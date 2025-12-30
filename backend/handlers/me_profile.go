package handlers

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"backend/db"
	"backend/models"
)

func UpdateCurrentUserProfile(c *gin.Context) {
	// Same pattern as your other handlers: middleware puts *models.User in context
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

	// Use pointers so JSON null stays null (matches frontend)
	var req struct {
		FirstName         *string  `json:"firstName"`
		Age               *int     `json:"age"`
		Gender            *string  `json:"gender"`
		LookingFor        *string  `json:"lookingFor"`
		Location          *string  `json:"location"`
		Bio               *string  `json:"bio"`
		Latitude          *float64 `json:"latitude"`
		Longitude         *float64 `json:"longitude"`
		MaxDistanceKm     *int     `json:"maxDistanceKm"`
		AllowOutsideRadius *bool   `json:"allowOutsideRadius"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}

	// Load existing profile so we don't accidentally wipe fields like profile_photo_url
	profile, err := db.GetProfileByUserID(user.ID)
	if err != nil {
		// If profile doesn't exist, create a default one
		if errors.Is(err, sql.ErrNoRows) {
			fmt.Printf("[UpdateCurrentUserProfile] Profile missing for userID %d, creating default profile\n", user.ID)
			newProfile, createErr := db.CreateProfile(user.ID)
			if createErr != nil {
				fmt.Printf("[UpdateCurrentUserProfile] Failed to create profile for userID %d: %v\n", user.ID, createErr)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create profile"})
				return
			}
			profile = newProfile
		} else {
			fmt.Printf("[UpdateCurrentUserProfile] Error loading profile for userID %d: %v\n", user.ID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load profile"})
			return
		}
	}

	// Apply updates ONLY if provided
	if req.FirstName != nil {
		profile.FirstName = toNullString(*req.FirstName)
	}
	if req.Age != nil {
		profile.Age = toNullInt32(*req.Age)
	}
	if req.Gender != nil {
		profile.Gender = toNullString(*req.Gender)
	}
	if req.LookingFor != nil {
		profile.LookingFor = toNullString(*req.LookingFor)
	}
	if req.Location != nil {
		profile.Location = toNullString(*req.Location)
	}
	if req.Bio != nil {
		profile.Bio = toNullString(*req.Bio)
	}
	if req.Latitude != nil {
		profile.Latitude = toNullFloat64(*req.Latitude)
	}
	if req.Longitude != nil {
		profile.Longitude = toNullFloat64(*req.Longitude)
	}
	if req.MaxDistanceKm != nil {
		// NOTE: MaxDistanceKm in your model is an int (non-null), so set directly
		profile.MaxDistanceKm = *req.MaxDistanceKm
	}
	if req.AllowOutsideRadius != nil {
		profile.AllowOutsideRadius = *req.AllowOutsideRadius
	}

	// Mark complete if the required fields exist (frontend already forces photo before step 2)
	profile.IsProfileComplete =
		profile.FirstName.Valid && profile.FirstName.String != "" &&
		profile.Age.Valid && profile.Age.Int32 > 0 &&
		profile.Gender.Valid && profile.Gender.String != ""

	if err := db.UpdateProfile(user.ID, profile); err != nil {
		// Log the actual error for debugging
		fmt.Printf("[UpdateCurrentUserProfile] Error updating profile for userID %d: %v\n", user.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update profile"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func toNullString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: s, Valid: true}
}

func toNullInt32(i int) sql.NullInt32 {
	if i <= 0 {
		return sql.NullInt32{Valid: false}
	}
	return sql.NullInt32{Int32: int32(i), Valid: true}
}

func toNullFloat64(f float64) sql.NullFloat64 {
	// Treat 0.0 as invalid/not set for latitude/longitude
	// This prevents storing (0,0) coordinates which are in the Gulf of Guinea
	// and not real user locations. NULL coordinates indicate location is unknown.
	if f == 0 {
		return sql.NullFloat64{Valid: false}
	}
	return sql.NullFloat64{Float64: f, Valid: true}
}
