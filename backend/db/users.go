package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"backend/models"
)

// CreateUser inserts a new user
func CreateUser(email, plainPassword, name string) (*models.User, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword(
		[]byte(plainPassword),
		bcrypt.DefaultCost,
	)
	if err != nil {
		return nil, err
	}

	user := &models.User{
		Email:     email,
		Password:  string(hashedPassword),
		Name:      name,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	err = DB.QueryRowContext(
		context.Background(),
		`
		INSERT INTO users (email, password, name, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
		`,
		user.Email,
		user.Password,
		user.Name,
		user.CreatedAt,
		user.UpdatedAt,
	).Scan(&user.ID)

	if err != nil {
		// Check if this is a duplicate email error
		errStr := strings.ToLower(err.Error())
		if strings.Contains(errStr, "unique") || strings.Contains(errStr, "duplicate") || 
		   strings.Contains(errStr, "23505") {
			return nil, errors.New("email already in use")
		}
		return nil, err
	}

	return user, nil
}

// GetUserByEmail returns a user by email
func GetUserByEmail(email string) (*models.User, error) {
	user := &models.User{}
	var lastSignedIn sql.NullTime

	err := DB.QueryRowContext(
		context.Background(),
		`
		SELECT id, email, password, name, role, created_at, updated_at, last_signed_in
		FROM users
		WHERE email = $1
		`,
		email,
	).Scan(
		&user.ID,
		&user.Email,
		&user.Password,
		&user.Name,
		&user.Role,
		&user.CreatedAt,
		&user.UpdatedAt,
		&lastSignedIn,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("user not found")
	}
	if err != nil {
		return nil, err
	}

	// Handle NULL last_signed_in safely
	if lastSignedIn.Valid {
    user.LastSignedIn = lastSignedIn.Time
	} else {
    user.LastSignedIn = time.Time{} // zero value
	}

	return user, nil
}

// GetUserByID returns a user by ID
func GetUserByID(id int) (*models.User, error) {
	user := &models.User{}
	var lastSignedIn sql.NullTime

	err := DB.QueryRowContext(
		context.Background(),
		`
		SELECT id, email, password, name, role, created_at, updated_at, last_signed_in
		FROM users
		WHERE id = $1
		`,
		id,
	).Scan(
		&user.ID,
		&user.Email,
		&user.Password,
		&user.Name,
		&user.Role,
		&user.CreatedAt,
		&user.UpdatedAt,
		&lastSignedIn,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("user not found")
	}
	if err != nil {
		return nil, err
	}

	// Handle NULL last_signed_in safely
	if lastSignedIn.Valid {
    user.LastSignedIn = lastSignedIn.Time
	} else {
    user.LastSignedIn = time.Time{} // zero value
	}


	return user, nil
}

// CheckUserPassword verifies email + password
func CheckUserPassword(email, plainPassword string) (*models.User, error) {
	user, err := GetUserByEmail(email)
	if err != nil {
		return nil, err
	}

	err = bcrypt.CompareHashAndPassword(
		[]byte(user.Password),
		[]byte(plainPassword),
	)
	if err != nil {
		return nil, errors.New("invalid credentials")
	}

	return user, nil
}

// DeleteUser deletes a user account and all associated data
// Deletes in order to respect foreign key constraints (even if no FK constraints exist, this order is safe)
func DeleteUser(userID int) error {
	fmt.Printf("[DeleteUser] Starting deletion for userID=%d\n", userID)
	ctx := context.Background()

	// Verify user exists before deletion
	_, err := GetUserByID(userID)
	if err != nil {
		return fmt.Errorf("user %d does not exist: %w", userID, err)
	}
	fmt.Printf("[DeleteUser] User %d exists, proceeding with deletion\n", userID)

	// Start a transaction for atomic deletion
	tx, err := DB.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	fmt.Printf("[DeleteUser] Transaction started\n")
	
	// Track if we've committed to avoid rolling back after commit
	committed := false
	defer func() {
		if !committed {
			fmt.Printf("[DeleteUser] Rolling back transaction\n")
			if rbErr := tx.Rollback(); rbErr != nil {
				fmt.Printf("[DeleteUser] Error rolling back transaction: %v\n", rbErr)
			}
		}
	}()

	// Delete in order to respect foreign key constraints
	// Delete all tables that reference users table

	// 1) Delete notifications
	res, err := tx.ExecContext(ctx, `DELETE FROM notifications WHERE user_id = $1`, userID)
	if err != nil {
		return fmt.Errorf("delete notifications: %w", err)
	}
	rows, _ := res.RowsAffected()
	fmt.Printf("[DeleteUser] Deleted %d notifications\n", rows)

	// 2) Delete messages where user is sender or receiver
	_, err = tx.ExecContext(ctx, `DELETE FROM messages WHERE sender_id = $1 OR receiver_id = $1`, userID)
	if err != nil {
		return fmt.Errorf("delete messages: %w", err)
	}

	// 3) Delete matches where user is involved
	_, err = tx.ExecContext(ctx, `DELETE FROM matches WHERE user_id1 = $1 OR user_id2 = $1`, userID)
	if err != nil {
		return fmt.Errorf("delete matches: %w", err)
	}

	// 4) Delete connection_requests (sent and received)
	_, err = tx.ExecContext(ctx, `DELETE FROM connection_requests WHERE from_user_id = $1 OR to_user_id = $1`, userID)
	if err != nil {
		return fmt.Errorf("delete connection_requests: %w", err)
	}

	// 5) Delete interactions (user_id and target_user_id)
	_, err = tx.ExecContext(ctx, `DELETE FROM interactions WHERE user_id = $1 OR target_user_id = $1`, userID)
	if err != nil {
		return fmt.Errorf("delete interactions: %w", err)
	}

	// 6) Delete reports (made by user and against user)
	_, err = tx.ExecContext(ctx, `DELETE FROM reports WHERE reporter_id = $1 OR reported_id = $1`, userID)
	if err != nil {
		return fmt.Errorf("delete reports: %w", err)
	}

	// 7) Delete blocks (made by user and against user)
	_, err = tx.ExecContext(ctx, `DELETE FROM blocks WHERE blocker_id = $1 OR blocked_id = $1`, userID)
	if err != nil {
		return fmt.Errorf("delete blocks: %w", err)
	}

	// 8) Delete user photos
	_, err = tx.ExecContext(ctx, `DELETE FROM photos WHERE user_id = $1`, userID)
	if err != nil {
		return fmt.Errorf("delete photos: %w", err)
	}

	// 9) Delete user interests
	_, err = tx.ExecContext(ctx, `DELETE FROM user_interests WHERE user_id = $1`, userID)
	if err != nil {
		return fmt.Errorf("delete user_interests: %w", err)
	}

	// 10) Delete user prompts
	_, err = tx.ExecContext(ctx, `DELETE FROM user_prompts WHERE user_id = $1`, userID)
	if err != nil {
		return fmt.Errorf("delete user_prompts: %w", err)
	}

	// 11) Delete profile (must be before users due to foreign key)
	_, err = tx.ExecContext(ctx, `DELETE FROM profiles WHERE user_id = $1`, userID)
	if err != nil {
		return fmt.Errorf("delete profiles: %w", err)
	}

	// 12) Finally, delete the user record itself
	result, err := tx.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, userID)
	if err != nil {
		fmt.Printf("[DeleteUser] ERROR deleting user record: %v\n", err)
		return fmt.Errorf("delete users: %w", err)
	}

	// Verify that the user was actually deleted
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("get rows affected: %w", err)
	}
	if rowsAffected == 0 {
		fmt.Printf("[DeleteUser] WARNING: User %d was not deleted (rowsAffected=0)\n", userID)
		return fmt.Errorf("user with id %d was not found or already deleted", userID)
	}
	fmt.Printf("[DeleteUser] Deleted user record (rowsAffected=%d)\n", rowsAffected)

	// Commit the transaction
	fmt.Printf("[DeleteUser] Committing transaction...\n")
	if err = tx.Commit(); err != nil {
		fmt.Printf("[DeleteUser] ERROR committing transaction: %v\n", err)
		return fmt.Errorf("commit transaction: %w", err)
	}
	
	committed = true
	fmt.Printf("[DeleteUser] ✅ Transaction committed successfully for userID=%d\n", userID)
	
	// Final verification: check if user still exists
	_, verifyErr := GetUserByID(userID)
	if verifyErr == nil {
		fmt.Printf("[DeleteUser] ⚠️ CRITICAL: User %d still exists after deletion!\n", userID)
		return fmt.Errorf("user %d still exists after deletion - transaction may have failed", userID)
	}
	fmt.Printf("[DeleteUser] ✅ Verified: User %d no longer exists\n", userID)
	
	return nil
}
