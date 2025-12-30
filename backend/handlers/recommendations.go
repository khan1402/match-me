package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"backend/db"
	"backend/models"
)

// GetRecommendations returns a list of recommended user IDs
func GetRecommendations(c *gin.Context) {
    userAny, exists := c.Get("user")
    if !exists {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
        return
    }

    currentUser := userAny.(*models.User)

    recommendedIDs, err := db.GetRecommendations(currentUser.ID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get recommendations"})
        return
    }

    c.JSON(http.StatusOK, recommendedIDs)
}

// InteractionRequest represents a request to interact with a user
type InteractionRequest struct {
	TargetUserID int    `json:"targetUserId" binding:"required"`
	Type         string `json:"type" binding:"required,oneof=like pass"`
}

// CreateInteraction handles creating an interaction (like/pass)
func CreateInteraction(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	currentUser := user.(*models.User)

	var req InteractionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	err := db.CreateInteraction(currentUser.ID, req.TargetUserID, req.Type)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create interaction"})
		return
	}

	// Check for a new match
	if req.Type == "like" {
		otherUserInteraction, err := db.GetInteractionType(req.TargetUserID, currentUser.ID)
		if err == nil && otherUserInteraction == "like" {
			_ = db.CreateMatch(currentUser.ID, req.TargetUserID)
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GetConnections returns a list of connected user IDs
func GetConnections(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	currentUser := user.(*models.User)

	connections, err := db.GetConnections(currentUser.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get connections"})
		return
	}

	c.JSON(http.StatusOK, connections)
}
