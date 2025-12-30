package socket

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// Heartbeat interval - server sends ping every 30 seconds
	heartbeatInterval = 30 * time.Second
	// Pong wait timeout - if no pong received within 60 seconds, connection is stale
	pongWait = 60 * time.Second
	// Ping timeout for write
	pingPeriod = (pongWait * 9) / 10
)

// ConnectionInfo stores connection and metadata
type ConnectionInfo struct {
	Conn      *websocket.Conn
	LastSeen  time.Time
	CloseChan chan struct{}
}

// WebSocketManager manages native WebSocket connections
type WebSocketManager struct {
	// Map userID -> []*ConnectionInfo (multiple connections per user for tabs/devices)
	connections map[int][]*ConnectionInfo
	mu          sync.RWMutex

	upgrader websocket.Upgrader
}

// NewWebSocketManager creates a new WebSocket manager
func NewWebSocketManager() *WebSocketManager {
	return &WebSocketManager{
		connections: make(map[int][]*ConnectionInfo),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				// DEV ONLY: allow cross-origin websocket upgrade from frontend
				// In prod, restrict this.
				return true
			},
		},
	}
}

// GetUpgrader returns a pointer to the websocket upgrader
func (m *WebSocketManager) GetUpgrader() *websocket.Upgrader {
	return &m.upgrader
}

// Register registers a WebSocket connection for a user
// Supports multiple connections per user (tabs/devices)
func (m *WebSocketManager) Register(userID int, conn *websocket.Conn) {
	m.mu.Lock()
	defer m.mu.Unlock()

	closeChan := make(chan struct{})
	connInfo := &ConnectionInfo{
		Conn:      conn,
		LastSeen:  time.Now(),
		CloseChan: closeChan,
	}

	// Set read deadline for pong
	conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.SetPongHandler(func(string) error {
		m.mu.Lock()
		defer m.mu.Unlock()
		// Update last seen on pong
		if conns, ok := m.connections[userID]; ok {
			for _, c := range conns {
				if c.Conn == conn {
					c.LastSeen = time.Now()
					conn.SetReadDeadline(time.Now().Add(pongWait))
					break
				}
			}
		}
		return nil
	})

	// Add connection to user's connection list
	m.connections[userID] = append(m.connections[userID], connInfo)
	log.Printf("[WebSocket] Register: Added connection for user %d (total connections for user: %d, total users: %d)", userID, len(m.connections[userID]), len(m.connections))

	// Start heartbeat goroutine for this connection
	go m.heartbeat(userID, conn, closeChan)
}

// Unregister removes a WebSocket connection for a user
// Returns true if this was the last connection for the user (so we can broadcast offline)
func (m *WebSocketManager) Unregister(userID int, conn *websocket.Conn) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	conns, ok := m.connections[userID]
	if !ok {
		return false
	}

	// Find and remove the specific connection
	for i, c := range conns {
		if c.Conn == conn {
			// Close the connection
			c.Conn.Close()
			// Signal heartbeat goroutine to stop
			close(c.CloseChan)
			// Remove from slice
			m.connections[userID] = append(conns[:i], conns[i+1:]...)
			log.Printf("[WebSocket] Unregister: Removed connection for user %d (remaining connections: %d)", userID, len(m.connections[userID]))

			// If no connections left, remove user from map
			if len(m.connections[userID]) == 0 {
				delete(m.connections, userID)
				log.Printf("[WebSocket] Unregister: User %d has no more connections", userID)
				return true // Last connection removed
			}
			return false // Still has other connections
		}
	}

	return false
}

// UnregisterAll removes ALL connections for a user (e.g., on logout)
func (m *WebSocketManager) UnregisterAll(userID int) {
	m.mu.Lock()
	defer m.mu.Unlock()

	conns, ok := m.connections[userID]
	if !ok {
		return
	}

	// Close all connections and signal heartbeat goroutines
	for _, c := range conns {
		c.Conn.Close()
		close(c.CloseChan)
	}

	delete(m.connections, userID)
	log.Printf("[WebSocket] UnregisterAll: Removed all connections for user %d", userID)
}

// heartbeat sends periodic ping messages to keep connection alive and detect stale connections
func (m *WebSocketManager) heartbeat(userID int, conn *websocket.Conn, closeChan chan struct{}) {
	ticker := time.NewTicker(pingPeriod)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Send ping
			if err := conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(10*time.Second)); err != nil {
				log.Printf("[WebSocket] Heartbeat: Failed to send ping to user %d: %v (connection is dead)", userID, err)
				// Connection is dead, close it to trigger read loop cleanup
				// The handler's defer will call Unregister and broadcast offline if it was the last connection
				conn.Close()
				return
			}
		case <-closeChan:
			// Connection was explicitly closed
			return
		}
	}
}

// SendToUser sends a message to a specific user's WebSocket connection(s)
// Sends to all connections for that user (all tabs/devices)
func (m *WebSocketManager) SendToUser(userID int, eventType string, payload interface{}) error {
	m.mu.RLock()
	conns, ok := m.connections[userID]
	if !ok {
		m.mu.RUnlock()
		log.Printf("[WebSocket] SendToUser: User %d not connected (eventType: %s)", userID, eventType)
		return nil // User not connected, silently ignore
	}
	// Create a copy of the slice to avoid holding lock during writes
	connsCopy := make([]*ConnectionInfo, len(conns))
	copy(connsCopy, conns)
	m.mu.RUnlock()

	message := map[string]interface{}{
		"type":    eventType,
		"payload": payload,
	}

	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("[WebSocket] SendToUser: JSON marshal error for user %d: %v", userID, err)
		return err
	}

	log.Printf("[WebSocket] SendToUser: Sending eventType=%s to userID=%d (to %d connection(s)), payload=%+v", eventType, userID, len(connsCopy), payload)

	// Send to all connections for this user
	var lastErr error
	for _, connInfo := range connsCopy {
		err := connInfo.Conn.WriteMessage(websocket.TextMessage, data)
		if err != nil {
			log.Printf("[WebSocket] SendToUser: Error sending message to user %d connection: %v", userID, err)
			lastErr = err
			// Connection might be closed, remove it (but don't hold lock while calling)
			// Note: We can't broadcast offline here because we're in SendToUser and don't know if it's the last connection
			// The heartbeat or read loop will handle proper cleanup and offline broadcast
			go func(conn *websocket.Conn) {
				m.Unregister(userID, conn)
			}(connInfo.Conn)
		}
	}

	if lastErr != nil {
		return lastErr
	}

	log.Printf("[WebSocket] SendToUser: Successfully sent eventType=%s to userID=%d", eventType, userID)
	return nil
}

// SendToUsers sends a message to multiple users
func (m *WebSocketManager) SendToUsers(userIDs []int, eventType string, payload interface{}) {
	for _, userID := range userIDs {
		m.SendToUser(userID, eventType, payload)
	}
	log.Printf("[WebSocket] SendToUsers: Completed sending eventType=%s to %d users", eventType, len(userIDs))
}

// BroadcastToAll sends a message to all connected users
func (m *WebSocketManager) BroadcastToAll(eventType string, payload interface{}) {
	m.mu.RLock()
	userIDs := make([]int, 0, len(m.connections))
	for userID := range m.connections {
		userIDs = append(userIDs, userID)
	}
	m.mu.RUnlock()

	log.Printf("[WebSocket] BroadcastToAll: Sending eventType=%s to %d users: %v", eventType, len(userIDs), userIDs)
	// Send to all users
	m.SendToUsers(userIDs, eventType, payload)
}

// BroadcastToAllExcept sends a message to all connected users except the specified user
func (m *WebSocketManager) BroadcastToAllExcept(excludeUserID int, eventType string, payload interface{}) {
	m.mu.RLock()
	userIDs := make([]int, 0, len(m.connections))
	for userID := range m.connections {
		if userID != excludeUserID {
			userIDs = append(userIDs, userID)
		}
	}
	m.mu.RUnlock()

	log.Printf("[WebSocket] BroadcastToAllExcept: Sending eventType=%s to %d users (excluding %d): %v", eventType, len(userIDs), excludeUserID, userIDs)
	// Send to all users except the excluded one
	m.SendToUsers(userIDs, eventType, payload)
}

// GetAllConnectedUserIDs returns a list of all connected user IDs (users with at least one connection)
func (m *WebSocketManager) GetAllConnectedUserIDs() []int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	userIDs := make([]int, 0, len(m.connections))
	for userID := range m.connections {
		userIDs = append(userIDs, userID)
	}
	return userIDs
}

// IsConnected checks if a user has at least one active WebSocket connection
func (m *WebSocketManager) IsConnected(userID int) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	conns, ok := m.connections[userID]
	return ok && len(conns) > 0
}
