# Match-Me  
**A Prompt-Based Dating Application**

Match-Me is a lightweight, Hinge-style dating application built for **local development and testing**.  
The project provides a clean and extensible foundation for a modern dating app where users create prompt-based profiles, discover compatible matches, and communicate in real time.

The application is designed to be:
- Easy to run locally  
- Easy for other developers to understand  
- Straightforward to extend without cloud lock-in  

---

## Core Features

Match-Me delivers a complete end-to-end dating experience:

### Onboarding and Profiles
- Secure email and password sign-up  
- Guided onboarding flow  
- Profile fields include name, age, gender, location, and biography  
- Users select interests and answer conversation prompts to add personality  

### Discovery and Matching
- Swipe-style discovery feed with scrollable cards  
- Recommendation engine filters and ranks users based on compatibility  

### Real-Time Chat
- Matches are created only after mutual likes  
- Real-time messaging powered by Socket.IO  
- No HTTP polling — messages are delivered instantly  

### Account Management
- Users can edit their profile at any time  
- Permanent account deletion removes all associated data  

---

## Technology Stack

The project uses a modern, type-safe stack:

### Frontend
- React  
- TypeScript  
- Vite for fast development  
- Tailwind CSS for styling  

### Backend
- Node.js  
- Express  
- TypeScript  
- RESTful API architecture  

### Database
- PostgreSQL  
- Drizzle ORM for schema management and type-safe queries  

### Authentication
- JSON Web Tokens (JWT)  
- Stored in secure, HTTP-only cookies  

---

## Local Setup Guide

### Prerequisites
- Node.js **v18 or newer**
- pnpm
- A running PostgreSQL instance

---

### 1. Install Dependencies

From the project root:

```bash
pnpm install
```

---

### 2. Create and Configure the Database

Ensure PostgreSQL is running, then connect to `psql` and run:

```sql
CREATE DATABASE matchme;
CREATE USER matchme_user WITH PASSWORD 'matchme_password';
GRANT ALL PRIVILEGES ON DATABASE matchme TO matchme_user;
```

---

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

The file is pre-configured for local development.

---

### 4. Run Database Migrations

Create all required tables:

```bash
pnpm run db:push
```

---

### 5. Seed the Database (Recommended)

Populate the app with demo data by running the scripts **in order**:

```bash
# Seed prompt questions and interests
pnpm exec tsx scripts/seed.mjs

# Create demo users, profiles, and photos
pnpm exec tsx scripts/seed-users.mjs

---

### 6. Start the Application

```bash
pnpm run dev
```

The app will be available at:

```
http://localhost:3000
```

---

## Recommendation Logic

The discovery feed is driven by a multi-phase recommendation system:

### Phase 1: Hard Filters
Profiles are excluded if they:
- Belong to the current user
- Have already been interacted with (liked, passed, or matched)
- Have been blocked by the user
- Do not match mutual gender preferences (both users must match each other's preference)

### Phase 2: Location Filtering
**If GPS and radius are enabled:**
- Only show users within the specified radius (e.g., 50km)
- Users without GPS fall back to city/country text matching
- Same city or same country users are included even without GPS

**If GPS or radius is not set:**
- Location filtering is skipped
- All users proceed to scoring phase

### Phase 3: Compatibility Scoring
Each profile receives a weighted score based on:
- **Gender preference match**: 30 points (required, 0 if mismatch)
- **Age proximity**: 0-20 points (closer ages score higher)
- **Location match**: 0-25 points (same city: 25, same country: 15, different: 0)
- **Shared interests**: 0-20 points (more shared interests = higher score)
- **Shared prompts**: 0-6 points (similar prompt categories)

**Maximum possible score**: 101 points

### Phase 4: Match Quality Filtering
A minimum score threshold is applied:
- **Default**: MIN_SCORE = 50
- Ensures only meaningful matches appear in the feed
- Prevents showing users who only match on gender preference alone

### Phase 5: Country Preference
- If same-country matches exist, only show those
- If no same-country matches, show matches from other countries
- Prevents empty feeds while prioritizing local matches

### Phase 6: Ranking and Limiting
- Profiles are sorted by compatibility score (highest first)
- Maximum of 10 recommendations returned
- Ensures users aren't overwhelmed with too many options

The threshold can be adjusted in:

```
server/db.ts
```

---

## Areas for Improvement

Potential future extensions include:

- **Block and Report System**  
  API support exists, but UI and enforcement logic can be expanded  

- **Real-Time Notifications**  
  For new matches and incoming messages  

- **Advanced Discovery Filters**  
  Filtering by interests, education, or additional profile fields  

- **UI Enhancements**  
  Animations, layout improvements, and a more polished design system  

---

## Project Structure

```text
match-me/
├── client/         # React frontend
├── server/         # Node.js backend
├── drizzle/        # Drizzle ORM schema and migrations
├── scripts/        # Database seed scripts
├── shared/         # Shared types and constants
├── .env.example    # Environment variables template
└── package.json    # Project scripts and dependencies
```
