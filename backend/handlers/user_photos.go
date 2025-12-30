package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"backend/db"
)

func GetUserPhotos(c *gin.Context) {
	idStr := c.Param("id")
	userID, err := strconv.Atoi(idStr)
	if err != nil || userID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	photos, err := db.GetUserPhotos(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load photos"})
		return
	}

	c.JSON(http.StatusOK, photos)
}
