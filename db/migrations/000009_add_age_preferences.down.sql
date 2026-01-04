-- Remove age range preferences columns
ALTER TABLE profiles 
DROP COLUMN IF EXISTS min_age,
DROP COLUMN IF EXISTS max_age;

