-- ============================================================
-- Data Quality Audit Query
-- ============================================================
-- This query shows enrichment status breakdown with missing field counts
-- Identifies records marked as 'completed' that are missing critical data

SELECT 
  enrichment_status,
  COUNT(*) as count,
  SUM(CASE 
    WHEN (founder_names IS NULL OR founder_names = '' OR founder_names = 'Team')
      AND (founder_first_name IS NULL OR founder_first_name = '' OR founder_first_name = 'Team')
    THEN 1 ELSE 0 
  END) as missing_founders,
  SUM(CASE 
    WHEN (founder_emails IS NULL OR founder_emails = '' OR founder_emails LIKE 'hello@%')
    THEN 1 ELSE 0 
  END) as missing_emails,
  SUM(CASE 
    WHEN (website IS NULL OR website = '')
    THEN 1 ELSE 0 
  END) as missing_website
FROM startups
WHERE data_source = 'yc'
GROUP BY enrichment_status
ORDER BY 
  CASE enrichment_status
    WHEN 'completed' THEN 1
    WHEN 'in_progress' THEN 2
    WHEN 'pending' THEN 3
    WHEN 'failed' THEN 4
    WHEN 'needs_review' THEN 5
    ELSE 6
  END;

-- ============================================================
-- Find the problematic 'completed' record(s)
-- ============================================================

SELECT 
  id,
  name,
  enrichment_status,
  enrichment_quality_score,
  enrichment_quality_status,
  founder_names,
  founder_first_name,
  founder_emails,
  website,
  description
FROM startups
WHERE data_source = 'yc'
  AND enrichment_status = 'completed'
  AND (
    (founder_names IS NULL OR founder_names = '' OR founder_names = 'Team')
    OR (founder_emails IS NULL OR founder_emails = '' OR founder_emails LIKE 'hello@%')
    OR (website IS NULL OR website = '')
  )
ORDER BY name;

-- ============================================================
-- Fix: Update incorrectly marked 'completed' records
-- ============================================================
-- Records marked as 'completed' should have:
-- - founder_names (not NULL, not empty, not 'Team')
-- - founder_emails (not NULL, not empty, not 'hello@...')
-- - website (not NULL, not empty)
--
-- If they're missing these, they should be 'needs_review' or 'pending'

UPDATE startups
SET 
  enrichment_status = CASE
    -- If missing critical fields, mark as needs_review
    WHEN (founder_names IS NULL OR founder_names = '' OR founder_names = 'Team')
         OR (founder_emails IS NULL OR founder_emails = '' OR founder_emails LIKE 'hello@%')
         OR (website IS NULL OR website = '')
    THEN 'needs_review'
    ELSE enrichment_status
  END,
  needs_enrichment = CASE
    -- Set needs_enrichment = true if missing critical fields
    WHEN (founder_names IS NULL OR founder_names = '' OR founder_names = 'Team')
         OR (founder_emails IS NULL OR founder_emails = '' OR founder_emails LIKE 'hello@%')
         OR (website IS NULL OR website = '')
    THEN true
    ELSE needs_enrichment
  END
WHERE data_source = 'yc'
  AND enrichment_status = 'completed'
  AND (
    (founder_names IS NULL OR founder_names = '' OR founder_names = 'Team')
    OR (founder_emails IS NULL OR founder_emails = '' OR founder_emails LIKE 'hello@%')
    OR (website IS NULL OR website = '')
  );

-- ============================================================
-- Verification: Check after fix
-- ============================================================

SELECT 
  enrichment_status,
  COUNT(*) as count,
  SUM(CASE 
    WHEN (founder_names IS NULL OR founder_names = '' OR founder_names = 'Team')
      AND (founder_first_name IS NULL OR founder_first_name = '' OR founder_first_name = 'Team')
    THEN 1 ELSE 0 
  END) as missing_founders,
  SUM(CASE 
    WHEN (founder_emails IS NULL OR founder_emails = '' OR founder_emails LIKE 'hello@%')
    THEN 1 ELSE 0 
  END) as missing_emails,
  SUM(CASE 
    WHEN (website IS NULL OR website = '')
    THEN 1 ELSE 0 
  END) as missing_website
FROM startups
WHERE data_source = 'yc'
GROUP BY enrichment_status
ORDER BY 
  CASE enrichment_status
    WHEN 'completed' THEN 1
    WHEN 'in_progress' THEN 2
    WHEN 'pending' THEN 3
    WHEN 'failed' THEN 4
    WHEN 'needs_review' THEN 5
    ELSE 6
  END;



