-- Fix RLS policies for user_email_connections table
-- This replaces the policies that query auth.users (which requires elevated permissions)
-- with policies that use auth.email() (which is available to authenticated users)

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own email connections" ON user_email_connections;
DROP POLICY IF EXISTS "Users can insert their own email connections" ON user_email_connections;
DROP POLICY IF EXISTS "Users can update their own email connections" ON user_email_connections;
DROP POLICY IF EXISTS "Users can delete their own email connections" ON user_email_connections;

-- Policy: Users can only see their own connections
-- Uses auth.email() instead of querying auth.users
CREATE POLICY "Users can view their own email connections"
  ON user_email_connections
  FOR SELECT
  USING (
    auth.email() = user_email_connections.user_email
  );

-- Policy: Users can insert their own connections
-- Uses auth.email() instead of querying auth.users
CREATE POLICY "Users can insert their own email connections"
  ON user_email_connections
  FOR INSERT
  WITH CHECK (
    auth.email() = user_email_connections.user_email
  );

-- Policy: Users can update their own connections
-- Uses auth.email() instead of querying auth.users
CREATE POLICY "Users can update their own email connections"
  ON user_email_connections
  FOR UPDATE
  USING (
    auth.email() = user_email_connections.user_email
  )
  WITH CHECK (
    auth.email() = user_email_connections.user_email
  );

-- Policy: Users can delete their own connections
-- Uses auth.email() instead of querying auth.users
CREATE POLICY "Users can delete their own email connections"
  ON user_email_connections
  FOR DELETE
  USING (
    auth.email() = user_email_connections.user_email
  );

