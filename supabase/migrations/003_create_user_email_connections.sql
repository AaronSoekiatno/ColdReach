-- Create table for storing user email provider connections (Gmail, Outlook, etc.)
CREATE TABLE IF NOT EXISTS user_email_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'gmail' or 'outlook'
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_email, provider)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_email_connections_user_email 
  ON user_email_connections(user_email);

-- Enable RLS
ALTER TABLE user_email_connections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own connections
CREATE POLICY "Users can view their own email connections"
  ON user_email_connections
  FOR SELECT
  USING (
    auth.uid()::text = (
      SELECT id::text 
      FROM auth.users 
      WHERE email = user_email_connections.user_email
    )
  );

-- Policy: Users can insert their own connections
CREATE POLICY "Users can insert their own email connections"
  ON user_email_connections
  FOR INSERT
  WITH CHECK (
    auth.uid()::text = (
      SELECT id::text 
      FROM auth.users 
      WHERE email = user_email_connections.user_email
    )
  );

-- Policy: Users can update their own connections
CREATE POLICY "Users can update their own email connections"
  ON user_email_connections
  FOR UPDATE
  USING (
    auth.uid()::text = (
      SELECT id::text 
      FROM auth.users 
      WHERE email = user_email_connections.user_email
    )
  );

-- Policy: Users can delete their own connections
CREATE POLICY "Users can delete their own email connections"
  ON user_email_connections
  FOR DELETE
  USING (
    auth.uid()::text = (
      SELECT id::text 
      FROM auth.users 
      WHERE email = user_email_connections.user_email
    )
  );

