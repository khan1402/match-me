-- Add foreign key constraints to ensure referential integrity
-- This prevents orphaned records and data mismatches

-- Profiles must reference valid users
ALTER TABLE profiles 
ADD CONSTRAINT profiles_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Photos must reference valid users
ALTER TABLE photos 
ADD CONSTRAINT photos_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- User interests must reference valid users and interests
ALTER TABLE user_interests 
ADD CONSTRAINT user_interests_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE user_interests 
ADD CONSTRAINT user_interests_interest_id_fkey 
FOREIGN KEY (interest_id) REFERENCES interests(id) ON DELETE CASCADE;

-- User prompts must reference valid users and prompts
ALTER TABLE user_prompts 
ADD CONSTRAINT user_prompts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE user_prompts 
ADD CONSTRAINT user_prompts_prompt_id_fkey 
FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE;

-- Interactions must reference valid users
ALTER TABLE interactions 
ADD CONSTRAINT interactions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE interactions 
ADD CONSTRAINT interactions_target_user_id_fkey 
FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Matches must reference valid users
ALTER TABLE matches 
ADD CONSTRAINT matches_user_id1_fkey 
FOREIGN KEY (user_id1) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE matches 
ADD CONSTRAINT matches_user_id2_fkey 
FOREIGN KEY (user_id2) REFERENCES users(id) ON DELETE CASCADE;

-- Messages must reference valid matches and users
ALTER TABLE messages 
ADD CONSTRAINT messages_match_id_fkey 
FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE;

ALTER TABLE messages 
ADD CONSTRAINT messages_sender_id_fkey 
FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE messages 
ADD CONSTRAINT messages_receiver_id_fkey 
FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE;

