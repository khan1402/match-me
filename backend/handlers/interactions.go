package handlers

import (
	"net/http"
	"strconv"

	"backend/db"
	"backend/models"
	"github.com/gin-gonic/gin"
)

func LikeUser(c *gin.Context) {
	userAny, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	currentUser := userAny.(*models.User)

	targetIDStr := c.Param("userId")
	targetID, err := strconv.Atoi(targetIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	// Create like interaction
	if err := db.CreateInteraction(currentUser.ID, targetID, "like"); err != nil {
		// unique constraint = already liked → treat as OK
		c.JSON(http.StatusOK, gin.H{"success": true})
		return
	}

	// Check if the other user already liked me → create match
	otherType, err := db.GetInteractionType(targetID, currentUser.ID)
	if err == nil && otherType == "like" {
		_ = db.CreateMatch(currentUser.ID, targetID)
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func PassUser(c *gin.Context) {
	userAny, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	currentUser := userAny.(*models.User)

	targetIDStr := c.Param("userId")
	targetID, err := strconv.Atoi(targetIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	// Create pass interaction (idempotent because DB has unique (user_id,target_user_id))
	if err := db.CreateInteraction(currentUser.ID, targetID, "pass"); err != nil {
		// already exists → treat as OK
		c.JSON(http.StatusOK, gin.H{"success": true})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func DisconnectUser(c *gin.Context) {
	userAny, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"} )
		return
	}
	currentUser := userAny.(*models.User)
	me := currentUser.ID

	matchID, err := strconv.Atoi(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"} )
		return
	}

	err = db.DeleteMatch(matchID, me)
	if err == db.ErrNotFound {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"} )
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"} )
		return
	}

	c.Status(http.StatusNoContent )
}
