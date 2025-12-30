package db

import (
	"context"
	"database/sql"
	"fmt"
)

// UpsertInteraction makes (user -> target) one row, updates type if it already exists.
func UpsertInteraction(userID, targetUserID int, typ string) error {
	q := `
INSERT INTO interactions (user_id, target_user_id, type)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, target_user_id) DO UPDATE
SET type = EXCLUDED.type
`
	_, err := DB.ExecContext(context.Background(), q, userID, targetUserID, typ)
	if err != nil {
		return fmt.Errorf("UpsertInteraction: %w", err)
	}
	return nil
}

// HasLike checks if (user -> target) is a "like"
func HasLike(userID, targetUserID int) (bool, error) {
	q := `
SELECT EXISTS(
  SELECT 1
  FROM interactions
  WHERE user_id = $1 AND target_user_id = $2 AND type = 'like'
)
`
	var ok bool
	if err := DB.QueryRowContext(context.Background(), q, userID, targetUserID).Scan(&ok); err != nil {
		return false, fmt.Errorf("HasLike: %w", err)
	}
	return ok, nil
}

// CreateOrGetMatch creates a match for the pair (sorted) or returns the existing match id.
func CreateOrGetMatch(a, b int) (int, error) {
	u1, u2 := a, b
	if u1 > u2 {
		u1, u2 = u2, u1
	}

	ins := `
INSERT INTO matches (user_id1, user_id2)
VALUES ($1, $2)
ON CONFLICT DO NOTHING
RETURNING id
`
	var id int
	err := DB.QueryRowContext(context.Background(), ins, u1, u2).Scan(&id)
	if err == nil {
		return id, nil
	}
	if err != sql.ErrNoRows {
		return 0, fmt.Errorf("CreateOrGetMatch insert: %w", err)
	}

	sel := `SELECT id FROM matches WHERE user_id1 = $1 AND user_id2 = $2`
	if err := DB.QueryRowContext(context.Background(), sel, u1, u2).Scan(&id); err != nil {
		return 0, fmt.Errorf("CreateOrGetMatch select: %w", err)
	}
	return id, nil
}
