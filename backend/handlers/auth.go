package handlers

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"

	"backend/db"
	"backend/models"
	"backend/utils"
	"github.com/gin-gonic/gin"
)

// RegisterRequest represents a registration request
type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Name     string `json:"name"`
}

// LoginRequest represents a login request
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// Register handles user registration
func Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email and password required"})
		return
	}

	// ✅ use existing db function
	user, err := db.CreateUser(req.Email, req.Password, req.Name)
	if err != nil {
		// Check if it's a duplicate email error
		if err.Error() == "email already in use" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "email already in use"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Always create profile for user (required for app to work)
	_, err = db.CreateProfile(user.ID)
	if err != nil {
		// If profile creation fails, this is a critical error
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create profile"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"userId":  user.ID,
	})
}

// Login handles user login
func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email and password required"})
		return
	}

	// ✅ use existing db function
	user, err := db.CheckUserPassword(req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	// ✅ use existing utils function
	token, err := utils.GenerateToken(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// ✅ IMPORTANT: make cookie persist in browser for localhost dev
	// - SameSiteLax works well for localhost and typical SPA navigation
	// - domain MUST be empty for a host-only cookie (works reliably across browsers)
	// - secure MUST be false on http://localhost
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(
		"auth_token",
		token,
		7*24*60*60, // 7 days
		"/",
		"",    // ✅ FIX: host-only cookie (do NOT set "localhost")
		false, // secure
		true,  // httpOnly
	)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"userId":  user.ID,
	})
}

// Logout handles user logout
func Logout(c *gin.Context) {
	// Get current user from context (set by AuthMiddleware)
	userAny, exists := c.Get("user")
	if exists {
		if currentUser, ok := userAny.(*models.User); ok {
			// Close all WebSocket connections for this user
			wsManager := GetWebSocketManager()
			if wsManager != nil {
				userID := currentUser.ID
				log.Printf("[Logout] Closing all WebSocket connections for user %d", userID)
				wsManager.UnregisterAll(userID)
				// Broadcast offline status to all other users
				wsManager.BroadcastToAllExcept(userID, "presence:update", map[string]interface{}{
					"userId": userID,
					"online": false,
				})
				log.Printf("[Logout] Broadcasted offline status for user %d", userID)
			}
		}
	}

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("auth_token", "", -1, "/", "", false, true) // ✅ FIX: host-only cookie
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// DeleteAccount handles account deletion
func DeleteAccount(c *gin.Context) {
	log.Println("[DELETE ME] handler hit")
	// Get current user from context (set by AuthMiddleware)
	userAny, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	currentUser, ok := userAny.(*models.User)
	if !ok || currentUser == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID := currentUser.ID
	log.Printf("[DeleteAccount] Deleting account for user %d", userID)

	// Close all WebSocket connections for this user (before deletion)
	wsManager := GetWebSocketManager()
	if wsManager != nil {
		log.Printf("[DeleteAccount] Closing all WebSocket connections for user %d", userID)
		wsManager.UnregisterAll(userID)
		// Broadcast offline status to all other users
		wsManager.BroadcastToAllExcept(userID, "presence:update", map[string]interface{}{
			"userId": userID,
			"online": false,
		})
		log.Printf("[DeleteAccount] Broadcasted offline status for user %d", userID)
	}

	// Delete the user and all associated data
	err := db.DeleteUser(userID)
	if err != nil {
		log.Printf("[DeleteAccount] ERROR deleting user %d: %v", userID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to delete account: %v", err)})
		return
	}

	log.Printf("[DeleteAccount] ✅ Successfully deleted account for user %d", userID)
	
	// Double-check: verify user no longer exists
	_, checkErr := db.GetUserByID(userID)
	if checkErr == nil {
		log.Printf("[DeleteAccount] ⚠️ WARNING: User %d still exists after deletion!", userID)
	} else {
		log.Printf("[DeleteAccount] ✅ Verified: User %d no longer exists in database", userID)
	}

	// Clear the auth cookie
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("auth_token", "", -1, "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Account deleted successfully"})
}

// GetMe returns the authenticated user's info
func GetMe(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	currentUser := user.(*models.User)
	profile, err := db.GetProfileByUserID(currentUser.ID)
	if err != nil {
		// Profile missing means user needs onboarding
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusOK, gin.H{
				"id":              currentUser.ID,
				"email":           currentUser.Email,
				"name":            currentUser.Name,
				"profilePicture":  "",
				"hasProfile":      false,
				"needsOnboarding": true,
			})
			return
		}
		// Other errors are real problems
		fmt.Printf("[GetMe] Error fetching profile for userID %d: %v\n", currentUser.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get profile"})
		return
	}

	photos, err := db.GetUserPhotos(currentUser.ID)
	if err != nil {
		photos = []*models.Photo{}
	}

	profilePicture := ""
	if len(photos) > 0 {
		profilePicture = photos[0].PhotoUrl
	}

	name := currentUser.Name
	if name == "" && profile != nil && profile.FirstName.Valid {
		name = profile.FirstName.String
	}
	if name == "" {
		name = "Anonymous"
	}

	c.JSON(http.StatusOK, gin.H{
		"id":             currentUser.ID,
		"email":          currentUser.Email,
		"name":           name,
		"profilePicture": profilePicture,
		"hasProfile":     profile != nil && profile.IsProfileComplete,
		"needsOnboarding": false,
	})
}

// GetMyProfile returns the authenticated user's profile
func GetMyProfile(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	currentUser := user.(*models.User)
	profile, err := db.GetProfileByUserID(currentUser.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Profile not found"})
		return
	}

	resp := models.ProfileResponse{
		ID:                profile.ID,
		FirstName:         profile.FirstName.String,
		Age:               int(profile.Age.Int32),
		Gender:            profile.Gender.String,
		LookingFor:        profile.LookingFor.String,
		Location:          profile.Location.String,
		Bio:               profile.Bio.String,
		IsVerified:        profile.IsVerified,
		ProfilePhotoUrl:   profile.ProfilePhotoUrl.String,
		Latitude:          profile.Latitude.Float64,
		Longitude:         profile.Longitude.Float64,
		MaxDistanceKm:     profile.MaxDistanceKm,
		AllowOutsideRadius: profile.AllowOutsideRadius,
	}

	// Include minAge/maxAge only if set
	if profile.MinAge.Valid {
		minAge := int(profile.MinAge.Int32)
		resp.MinAge = &minAge
	}
	if profile.MaxAge.Valid {
		maxAge := int(profile.MaxAge.Int32)
		resp.MaxAge = &maxAge
	}

	c.JSON(http.StatusOK, resp)
}

// GetMyBio returns the authenticated user's biographical data
func GetMyBio(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	currentUser := user.(*models.User)
	profile, err := db.GetProfileByUserID(currentUser.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Profile not found"})
		return
	}

	interests, err := db.GetUserInterests(currentUser.ID)
	if err != nil {
		interests = []*models.UserInterest{}
	}

	prompts, err := db.GetUserPrompts(currentUser.ID)
	if err != nil {
		prompts = []*models.UserPrompt{}
	}

	interestNames := []string{}
	for _, interest := range interests {
		interestNames = append(interestNames, interest.InterestName)
	}

	promptPairs := []models.PromptAnswerPair{}
	for _, prompt := range prompts {
		promptPairs = append(promptPairs, models.PromptAnswerPair{
			Question: prompt.PromptText,
			Answer:   prompt.Answer,
		})
	}

	resp := models.BioResponse{
		ID:         currentUser.ID,
		Gender:     profile.Gender.String,
		LookingFor: profile.LookingFor.String,
		Age:        int(profile.Age.Int32),
		Location:   profile.Location.String,
		Interests:  interestNames,
		Prompts:    promptPairs,
	}

	c.JSON(http.StatusOK, resp)
}
