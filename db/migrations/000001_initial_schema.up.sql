-- Enums
CREATE TYPE role_enum AS ENUM ('user', 'admin');
CREATE TYPE interaction_type AS ENUM ('like', 'pass', 'dismiss', 'prompt_like');
CREATE TYPE connection_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'resolved');

-- Users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT,
  role role_enum NOT NULL DEFAULT 'user',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_signed_in TIMESTAMP
);

-- Profiles
CREATE TABLE profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  username TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  age INTEGER,
  gender TEXT,
  looking_for TEXT,
  bio TEXT,
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  max_distance_km INTEGER DEFAULT 50,
  profile_photo_url TEXT,
  is_profile_complete BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Prompts (UPDATED)
CREATE TABLE prompts (
  id SERIAL PRIMARY KEY,
  question TEXT,
  text TEXT,
  category TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- User Prompts
CREATE TABLE user_prompts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  prompt_id INTEGER NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, prompt_id)
);

-- Interests (UPDATED)
CREATE TABLE interests (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE user_interests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  interest_id INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Photos
CREATE TABLE photos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  photo_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Interactions
CREATE TABLE interactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  target_user_id INTEGER NOT NULL,
  type interaction_type NOT NULL,
  prompt_id INTEGER,
  comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Matches
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  user_id1 INTEGER NOT NULL,
  user_id2 INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Messages
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  receiver_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Connection Requests
CREATE TABLE connection_requests (
  id SERIAL PRIMARY KEY,
  from_user_id INTEGER NOT NULL,
  to_user_id INTEGER NOT NULL,
  status connection_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMP
);

-- Notifications
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  related_user_id INTEGER,
  related_match_id INTEGER,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Reports
CREATE TABLE reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL,
  reported_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status report_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Blocks
CREATE TABLE blocks (
  id SERIAL PRIMARY KEY,
  blocker_id INTEGER NOT NULL,
  blocked_id INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
