package socket

import (
	"sync"

	socketio "github.com/googollee/go-socket.io"
)

// Manager manages Socket.IO connections per user
type Manager struct {
	server *socketio.Server

	mu    sync.RWMutex
	users map[int]map[string]socketio.Conn // userID -> socketID -> Conn
}

// NewManager creates a new Socket.IO manager
func NewManager(server *socketio.Server) *Manager {
	return &Manager{
		server: server,
		users:  make(map[int]map[string]socketio.Conn),
	}
}

// Register registers a socket connection for a user
func (m *Manager) Register(userID int, conn socketio.Conn) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.users[userID]; !ok {
		m.users[userID] = make(map[string]socketio.Conn)
	}

	m.users[userID][conn.ID()] = conn
}

// Unregister removes a socket connection for a user
func (m *Manager) Unregister(userID int, conn socketio.Conn) {
	m.mu.Lock()
	defer m.mu.Unlock()

	conns, ok := m.users[userID]
	if !ok {
		return
	}

	delete(conns, conn.ID())

	if len(conns) == 0 {
		delete(m.users, userID)
	}
}

// EmitToUser emits an event to all active sockets of a user
func (m *Manager) EmitToUser(userID int, event string, payload interface{}) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	conns, ok := m.users[userID]
	if !ok {
		return
	}

	for _, conn := range conns {
		conn.Emit(event, payload)
	}
}

// EmitToUsers emits an event to multiple users
func (m *Manager) EmitToUsers(userIDs []int, event string, payload interface{}) {
	for _, userID := range userIDs {
		m.EmitToUser(userID, event, payload)
	}
}
