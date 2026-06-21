-- Add email column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS email text;
