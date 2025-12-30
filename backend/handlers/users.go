package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"backend/db"
	"backend/models"
)

// GetUser returns user's name and profile picture
func GetUser(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	currentUser := user.(*models.User)

	// Check permission
	canView, err := db.CanViewDetailedProfile(currentUser.ID, userID)
	if err != nil || !canView {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	targetUser, err := db.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	profile, err := db.GetProfileByUserID(userID)
	if err != nil {
    c.JSON(http.StatusNotFound, gin.H{"error": "Profile not found"})
    return
	}

	photos, err := db.GetUserPhotos(userID)
	if err != nil {
    photos = []*models.Photo{}
	}

	name := targetUser.Name
	if name == "" && profile != nil && profile.FirstName.Valid {
		name = profile.FirstName.String
	}
	if name == "" {
		name = "Anonymous"
	}

	profilePicture := ""
	if len(photos) > 0 {
		profilePicture = photos[0].PhotoUrl
	}

	resp := models.UserResponse{
		ID:             userID,
		Name:           name,
		ProfilePicture: profilePicture,
	}

	c.JSON(http.StatusOK, resp)
}

// GetUserProfile returns user's profile information
func GetUserProfile(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Profile not found"})
		return
	}

	currentUser := user.(*models.User)

	// Check permission
	canView, err := db.CanViewDetailedProfile(currentUser.ID, userID)
	if err != nil || !canView {
		c.JSON(http.StatusNotFound, gin.H{"error": "Profile not found"})
		return
	}

	profile, err := db.GetProfileByUserID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Profile not found"})
		return
	}

	resp := models.ProfileResponse{
		ID:              profile.ID,
		FirstName:       profile.FirstName.String,
		Age:             int(profile.Age.Int32),
		Gender:          profile.Gender.String,
		LookingFor:      profile.LookingFor.String,
		Location:        profile.Location.String,
		Bio:             profile.Bio.String,
		IsVerified:      profile.IsVerified,
		ProfilePhotoUrl: profile.ProfilePhotoUrl.String,
		Latitude:        profile.Latitude.Float64,
		Longitude:       profile.Longitude.Float64,
		MaxDistanceKm:   profile.MaxDistanceKm,
	}

	c.JSON(http.StatusOK, resp)
}

// GetUserBio returns user's biographical data
func GetUserBio(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Profile not found"})
		return
	}

	currentUser := user.(*models.User)

	// Check permission
	canView, err := db.CanViewDetailedProfile(currentUser.ID, userID)
	if err != nil || !canView {
		c.JSON(http.StatusNotFound, gin.H{"error": "Profile not found"})
		return
	}

	profile, err := db.GetProfileByUserID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Profile not found"})
		return
	}

	interests, err := db.GetUserInterests(userID)
	if err != nil {
		interests = []*models.UserInterest{}
	}

	prompts, err := db.GetUserPrompts(userID)
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
		ID:        userID,
		Gender:    profile.Gender.String,
		LookingFor: profile.LookingFor.String,
		Age:       int(profile.Age.Int32),
		Location:  profile.Location.String,
		Interests: interestNames,
		Prompts:   promptPairs,
	}

	c.JSON(http.StatusOK, resp)
}

// GetUserDiscovery returns full profile for discovery feed
func GetUserDiscovery(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Profile not found"})
		return
	}

	currentUser := user.(*models.User)

	// Check permission
	canView, err := db.CanViewDetailedProfile(currentUser.ID, userID)
	if err != nil || !canView {
		c.JSON(http.StatusNotFound, gin.H{"error": "Profile not found"})
		return
	}

	targetUser, err := db.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Profile not found"})
		return
	}

	profile, err := db.GetProfileByUserID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Profile not found"})
		return
	}

	interests, err := db.GetUserInterests(userID)
	if err != nil {
		interests = []*models.UserInterest{}
	}

	prompts, err := db.GetUserPrompts(userID)
	if err != nil {
		prompts = []*models.UserPrompt{}
	}

	photos, err := db.GetUserPhotos(userID)
	if err != nil {
		photos = []*models.Photo{}
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

	name := targetUser.Name
	if name == "" && profile.FirstName.Valid {
		name = profile.FirstName.String
	}
	if name == "" {
		name = "Anonymous"
	}

	profilePicture := ""
	if len(photos) > 0 {
		profilePicture = photos[0].PhotoUrl
	}

	resp := models.DiscoveryResponse{
		ID:             userID,
		Gender:         profile.Gender.String,
		LookingFor:     profile.LookingFor.String,
		Age:            int(profile.Age.Int32),
		Location:       profile.Location.String,
		Interests:      interestNames,
		Prompts:        promptPairs,
		Name:           name,
		ProfilePicture: profilePicture,
	}

	c.JSON(http.StatusOK, resp)
}
