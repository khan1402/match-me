package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Temporary stubs so the server compiles.
// Replace later with real logic.

func GetCurrentUser(c *gin.Context)           { c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"}) }
func UpdateCurrentUser(c *gin.Context)        { c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"}) }
func GetCurrentUserProfile(c *gin.Context)    { c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"}) }
func GetCurrentUserBio(c *gin.Context)        { c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"}) }
func UpdateCurrentUserBio(c *gin.Context)     { c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"}) }
func DismissUser(c *gin.Context) { c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"}) }
func SendConnectionRequest(c *gin.Context)   { c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"}) }

