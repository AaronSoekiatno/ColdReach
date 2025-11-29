-- Migration: Add new fields to candidates table for richer matching
-- Run this in your Supabase SQL Editor: https://app.supabase.com/project/_/sql
-- This migration is idempotent - safe to run multiple times

-- ==================== ADD NEW CANDIDATE COLUMNS ====================
DO $$
BEGIN
  -- Add location
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'location'
  ) THEN
    ALTER TABLE candidates ADD COLUMN location TEXT;
  END IF;

  -- Add education_level
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'education_level'
  ) THEN
    ALTER TABLE candidates ADD COLUMN education_level TEXT;
  END IF;

  -- Add university
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'university'
  ) THEN
    ALTER TABLE candidates ADD COLUMN university TEXT;
  END IF;

  -- Add past_internships
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'past_internships'
  ) THEN
    ALTER TABLE candidates ADD COLUMN past_internships TEXT;
  END IF;

  -- Add technical_projects
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'technical_projects'
  ) THEN
    ALTER TABLE candidates ADD COLUMN technical_projects TEXT;
  END IF;
END $$;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_candidates_location ON candidates(location);
CREATE INDEX IF NOT EXISTS idx_candidates_education_level ON candidates(education_level);
CREATE INDEX IF NOT EXISTS idx_candidates_university ON candidates(university);

-- Comment to explain the new columns
COMMENT ON COLUMN candidates.location IS 'Current or preferred location of the candidate';
COMMENT ON COLUMN candidates.education_level IS 'Highest degree (e.g., Bachelor''s, Master''s, PhD)';
COMMENT ON COLUMN candidates.university IS 'Name of university/college for highest degree';
COMMENT ON COLUMN candidates.past_internships IS 'Comma-separated list of past internship experiences';
COMMENT ON COLUMN candidates.technical_projects IS 'Comma-separated list of notable technical/personal projects';
