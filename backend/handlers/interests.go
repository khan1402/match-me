package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"backend/db"
)

func GetInterests(c *gin.Context) {
	interests, err := db.GetAllInterests()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load interests"})
		return
	}

	// frontend expects: { interests: [...] }
	c.JSON(http.StatusOK, gin.H{"interests": interests})
}
