-- Migration to add TechCrunch article columns for tracking source articles
-- and enabling web search enrichment

-- Add techcrunch_article_link column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'startups' 
        AND column_name = 'techcrunch_article_link'
    ) THEN
        ALTER TABLE startups ADD COLUMN techcrunch_article_link TEXT;
        COMMENT ON COLUMN startups.techcrunch_article_link IS 'Link to the TechCrunch article about this startup';
    END IF;
END $$;

-- Add techcrunch_article_content column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'startups' 
        AND column_name = 'techcrunch_article_content'
    ) THEN
        ALTER TABLE startups ADD COLUMN techcrunch_article_content TEXT;
        COMMENT ON COLUMN startups.techcrunch_article_content IS 'Full content of the TechCrunch article (for context in enrichment)';
    END IF;
END $$;

-- Add needs_enrichment column to track which startups need web search enrichment
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'startups' 
        AND column_name = 'needs_enrichment'
    ) THEN
        ALTER TABLE startups ADD COLUMN needs_enrichment BOOLEAN DEFAULT false;
        COMMENT ON COLUMN startups.needs_enrichment IS 'Flag indicating if startup needs web search enrichment';
    END IF;
END $$;

-- Add enrichment_status column to track enrichment progress
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'startups' 
        AND column_name = 'enrichment_status'
    ) THEN
        ALTER TABLE startups ADD COLUMN enrichment_status TEXT DEFAULT 'pending';
        COMMENT ON COLUMN startups.enrichment_status IS 'Status of enrichment: pending, in_progress, completed, failed';
    END IF;
END $$;

-- Add data_source column to track where the data came from
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'startups' 
        AND column_name = 'data_source'
    ) THEN
        ALTER TABLE startups ADD COLUMN data_source TEXT;
        COMMENT ON COLUMN startups.data_source IS 'Source of the data: techcrunch, yc, manual, etc.';
    END IF;
END $$;

-- Create index on needs_enrichment for efficient querying
CREATE INDEX IF NOT EXISTS idx_startups_needs_enrichment ON startups(needs_enrichment) WHERE needs_enrichment = true;

-- Create index on enrichment_status
CREATE INDEX IF NOT EXISTS idx_startups_enrichment_status ON startups(enrichment_status);

