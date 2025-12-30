package handlers

import (
	"log"
	"net/http"

	"backend/db"
	"backend/socket"
	"backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var wsManager *socket.WebSocketManager

// SetWebSocketManager sets the WebSocket manager for use by handlers
func SetWebSocketManager(manager *socket.WebSocketManager) {
	wsManager = manager
}

// GetWebSocketManager returns the WebSocket manager
func GetWebSocketManager() *socket.WebSocketManager {
	return wsManager
}

// HandleWebSocket handles WebSocket connections
func HandleWebSocket(c *gin.Context) {
	if wsManager == nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	// Get auth token from cookie or query parameter
	var token string
	cookie, err := c.Cookie("auth_token")
	if err == nil {
		token = cookie
	} else {
		// Fallback to query parameter for cross-origin WebSocket connections
		token = c.Query("token")
		if token == "" {
			log.Println("[WebSocket] auth_token cookie NOT found and no token query param")
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
	}

	// Verify token
	claims, err := utils.VerifyToken(token)
	if err != nil {
		log.Println("[WebSocket] token verification FAILED")
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	// Get user
	user, err := db.GetUserByID(claims.UserID)
	if err != nil {
		log.Println("[WebSocket] user NOT found")
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	log.Printf("[WebSocket] Connection attempt from user %d", user.ID)

	// Upgrade connection to WebSocket
	conn, err := wsManager.GetUpgrader().Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[WebSocket] Upgrade failed: %v", err)
		return
	}

	// Get list of currently connected users BEFORE registering the new user
	// This gives us the list of users who were already online
	currentlyOnline := wsManager.GetAllConnectedUserIDs()
	log.Printf("[WebSocket] Users already online before registration: %v", currentlyOnline)
	
	// Register connection (adds new user to the connections map)
	wsManager.Register(user.ID, conn)
	log.Printf("[WebSocket] Successfully registered connection for user %d", user.ID)
	
	// Send initial presence sync to the newly connected user
	// This tells them who is currently online (users who were online BEFORE they connected)
	for _, onlineUserId := range currentlyOnline {
		log.Printf("[WebSocket] Sending initial presence:update to new user %d: userId=%d online=true", user.ID, onlineUserId)
		wsManager.SendToUser(user.ID, "presence:update", map[string]interface{}{
			"userId": onlineUserId,
			"online": true,
		})
	}
	
	// Broadcast presence update for this user coming online
	// Send to all OTHER connected users (users who were already connected)
	log.Printf("[WebSocket] Broadcasting presence:update for user %d coming online to %d other users", user.ID, len(currentlyOnline))
	wsManager.BroadcastToAllExcept(user.ID, "presence:update", map[string]interface{}{
		"userId": user.ID,
		"online": true,
	})

	// Keep connection alive and handle incoming messages
	go func() {
		defer func() {
			log.Printf("[WebSocket] Connection closed for user %d, unregistering (reason: connection closed)", user.ID)
			// Unregister returns true if this was the last connection for the user
			isLastConnection := wsManager.Unregister(user.ID, conn)
			if isLastConnection {
				// Only broadcast offline if this was the last connection (user has no more tabs/devices connected)
				log.Printf("[WebSocket] Last connection closed for user %d, broadcasting offline status", user.ID)
				wsManager.BroadcastToAllExcept(user.ID, "presence:update", map[string]interface{}{
					"userId": user.ID,
					"online": false,
				})
			} else {
				log.Printf("[WebSocket] User %d still has other connections open, not broadcasting offline", user.ID)
			}
		}()

		for {
			var msg map[string]interface{}
			err := conn.ReadJSON(&msg)
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("[WebSocket] Error reading message from user %d: %v (reason: read error)", user.ID, err)
				} else {
					log.Printf("[WebSocket] Connection closed for user %d (reason: read error: %v)", user.ID, err)
				}
				break
			}

			// Handle incoming messages (typing events, etc.)
			// For now, we just log them
			log.Printf("[WebSocket] Received message from user %d: %v", user.ID, msg)
		}
	}()
}

