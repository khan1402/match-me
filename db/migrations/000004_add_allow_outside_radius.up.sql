-- Add allow_outside_radius field to profiles table
-- Default is false to enforce strict radius filtering by default
ALTER TABLE profiles
ADD COLUMN allow_outside_radius BOOLEAN NOT NULL DEFAULT false;

