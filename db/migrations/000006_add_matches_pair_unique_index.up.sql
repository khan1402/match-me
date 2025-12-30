-- Add unique index on matches to prevent duplicate pairs regardless of order
-- Uses LEAST/GREATEST to ensure (1,2) and (2,1) are treated as the same pair
CREATE UNIQUE INDEX IF NOT EXISTS matches_pair_uniq
ON matches (LEAST(user_id1, user_id2), GREATEST(user_id1, user_id2));

