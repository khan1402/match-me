import "dotenv/config";                    // ⬅️ keep this
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { prompts, interests } from "../drizzle/schema.js";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

const promptsData = [
  { text: "My ideal Sunday morning is...", category: "lifestyle" },
  { text: "I'm weirdly attracted to...", category: "personality" },
  { text: "The way to win me over is...", category: "personality" },
  { text: "I'm looking for...", category: "relationship" },
  { text: "My most controversial opinion is...", category: "personality" },
  { text: "I geek out on...", category: "hobbies" },
  { text: "The best travel story I have is...", category: "travel" },
  { text: "I won't shut up about...", category: "personality" },
  { text: "My simple pleasures are...", category: "lifestyle" },
  { text: "The most spontaneous thing I've done is...", category: "adventure" },
  { text: "My love language is...", category: "relationship" },
  { text: "I judge people by...", category: "values" },
  { text: "The last book I loved was...", category: "books" },
  { text: "The best concert I've been to is...", category: "music" },
  { text: "My favorite way to spend a Friday night is...", category: "lifestyle" },
  { text: "My friends describe me as...", category: "personality" },
  { text: "A green flag in a relationship is...", category: "relationship" },
  { text: "A red flag in a relationship is...", category: "relationship" },
  { text: "The most interesting place I've visited is...", category: "travel" },
  { text: "My comfort show is...", category: "entertainment" },
];

const interestsData = [
  // Hobbies
  { name: "Photography", category: "hobbies" },
  { name: "Reading", category: "hobbies" },
  { name: "Painting", category: "hobbies" },
  { name: "Cooking", category: "hobbies" },
  { name: "Gaming", category: "hobbies" },
  { name: "Gardening", category: "hobbies" },
  { name: "Writing", category: "hobbies" },
  
  // Music
  { name: "Rock", category: "music" },
  { name: "Pop", category: "music" },
  { name: "Jazz", category: "music" },
  { name: "Classical", category: "music" },
  { name: "Hip Hop", category: "music" },
  { name: "Electronic", category: "music" },
  { name: "Country", category: "music" },
  
  // Food
  { name: "Italian Food", category: "food" },
  { name: "Mexican Food", category: "food" },
  { name: "Asian Food", category: "food" },
  { name: "Vegan Food", category: "food" },
  { name: "Street Food", category: "food" },
  
  // Lifestyle
  { name: "Fitness", category: "lifestyle" },
  { name: "Yoga", category: "lifestyle" },
  { name: "Meditation", category: "lifestyle" },
  { name: "Minimalism", category: "lifestyle" },
  { name: "Sustainability", category: "lifestyle" },
  
  // Sports
  { name: "Football", category: "sports" },
  { name: "Basketball", category: "sports" },
  { name: "Tennis", category: "sports" },
  { name: "Running", category: "sports" },
  { name: "Cycling", category: "sports" },
  { name: "Swimming", category: "sports" },
  
  // Entertainment
  { name: "Movies", category: "entertainment" },
  { name: "TV Shows", category: "entertainment" },
  { name: "Anime", category: "entertainment" },
  { name: "Theatre", category: "entertainment" },
  { name: "Podcasts", category: "entertainment" },
  
  // Travel
  { name: "Backpacking", category: "travel" },
  { name: "Road Trips", category: "travel" },
  { name: "City Breaks", category: "travel" },
  { name: "Beach Holidays", category: "travel" },
  { name: "Nature Trips", category: "travel" },
  { name: "Cultural Tourism", category: "travel" },
  
  // Other
  { name: "Volunteering", category: "other" },
  { name: "Animals", category: "other" },
  { name: "Technology", category: "other" },
  { name: "Fashion", category: "other" },
  { name: "Art", category: "other" },
  { name: "Politics", category: "other" },
  { name: "Environment", category: "other" },
];

async function seed() {
  console.log("Seeding database...");
  
  try {
    // Insert prompts
    console.log("Inserting prompts...");
    for (const prompt of promptsData) {
      // Postgres: use onConflictDoNothing instead of MySQL onDuplicateKeyUpdate
      await db.insert(prompts).values(prompt).onConflictDoNothing();
    }
    console.log(`✓ Inserted ${promptsData.length} prompts`);
    
    // Insert interests
    console.log("Inserting interests...");
    for (const interest of interestsData) {
      await db.insert(interests).values(interest).onConflictDoNothing();
    }
    console.log(`✓ Inserted ${interestsData.length} interests`);
    
    console.log("✓ Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

seed();