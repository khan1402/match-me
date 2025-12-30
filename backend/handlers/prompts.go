package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"backend/db"
)

func GetPrompts(c *gin.Context) {
	prompts, err := db.GetAllPrompts()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load prompts"})
		return
	}

	// frontend expects: { prompts: [...] }
	c.JSON(http.StatusOK, gin.H{"prompts": prompts})
}
