package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"backend/db"
)

func GetUserDiscoveryBio(c *gin.Context) {
	idStr := c.Param("id")
	userID, err := strconv.Atoi(idStr)
	if err != nil || userID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	// 1) Basic user
	user, err := db.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// 2) Profile (discovery uses profile data)
	profile, err := db.GetProfileByUserID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "profile not found"})
		return
	}

	// 3) Interests
	interests, _ := db.GetUserInterests(userID)

	// 4) Prompts
	prompts, _ := db.GetUserPrompts(userID)

	// 5) Photos (optional)
	photos, _ := db.GetUserPhotos(userID)

	// Return a single object the frontend can use for the discovery card.
	c.JSON(http.StatusOK, gin.H{
		"user":      user,
		"profile":   profile,
		"interests": interests,
		"prompts":   prompts,
		"photos":    photos,
	})
}
