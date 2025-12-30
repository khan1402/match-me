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

	// Finnish cities (70% of users)
	finlandCities = []struct {
		name      string
		country   string
		latitude  float64
		longitude float64
	}{
		{"Helsinki", "Finland", 60.1699, 24.9384},
		{"Espoo", "Finland", 60.2055, 24.6559},
		{"Tampere", "Finland", 61.4991, 23.7871},
		{"Vantaa", "Finland", 60.2934, 25.0378},
		{"Oulu", "Finland", 65.0121, 25.4651},
		{"Turku", "Finland", 60.4518, 22.2666},
		{"Jyväskylä", "Finland", 62.2415, 25.7209},
		{"Lahti", "Finland", 60.9827, 25.6612},
		{"Kuopio", "Finland", 62.8924, 27.6782},
		{"Pori", "Finland", 61.4833, 21.7972},
		{"Kouvola", "Finland", 60.8681, 26.7042},
		{"Joensuu", "Finland", 62.6019, 29.7636},
		{"Lappeenranta", "Finland", 61.0586, 28.1887},
		{"Hämeenlinna", "Finland", 60.9960, 24.4643},
		{"Vaasa", "Finland", 63.0960, 21.6158},
	}

	// European cities (30% of users)
	europeanCities = []struct {
		name      string
		country   string
		latitude  float64
		longitude float64
	}{
		{"Stockholm", "Sweden", 59.3293, 18.0686},
		{"Gothenburg", "Sweden", 57.7089, 11.9746},
		{"Malmö", "Sweden", 55.6050, 13.0038},
		{"Oslo", "Norway", 59.9139, 10.7522},
		{"Copenhagen", "Denmark", 55.6761, 12.5683},
		{"Berlin", "Germany", 52.5200, 13.4050},
		{"Hamburg", "Germany", 53.5511, 9.9937},
		{"Munich", "Germany", 48.1351, 11.5820},
		{"Amsterdam", "Netherlands", 52.3676, 4.9041},
		{"Rotterdam", "Netherlands", 51.9244, 4.4777},
		{"Brussels", "Belgium", 50.8503, 4.3517},
		{"Vienna", "Austria", 48.2082, 16.3738},
		{"Zurich", "Switzerland", 47.3769, 8.5417},
		{"Paris", "France", 48.8566, 2.3522},
		{"Lyon", "France", 45.7640, 4.8357},
		{"Barcelona", "Spain", 41.3851, 2.1734},
		{"Madrid", "Spain", 40.4168, -3.7038},
		{"Rome", "Italy", 41.9028, 12.4964},
		{"Milan", "Italy", 45.4642, 9.1900},
		{"Warsaw", "Poland", 52.2297, 21.0122},
		{"Prague", "Czech Republic", 50.0755, 14.4378},
		{"Budapest", "Hungary", 47.4979, 19.0402},
		{"Dublin", "Ireland", 53.3498, -6.2603},
		{"Lisbon", "Portugal", 38.7223, -9.1393},
		{"Athens", "Greece", 37.9838, 23.7275},
	}

	genders    = []string{"male", "female", "non-binary"}
	lookingFor = []string{"male", "female", "everyone"}

	promptAnswers = map[string][]string{
		"My ideal Sunday morning is...": {
			"Coffee and a good book",
			"Brunch with friends",
			"Exploring the city",
			"Sleeping in and relaxing",
			"Outdoor activities",
			"Yoga and meditation",
			"Cooking a big breakfast",
		},
		"I'm weirdly attracted to...": {
			"People who can make me laugh",
			"Good conversation",
			"Creative minds",
			"Adventurous spirits",
			"Genuine kindness",
			"People who are passionate about their interests",
			"Those who aren't afraid to be themselves",
		},
		"The way to win me over is...": {
			"Be genuine and authentic",
			"Show interest in my hobbies",
			"Make me laugh",
			"Plan a thoughtful date",
			"Be a good listener",
			"Share your passions with me",
		},
		"I'm looking for...": {
			"Someone to explore the world with",
			"A genuine connection",
			"Adventure and fun",
			"Deep conversations",
			"Someone who shares my values",
			"A partner in crime",
		},
		"My most controversial opinion is...": {
			"Pineapple belongs on pizza",
			"Morning people are superior",
			"Cats are better than dogs",
			"Winter is the best season",
			"Books are better than movies",
		},
		"I geek out on...": {
			"Sci-fi movies and shows",
			"Board games",
			"Technology and gadgets",
			"Comic books",
			"Video games",
			"Anime and manga",
		},
	}
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

	// Ensure prompts and interests are seeded
	seedPromptsAndInterests(db)

	// Update all existing users' locations to European distribution
	updateAllUserLocations(db)

	// Seed users
	seedUsers(db, 150)

	log.Println("Seeding completed successfully")
}

// seedPromptsAndInterests ensures prompts and interests are in the database
func seedPromptsAndInterests(db *sql.DB) {
	log.Println("Seeding prompts and interests...")

	// Seed prompts
	promptsData := []struct {
		text     string
		category string
	}{
		{"My ideal Sunday morning is...", "lifestyle"},
		{"I'm weirdly attracted to...", "personality"},
		{"The way to win me over is...", "personality"},
		{"I'm looking for...", "relationship"},
		{"My most controversial opinion is...", "personality"},
		{"I geek out on...", "hobbies"},
		{"The best travel story I have is...", "travel"},
		{"I won't shut up about...", "personality"},
		{"My simple pleasures are...", "lifestyle"},
		{"The most spontaneous thing I've done is...", "adventure"},
		{"My love language is...", "relationship"},
		{"I judge people by...", "values"},
		{"The last book I loved was...", "books"},
		{"The best concert I've been to is...", "music"},
		{"My favorite way to spend a Friday night is...", "lifestyle"},
		{"My friends describe me as...", "personality"},
		{"A green flag in a relationship is...", "relationship"},
		{"A red flag in a relationship is...", "relationship"},
		{"The most interesting place I've visited is...", "travel"},
		{"My comfort show is...", "entertainment"},
	}

	for _, p := range promptsData {
		// Check if prompt already exists
		var exists bool
		err := db.QueryRowContext(
			context.Background(),
			`SELECT EXISTS(SELECT 1 FROM prompts WHERE text = $1)`,
			p.text,
		).Scan(&exists)
		if err != nil {
			log.Printf("Error checking prompt '%s': %v", p.text, err)
			continue
		}
		if !exists {
			_, err = db.ExecContext(
				context.Background(),
				`INSERT INTO prompts (text, category) VALUES ($1, $2)`,
				p.text, p.category,
			)
			if err != nil {
				log.Printf("Error seeding prompt '%s': %v", p.text, err)
			}
		}
	}

	// Seed interests
	interestsData := []struct {
		name     string
		category string
	}{
		{"Photography", "hobbies"},
		{"Reading", "hobbies"},
		{"Painting", "hobbies"},
		{"Cooking", "hobbies"},
		{"Gaming", "hobbies"},
		{"Gardening", "hobbies"},
		{"Writing", "hobbies"},
		{"Rock", "music"},
		{"Pop", "music"},
		{"Jazz", "music"},
		{"Classical", "music"},
		{"Hip Hop", "music"},
		{"Electronic", "music"},
		{"Country", "music"},
		{"Italian Food", "food"},
		{"Mexican Food", "food"},
		{"Asian Food", "food"},
		{"Vegan Food", "food"},
		{"Street Food", "food"},
		{"Fitness", "lifestyle"},
		{"Yoga", "lifestyle"},
		{"Meditation", "lifestyle"},
		{"Minimalism", "lifestyle"},
		{"Sustainability", "lifestyle"},
		{"Football", "sports"},
		{"Basketball", "sports"},
		{"Tennis", "sports"},
		{"Running", "sports"},
		{"Cycling", "sports"},
		{"Swimming", "sports"},
		{"Movies", "entertainment"},
		{"TV Shows", "entertainment"},
		{"Anime", "entertainment"},
		{"Theatre", "entertainment"},
		{"Podcasts", "entertainment"},
		{"Backpacking", "travel"},
		{"Road Trips", "travel"},
		{"City Breaks", "travel"},
		{"Beach Holidays", "travel"},
		{"Nature Trips", "travel"},
		{"Cultural Tourism", "travel"},
		{"Volunteering", "other"},
		{"Animals", "other"},
		{"Technology", "other"},
		{"Fashion", "other"},
		{"Art", "other"},
		{"Politics", "other"},
		{"Environment", "other"},
	}

	for _, i := range interestsData {
		_, err := db.ExecContext(
			context.Background(),
			`INSERT INTO interests (name, category) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
			i.name, i.category,
		)
		if err != nil {
			log.Printf("Error seeding interest '%s': %v", i.name, err)
		}
	}

	log.Println("Prompts and interests seeded successfully")
}

// updateAllUserLocations updates all existing users to have European/Finland locations
func updateAllUserLocations(db *sql.DB) {
	log.Println("Updating all existing users' locations to European distribution...")

	rows, err := db.QueryContext(context.Background(), `SELECT user_id FROM profiles`)
	if err != nil {
		log.Printf("Error querying profiles: %v", err)
		return
	}
	defer rows.Close()

	updatedCount := 0
	for rows.Next() {
		var userID int
		if err := rows.Scan(&userID); err != nil {
			continue
		}

		// Assign location: 70% Finland, 30% Europe
		var city struct {
			name      string
			country   string
			latitude  float64
			longitude float64
		}
		if rand.Float64() < 0.7 {
			city = finlandCities[rand.Intn(len(finlandCities))]
		} else {
			city = europeanCities[rand.Intn(len(europeanCities))]
		}
		location := fmt.Sprintf("%s, %s", city.name, city.country)
		// Add small random offset to coordinates for variety
		latitude := city.latitude + (rand.Float64()-0.5)*0.1
		longitude := city.longitude + (rand.Float64()-0.5)*0.1

		_, err = db.ExecContext(context.Background(),
			`UPDATE profiles SET location = $1, latitude = $2, longitude = $3 WHERE user_id = $4`,
			location, latitude, longitude, userID)
		if err != nil {
			log.Printf("Error updating location for user %d: %v", userID, err)
			continue
		}
		updatedCount++
	}

	log.Printf("Updated locations for %d existing users", updatedCount)
}

func seedUsers(db *sql.DB, count int) {
	rand.Seed(time.Now().UnixNano())

	for i := 1; i <= count; i++ {
		email := fmt.Sprintf("user%d@example.com", i)
		password := "password123"
		name := fmt.Sprintf("%s %s", randomElement(firstNames), randomElement(lastNames))

		// Check if user already exists
		var userID int
		err := db.QueryRowContext(
			context.Background(),
			`SELECT id FROM users WHERE email = $1`,
			email,
		).Scan(&userID)

		if err == sql.ErrNoRows {
			// User doesn't exist, create new one
			hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
			if err != nil {
				log.Printf("Error hashing password for user %d: %v", i, err)
				continue
			}

			err = db.QueryRowContext(
				context.Background(),
				`INSERT INTO users (email, password, name)
				 VALUES ($1, $2, $3)
				 RETURNING id`,
				email, string(hashedPassword), name,
			).Scan(&userID)

			if err != nil {
				log.Printf("Error creating user %d: %v", i, err)
				continue
			}
		} else if err != nil {
			log.Printf("Error checking user %d: %v", i, err)
			continue
		} else {
			// User exists, check if they have photos and prompts
			var photoCount int
			var promptCount int
			db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM photos WHERE user_id = $1`, userID).Scan(&photoCount)
			db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM user_prompts WHERE user_id = $1`, userID).Scan(&promptCount)

			if photoCount > 0 && promptCount > 0 {
				// User already has photos and prompts, skip
				continue
			}
		}

		// Check if profile exists
		var profileExists bool
		err = db.QueryRowContext(
			context.Background(),
			`SELECT EXISTS(SELECT 1 FROM profiles WHERE user_id = $1)`,
			userID,
		).Scan(&profileExists)

		if !profileExists {
			// Create profile
			firstName := randomElement(firstNames)
			lastName := randomElement(lastNames)
			age := rand.Intn(40) + 18 // 18-58
			gender := randomElement(genders)
			looking := randomElement(lookingFor)
			bio := randomElement(bios)

			// Select location: 70% Finland, 30% Europe
			var city struct {
				name      string
				country   string
				latitude  float64
				longitude float64
			}
			if rand.Float64() < 0.7 {
				city = finlandCities[rand.Intn(len(finlandCities))]
			} else {
				city = europeanCities[rand.Intn(len(europeanCities))]
			}
			location := fmt.Sprintf("%s, %s", city.name, city.country)
			// Add small random offset to coordinates for variety within the city
			latitude := city.latitude + (rand.Float64()-0.5)*0.1
			longitude := city.longitude + (rand.Float64()-0.5)*0.1
			maxDistance := rand.Intn(100) + 10

			// Generate profile photo URL (using randomuser.me or picsum)
			genderFolder := "men"
			if gender == "female" {
				genderFolder = "women"
			}
			portraitIndex := (i % 99) + 1
			profilePhotoUrl := fmt.Sprintf("https://randomuser.me/api/portraits/%s/%d.jpg", genderFolder, portraitIndex)

			_, err = db.ExecContext(
				context.Background(),
				`INSERT INTO profiles (user_id, first_name, last_name, age, gender, looking_for, bio, location, latitude, longitude, max_distance_km, profile_photo_url, is_profile_complete, is_verified)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
				userID, firstName, lastName, age, gender, looking, bio, location, latitude, longitude, maxDistance, profilePhotoUrl, true, true,
			)

			if err != nil {
				log.Printf("Error creating profile for user %d: %v", i, err)
				continue
			}
		} else {
			// Update profile photo if missing
			var hasProfilePhoto bool
			db.QueryRowContext(
				context.Background(),
				`SELECT profile_photo_url IS NOT NULL AND profile_photo_url != '' FROM profiles WHERE user_id = $1`,
				userID,
			).Scan(&hasProfilePhoto)

			if !hasProfilePhoto {
				var gender string
				db.QueryRowContext(context.Background(), `SELECT gender FROM profiles WHERE user_id = $1`, userID).Scan(&gender)
				genderFolder := "men"
				if gender == "female" {
					genderFolder = "women"
				}
				portraitIndex := (i % 99) + 1
				profilePhotoUrl := fmt.Sprintf("https://randomuser.me/api/portraits/%s/%d.jpg", genderFolder, portraitIndex)
				db.ExecContext(context.Background(), `UPDATE profiles SET profile_photo_url = $1 WHERE user_id = $2`, profilePhotoUrl, userID)
			}

			// Always update location to new distribution (70% Finland, 30% Europe)
			// This ensures all existing users get updated to European locations
			var city struct {
				name      string
				country   string
				latitude  float64
				longitude float64
			}
			if rand.Float64() < 0.7 {
				city = finlandCities[rand.Intn(len(finlandCities))]
			} else {
				city = europeanCities[rand.Intn(len(europeanCities))]
			}
			location := fmt.Sprintf("%s, %s", city.name, city.country)
			// Add small random offset to coordinates for variety
			latitude := city.latitude + (rand.Float64()-0.5)*0.1
			longitude := city.longitude + (rand.Float64()-0.5)*0.1
			db.ExecContext(context.Background(),
				`UPDATE profiles SET location = $1, latitude = $2, longitude = $3 WHERE user_id = $4`,
				location, latitude, longitude, userID)
		}

		// Add photos (2-4 photos per user) - only if they don't have photos
		var photoCount int
		db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM photos WHERE user_id = $1`, userID).Scan(&photoCount)

		if photoCount == 0 {
			numPhotos := rand.Intn(3) + 2 // 2-4 photos
			for j := 0; j < numPhotos; j++ {
				photoUrl := fmt.Sprintf("https://picsum.photos/seed/user%d-photo%d/600/600", i, j)
				_, err = db.ExecContext(
					context.Background(),
					`INSERT INTO photos (user_id, photo_url, sort_order) VALUES ($1, $2, $3)`,
					userID, photoUrl, j,
				)
				if err != nil {
					log.Printf("Error adding photo for user %d: %v", i, err)
				}
			}
		}

		// Add interests
		numInterests := rand.Intn(5) + 2 // 2-6 interests
		usedInterests := make(map[string]bool)
		for j := 0; j < numInterests; j++ {
			interest := randomElement(interests)
			// Avoid duplicates
			for usedInterests[interest] {
				interest = randomElement(interests)
			}
			usedInterests[interest] = true

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
				`INSERT INTO user_interests (user_id, interest_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
				userID, interestID,
			)
			if err != nil {
				log.Printf("Error adding user interest: %v", err)
			}
		}

		// Add prompt answers (2-3 prompts per user) - only if they don't have prompts
		var promptCount int
		db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM user_prompts WHERE user_id = $1`, userID).Scan(&promptCount)

		if promptCount == 0 {
			rows, err := db.QueryContext(
				context.Background(),
				`SELECT id, text FROM prompts ORDER BY RANDOM() LIMIT 3`,
			)
			if err == nil {
				defer rows.Close()
				promptOrder := 0
				for rows.Next() {
					var promptID int
					var promptText string
					if err := rows.Scan(&promptID, &promptText); err != nil {
						continue
					}

					// Get a random answer for this prompt if available
					answers, exists := promptAnswers[promptText]
					var answer string
					if exists && len(answers) > 0 {
						answer = randomElement(answers)
					} else {
						// Generic answer if prompt not in our map
						answer = "This is something I'm passionate about!"
					}

					_, err = db.ExecContext(
						context.Background(),
						`INSERT INTO user_prompts (user_id, prompt_id, answer, display_order) 
						 VALUES ($1, $2, $3, $4) 
						 ON CONFLICT (user_id, prompt_id) DO NOTHING`,
						userID, promptID, answer, promptOrder,
					)
					if err != nil {
						log.Printf("Error adding prompt answer for user %d: %v", i, err)
					}
					promptOrder++
				}
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
