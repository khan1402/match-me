package db

import (
	"context"
	"database/sql"
	"errors"

	"backend/models"
)

// GetMyNotifications returns the latest 50 notifications for a user
func GetMyNotifications(userID int) ([]*models.Notification, error) {
	q := `
		SELECT 
			id, 
			user_id, 
			type, 
			related_user_id, 
			related_match_id, 
			message, 
			is_read, 
			created_at
		FROM notifications
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 50
	`

	rows, err := DB.QueryContext(context.Background(), q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notifications []*models.Notification

	for rows.Next() {
		var n models.Notification
		var relatedUserID sql.NullInt64
		var relatedMatchID sql.NullInt64

		err := rows.Scan(
			&n.ID,
			&n.UserID,
			&n.Type,
			&relatedUserID,
			&relatedMatchID,
			&n.Content,
			&n.IsRead,
			&n.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		// Convert nullable fields to pointers
		if relatedUserID.Valid {
			val := int(relatedUserID.Int64)
			n.RelatedUserID = &val
		}
		if relatedMatchID.Valid {
			val := int(relatedMatchID.Int64)
			n.RelatedMatchID = &val
		}

		notifications = append(notifications, &n)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	// Return empty array instead of nil
	if notifications == nil {
		notifications = []*models.Notification{}
	}

	return notifications, nil
}

// MarkNotificationAsRead marks a notification as read for a specific user
func MarkNotificationAsRead(notificationID, userID int) error {
	q := `
		UPDATE notifications
		SET is_read = true
		WHERE id = $1 AND user_id = $2
	`

	result, err := DB.ExecContext(context.Background(), q, notificationID, userID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return errors.New("notification not found")
	}

	return nil
}

