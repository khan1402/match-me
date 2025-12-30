-- Remove allow_outside_radius field from profiles table
ALTER TABLE profiles
DROP COLUMN IF EXISTS allow_outside_radius;

