-- Migration to add founder-related columns if they don't exist
-- This handles the case where the table was created without these columns

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

