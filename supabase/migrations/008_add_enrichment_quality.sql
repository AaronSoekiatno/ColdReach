-- Migration to add enrichment quality tracking columns
-- These columns track the quality and success of enrichment attempts

-- Add enrichment_quality_score column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'startups' 
        AND column_name = 'enrichment_quality_score'
    ) THEN
        ALTER TABLE startups ADD COLUMN enrichment_quality_score FLOAT;
        COMMENT ON COLUMN startups.enrichment_quality_score IS 'Overall enrichment quality score (0.0-1.0) based on field completeness and confidence';
    END IF;
END $$;

-- Add enrichment_quality_status column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'startups' 
        AND column_name = 'enrichment_quality_status'
    ) THEN
        ALTER TABLE startups ADD COLUMN enrichment_quality_status TEXT;
        COMMENT ON COLUMN startups.enrichment_quality_status IS 'Quality status: excellent, good, fair, poor, or failed';
    END IF;
END $$;

-- Create index for querying by quality status
CREATE INDEX IF NOT EXISTS idx_startups_quality_status ON startups(enrichment_quality_status);
CREATE INDEX IF NOT EXISTS idx_startups_quality_score ON startups(enrichment_quality_score);

-- Create index for finding startups that need retry (failed or poor quality)
CREATE INDEX IF NOT EXISTS idx_startups_needs_retry ON startups(enrichment_status, enrichment_quality_status) 
WHERE enrichment_status IN ('failed', 'needs_review') OR enrichment_quality_status IN ('poor', 'failed');

