package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"backend/models"
)

// GetProfileByUserID retrieves a user's profile
func GetProfileByUserID(userID int) (*models.Profile, error) {
	profile := &models.Profile{}

	err := DB.QueryRowContext(
		context.Background(),
		`SELECT
			id,
			user_id,
			username,
			first_name,
			last_name,
			age,
			gender,
			looking_for,
			bio,
			location,
			latitude,
			longitude,
			max_distance_km,
			allow_outside_radius,
			profile_photo_url,
			is_profile_complete,
			is_verified,
			created_at,
			updated_at
		FROM profiles
		WHERE user_id = $1`,
		userID,
	).Scan(
		&profile.ID,
		&profile.UserID,
		&profile.Username,
		&profile.FirstName,
		&profile.LastName,
		&profile.Age,
		&profile.Gender,
		&profile.LookingFor,
		&profile.Bio,
		&profile.Location,
		&profile.Latitude,
		&profile.Longitude,
		&profile.MaxDistanceKm,
		&profile.AllowOutsideRadius,
		&profile.ProfilePhotoUrl,
		&profile.IsProfileComplete,
		&profile.IsVerified,
		&profile.CreatedAt,
		&profile.UpdatedAt,
	)

	if err != nil {
		// Preserve sql.ErrNoRows for proper handling in handlers
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sql.ErrNoRows
		}
		fmt.Printf("[GetProfileByUserID] SQL query/scan error for userID %d: %v\n", userID, err)
		return nil, err
	}

	return profile, nil
}

// CreateProfile creates a new user profile
func CreateProfile(userID int) (*models.Profile, error) {
	now := time.Now()
	profile := &models.Profile{
		UserID:             userID,
		MaxDistanceKm:      50,
		AllowOutsideRadius: false,
		IsProfileComplete:  false,
		IsVerified:         false,
		CreatedAt:          now,
		UpdatedAt:          now,
	}

	err := DB.QueryRowContext(
		context.Background(),
		`INSERT INTO profiles (
			user_id,
			max_distance_km,
			allow_outside_radius,
			is_profile_complete,
			is_verified,
			created_at,
			updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id`,
		userID, 50, false, false, false, now, now,
	).Scan(&profile.ID)

	if err != nil {
		return nil, fmt.Errorf("failed to create profile: %w", err)
	}

	return profile, nil
}

// UpdateProfile updates a user's profile
func UpdateProfile(userID int, profile *models.Profile) error {
	_, err := DB.ExecContext(
		context.Background(),
		`UPDATE profiles
		SET
			first_name = $1,
			last_name = $2,
			age = $3,
			gender = $4,
			looking_for = $5,
			bio = $6,
			location = $7,
			latitude = $8,
			longitude = $9,
			max_distance_km = $10,
			allow_outside_radius = $11,
			profile_photo_url = $12,
			is_profile_complete = $13,
			updated_at = NOW()
		WHERE user_id = $14`,
		profile.FirstName,
		profile.LastName,
		profile.Age,
		profile.Gender,
		profile.LookingFor,
		profile.Bio,
		profile.Location,
		profile.Latitude,
		profile.Longitude,
		profile.MaxDistanceKm,
		profile.AllowOutsideRadius,
		profile.ProfilePhotoUrl,
		profile.IsProfileComplete,
		userID,
	)
	if err != nil {
		fmt.Printf("[UpdateProfile] SQL UPDATE error for userID %d: %v\n", userID, err)
		return fmt.Errorf("failed to update profile: %w", err)
	}

	return nil
}

// GetUserPhotos retrieves all photos for a user
func GetUserPhotos(userID int) ([]*models.Photo, error) {
	rows, err := DB.QueryContext(
		context.Background(),
		`SELECT id, user_id, photo_url, sort_order, created_at
		FROM photos
		WHERE user_id = $1
		ORDER BY sort_order`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query photos: %w", err)
	}
	defer rows.Close()

	var photos []*models.Photo
	for rows.Next() {
		photo := &models.Photo{}
		err := rows.Scan(&photo.ID, &photo.UserID, &photo.PhotoUrl, &photo.Order, &photo.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan photo: %w", err)
		}
		photos = append(photos, photo)
	}

	return photos, nil
}

// AddPhoto adds a photo for a user
func AddPhoto(userID int, photoUrl string, order int) (*models.Photo, error) {
	photo := &models.Photo{
		UserID:    userID,
		PhotoUrl:  photoUrl,
		Order:     order,
		CreatedAt: time.Now(),
	}

	err := DB.QueryRowContext(
		context.Background(),
		`INSERT INTO photos (user_id, photo_url, sort_order, created_at)
		VALUES ($1, $2, $3, $4)
		RETURNING id`,
		userID, photoUrl, order, photo.CreatedAt,
	).Scan(&photo.ID)

	if err != nil {
		return nil, fmt.Errorf("failed to add photo: %w", err)
	}

	return photo, nil
}

// DeletePhoto deletes a photo
func DeletePhoto(photoID int) error {
	_, err := DB.ExecContext(
		context.Background(),
		`DELETE FROM photos WHERE id = $1`,
		photoID,
	)
	return err
}

// GetUserInterests retrieves all interests for a user
func GetUserInterests(userID int) ([]*models.UserInterest, error) {
	rows, err := DB.QueryContext(
		context.Background(),
		`SELECT ui.id, ui.user_id, ui.interest_id, i.name
		FROM user_interests ui
		JOIN interests i ON ui.interest_id = i.id
		WHERE ui.user_id = $1`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query interests: %w", err)
	}
	defer rows.Close()

	var interests []*models.UserInterest
	for rows.Next() {
		interest := &models.UserInterest{}
		err := rows.Scan(&interest.ID, &interest.UserID, &interest.InterestID, &interest.InterestName)
		if err != nil {
			return nil, fmt.Errorf("failed to scan interest: %w", err)
		}
		interests = append(interests, interest)
	}

	return interests, nil
}

// GetUserPrompts retrieves all prompts and answers for a user
func GetUserPrompts(userID int) ([]*models.UserPrompt, error) {
	rows, err := DB.QueryContext(
		context.Background(),
		`SELECT
			up.id,
			up.user_id,
			up.prompt_id,
			up.answer,
			up.display_order,
			up.created_at,
			p.text AS question
		FROM user_prompts up
		JOIN prompts p ON up.prompt_id = p.id
		WHERE up.user_id = $1
		ORDER BY up.display_order`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query prompts: %w", err)
	}
	defer rows.Close()

	var prompts []*models.UserPrompt
	for rows.Next() {
		prompt := &models.UserPrompt{}
		err := rows.Scan(
			&prompt.ID,
			&prompt.UserID,
			&prompt.PromptID,
			&prompt.Answer,
			&prompt.DisplayOrder,
			&prompt.CreatedAt,
			&prompt.PromptText,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan prompt: %w", err)
		}
		prompts = append(prompts, prompt)
	}

	return prompts, nil
}

// CanViewDetailedProfile checks if a user can view another user's detailed profile
func CanViewDetailedProfile(viewerID, targetUserID int) (bool, error) {
    if viewerID == targetUserID {
        return true, nil
    }

    // Allow if there is any interaction
    var count int
    err := DB.QueryRowContext(
        context.Background(),
        `SELECT COUNT(*)
         FROM interactions
         WHERE (user_id = $1 AND target_user_id = $2)
            OR (user_id = $2 AND target_user_id = $1)`,
        viewerID, targetUserID,
    ).Scan(&count)

    if err != nil && err != sql.ErrNoRows {
        return false, err
    }
    if count > 0 {
        return true, nil
    }

    // Allow if matched
    var matchCount int
    err = DB.QueryRowContext(
        context.Background(),
        `SELECT COUNT(*)
         FROM matches
         WHERE (user_id1 = $1 AND user_id2 = $2)
            OR (user_id1 = $2 AND user_id2 = $1)`,
        viewerID, targetUserID,
    ).Scan(&matchCount)

    if err != nil && err != sql.ErrNoRows {
        return false, err
    }
    if matchCount > 0 {
        return true, nil
    }

    // ✅ Allow if target is in current recommendations (computed)
    recs, err := GetRecommendations(viewerID)
    if err != nil {
        return false, err
    }
    for _, id := range recs {
        if id == targetUserID {
            return true, nil
        }
    }

    return false, nil
}


// DeleteUserPhoto deletes a photo only if it belongs to this user.
func DeleteUserPhoto(userID, photoID int) error {
	_, err := DB.ExecContext(
		context.Background(),
		`DELETE FROM photos
		 WHERE id = $1 AND user_id = $2`,
		photoID, userID,
	)
	if err != nil {
		return fmt.Errorf("delete photo: %w", err)
	}
	return nil
}

// SetProfilePhotoURL sets the main profile photo url for the user
func SetProfilePhotoURL(userID int, url string) error {
	_, err := DB.ExecContext(
		context.Background(),
		`UPDATE profiles
		 SET profile_photo_url = $1, updated_at = NOW()
		 WHERE user_id = $2`,
		url, userID,
	)
	if err != nil {
		return fmt.Errorf("set profile photo url: %w", err)
	}
	return nil
}
