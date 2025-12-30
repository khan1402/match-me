package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"backend/db"
	"backend/models"
)

func GetMyLikes(c *gin.Context) {
	userAny, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	user, ok := userAny.(*models.User)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	items, err := db.GetMyLikes(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load likes"})
		return
	}

	// ✅ Ensure empty array instead of null
	resp := gin.H{"likes": items}
	if items == nil {
		resp["likes"] = []any{}
	}

	c.JSON(http.StatusOK, resp)
}

func GetConnectionRequests(c *gin.Context) {
	userAny, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	user, ok := userAny.(*models.User)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	items, err := db.GetIncomingRequests(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load requests"})
		return
	}

	// ✅ Ensure empty array instead of null
	resp := gin.H{"requests": items}
	if items == nil {
		resp["requests"] = []any{}
	}

	c.JSON(http.StatusOK, resp)
}

func GetMyMatches(c *gin.Context) {
	userAny, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	user, ok := userAny.(*models.User)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	items, err := db.GetMyMatches(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load matches"})
		return
	}

	// ✅ Ensure empty array instead of null
	resp := gin.H{"matches": items}
	if items == nil {
		resp["matches"] = []any{}
	}

	c.JSON(http.StatusOK, resp)
}
