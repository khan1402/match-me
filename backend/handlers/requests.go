package handlers

import (
	"net/http"
	"strconv"

	"backend/db"
	"backend/models"
	"github.com/gin-gonic/gin"
)

// POST /api/connections/:userId/accept
// (also works for /api/connection-requests/:userId/accept if you add alias route)
func AcceptConnectionRequest(c *gin.Context) {
	userAny, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	currentUser := userAny.(*models.User)
	me := currentUser.ID

	otherStr := c.Param("userId")
	other, err := strconv.Atoi(otherStr)
	if err != nil || other <= 0 || other == me {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid userId"})
		return
	}

	// Only accept if it's a real incoming like (other -> me)
	hasIncoming, err := db.HasLike(other, me)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to accept request"})
		return
	}
	if !hasIncoming {
		c.JSON(http.StatusNotFound, gin.H{"error": "request not found"})
		return
	}

	// Accept = I like them back (idempotent)
	if err := db.UpsertInteraction(me, other, "like"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to accept request"})
		return
	}

	// Create match (idempotent)
	matchID, err := db.CreateOrGetMatch(me, other)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create match"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"matched": true, "matchId": matchID})
}

// POST /api/connections/:userId/reject
// (also works for /api/connection-requests/:userId/reject if you add alias route)
func RejectConnectionRequest(c *gin.Context) {
	userAny, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	currentUser := userAny.(*models.User)
	me := currentUser.ID

	otherStr := c.Param("userId")
	other, err := strconv.Atoi(otherStr)
	if err != nil || other <= 0 || other == me {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid userId"})
		return
	}

	// Reject = mark as pass so request disappears (idempotent)
	if err := db.UpsertInteraction(me, other, "pass"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reject request"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}
