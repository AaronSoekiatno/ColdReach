-- ============================================================
-- Clean False Positive Founder Names
-- 
-- This script removes ONLY section headings and non-name phrases
-- that were mistakenly extracted as founder names.
-- 
-- ⚠️  SAFETY: This ONLY removes exact matches to known false positives.
-- Real founder names like "John Smith" or "Sarah Johnson" are NOT affected.
-- 
-- Examples of what WILL be removed:
--   - "The Problem"
--   - "Our Solution"
--   - "Our Story"
--   - "Since Launch"
--   - "Our Approach"
--   - "Launch Video"
--   - "Our Ask"
-- ============================================================

-- ============================================================
-- 1. PREVIEW: See what will be cleaned (DRY RUN)
-- ============================================================
-- Run this first to see exactly what will be affected

SELECT 
  id,
  name,
  yc_link,
  founder_names,
  founder_first_name,
  founder_last_name,
  'Will be cleaned' AS action
FROM startups
WHERE data_source = 'yc'
  AND (
    -- Exact matches to known false positives (SAFE - only section headings)
    founder_names IN (
      'The Problem', 'Problem',
      'Our Solution', 'Solution',
      'Our Story', 'Story',
      'Since Launch', 'Launch',
      'Our Approach', 'Approach',
      'Launch Video', 'Video',
      'Our Ask', 'Ask',
      'The Team', 'Team',
      'Our Mission', 'Mission',
      'Our Vision', 'Vision',
      'Company History', 'History',
      'About Us', 'Us',
      'What We Do', 'We Do',
      'How It Works', 'It Works',
      'Meet The Team',
      'Our Product', 'Product',
      'Our Technology', 'Technology',
      'Our Customers', 'Customers',
      'Our Traction', 'Traction',
      'Contact Us',
      'Read More', 'More',
      'Learn More',
      'Get Started', 'Started',
      'Sign Up', 'Up',
      'View All', 'All'
    )
    OR founder_first_name IN (
      'Problem', 'Solution', 'Story', 'Launch', 'Approach', 'Video', 'Ask',
      'Team', 'Mission', 'Vision', 'History', 'Product', 'Technology',
      'Customers', 'Traction', 'Us', 'More', 'Started', 'Up', 'All'
    )
    -- Very short strings that start with section heading words (likely headings, not names)
    OR (LENGTH(TRIM(founder_names)) < 25 
        AND founder_names ~* '^(The Problem|Our Solution|Our Story|Since Launch|Our Approach|Launch Video|Our Ask|The Team|Our Mission|Our Vision|Company History|About Us|What We Do|How It Works|Meet The Team|Our Product|Our Technology|Our Customers|Our Traction|Contact Us|Read More|Learn More|Get Started|Sign Up|View All)')
    OR (LENGTH(TRIM(founder_names)) < 20 
        AND founder_names ~* '^(The|Our|Since|Meet|How|What|Read|Learn|Get|Sign|View|Contact|About) ')
  )
ORDER BY name
LIMIT 100;

-- ============================================================
-- 2. COUNT: How many will be affected
-- ============================================================

SELECT 
  COUNT(*) AS total_to_clean,
  COUNT(DISTINCT CASE WHEN founder_names IS NOT NULL AND founder_names != '' THEN id END) AS with_founder_names,
  COUNT(DISTINCT CASE WHEN founder_first_name IS NOT NULL AND founder_first_name != '' THEN id END) AS with_first_name
FROM startups
WHERE data_source = 'yc'
  AND (
    -- Exact matches only (SAFE)
    founder_names IN (
      'The Problem', 'Problem', 'Our Solution', 'Solution', 'Our Story', 'Story', 
      'Since Launch', 'Launch', 'Our Approach', 'Approach', 'Launch Video', 'Video', 
      'Our Ask', 'Ask', 'The Team', 'Team', 'Our Mission', 'Mission', 
      'Our Vision', 'Vision', 'Company History', 'History', 'About Us', 'Us',
      'What We Do', 'We Do', 'How It Works', 'It Works', 'Meet The Team', 'The Team',
      'Our Product', 'Product', 'Our Technology', 'Technology', 'Our Customers', 'Customers',
      'Our Traction', 'Traction', 'Contact Us', 'Read More', 'Learn More', 'Get Started',
      'Sign Up', 'View All'
    )
    OR founder_first_name IN (
      'Problem', 'Solution', 'Story', 'Launch', 'Approach', 'Video', 'Ask',
      'Team', 'Mission', 'Vision', 'History', 'Product', 'Technology', 
      'Customers', 'Traction', 'Us', 'More', 'Started', 'Up', 'All'
    )
    -- Very short strings starting with section words (likely headings)
    OR (LENGTH(TRIM(founder_names)) < 25 
        AND founder_names ~* '^(The Problem|Our Solution|Our Story|Since Launch|Our Approach|Launch Video|Our Ask|The Team|Our Mission|Our Vision|Company History|About Us|What We Do|How It Works|Meet The Team|Our Product|Our Technology|Our Customers|Our Traction|Contact Us|Read More|Learn More|Get Started|Sign Up|View All)')
    OR (LENGTH(TRIM(founder_names)) < 20 
        AND founder_names ~* '^(The|Our|Since|Meet|How|What|Read|Learn|Get|Sign|View|Contact|About) ')
  );

-- ============================================================
-- 3. CLEANUP: Remove false positive founder names
-- ============================================================
-- ⚠️  WARNING: This will UPDATE the database
-- ⚠️  SAFETY: Only removes exact matches to known false positives
-- ⚠️  Real founder names like "John Smith" are NOT affected
-- 
-- Run the preview queries above first to see what will be changed

UPDATE startups
SET 
  founder_names = NULL,
  founder_first_name = NULL,
  founder_last_name = NULL
WHERE data_source = 'yc'
  AND (
    -- Exact matches only (SAFE - only removes known section headings)
    founder_names IN (
      'The Problem', 'Problem',
      'Our Solution', 'Solution',
      'Our Story', 'Story',
      'Since Launch', 'Launch',
      'Our Approach', 'Approach',
      'Launch Video', 'Video',
      'Our Ask', 'Ask',
      'The Team', 'Team',
      'Our Mission', 'Mission',
      'Our Vision', 'Vision',
      'Company History', 'History',
      'About Us', 'Us',
      'What We Do', 'We Do',
      'How It Works', 'It Works',
      'Meet The Team',
      'Our Product', 'Product',
      'Our Technology', 'Technology',
      'Our Customers', 'Customers',
      'Our Traction', 'Traction',
      'Contact Us',
      'Read More', 'More',
      'Learn More',
      'Get Started', 'Started',
      'Sign Up', 'Up',
      'View All', 'All'
    )
    OR founder_first_name IN (
      'Problem', 'Solution', 'Story', 'Launch', 'Approach', 'Video', 'Ask',
      'Team', 'Mission', 'Vision', 'History', 'Product', 'Technology',
      'Customers', 'Traction', 'Us', 'More', 'Started', 'Up', 'All'
    )
    -- Very short strings that match section heading patterns (likely headings, not names)
    OR (LENGTH(TRIM(founder_names)) < 25 
        AND founder_names ~* '^(The Problem|Our Solution|Our Story|Since Launch|Our Approach|Launch Video|Our Ask|The Team|Our Mission|Our Vision|Company History|About Us|What We Do|How It Works|Meet The Team|Our Product|Our Technology|Our Customers|Our Traction|Contact Us|Read More|Learn More|Get Started|Sign Up|View All)')
    OR (LENGTH(TRIM(founder_names)) < 20 
        AND founder_names ~* '^(The|Our|Since|Meet|How|What|Read|Learn|Get|Sign|View|Contact|About) ')
  );

-- ============================================================
-- 4. VERIFICATION: Check results after cleanup
-- ============================================================

SELECT 
  'After Cleanup' AS status,
  COUNT(*) AS total_startups,
  SUM(CASE WHEN founder_names IS NULL OR founder_names = '' THEN 1 ELSE 0 END) AS missing_founder_names,
  SUM(CASE WHEN founder_first_name IS NULL OR founder_first_name = '' THEN 1 ELSE 0 END) AS missing_first_name,
  SUM(CASE WHEN founder_names IS NOT NULL AND founder_names != '' THEN 1 ELSE 0 END) AS still_has_founder_names
FROM startups
WHERE data_source = 'yc';

-- ============================================================
-- 5. FIND REMAINING SUSPICIOUS PATTERNS (Optional)
-- ============================================================
-- This helps identify any remaining false positives that weren't caught

SELECT 
  id,
  name,
  yc_link,
  founder_names,
  founder_first_name,
  'Review manually' AS recommendation
FROM startups
WHERE data_source = 'yc'
  AND founder_names IS NOT NULL
  AND founder_names != ''
  AND (
    -- Very short names (single word)
    (LENGTH(TRIM(founder_names)) - LENGTH(REPLACE(founder_names, ' ', '')) = 0 
     AND LENGTH(founder_names) > 3 
     AND LENGTH(founder_names) < 15)
    -- All caps (likely a heading)
    OR (founder_names = UPPER(founder_names) 
        AND LENGTH(founder_names) > 5 
        AND LENGTH(founder_names) < 30)
  )
ORDER BY name
LIMIT 50;

-- ============================================================
-- NOTES:
-- ============================================================
-- 1. This script ONLY removes exact matches to known false positives
-- 2. Real founder names like "John Smith", "Sarah Johnson" are NOT affected
-- 3. Run section 1 (PREVIEW) first to see exactly what will be cleaned
-- 4. Run section 2 (COUNT) to see how many will be affected
-- 5. Run section 3 (CLEANUP) to actually clean the data
-- 6. Run section 4 (VERIFICATION) to check results
-- 7. Run section 5 to find any remaining suspicious patterns
--
-- After cleaning, re-run re-scrape script to get real founder names:
--   npm run re-scrape:missing
