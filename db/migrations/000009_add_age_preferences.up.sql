-- Add optional age range preferences to profiles table
ALTER TABLE profiles 
ADD COLUMN min_age INTEGER NULL,
ADD COLUMN max_age INTEGER NULL;

