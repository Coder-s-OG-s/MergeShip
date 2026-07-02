-- Migration 0023: Private Profile Emails

-- Create the private profile_emails table
CREATE TABLE IF NOT EXISTS profile_emails (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profile_emails ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for users to read their own email
DROP POLICY IF EXISTS profile_emails_read_own ON profile_emails;
CREATE POLICY profile_emails_read_own ON profile_emails FOR SELECT
  USING (auth.uid() = user_id);

