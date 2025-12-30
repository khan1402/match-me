package db

import (
	"context"
	"fmt"
	"time"

	"backend/models"
)

// CreateMatch creates a new match between two users
// Sorts IDs to ensure consistent ordering (min, max) for the unique index
func CreateMatch(userID1, userID2 int) error {
	// Sort IDs to ensure consistent ordering (required for unique index)
	u1, u2 := userID1, userID2
	if u1 > u2 {
		u1, u2 = u2, u1
	}

	_, err := DB.ExecContext(
		context.Background(),
		`INSERT INTO matches (user_id1, user_id2, created_at)
		 VALUES ($1, $2, NOW())
		 ON CONFLICT DO NOTHING`,
		u1, u2,
	)
	return err
}

// GetMatchByID retrieves a match by its ID
func GetMatchByID(matchID int) (*models.Match, error) {
	match := &models.Match{}

	err := DB.QueryRowContext(
		context.Background(),
		`SELECT id, user_id1, user_id2, created_at
		 FROM matches
		 WHERE id = $1`,
		matchID,
	).Scan(
		&match.ID,
		&match.UserID1,
		&match.UserID2,
		&match.CreatedAt,
	)

	if err != nil {
		return nil, err
	}

	return match, nil
}

// GetMessagesForMatch retrieves messages for a match with pagination
func GetMessagesForMatch(matchID, limit, offset int) ([]*models.Message, error) {
	rows, err := DB.QueryContext(
		context.Background(),
		`SELECT id, match_id, sender_id, receiver_id, content, is_read, created_at
		 FROM messages
		 WHERE match_id = $1
		 ORDER BY created_at ASC
		 LIMIT $2 OFFSET $3`,
		matchID, limit, offset,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query messages: %w", err)
	}
	defer rows.Close()

	var messages []*models.Message
	for rows.Next() {
		msg := &models.Message{}
		if err := rows.Scan(
			&msg.ID,
			&msg.MatchID,
			&msg.SenderID,
			&msg.ReceiverID,
			&msg.Content,
			&msg.IsRead,
			&msg.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan message: %w", err)
		}
		messages = append(messages, msg)
	}

	return messages, nil
}

// CreateMessage creates a new chat message with receiver_id (4 args!)
func CreateMessage(matchID, senderID, receiverID int, content string) (*models.Message, error) {
	msg := &models.Message{
		MatchID:    matchID,
		SenderID:   senderID,
		ReceiverID: receiverID,
		Content:    content,
		IsRead:     false,
		CreatedAt:  time.Now(),
	}

	err := DB.QueryRowContext(
		context.Background(),
		`INSERT INTO messages (match_id, sender_id, receiver_id, content, is_read, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id`,
		matchID,
		senderID,
		receiverID,
		content,
		false,
		msg.CreatedAt,
	).Scan(&msg.ID)

	if err != nil {
		return nil, fmt.Errorf("failed to create message: %w", err)
	}

	return msg, nil
}

// MarkMessagesAsRead marks all messages in a match as read for a user
func MarkMessagesAsRead(matchID, userID int) error {
	_, err := DB.ExecContext(
		context.Background(),
		`UPDATE messages
		 SET is_read = true
		 WHERE match_id = $1 AND receiver_id = $2 AND is_read = false`,
		matchID,
		userID,
	)
	return err
}

// GetUnreadMessageCount returns the count of unread messages for a user in a match
func GetUnreadMessageCount(matchID, userID int) (int, error) {
	var count int
	err := DB.QueryRowContext(
		context.Background(),
		`SELECT COUNT(*)
		 FROM messages
		 WHERE match_id = $1 AND receiver_id = $2 AND is_read = false`,
		matchID,
		userID,
	).Scan(&count)
	return count, err
}
