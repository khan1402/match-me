package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"backend/db"
	"backend/models"
)

// POST /api/me/photos
// Accepts BOTH keys to be backward compatible:
// { "photoUrl": "..." }  OR  { "url": "..." }
func UploadProfilePhoto(c *gin.Context) {
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

	var req struct {
		PhotoUrl string `json:"photoUrl"`
		Url      string `json:"url"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}

	photoURL := req.PhotoUrl
	if photoURL == "" {
		photoURL = req.Url
	}
	if photoURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "photoUrl is required"})
		return
	}

	// next order = current count + 1
	existing, err := db.GetUserPhotos(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load existing photos"})
		return
	}
	order := len(existing) + 1

	photo, err := db.AddPhoto(user.ID, photoURL, order)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save photo"})
		return
	}

	// ✅ If this is the first photo, set it as the main profile photo too
	if order == 1 {
    _ = db.SetProfilePhotoURL(user.ID, photoURL)
	}

	c.JSON(http.StatusOK, photo)
}

// GET /api/me/photos
func GetMyPhotos(c *gin.Context) {
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

	photos, err := db.GetUserPhotos(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load photos"})
		return
	}

	c.JSON(http.StatusOK, photos)
}

// DELETE /api/me/photos/:id
func DeleteMyPhoto(c *gin.Context) {
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

	photoIDStr := c.Param("id")
	photoID, err := strconv.Atoi(photoIDStr)
	if err != nil || photoID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid photo id"})
		return
	}

	// Must delete within this user only
	if err := db.DeleteUserPhoto(user.ID, photoID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete photo"})
		return
	}

	c.Status(http.StatusNoContent)
}
