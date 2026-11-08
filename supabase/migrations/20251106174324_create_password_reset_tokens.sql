/*
  # Create password reset tokens table

  1. New Tables
    - `password_reset_tokens`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `token` (text, unique hashed token)
      - `email` (text, for recovery in case user is deleted)
      - `expires_at` (timestamptz, 30 minutes from creation)
      - `used_at` (timestamptz, null until used)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on password_reset_tokens table
    - Only allow unauthenticated requests for token generation via edge function
    - Users can only view their own tokens via authenticated requests
*/

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reset tokens"
  ON password_reset_tokens FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND used_at IS NULL AND expires_at > now());

CREATE POLICY "Allow unauthenticated token creation via edge function"
  ON password_reset_tokens FOR INSERT
  TO anon
  WITH CHECK (true);
