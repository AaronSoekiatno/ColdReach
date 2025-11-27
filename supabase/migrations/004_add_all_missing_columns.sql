-- Migration to add ALL missing columns that might not exist
-- This ensures all required columns are present

-- Add job_openings column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'startups' 
        AND column_name = 'job_openings'
    ) THEN
        ALTER TABLE startups ADD COLUMN job_openings TEXT;
        COMMENT ON COLUMN startups.job_openings IS 'Job openings (comma-separated)';
    END IF;
END $$;

-- Add funding_amount column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'startups' 
        AND column_name = 'funding_amount'
    ) THEN
        ALTER TABLE startups ADD COLUMN funding_amount TEXT;
        COMMENT ON COLUMN startups.funding_amount IS 'Funding amount (e.g., "$20M")';
    END IF;
END $$;

-- Add round_type column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'startups' 
        AND column_name = 'round_type'
    ) THEN
        ALTER TABLE startups ADD COLUMN round_type TEXT;
        COMMENT ON COLUMN startups.round_type IS 'funding stage (Seed, Series A, etc.)';
    END IF;
END $$;

-- Add date column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'startups' 
        AND column_name = 'date'
    ) THEN
        ALTER TABLE startups ADD COLUMN date TEXT;
        COMMENT ON COLUMN startups.date IS 'funding date';
    END IF;
END $$;

-- Add location column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'startups' 
        AND column_name = 'location'
    ) THEN
        ALTER TABLE startups ADD COLUMN location TEXT;
        COMMENT ON COLUMN startups.location IS 'Location';
    END IF;
END $$;

-- Add website column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'startups' 
        AND column_name = 'website'
    ) THEN
        ALTER TABLE startups ADD COLUMN website TEXT;
        COMMENT ON COLUMN startups.website IS 'Website URL';
    END IF;
END $$;

-- Add founder_linkedin column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'startups' 
        AND column_name = 'founder_linkedin'
    ) THEN
        ALTER TABLE startups ADD COLUMN founder_linkedin TEXT;
        COMMENT ON COLUMN startups.founder_linkedin IS 'Founder LinkedIn URL';
    END IF;
END $$;

-- Add industry column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'startups' 
        AND column_name = 'industry'
    ) THEN
        ALTER TABLE startups ADD COLUMN industry TEXT;
        COMMENT ON COLUMN startups.industry IS 'Industry';
    END IF;
END $$;

-- Add founder_names column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'startups' 
        AND column_name = 'founder_names'
    ) THEN
        ALTER TABLE startups ADD COLUMN founder_names TEXT;
        COMMENT ON COLUMN startups.founder_names IS 'comma-separated founder names';
    END IF;
END $$;

-- Add founder_emails column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'startups' 
        AND column_name = 'founder_emails'
    ) THEN
        ALTER TABLE startups ADD COLUMN founder_emails TEXT;
        COMMENT ON COLUMN startups.founder_emails IS 'comma-separated founder emails';
    END IF;
END $$;

-- Add keywords column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'startups' 
        AND column_name = 'keywords'
    ) THEN
        ALTER TABLE startups ADD COLUMN keywords TEXT;
        COMMENT ON COLUMN startups.keywords IS 'tags/keywords for the startup';
    END IF;
END $$;

-- Add description column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'startups' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE startups ADD COLUMN description TEXT;
        COMMENT ON COLUMN startups.description IS 'company description (for embeddings)';
    END IF;
END $$;

-- Add pinecone_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'startups' 
        AND column_name = 'pinecone_id'
    ) THEN
        ALTER TABLE startups ADD COLUMN pinecone_id TEXT;
        COMMENT ON COLUMN startups.pinecone_id IS 'ID in Pinecone for the embedding';
    END IF;
END $$;

