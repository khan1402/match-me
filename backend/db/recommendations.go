package db

import (
	"context"
	"database/sql"
	"fmt"
	"math"
	"strings"

	"backend/models"
)

const MIN_SCORE = 50

// RecommendationScore holds scoring data for a user
type RecommendationScore struct {
	UserID int
	Score  float64
}

// haversineDistanceKm calculates the distance between two points on Earth using the Haversine formula
// Returns distance in kilometers
func haversineDistanceKm(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371 // Earth's radius in kilometers
	toRad := func(deg float64) float64 {
		return deg * math.Pi / 180
	}

	dLat := toRad(lat2 - lat1)
	dLon := toRad(lon2 - lon1)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(toRad(lat1))*math.Cos(toRad(lat2))*
			math.Sin(dLon/2)*math.Sin(dLon/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}

// isValidCoordinate checks if coordinates are valid (not NULL and not 0.0,0.0)
// Treats (0,0) as invalid since it's in the Gulf of Guinea and not a real user location
func isValidCoordinate(lat, lon sql.NullFloat64) bool {
	if !lat.Valid || !lon.Valid {
		return false
	}
	// Treat (0,0) as invalid - it's not a real user location
	const epsilon = 0.0001
	if math.Abs(lat.Float64) < epsilon && math.Abs(lon.Float64) < epsilon {
		return false
	}
	return true
}

// extractCountry parses the country from a location string
// Format is typically "City, Country" - returns the last part after comma, trimmed and lowercased
// Returns empty string if location is empty or cannot be parsed
func extractCountry(location sql.NullString) string {
	if !location.Valid || location.String == "" {
		return ""
	}
	parts := strings.Split(location.String, ",")
	if len(parts) == 0 {
		return ""
	}
	// Take the last part (country), trim and lowercase for comparison
	country := strings.TrimSpace(parts[len(parts)-1])
	return strings.ToLower(country)
}

// GetRecommendations returns up to 10 recommended users for the given user
func GetRecommendations(userID int) ([]int, error) {
	// Phase 1: Get user's profile and preferences
	userProfile, err := GetProfileByUserID(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user profile: %w", err)
	}

	// Phase 2: Get all candidate users (hard filters)
	candidates, err := getHardFilteredCandidates(userID, userProfile)
	if err != nil {
		return nil, fmt.Errorf("failed to get candidates: %w", err)
	}

	if len(candidates) == 0 {
		return []int{}, nil
	}

	// Phase 3: Score candidates
	scores := []RecommendationScore{}
	for _, candidateID := range candidates {
		score, err := scoreCandidate(userID, candidateID, userProfile)
		if err != nil {
			continue
		}

		// Phase 4: Apply minimum score threshold
		if score >= MIN_SCORE {
			scores = append(scores, RecommendationScore{
				UserID: candidateID,
				Score:  score,
			})
		}
	}

	// Phase 5: Location preference - prioritize same location
	sameLocationScores := []RecommendationScore{}
	otherLocationScores := []RecommendationScore{}

	userLocation := ""
	if userProfile.Location.Valid {
		userLocation = userProfile.Location.String
	}

	for _, s := range scores {
		candidateProfile, err := GetProfileByUserID(s.UserID)
		if err != nil {
			continue
		}

		candidateLocation := ""
		if candidateProfile.Location.Valid {
			candidateLocation = candidateProfile.Location.String
		}

		if userLocation != "" && candidateLocation != "" && candidateLocation == userLocation {
			sameLocationScores = append(sameLocationScores, s)
		} else {
			otherLocationScores = append(otherLocationScores, s)
		}
	}

	// Sort by score (highest first)
	sortByScore(sameLocationScores)
	sortByScore(otherLocationScores)

	// Combine: same location first, then others
	finalScores := append(sameLocationScores, otherLocationScores...)

	// Phase 6: Limit to 10 recommendations
	result := []int{}
	for i, s := range finalScores {
		if i >= 10 {
			break
		}
		result = append(result, s.UserID)
	}

	return result, nil
}

// getHardFilteredCandidates returns candidates after hard filters
func getHardFilteredCandidates(userID int, userProfile *models.Profile) ([]int, error) {
	rows, err := DB.QueryContext(
		context.Background(),
		`SELECT u.id FROM users u
		 WHERE u.id != $1`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	candidates := []int{}
	for rows.Next() {
		var candidateID int
		if err := rows.Scan(&candidateID); err != nil {
			continue
		}

		// Check if already interacted
		var interactionCount int
		err := DB.QueryRowContext(
			context.Background(),
			`SELECT COUNT(*) FROM interactions
			 WHERE user_id = $1 AND target_user_id = $2`,
			userID, candidateID,
		).Scan(&interactionCount)

		if err == nil && interactionCount > 0 {
			continue
		}

		// Check if blocked
		var blockCount int
		err = DB.QueryRowContext(
			context.Background(),
			`SELECT COUNT(*) FROM blocks
			 WHERE blocker_id = $1 AND blocked_id = $2`,
			userID, candidateID,
		).Scan(&blockCount)

		if err == nil && blockCount > 0 {
			continue
		}

		// Check mutual gender preference
		candidateProfile, err := GetProfileByUserID(candidateID)
		if err != nil {
			continue
		}

		if !checkMutualGenderPreference(userProfile, candidateProfile) {
			continue
		}

		// Location-based filtering: if allow_outside_radius is false, enforce strict filtering
		if !userProfile.AllowOutsideRadius {
			userHasValidCoords := isValidCoordinate(userProfile.Latitude, userProfile.Longitude)
			candidateHasValidCoords := isValidCoordinate(candidateProfile.Latitude, candidateProfile.Longitude)

			if userHasValidCoords && candidateHasValidCoords {
				// Both have GPS: enforce distance-based radius filtering
				distanceKm := haversineDistanceKm(
					userProfile.Latitude.Float64,
					userProfile.Longitude.Float64,
					candidateProfile.Latitude.Float64,
					candidateProfile.Longitude.Float64,
				)
				// Filter out candidates outside the max distance
				if distanceKm > float64(userProfile.MaxDistanceKm) {
					continue
				}
			} else if !userHasValidCoords {
				// User has no valid GPS: use location string as fallback filter
				// Only show candidates from the same country
				userCountry := extractCountry(userProfile.Location)
				candidateCountry := extractCountry(candidateProfile.Location)

				if userCountry != "" && candidateCountry != "" {
					// Both have location strings: require same country
					if userCountry != candidateCountry {
						continue
					}
				} else if userCountry != "" && candidateCountry == "" {
					// User has location but candidate doesn't: exclude candidate
					continue
				}
				// If user has no location string, don't filter by location (allow all)
			}
			// If user has GPS but candidate doesn't, we don't filter them out here
			// (they'll be scored lower by the scoring function)
		}

		candidates = append(candidates, candidateID)
	}

	return candidates, nil
}

// checkMutualGenderPreference checks if two users have matching gender preferences
func checkMutualGenderPreference(user1Profile, user2Profile *models.Profile) bool {
	user1Gender := ""
	user1Looking := ""
	user2Gender := ""
	user2Looking := ""

	if user1Profile.Gender.Valid {
		user1Gender = user1Profile.Gender.String
	}
	if user1Profile.LookingFor.Valid {
		user1Looking = user1Profile.LookingFor.String
	}
	if user2Profile.Gender.Valid {
		user2Gender = user2Profile.Gender.String
	}
	if user2Profile.LookingFor.Valid {
		user2Looking = user2Profile.LookingFor.String
	}

	// If missing required values, treat as not compatible
	if user1Gender == "" || user2Gender == "" || user1Looking == "" || user2Looking == "" {
		return false
	}

	// Check if user1 is looking for user2's gender
	if user1Looking != "everyone" && user1Looking != user2Gender {
		return false
	}

	// Check if user2 is looking for user1's gender
	if user2Looking != "everyone" && user2Looking != user1Gender {
		return false
	}

	return true
}

// scoreCandidate calculates compatibility score for a candidate
func scoreCandidate(userID, candidateID int, userProfile *models.Profile) (float64, error) {
	candidateProfile, err := GetProfileByUserID(candidateID)
	if err != nil {
		return 0, err
	}

	score := 0.0

	// Gender preference match: 30 points (required)
	if checkMutualGenderPreference(userProfile, candidateProfile) {
		score += 30
	} else {
		return 0, nil
	}

	// Age proximity: 0-20 points
	if userProfile.Age.Valid && candidateProfile.Age.Valid {
		ageDiff := math.Abs(float64(userProfile.Age.Int32 - candidateProfile.Age.Int32))
		if ageDiff <= 5 {
			score += 20
		} else if ageDiff <= 10 {
			score += 15
		} else if ageDiff <= 15 {
			score += 10
		} else if ageDiff <= 20 {
			score += 5
		}
	}

	// Location match: 0-25 points
	if userProfile.Location.Valid && candidateProfile.Location.Valid {
		if userProfile.Location.String == candidateProfile.Location.String {
			score += 25
		}
	}

	// Shared interests: 0-20 points
	userInterests, err := GetUserInterests(userID)
	if err == nil {
		candidateInterests, err := GetUserInterests(candidateID)
		if err == nil {
			sharedCount := 0
			for _, ui := range userInterests {
				for _, ci := range candidateInterests {
					if ui.InterestID == ci.InterestID {
						sharedCount++
						break
					}
				}
			}

			if len(userInterests) > 0 {
				sharedRatio := float64(sharedCount) / float64(len(userInterests))
				score += sharedRatio * 20
			}
		}
	}

	// Shared prompts: 0-6 points
	userPrompts, err := GetUserPrompts(userID)
	if err == nil {
		candidatePrompts, err := GetUserPrompts(candidateID)
		if err == nil {
			sharedPrompts := 0
			for _, up := range userPrompts {
				for _, cp := range candidatePrompts {
					if up.PromptID == cp.PromptID {
						sharedPrompts++
						break
					}
				}
			}

			if len(userPrompts) > 0 {
				promptRatio := float64(sharedPrompts) / float64(len(userPrompts))
				score += promptRatio * 6
			}
		}
	}

	return score, nil
}

// sortByScore sorts scores in descending order
func sortByScore(scores []RecommendationScore) {
	for i := 0; i < len(scores); i++ {
		for j := i + 1; j < len(scores); j++ {
			if scores[j].Score > scores[i].Score {
				scores[i], scores[j] = scores[j], scores[i]
			}
		}
	}
}

// GetInteractionType gets the type of interaction between two users
func GetInteractionType(userID, targetUserID int) (string, error) {
	var interactionType string
	err := DB.QueryRowContext(
		context.Background(),
		`SELECT type FROM interactions
		 WHERE user_id = $1 AND target_user_id = $2
		 LIMIT 1`,
		userID, targetUserID,
	).Scan(&interactionType)

	if err != nil {
		if err == sql.ErrNoRows {
			return "", nil
		}
		return "", err
	}

	return interactionType, nil
}

// CreateInteraction creates an interaction (like/pass/dismiss/prompt_like)
//
// NOTE: Your schema does NOT define a UNIQUE constraint on (user_id, target_user_id).
// So we do: update first, if nothing updated -> insert.
func CreateInteraction(userID, targetUserID int, interactionType string) error {
	res, err := DB.ExecContext(
		context.Background(),
		`UPDATE interactions
		 SET type = $3
		 WHERE user_id = $1 AND target_user_id = $2`,
		userID, targetUserID, interactionType,
	)
	if err != nil {
		return err
	}

	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected > 0 {
		return nil
	}

	_, err = DB.ExecContext(
		context.Background(),
		`INSERT INTO interactions (user_id, target_user_id, type)
		 VALUES ($1, $2, $3)`,
		userID, targetUserID, interactionType,
	)
	return err
}

// GetConnections returns all connected profiles for a user
func GetConnections(userID int) ([]int, error) {
	rows, err := DB.QueryContext(
		context.Background(),
		`SELECT DISTINCT target_user_id
		 FROM interactions
		 WHERE user_id = $1`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var connections []int
	for rows.Next() {
		var targetID int
		if err := rows.Scan(&targetID); err != nil {
			continue
		}
		connections = append(connections, targetID)
	}

	return connections, nil
}