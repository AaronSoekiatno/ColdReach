-- Migration to add missing columns if they don't exist
-- This handles the case where the table was created without these columns

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

-- Add keywords column if it doesn't exist (rename from tags if needed)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'startups' 
        AND column_name = 'keywords'
    ) THEN
        -- Check if 'tags' column exists and rename it, otherwise add new column
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'startups' 
            AND column_name = 'tags'
        ) THEN
            ALTER TABLE startups RENAME COLUMN tags TO keywords;
        ELSE
            ALTER TABLE startups ADD COLUMN keywords TEXT;
        END IF;
        COMMENT ON COLUMN startups.keywords IS 'tags/keywords for the startup';
    END IF;
END $$;

-- Create index on round_type if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_startups_round_type ON startups(round_type);

-- Create index on keywords if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_startups_keywords ON startups USING gin(to_tsvector('english', keywords));

