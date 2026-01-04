package models

import (
	"database/sql"
	"time"
)

// User represents a user account
type User struct {
	ID           int       `db:"id" json:"id"`
	Email        string    `db:"email" json:"email"`
	Password     string    `db:"password" json:"-"`
	Name         string    `db:"name" json:"name"`
	Role         string    `db:"role" json:"role"`
	CreatedAt    time.Time `db:"createdAt" json:"createdAt"`
	UpdatedAt    time.Time `db:"updatedAt" json:"updatedAt"`
	LastSignedIn time.Time `db:"lastSignedIn" json:"lastSignedIn"`
}

// Profile represents user profile information
type Profile struct {
	ID                 int             `db:"id" json:"id"`
	UserID             int             `db:"userId" json:"userId"`
	Username           sql.NullString  `db:"username" json:"username"`
	FirstName          sql.NullString  `db:"firstName" json:"firstName"`
	LastName           sql.NullString  `db:"lastName" json:"lastName"`
	Age                sql.NullInt32   `db:"age" json:"age"`
	MinAge             sql.NullInt32   `db:"min_age" json:"minAge,omitempty"`
	MaxAge             sql.NullInt32   `db:"max_age" json:"maxAge,omitempty"`
	Gender             sql.NullString  `db:"gender" json:"gender"`
	LookingFor         sql.NullString  `db:"lookingFor" json:"lookingFor"`
	Bio                sql.NullString  `db:"bio" json:"bio"`
	Location           sql.NullString  `db:"location" json:"location"`
	Latitude           sql.NullFloat64 `db:"latitude" json:"latitude"`
	Longitude          sql.NullFloat64 `db:"longitude" json:"longitude"`
	MaxDistanceKm      int             `db:"maxDistanceKm" json:"maxDistanceKm"`
	AllowOutsideRadius bool            `db:"allowOutsideRadius" json:"allowOutsideRadius"`
	ProfilePhotoUrl    sql.NullString  `db:"profilePhotoUrl" json:"profilePhotoUrl"`
	IsProfileComplete  bool            `db:"isProfileComplete" json:"isProfileComplete"`
	IsVerified         bool            `db:"isVerified" json:"isVerified"`
	CreatedAt          time.Time       `db:"createdAt" json:"createdAt"`
	UpdatedAt          time.Time       `db:"updatedAt" json:"updatedAt"`
}

// Prompt represents a predefined prompt question
type Prompt struct {
	ID        int       `db:"id" json:"id"`
	Text      string    `db:"text" json:"text"`
	Category  string    `db:"category" json:"category"`
	IsActive  bool      `db:"isActive" json:"isActive"`
	CreatedAt time.Time `db:"createdAt" json:"createdAt"`
}

// UserPrompt represents a user's answer to a prompt
type UserPrompt struct {
	ID           int       `db:"id" json:"id"`
	UserID       int       `db:"userId" json:"userId"`
	PromptID     int       `db:"promptId" json:"promptId"`
	Answer       string    `db:"answer" json:"answer"`
	DisplayOrder int       `db:"displayOrder" json:"displayOrder"`
	CreatedAt    time.Time `db:"createdAt" json:"createdAt"`
	UpdatedAt    time.Time `db:"updatedAt" json:"updatedAt"`
	PromptText   string    `db:"-" json:"question,omitempty"`
}

// Interest represents a predefined interest
type Interest struct {
	ID       int    `db:"id" json:"id"`
	Name     string `db:"name" json:"name"`
	Category string `db:"category" json:"category"`
	IsActive bool   `db:"isActive" json:"isActive"`
}

type PromptAnswerInput struct {
	PromptID     int    `json:"promptId"`
	Answer       string `json:"answer"`
	DisplayOrder int    `json:"displayOrder"`
}

// UserInterest represents a user's selected interest
type UserInterest struct {
	ID           int    `db:"id" json:"id"`
	UserID       int    `db:"userId" json:"userId"`
	InterestID   int    `db:"interestId" json:"interestId"`
	InterestName string `db:"-" json:"interestName,omitempty"`
}

// Photo represents a user's photo
type Photo struct {
	ID        int       `db:"id" json:"id"`
	UserID    int       `db:"userId" json:"userId"`
	PhotoUrl  string    `db:"photoUrl" json:"photoUrl"`
	Order     int       `db:"order" json:"order"`
	CreatedAt time.Time `db:"createdAt" json:"createdAt"`
}

// Interaction represents a user's interaction with another user (like/pass)
type Interaction struct {
	ID           int       `db:"id" json:"id"`
	UserID       int       `db:"userId" json:"userId"`
	TargetUserID int       `db:"targetUserId" json:"targetUserId"`
	Type         string    `db:"type" json:"type"` // like, pass
	CreatedAt    time.Time `db:"createdAt" json:"createdAt"`
}

// Match represents a mutual connection between two users
type Match struct {
	ID        int       `db:"id" json:"id"`
	UserID1   int       `db:"userId1" json:"userId1"`
	UserID2   int       `db:"userId2" json:"userId2"`
	CreatedAt time.Time `db:"createdAt" json:"createdAt"`
}

// Message represents a chat message
type Message struct {
	ID         int       `db:"id" json:"id"`
	MatchID    int       `db:"matchId" json:"matchId"`
	SenderID   int       `db:"senderId" json:"senderId"`
	ReceiverID int       `db:"receiverId" json:"receiverId"`
	Content    string    `db:"content" json:"content"`
	IsRead     bool      `db:"isRead" json:"isRead"`
	CreatedAt  time.Time `db:"createdAt" json:"createdAt"`
}

// Notification represents a notification
type Notification struct {
	ID             int       `db:"id" json:"id"`
	UserID         int       `db:"user_id" json:"userId"`
	Type           string    `db:"type" json:"type"`
	RelatedUserID  *int      `db:"related_user_id" json:"relatedUserId"`
	RelatedMatchID *int      `db:"related_match_id" json:"relatedMatchId"`
	Content        string    `db:"message" json:"content"` // DB column is "message", JSON field is "content"
	IsRead         bool      `db:"is_read" json:"isRead"`
	CreatedAt      time.Time `db:"created_at" json:"createdAt"`
}

// Block represents a user blocking another user
type Block struct {
	ID        int       `db:"id" json:"id"`
	UserID    int       `db:"userId" json:"userId"`
	BlockedID int       `db:"blockedId" json:"blockedId"`
	CreatedAt time.Time `db:"createdAt" json:"createdAt"`
}

// Report represents a user report
type Report struct {
	ID         int       `db:"id" json:"id"`
	UserID     int       `db:"userId" json:"userId"`
	ReportedID int       `db:"reportedId" json:"reportedId"`
	Reason     string    `db:"reason" json:"reason"`
	Status     string    `db:"status" json:"status"`
	CreatedAt  time.Time `db:"createdAt" json:"createdAt"`
}

// JWT Claims
type Claims struct {
	UserID int    `json:"userId"`
	Email  string `json:"email"`
}

// API Response types
type UserResponse struct {
	ID             int    `json:"id"`
	Name           string `json:"name"`
	ProfilePicture string `json:"profilePicture"`
}

type ProfileResponse struct {
	ID                 int     `json:"id"`
	FirstName          string  `json:"firstName"`
	Age                int     `json:"age"`
	MinAge             *int    `json:"minAge,omitempty"`
	MaxAge             *int    `json:"maxAge,omitempty"`
	Location           string  `json:"location"`
	Bio                string  `json:"bio"`
	IsVerified         bool    `json:"isVerified"`
	ProfilePhotoUrl    string  `json:"profilePhotoUrl"`
	Gender             string  `json:"gender"`
	LookingFor         string  `json:"lookingFor"`
	Latitude           float64 `json:"latitude"`
	Longitude          float64 `json:"longitude"`
	MaxDistanceKm      int     `json:"maxDistanceKm"`
	AllowOutsideRadius bool    `json:"allowOutsideRadius"`
}

type BioResponse struct {
	ID         int                `json:"id"`
	Gender     string             `json:"gender"`
	LookingFor string             `json:"lookingFor"`
	Age        int                `json:"age"`
	Location   string             `json:"location"`
	Interests  []string           `json:"interests"`
	Prompts    []PromptAnswerPair `json:"prompts"`
}

type PromptAnswerPair struct {
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

type DiscoveryResponse struct {
	ID             int                `json:"id"`
	Gender         string             `json:"gender"`
	LookingFor     string             `json:"lookingFor"`
	Age            int                `json:"age"`
	Location       string             `json:"location"`
	Interests      []string           `json:"interests"`
	Prompts        []PromptAnswerPair `json:"prompts"`
	Name           string             `json:"name"`
	ProfilePicture string             `json:"profilePicture"`
}

type RecommendationResponse struct {
	ID             int    `json:"id"`
	Name           string `json:"name"`
	ProfilePicture string `json:"profilePicture"`
}

type ConnectionResponse struct {
	ID int `json:"id"`
}
