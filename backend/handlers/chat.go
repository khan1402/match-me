package handlers

import (
	"log"
	"net/http"
	"strconv"

	"backend/db"
	"backend/models"

	"github.com/gin-gonic/gin"
)

// GetMessages returns messages for a match
func GetMessages(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	currentUser := user.(*models.User)

	matchID, err := strconv.Atoi(c.Param("matchId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid match ID"})
		return
	}

	// Security check: ensure user is part of the match
	match, err := db.GetMatchByID(matchID)
	if err != nil || (match.UserID1 != currentUser.ID && match.UserID2 != currentUser.ID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	messages, err := db.GetMessagesForMatch(matchID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get messages"})
		return
	}

	// Mark messages as read (best-effort)
	_ = db.MarkMessagesAsRead(matchID, currentUser.ID)

	c.JSON(http.StatusOK, gin.H{
		"messages": messages,
	})
}

// SendMessageRequest represents a request to send a message
// NOTE: receiverId is not needed anymore because DB computes receiver_id from match + sender
type SendMessageRequest struct {
	Content string `json:"content" binding:"required"`
}

// SendMessage sends a chat message (REST).
// Real-time delivery is handled by Socket.IO handlers (socketio_handlers.go).
func SendMessage(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	currentUser := user.(*models.User)

	matchID, err := strconv.Atoi(c.Param("matchId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid match ID"})
		return
	}

	// Security check: ensure user is part of the match
	match, err := db.GetMatchByID(matchID)
	if err != nil || (match.UserID1 != currentUser.ID && match.UserID2 != currentUser.ID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	var req SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Compute receiver ID based on match and current user
	var receiverID int
	if match.UserID1 == currentUser.ID {
		receiverID = match.UserID2
	} else {
		receiverID = match.UserID1
	}

	// Create message
	msg, err := db.CreateMessage(matchID, currentUser.ID, receiverID, req.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send message"})
		return
	}

	// Emit WebSocket event for real-time delivery
	wsManager := GetWebSocketManager()
	if wsManager != nil {
		log.Printf("[SendMessage] Broadcasting message:new to users %d and %d, messageID=%d", match.UserID1, match.UserID2, msg.ID)
		wsManager.SendToUsers(
			[]int{match.UserID1, match.UserID2},
			"message:new",
			msg,
		)
	} else {
		log.Printf("[SendMessage] WebSocket manager is nil, cannot broadcast message")
	}

	c.JSON(http.StatusOK, msg)
}

// MarkAsRead marks messages as read
func MarkAsRead(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	currentUser := user.(*models.User)

	matchID, err := strconv.Atoi(c.Param("matchId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid match ID"})
		return
	}

	// Security check: ensure user is part of the match
	match, err := db.GetMatchByID(matchID)
	if err != nil || (match.UserID1 != currentUser.ID && match.UserID2 != currentUser.ID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	err = db.MarkMessagesAsRead(matchID, currentUser.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark messages as read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// TypingRequest represents a typing notification request
// NOTE: Typing in your app is Socket.IO-based ("typing" event).
// We keep this REST endpoint only to avoid breaking existing routes, but it does not emit real-time events.
type TypingRequest struct {
	ReceiverID int  `json:"receiverId"`
	IsTyping   bool `json:"isTyping"`
}

// Typing endpoint - sends typing indicator via WebSocket
func Typing(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	currentUser := user.(*models.User)

	matchID, err := strconv.Atoi(c.Param("matchId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid match ID"})
		return
	}

	// Security check: ensure user is part of the match
	match, err := db.GetMatchByID(matchID)
	if err != nil || (match.UserID1 != currentUser.ID && match.UserID2 != currentUser.ID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	var req TypingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Determine receiver ID
	var receiverID int
	if match.UserID1 == currentUser.ID {
		receiverID = match.UserID2
	} else {
		receiverID = match.UserID1
	}

	// Send typing indicator via WebSocket
	wsManager := GetWebSocketManager()
	if wsManager != nil {
		if req.IsTyping {
			log.Printf("[Typing] Sending typing:start from user %d to user %d for match %d", currentUser.ID, receiverID, matchID)
			wsManager.SendToUser(
				receiverID,
				"typing:start",
				map[string]interface{}{
					"matchId":    matchID,
					"fromUserId": currentUser.ID,
				},
			)
		} else {
			// Send typing:stop event when user stops typing
			log.Printf("[Typing] Sending typing:stop from user %d to user %d for match %d", currentUser.ID, receiverID, matchID)
			wsManager.SendToUser(
				receiverID,
				"typing:stop",
				map[string]interface{}{
					"matchId":    matchID,
					"fromUserId": currentUser.ID,
				},
			)
		}
	} else {
		log.Printf("[Typing] WebSocket manager is nil, cannot send typing indicator")
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
