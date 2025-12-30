package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"
	
)

type MiniProfile struct {
	ID              int     `json:"id"`
	FirstName       *string `json:"firstName,omitempty"`
	Age             *int    `json:"age,omitempty"`
	Location        *string `json:"location,omitempty"`
	ProfilePhotoUrl *string `json:"profilePhotoUrl,omitempty"`
}

type LikeItem struct {
	OtherUserID int          `json:"otherUserId"`
	Profile     *MiniProfile `json:"profile"`
	PhotoUrl    *string      `json:"photoUrl,omitempty"`
}

//
// =====================
// CREATE LIKE (SAFE)
// =====================
//

func CreateLike(userID, targetUserID int) error {
	if userID == targetUserID {
		return fmt.Errorf("cannot like yourself")
	}

	q := `
INSERT INTO interactions (user_id, target_user_id, type)
VALUES ($1, $2, 'like')
ON CONFLICT (user_id, target_user_id) DO NOTHING
`
	_, err := DB.ExecContext(context.Background(), q, userID, targetUserID)
	return err
}

//
// =====================
// CHECK IF MATCH EXISTS
// =====================
//

func HasMutualLike(userID, targetUserID int) (bool, error) {
	q := `
SELECT 1
FROM interactions a
JOIN interactions b
  ON a.user_id = b.target_user_id
 AND a.target_user_id = b.user_id
WHERE a.user_id = $1
  AND a.target_user_id = $2
  AND a.type = 'like'
  AND b.type = 'like'
LIMIT 1
`
	var dummy int
	err := DB.QueryRowContext(context.Background(), q, userID, targetUserID).Scan(&dummy)
	if err == sql.ErrNoRows {
		return false, nil
	}
	return err == nil, err
}

//
// =====================
// LIKES TAB (I liked)
// returns the shape ProfileHub.tsx expects
//
// IMPORTANT: exclude users already in matches,
// so "Liked" only shows outgoing likes that are NOT mutual yet.
// =====================
//

func GetMyLikes(userID int) ([]LikeItem, error) {
	q := `
SELECT
	u.id,
	COALESCE(NULLIF(p.first_name, ''), u.name) AS first_name,
	COALESCE(p.age, 0) AS age,
	COALESCE(p.location, '') AS location,
	COALESCE(p.profile_photo_url, '') AS photo_url
FROM interactions i
JOIN users u ON u.id = i.target_user_id
LEFT JOIN profiles p ON p.user_id = u.id
WHERE i.user_id = $1
  AND i.type = 'like'
  AND NOT EXISTS (
    SELECT 1
    FROM matches m
    WHERE (m.user_id1 = $1 AND m.user_id2 = u.id)
       OR (m.user_id1 = u.id AND m.user_id2 = $1)
  )
ORDER BY i.created_at DESC
`
	rows, err := DB.QueryContext(context.Background(), q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []LikeItem
	for rows.Next() {
		var (
			otherID   int
			firstName string
			age       int
			location  string
			photoUrl  string
		)

		if err := rows.Scan(&otherID, &firstName, &age, &location, &photoUrl); err != nil {
			return nil, err
		}

		// Convert to pointers to match the TS type "optional"
		fn := firstName // always non-empty because of COALESCE
		var agePtr *int
		if age > 0 {
			a := age
			agePtr = &a
		}

		var locPtr *string
		if location != "" {
			l := location
			locPtr = &l
		}

		var photoPtr *string
		if photoUrl != "" {
			p := photoUrl
			photoPtr = &p
		}

		out = append(out, LikeItem{
			OtherUserID: otherID,
			Profile: &MiniProfile{
				ID:              otherID,
				FirstName:       &fn,
				Age:             agePtr,
				Location:        locPtr,
				ProfilePhotoUrl: photoPtr,
			},
			PhotoUrl: photoPtr,
		})
	}

	return out, rows.Err()
}

//
// =====================
// INCOMING LIKES (requests)
// returns the same shape ProfileHub.tsx expects
// =====================
//

func GetIncomingRequests(userID int) ([]LikeItem, error) {
	q := `
SELECT
	u.id,
	COALESCE(NULLIF(p.first_name, ''), u.name) AS first_name,
	COALESCE(p.age, 0) AS age,
	COALESCE(p.location, '') AS location,
	COALESCE(p.profile_photo_url, '') AS photo_url
FROM interactions i
JOIN users u ON u.id = i.user_id
LEFT JOIN profiles p ON p.user_id = u.id
WHERE i.target_user_id = $1
  AND i.type = 'like'
  AND NOT EXISTS (
    SELECT 1
    FROM interactions me
    WHERE me.user_id = $1
      AND me.target_user_id = i.user_id
  )
ORDER BY i.created_at DESC
`
	rows, err := DB.QueryContext(context.Background(), q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []LikeItem
	for rows.Next() {
		var (
			otherID   int
			firstName string
			age       int
			location  string
			photoUrl  string
		)

		if err := rows.Scan(&otherID, &firstName, &age, &location, &photoUrl); err != nil {
			return nil, err
		}

		fn := firstName
		var agePtr *int
		if age > 0 {
			a := age
			agePtr = &a
		}

		var locPtr *string
		if location != "" {
			l := location
			locPtr = &l
		}

		var photoPtr *string
		if photoUrl != "" {
			p := photoUrl
			photoPtr = &p
		}

		out = append(out, LikeItem{
			OtherUserID: otherID,
			Profile: &MiniProfile{
				ID:              otherID,
				FirstName:       &fn,
				Age:             agePtr,
				Location:        locPtr,
				ProfilePhotoUrl: photoPtr,
			},
			PhotoUrl: photoPtr,
		})
	}

	return out, rows.Err()
}

// =====================
// MATCHES (ProfileHub.tsx shape)
// =====================

type MessageDTO struct {
	ID         int       `json:"id"`
	MatchID    int       `json:"matchId"`
	SenderID   int       `json:"senderId"`
	ReceiverID int       `json:"receiverId"`
	Content    string    `json:"content"`
	CreatedAt  time.Time `json:"createdAt"`
	IsRead     bool      `json:"isRead"`
}

type MatchItem struct {
	ID          int          `json:"id"`
	OtherUserID int          `json:"otherUserId"`
	MatchedAt   time.Time    `json:"matchedAt"`
	Profile     *MiniProfile `json:"profile"`
	PhotoUrl    *string      `json:"photoUrl,omitempty"`
	LastMessage *MessageDTO  `json:"lastMessage,omitempty"`
	UnreadCount int          `json:"unreadCount,omitempty"`
	Online      bool         `json:"online"`
}

func GetMyMatches(userID int) ([]MatchItem, error) {
	q := `
SELECT
  m.id AS match_id,
  m.created_at AS matched_at,

  other_u.id AS other_user_id,
  other_u.last_signed_in AS other_last_signed_in,
  COALESCE(NULLIF(other_p.first_name, ''), other_u.name) AS first_name,
  COALESCE(other_p.age, 0) AS age,
  COALESCE(other_p.location, '') AS location,
  COALESCE(other_p.profile_photo_url, '') AS photo_url,

  lm.id AS last_message_id,
  lm.match_id AS last_message_match_id,
  lm.sender_id AS last_sender_id,
  lm.receiver_id AS last_receiver_id,
  lm.content AS last_content,
  lm.created_at AS last_created_at,
  lm.is_read AS last_is_read,

  (
    SELECT COUNT(*)
    FROM messages um
    WHERE um.match_id = m.id
      AND um.receiver_id = $1
      AND um.is_read = false
  ) AS unread_count

FROM matches m
JOIN users other_u
  ON other_u.id = CASE
    WHEN m.user_id1 = $1 THEN m.user_id2
    ELSE m.user_id1
  END
LEFT JOIN profiles other_p ON other_p.user_id = other_u.id

LEFT JOIN LATERAL (
  SELECT id, match_id, sender_id, receiver_id, content, created_at, is_read
  FROM messages
  WHERE match_id = m.id
  ORDER BY created_at DESC
  LIMIT 1
) lm ON TRUE

WHERE m.user_id1 = $1 OR m.user_id2 = $1
ORDER BY COALESCE(lm.created_at, m.created_at) DESC
`

	rows, err := DB.QueryContext(context.Background(), q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []MatchItem

	for rows.Next() {
		var (
			matchID   int
			matchedAt time.Time
			otherID   int
			otherLastSignedIn sql.NullTime
			firstName string
			age       int
			location  string
			photoUrl  string

			lmID         sql.NullInt64
			lmMatchID    sql.NullInt64
			lmSenderID   sql.NullInt64
			lmReceiverID sql.NullInt64
			lmContent    sql.NullString
			lmCreatedAt  sql.NullTime
			lmIsRead     sql.NullBool

			unreadCount int
		)

		if err := rows.Scan(
			&matchID,
			&matchedAt,
			&otherID,
			&otherLastSignedIn,
			&firstName,
			&age,
			&location,
			&photoUrl,
			&lmID,
			&lmMatchID,
			&lmSenderID,
			&lmReceiverID,
			&lmContent,
			&lmCreatedAt,
			&lmIsRead,
			&unreadCount,
		); err != nil {
			return nil, err
		}

		fn := firstName
		var agePtr *int
		if age > 0 {
			a := age
			agePtr = &a
		}

		var locPtr *string
		if location != "" {
			l := location
			locPtr = &l
		}

		var photoPtr *string
		if photoUrl != "" {
			p := photoUrl
			photoPtr = &p
		}

		var lastMsg *MessageDTO
		if lmID.Valid {
			lastMsg = &MessageDTO{
				ID:         int(lmID.Int64),
				MatchID:    int(lmMatchID.Int64),
				SenderID:   int(lmSenderID.Int64),
				ReceiverID: int(lmReceiverID.Int64),
				Content:    lmContent.String,
				CreatedAt:  lmCreatedAt.Time,
				IsRead:     lmIsRead.Bool,
			}
		}

		// Calculate online status: online if last_signed_in is within last 5 minutes
		online := false
		if otherLastSignedIn.Valid {
			lastSignedInTime := otherLastSignedIn.Time
			now := time.Now()
			diff := now.Sub(lastSignedInTime)
			online = diff < 5*time.Minute
		}

		out = append(out, MatchItem{
			ID:          matchID,
			OtherUserID: otherID,
			MatchedAt:   matchedAt,
			Profile: &MiniProfile{
				ID:              otherID,
				FirstName:       &fn,
				Age:             agePtr,
				Location:        locPtr,
				ProfilePhotoUrl: photoPtr,
			},
			PhotoUrl:    photoPtr,
			LastMessage: lastMsg,
			UnreadCount: unreadCount,
			Online:      online,
		})
	}

	return out, rows.Err()
}

func DeleteMatch(matchID, userID int) error {
    res, err := DB.Exec(`
        DELETE FROM matches
        WHERE id = $1
          AND (user_id1 = $2 OR user_id2 = $2)
    `, matchID, userID)

    if err != nil {
        return err
    }

    rows, _ := res.RowsAffected()
    if rows == 0 {
        return ErrNotFound
    }

    return nil
}
