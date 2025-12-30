package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"os"
	"time"

	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

var (
	firstNames = []string{"Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Henry", "Iris", "Jack",
		"Karen", "Leo", "Mia", "Noah", "Olivia", "Peter", "Quinn", "Rachel", "Sam", "Tina",
		"Uma", "Victor", "Wendy", "Xavier", "Yara", "Zoe", "Adam", "Bella", "Chris", "Diana"}

	lastNames = []string{"Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez",
		"Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson",
		"Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson"}

	bios = []string{
		"Love hiking and outdoor adventures",
		"Coffee enthusiast and bookworm",
		"Passionate about travel and photography",
		"Fitness lover and gym regular",
		"Artist and creative thinker",
		"Tech enthusiast and startup founder",
		"Music lover and concert goer",
		"Foodie and cooking enthusiast",
		"Yoga instructor and wellness advocate",
		"Entrepreneur and business minded",
		"Adventure seeker and thrill junkie",
		"Movie buff and film critic",
		"Gaming enthusiast and streamer",
		"Volunteer and community activist",
		"Pet lover and animal advocate",
	}

	interests = []string{
		"hiking", "photography", "travel", "cooking", "music", "art", "sports",
		"reading", "movies", "gaming", "fitness", "yoga", "meditation", "volunteering",
		"technology", "entrepreneurship", "fashion", "design", "nature", "animals",
	}

	locations = []string{
		"New York, NY", "Los Angeles, CA", "Chicago, IL", "Houston, TX", "Phoenix, AZ",
		"Philadelphia, PA", "San Antonio, TX", "San Diego, CA", "Dallas, TX", "San Jose, CA",
		"Austin, TX", "Jacksonville, FL", "Fort Worth, TX", "Columbus, OH", "Charlotte, NC",
		"San Francisco, CA", "Indianapolis, IN", "Seattle, WA", "Denver, CO", "Boston, MA",
	}

	genders = []string{"male", "female", "non-binary"}
	lookingFor = []string{"male", "female", "everyone"}
)

func main() {
	// Database connection
	dbURL := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		getEnv("DB_USER", "matchme_user"),
		getEnv("DB_PASSWORD", "matchme_password"),
		getEnv("DB_HOST", "localhost"),
		getEnv("DB_PORT", "5432"),
		getEnv("DB_NAME", "matchme"),
	)

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Test connection
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	log.Println("Connected to database")

	// Seed users
	seedUsers(db, 150)

	log.Println("Seeding completed successfully")
}

func seedUsers(db *sql.DB, count int) {
	rand.Seed(time.Now().UnixNano())

	for i := 1; i <= count; i++ {
		email := fmt.Sprintf("user%d@example.com", i)
		password := "password123"
		name := fmt.Sprintf("%s %s", randomElement(firstNames), randomElement(lastNames))

		// Hash password
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("Error hashing password for user %d: %v", i, err)
			continue
		}

		// Create user
		var userID int
		err = db.QueryRowContext(
			context.Background(),
			`INSERT INTO users (email, password, name, createdAt, updatedAt)
			 VALUES ($1, $2, $3, NOW(), NOW())
			 RETURNING id`,
			email, string(hashedPassword), name,
		).Scan(&userID)

		if err != nil {
			log.Printf("Error creating user %d: %v", i, err)
			continue
		}

		// Create profile
		firstName := randomElement(firstNames)
		lastName := randomElement(lastNames)
		age := rand.Intn(40) + 18 // 18-58
		gender := randomElement(genders)
		looking := randomElement(lookingFor)
		bio := randomElement(bios)
		location := randomElement(locations)
		latitude := rand.Float64()*180 - 90
		longitude := rand.Float64()*360 - 180
		maxDistance := rand.Intn(100) + 10

		_, err = db.ExecContext(
			context.Background(),
			`INSERT INTO profiles (userId, firstName, lastName, age, gender, lookingFor, bio, location, latitude, longitude, maxDistanceKm, isProfileComplete, isVerified)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
			userID, firstName, lastName, age, gender, looking, bio, location, latitude, longitude, maxDistance, true, true,
		)

		if err != nil {
			log.Printf("Error creating profile for user %d: %v", i, err)
			continue
		}

		// Add interests
		numInterests := rand.Intn(5) + 2 // 2-6 interests
		for j := 0; j < numInterests; j++ {
			interest := randomElement(interests)

			// Get or create interest
			var interestID int
			err := db.QueryRowContext(
				context.Background(),
				`SELECT id FROM interests WHERE name = $1`,
				interest,
			).Scan(&interestID)

			if err == sql.ErrNoRows {
				// Create interest
				err = db.QueryRowContext(
					context.Background(),
					`INSERT INTO interests (name) VALUES ($1) RETURNING id`,
					interest,
				).Scan(&interestID)
				if err != nil {
					log.Printf("Error creating interest: %v", err)
					continue
				}
			} else if err != nil {
				log.Printf("Error getting interest: %v", err)
				continue
			}

			// Add user interest
			_, err = db.ExecContext(
				context.Background(),
				`INSERT INTO userInterests (userId, interestId) VALUES ($1, $2)`,
				userID, interestID,
			)
			if err != nil {
				log.Printf("Error adding user interest: %v", err)
			}
		}

		if i%10 == 0 {
			log.Printf("Created %d users...", i)
		}
	}
}

func randomElement(slice []string) string {
	return slice[rand.Intn(len(slice))]
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}
