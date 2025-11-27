-- Quick fix: Add all missing columns to startups table
-- Run this in your Supabase SQL Editor

ALTER TABLE startups 
ADD COLUMN IF NOT EXISTS job_openings TEXT,
ADD COLUMN IF NOT EXISTS funding_amount TEXT,
ADD COLUMN IF NOT EXISTS round_type TEXT,
ADD COLUMN IF NOT EXISTS date TEXT,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS founder_linkedin TEXT,
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS founder_names TEXT,
ADD COLUMN IF NOT EXISTS founder_emails TEXT,
ADD COLUMN IF NOT EXISTS keywords TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS pinecone_id TEXT;

