import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import {
  users,
  profiles,
  photos,
  interests,
  userInterests,
  prompts,
  userPrompts,
} from "../drizzle/schema.js";

/**
 * EXTENDED SEED FILE - 100 USERS
 * 
 * Includes:
 * - 12 strategic test users (Alice, Bob, Carol, David, etc.)
 * - 88 randomly generated users for realistic testing
 * 
 * Password for ALL users: password123
 */

// ============================================
// HELPER FUNCTIONS FOR RANDOM GENERATION
// ============================================

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const FIRST_NAMES_MALE = [
  "Lauri", "Mika", "Johan", "Luca", "Omar", "Samir", "David", "Emil", 
  "Leo", "Jonas", "Mikko", "Jari", "Antti", "Ville", "Sami", "Juha",
  "Petri", "Timo", "Markus", "Jukka", "Henrik", "Erik", "Niklas", "Oskar"
];

const FIRST_NAMES_FEMALE = [
  "Anna", "Sara", "Hanna", "Mia", "Sofia", "Elena", "Linda", "Noora",
  "Fatima", "Amira", "Emma", "Olivia", "Aino", "Helmi", "Lilja", "Venla",
  "Isla", "Aada", "Ella", "Emilia", "Pihla", "Kerttu", "Siiri", "Viivi"
];

const LAST_NAMES = [
  "Virtanen", "Korhonen", "Johansson", "Karlsson", "Müller", "Schmidt",
  "Garcia", "Rossi", "Ahmed", "Petrov", "Nieminen", "Mäkinen", "Laine",
  "Järvinen", "Salo", "Andersson", "Larsson", "Nielsen", "Hansen", "Berg"
];

const CITIES_FINLAND = [
  { city: "Helsinki", country: "Finland", lat: 60.1699, lng: 24.9384 },
  { city: "Espoo", country: "Finland", lat: 60.2055, lng: 24.6559 },
  { city: "Vantaa", country: "Finland", lat: 60.2934, lng: 25.0378 },
  { city: "Tampere", country: "Finland", lat: 61.4991, lng: 23.7871 },
  { city: "Turku", country: "Finland", lat: 60.4518, lng: 22.2666 },
  { city: "Oulu", country: "Finland", lat: 65.0121, lng: 25.4651 },
  { city: "Lahti", country: "Finland", lat: 60.9827, lng: 25.6612 },
  { city: "Kuopio", country: "Finland", lat: 62.8924, lng: 27.6782 },
];

const CITIES_SWEDEN = [
  { city: "Stockholm", country: "Sweden", lat: 59.3293, lng: 18.0686 },
  { city: "Gothenburg", country: "Sweden", lat: 57.7089, lng: 11.9746 },
  { city: "Malmö", country: "Sweden", lat: 55.6050, lng: 13.0038 },
  { city: "Uppsala", country: "Sweden", lat: 59.8586, lng: 17.6389 },
];

const CITIES_OTHER = [
  { city: "Berlin", country: "Germany", lat: 52.5200, lng: 13.4050 },
  { city: "Hamburg", country: "Germany", lat: 53.5511, lng: 9.9937 },
  { city: "Amsterdam", country: "Netherlands", lat: 52.3676, lng: 4.9041 },
  { city: "Copenhagen", country: "Denmark", lat: 55.6761, lng: 12.5683 },
  { city: "Oslo", country: "Norway", lat: 59.9139, lng: 10.7522 },
];

const ALL_CITIES = [...CITIES_FINLAND, ...CITIES_SWEDEN, ...CITIES_OTHER];

const OCCUPATIONS = [
  "software developer", "graphic designer", "product manager", "teacher",
  "nurse", "marketing specialist", "data analyst", "photographer",
  "student", "researcher", "architect", "engineer", "doctor", "lawyer",
  "consultant", "entrepreneur", "writer", "musician", "chef", "barista"
];

const HOBBIES = [
  "hiking", "photography", "cooking", "reading", "gaming", "yoga",
  "running", "cycling", "swimming", "climbing", "skiing", "sailing",
  "painting", "music", "dancing", "traveling", "coffee", "wine tasting",
  "board games", "podcasts", "movies", "theater", "museums", "concerts"
];

const VIBE_SENTENCES = [
  "I love good coffee and long walks.",
  "Weekends are for board games and brunch.",
  "Trying to visit one new city every year.",
  "Introvert who still likes deep conversations.",
  "Gym, Netflix and trying new recipes.",
  "Always up for spontaneous road trips.",
  "Learning a new language this year.",
  "Prefer quiet bars over loud clubs.",
  "Sauna enthusiast and nature lover.",
  "Foodie who loves trying new restaurants.",
  "Bookworm looking for reading recommendations.",
  "Music festival regular and concert goer.",
];

// ============================================
// STRATEGIC TEST USERS (12 users)
// ============================================

const STRATEGIC_USERS = [
  {
    email: "alice.fi@test.com",
    name: "Alice Virtanen",
    username: "alice_helsinki",
    firstName: "Alice",
    lastName: "Virtanen",
    age: 28,
    gender: "female",
    lookingFor: "male",
    bio: "Software engineer who loves hiking, photography, and good coffee. Looking for someone to explore Helsinki's hidden gems with.",
    location: "Helsinki, Finland",
    latitude: 60.1699,
    longitude: 24.9384,
    profilePhotoUrl: "https://randomuser.me/api/portraits/women/1.jpg",
    photoUrls: [
      "https://picsum.photos/seed/alice1/600/600",
      "https://picsum.photos/seed/alice2/600/600",
    ],
    interests: ["Photography", "Hiking", "Coffee", "Technology"],
    prompts: [
      { category: "My ideal Sunday morning is...", answer: "Coffee, a good book, and a walk in nature" },
      { category: "I'm weirdly attracted to...", answer: "People who can explain complex things simply" },
    ],
  },
  {
    email: "bob.fi@test.com",
    name: "Bob Korhonen",
    username: "bob_helsinki",
    firstName: "Bob",
    lastName: "Korhonen",
    age: 30,
    gender: "male",
    lookingFor: "female",
    bio: "Marketing manager and amateur chef. Love trying new restaurants and cooking at home. Sauna enthusiast.",
    location: "Helsinki, Finland",
    latitude: 60.1750,
    longitude: 24.9410,
    profilePhotoUrl: "https://randomuser.me/api/portraits/men/1.jpg",
    photoUrls: [
      "https://picsum.photos/seed/bob1/600/600",
      "https://picsum.photos/seed/bob2/600/600",
    ],
    interests: ["Cooking", "Food", "Sauna", "Travel"],
    prompts: [
      { category: "My ideal Sunday morning is...", answer: "Brunch with friends and exploring new cafés" },
      { category: "I'm weirdly attracted to...", answer: "Good food photography" },
    ],
  },
  {
    email: "carol.fi@test.com",
    name: "Carol Nieminen",
    username: "carol_espoo",
    firstName: "Carol",
    lastName: "Nieminen",
    age: 26,
    gender: "female",
    lookingFor: "male",
    bio: "Graphic designer with a passion for art, music festivals, and yoga. Always planning my next adventure.",
    location: "Espoo, Finland",
    latitude: 60.2055,
    longitude: 24.6559,
    profilePhotoUrl: "https://randomuser.me/api/portraits/women/2.jpg",
    photoUrls: [
      "https://picsum.photos/seed/carol1/600/600",
      "https://picsum.photos/seed/carol2/600/600",
    ],
    interests: ["Art", "Music", "Yoga", "Travel"],
    prompts: [
      { category: "My ideal Sunday morning is...", answer: "Yoga class followed by brunch" },
      { category: "I'm weirdly attracted to...", answer: "Creative people with unique perspectives" },
    ],
  },
  {
    email: "david.fi@test.com",
    name: "David Mäkinen",
    username: "david_espoo",
    firstName: "David",
    lastName: "Mäkinen",
    age: 29,
    gender: "male",
    lookingFor: "female",
    bio: "Data scientist who enjoys board games, sci-fi movies, and weekend cycling trips. Looking for someone who appreciates both deep conversations and silly jokes.",
    location: "Espoo, Finland",
    latitude: 60.2100,
    longitude: 24.6600,
    profilePhotoUrl: "https://randomuser.me/api/portraits/men/2.jpg",
    photoUrls: [
      "https://picsum.photos/seed/david1/600/600",
      "https://picsum.photos/seed/david2/600/600",
    ],
    interests: ["Technology", "Board Games", "Cycling", "Movies"],
    prompts: [
      { category: "My ideal Sunday morning is...", answer: "Cycling by the sea, then coffee and a good sci-fi book" },
      { category: "I'm weirdly attracted to...", answer: "People who laugh at their own jokes" },
    ],
  },
  {
    email: "emma.fi@test.com",
    name: "Emma Laine",
    username: "emma_tampere",
    firstName: "Emma",
    lastName: "Laine",
    age: 27,
    gender: "female",
    lookingFor: "male",
    bio: "Teacher who loves reading, classical music, and long walks. Looking for someone genuine and kind.",
    location: "Tampere, Finland",
    latitude: 61.4991,
    longitude: 23.7871,
    profilePhotoUrl: "https://randomuser.me/api/portraits/women/3.jpg",
    photoUrls: [
      "https://picsum.photos/seed/emma1/600/600",
      "https://picsum.photos/seed/emma2/600/600",
    ],
    interests: ["Reading", "Classical Music", "Education", "Nature"],
    prompts: [
      { category: "My ideal Sunday morning is...", answer: "A quiet morning with a book and tea" },
      { category: "I'm weirdly attracted to...", answer: "People who are passionate about teaching" },
    ],
  },
  {
    email: "frank.fi@test.com",
    name: "Frank Järvinen",
    username: "frank_turku",
    firstName: "Frank",
    lastName: "Järvinen",
    age: 32,
    gender: "male",
    lookingFor: "female",
    bio: "Architect who enjoys sailing, photography, and exploring historic buildings. Based in Turku but travel to Helsinki often.",
    location: "Turku, Finland",
    latitude: 60.4518,
    longitude: 22.2666,
    profilePhotoUrl: "https://randomuser.me/api/portraits/men/3.jpg",
    photoUrls: [
      "https://picsum.photos/seed/frank1/600/600",
      "https://picsum.photos/seed/frank2/600/600",
    ],
    interests: ["Architecture", "Sailing", "Photography", "History"],
    prompts: [
      { category: "My ideal Sunday morning is...", answer: "Early morning sail followed by coffee at the harbor" },
      { category: "I'm weirdly attracted to...", answer: "Beautiful architecture and design details" },
    ],
  },
  {
    email: "grace.se@test.com",
    name: "Grace Andersson",
    username: "grace_stockholm",
    firstName: "Grace",
    lastName: "Andersson",
    age: 29,
    gender: "female",
    lookingFor: "everyone",
    bio: "Product designer who loves art galleries, indie music, and weekend getaways. Open to meeting interesting people.",
    location: "Stockholm, Sweden",
    latitude: 59.3293,
    longitude: 18.0686,
    profilePhotoUrl: "https://randomuser.me/api/portraits/women/4.jpg",
    photoUrls: [
      "https://picsum.photos/seed/grace1/600/600",
      "https://picsum.photos/seed/grace2/600/600",
    ],
    interests: ["Design", "Art", "Music", "Travel"],
    prompts: [
      { category: "My ideal Sunday morning is...", answer: "Visiting a new art gallery or museum" },
      { category: "I'm weirdly attracted to...", answer: "Creative problem solvers" },
    ],
  },
  {
    email: "henry.se@test.com",
    name: "Henry Johansson",
    username: "henry_stockholm",
    firstName: "Henry",
    lastName: "Johansson",
    age: 31,
    gender: "male",
    lookingFor: "female",
    bio: "Startup founder who enjoys running, podcasts, and good conversations over wine. Looking for someone ambitious and fun.",
    location: "Stockholm, Sweden",
    latitude: 59.3300,
    longitude: 18.0700,
    profilePhotoUrl: "https://randomuser.me/api/portraits/men/4.jpg",
    photoUrls: [
      "https://picsum.photos/seed/henry1/600/600",
      "https://picsum.photos/seed/henry2/600/600",
    ],
    interests: ["Entrepreneurship", "Running", "Wine", "Podcasts"],
    prompts: [
      { category: "My ideal Sunday morning is...", answer: "Long run followed by brunch and good conversation" },
      { category: "I'm weirdly attracted to...", answer: "Ambitious people who take risks" },
    ],
  },
  {
    email: "iris.de@test.com",
    name: "Iris Müller",
    username: "iris_berlin",
    firstName: "Iris",
    lastName: "Müller",
    age: 28,
    gender: "female",
    lookingFor: "male",
    bio: "Journalist who loves techno, street art, and late-night conversations. Berlin is home but I travel often.",
    location: "Berlin, Germany",
    latitude: 52.5200,
    longitude: 13.4050,
    profilePhotoUrl: "https://randomuser.me/api/portraits/women/5.jpg",
    photoUrls: [
      "https://picsum.photos/seed/iris1/600/600",
      "https://picsum.photos/seed/iris2/600/600",
    ],
    interests: ["Journalism", "Music", "Art", "Travel"],
    prompts: [
      { category: "My ideal Sunday morning is...", answer: "Recovering from Saturday night with coffee and friends" },
      { category: "I'm weirdly attracted to...", answer: "People who can dance without caring what others think" },
    ],
  },
  {
    email: "jack.de@test.com",
    name: "Jack Schmidt",
    username: "jack_berlin",
    firstName: "Jack",
    lastName: "Schmidt",
    age: 30,
    gender: "male",
    lookingFor: "female",
    bio: "Software engineer in Berlin. Love climbing, craft beer, and exploring the city by bike.",
    location: "Berlin, Germany",
    latitude: 52.5210,
    longitude: 13.4060,
    profilePhotoUrl: "https://randomuser.me/api/portraits/men/5.jpg",
    photoUrls: [
      "https://picsum.photos/seed/jack1/600/600",
      "https://picsum.photos/seed/jack2/600/600",
    ],
    interests: ["Technology", "Climbing", "Cycling", "Beer"],
    prompts: [
      { category: "My ideal Sunday morning is...", answer: "Climbing session followed by brunch" },
      { category: "I'm weirdly attracted to...", answer: "People who aren't afraid of heights" },
    ],
  },
  {
    email: "kate.fi@test.com",
    name: "Kate Salo",
    username: "kate_helsinki",
    firstName: "Kate",
    lastName: "Salo",
    age: 35,
    gender: "female",
    lookingFor: "male",
    bio: "Doctor who values work-life balance. Enjoy skiing, wine tasting, and quality time with close friends.",
    location: "Helsinki, Finland",
    latitude: 60.1800,
    longitude: 24.9500,
    profilePhotoUrl: "https://randomuser.me/api/portraits/women/6.jpg",
    photoUrls: [
      "https://picsum.photos/seed/kate1/600/600",
      "https://picsum.photos/seed/kate2/600/600",
    ],
    interests: ["Medicine", "Skiing", "Wine", "Travel"],
    prompts: [
      { category: "My ideal Sunday morning is...", answer: "Sleeping in, then brunch with friends" },
      { category: "I'm weirdly attracted to...", answer: "People who can make me laugh after a long day" },
    ],
  },
  {
    email: "leo.fi@test.com",
    name: "Leo Virtanen",
    username: "leo_helsinki",
    firstName: "Leo",
    lastName: "Virtanen",
    age: 24,
    gender: "male",
    lookingFor: "female",
    bio: "Student and part-time barista. Love music, gaming, and spontaneous adventures. Looking for someone fun and easygoing.",
    location: "Helsinki, Finland",
    latitude: 60.1650,
    longitude: 24.9300,
    profilePhotoUrl: "https://randomuser.me/api/portraits/men/6.jpg",
    photoUrls: [
      "https://picsum.photos/seed/leo1/600/600",
      "https://picsum.photos/seed/leo2/600/600",
    ],
    interests: ["Music", "Gaming", "Coffee", "Student Life"],
    prompts: [
      { category: "My ideal Sunday morning is...", answer: "Gaming with friends or exploring new coffee shops" },
      { category: "I'm weirdly attracted to...", answer: "People who aren't afraid to be themselves" },
    ],
  },
];

// ============================================
// RANDOM USER GENERATOR (88 users)
// ============================================

function generateRandomUsers(count) {
  const users = [];
  
  for (let i = 0; i < count; i++) {
    const gender = Math.random() < 0.5 ? "male" : "female";
    const firstName = gender === "male" 
      ? pickRandom(FIRST_NAMES_MALE) 
      : pickRandom(FIRST_NAMES_FEMALE);
    const lastName = pickRandom(LAST_NAMES);
    const fullName = `${firstName} ${lastName}`;
    const username = `${firstName.toLowerCase()}_${lastName.toLowerCase()}_${i}`;
    
    const age = 22 + Math.floor(Math.random() * 18); // 22-39
    
    // Weight cities: 70% Finland, 20% Sweden, 10% Other
    const rand = Math.random();
    let cityObj;
    if (rand < 0.7) {
      cityObj = pickRandom(CITIES_FINLAND);
    } else if (rand < 0.9) {
      cityObj = pickRandom(CITIES_SWEDEN);
    } else {
      cityObj = pickRandom(CITIES_OTHER);
    }
    
    const occupation = pickRandom(OCCUPATIONS);
    const vibe = pickRandom(VIBE_SENTENCES);
    const hobby1 = pickRandom(HOBBIES);
    const hobby2 = pickRandom(HOBBIES.filter(h => h !== hobby1));
    
    const email = `user${i + 1}@test.com`;
    
    // Use randomuser.me for realistic portraits
    const portraitIndex = ((i + 13) % 99) + 1; // Start after strategic users
    const genderFolder = gender === "female" ? "women" : "men";
    const profilePhotoUrl = `https://randomuser.me/api/portraits/${genderFolder}/${portraitIndex}.jpg`;
    
    // Random looking for preference (80% straight, 20% everyone)
    let lookingFor;
    if (Math.random() < 0.8) {
      lookingFor = gender === "male" ? "female" : "male";
    } else {
      lookingFor = "everyone";
    }
    
    users.push({
      email,
      name: fullName,
      username,
      firstName,
      lastName,
      age,
      gender,
      lookingFor,
      bio: `I'm a ${age}-year-old ${occupation} from ${cityObj.city}. ${vibe} Love ${hobby1} and ${hobby2}.`,
      location: `${cityObj.city}, ${cityObj.country}`,
      latitude: cityObj.lat + (Math.random() - 0.5) * 0.1, // Add small random offset
      longitude: cityObj.lng + (Math.random() - 0.5) * 0.1,
      profilePhotoUrl,
      photoUrls: [
        `https://picsum.photos/seed/${username}-1/600/600`,
        `https://picsum.photos/seed/${username}-2/600/600`,
      ],
      interests: [hobby1, hobby2, pickRandom(HOBBIES)].map(h => 
        h.charAt(0).toUpperCase() + h.slice(1)
      ),
      prompts: [
        { 
          category: "My ideal Sunday morning is...", 
          answer: pickRandom([
            "Coffee and a good book",
            "Brunch with friends",
            "Exploring the city",
            "Sleeping in and relaxing",
            "Outdoor activities",
          ])
        },
        { 
          category: "I'm weirdly attracted to...", 
          answer: pickRandom([
            "People who can make me laugh",
            "Good conversation",
            "Creative minds",
            "Adventurous spirits",
            "Genuine kindness",
          ])
        },
      ],
    });
  }
  
  return users;
}

// Combine strategic + random users
const ALL_USERS = [...STRATEGIC_USERS, ...generateRandomUsers(88)];

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL is missing – check your .env file");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    console.log("🌱 Starting seed process (100 users)...\n");

    // Get all interests and prompts from the database
    const allInterests = await db.select().from(interests);
    const allPrompts = await db.select().from(prompts);

    console.log(`📊 Found ${allInterests.length} interests and ${allPrompts.length} prompts in database\n`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const userData of ALL_USERS) {
      // Check if user already exists
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, userData.email))
        .limit(1);

      if (existing.length > 0) {
        skippedCount++;
        continue;
      }

      const passwordHash = await bcrypt.hash("password123", 10);

      // 1) Create user account
      const [newUser] = await db
        .insert(users)
        .values({
          email: userData.email,
          password: passwordHash,
          name: userData.name,
          role: "user",
        })
        .returning();

      // 2) Create profile
      await db.insert(profiles).values({
        userId: newUser.id,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        age: userData.age,
        gender: userData.gender,
        lookingFor: userData.lookingFor,
        bio: userData.bio,
        location: userData.location,
        latitude: userData.latitude,
        longitude: userData.longitude,
        profilePhotoUrl: userData.profilePhotoUrl,
        isProfileComplete: true,
        isVerified: true,
        maxDistanceKm: 50,
      });

      // 3) Add extra photos
      if (userData.photoUrls && userData.photoUrls.length > 0) {
        await db.insert(photos).values(
          userData.photoUrls.map((url, idx) => ({
            userId: newUser.id,
            photoUrl: url,
            displayOrder: idx,
          }))
        );
      }

      // 4) Add interests
      if (userData.interests && userData.interests.length > 0) {
        const userInterestValues = [];
        
        for (const interestName of userData.interests) {
          const matchingInterest = allInterests.find(
            (i) => i.name.toLowerCase() === interestName.toLowerCase()
          );

          if (matchingInterest) {
            userInterestValues.push({
              userId: newUser.id,
              interestId: matchingInterest.id,
            });
          }
        }

        if (userInterestValues.length > 0) {
          await db.insert(userInterests).values(userInterestValues);
        }
      }

      // 5) Add prompts
      if (userData.prompts && userData.prompts.length > 0) {
        const userPromptValues = [];

        for (let i = 0; i < userData.prompts.length; i++) {
          const promptData = userData.prompts[i];
          
          const matchingPrompt = allPrompts.find(
            (p) => p.text === promptData.category
          );

          if (matchingPrompt) {
            userPromptValues.push({
              userId: newUser.id,
              promptId: matchingPrompt.id,
              answer: promptData.answer,
              displayOrder: i,
            });
          }
        }

        if (userPromptValues.length > 0) {
          await db.insert(userPrompts).values(userPromptValues);
        }
      }

      createdCount++;
      
      // Progress indicator
      if (createdCount % 10 === 0) {
        console.log(`  ✅ Created ${createdCount} users...`);
      }
    }

    console.log("\n✅ SEED COMPLETED SUCCESSFULLY!\n");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`📊 SUMMARY`);
    console.log("═══════════════════════════════════════════════════════");
    console.log(`  Created: ${createdCount} users`);
    console.log(`  Skipped: ${skippedCount} users (already exist)`);
    console.log(`  Total: ${ALL_USERS.length} users`);
    console.log(`  Password for all: password123\n`);
    
    console.log("🎯 STRATEGIC TEST USERS:");
    console.log("  • alice.fi@test.com    - Alice, 28F→M, Helsinki");
    console.log("  • bob.fi@test.com      - Bob, 30M→F, Helsinki");
    console.log("  • carol.fi@test.com    - Carol, 26F→M, Espoo");
    console.log("  • david.fi@test.com    - David, 29M→F, Espoo");
    console.log("  • emma.fi@test.com     - Emma, 27F→M, Tampere");
    console.log("  • frank.fi@test.com    - Frank, 32M→F, Turku");
    console.log("  • grace.se@test.com    - Grace, 29F→Everyone, Stockholm");
    console.log("  • henry.se@test.com    - Henry, 31M→F, Stockholm");
    console.log("  • iris.de@test.com     - Iris, 28F→M, Berlin");
    console.log("  • jack.de@test.com     - Jack, 30M→F, Berlin");
    console.log("  • kate.fi@test.com     - Kate, 35F→M, Helsinki");
    console.log("  • leo.fi@test.com      - Leo, 24M→F, Helsinki\n");
    
    console.log("🌍 RANDOM USERS:");
    console.log(`  • user1@test.com through user88@test.com`);
    console.log(`  • Distributed across Finland (70%), Sweden (20%), Other (10%)`);
    console.log(`  • Ages 22-39, mixed genders and preferences\n`);

  } catch (err) {
    console.error("\n❌ SEED FAILED:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();