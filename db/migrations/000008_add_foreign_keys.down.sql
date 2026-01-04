-- Remove foreign key constraints
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_user_id_fkey;
ALTER TABLE user_interests DROP CONSTRAINT IF EXISTS user_interests_user_id_fkey;
ALTER TABLE user_interests DROP CONSTRAINT IF EXISTS user_interests_interest_id_fkey;
ALTER TABLE user_prompts DROP CONSTRAINT IF EXISTS user_prompts_user_id_fkey;
ALTER TABLE user_prompts DROP CONSTRAINT IF EXISTS user_prompts_prompt_id_fkey;
ALTER TABLE interactions DROP CONSTRAINT IF EXISTS interactions_user_id_fkey;
ALTER TABLE interactions DROP CONSTRAINT IF EXISTS interactions_target_user_id_fkey;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_user_id1_fkey;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_user_id2_fkey;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_match_id_fkey;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;

