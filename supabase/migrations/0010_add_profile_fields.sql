
-- Bio text (like a short description about yourself)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Skills as an array (can store multiple skills like ["React", "Node.js"])
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';

-- Website URL (personal portfolio or blog)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Twitter/X username (without the @ symbol)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS twitter_handle TEXT;

-- Make sure website URLs are actually valid URLs
ALTER TABLE profiles
ADD CONSTRAINT website_url_format CHECK (
  website_url IS NULL OR 
  website_url ~* '^https?://[^\s/$.?#].[^\s]*$'
);