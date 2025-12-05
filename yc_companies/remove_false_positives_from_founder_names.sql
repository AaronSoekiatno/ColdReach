-- ============================================================
-- Remove False Positive Names from Comma-Separated founder_names
-- 
-- This script removes ONLY false positive names from the comma-separated
-- founder_names list while preserving real founder names.
-- 
-- ⚠️  SAFETY: This ONLY removes exact matches to known false positives.
-- Real founder names like "John Smith" or "Sarah Johnson" are preserved.
-- 
-- Examples of what WILL be removed:
--   - "The Problem"
--   - "Our Solution"
--   - "Team"
--   - "Our Story"
--   - etc.
-- ============================================================

-- ============================================================
-- 1. PREVIEW: See what will be cleaned (DRY RUN)
-- ============================================================
-- Run this first to see exactly what will be affected

WITH false_positives AS (
  SELECT unnest(ARRAY[
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
  ]) AS false_positive
),
cleaned_names AS (
  SELECT 
    id,
    name,
    yc_link,
    founder_names AS original_names,
    TRIM(BOTH ' ' FROM 
      array_to_string(
        array(
          SELECT TRIM(name_part)
          FROM unnest(string_to_array(founder_names, ',')) AS name_part
          WHERE TRIM(name_part) NOT IN (SELECT false_positive FROM false_positives)
            AND TRIM(name_part) != ''
        ),
        ', '
      )
    ) AS cleaned_names
  FROM startups
  WHERE data_source = 'yc'
    AND founder_names IS NOT NULL
    AND founder_names != ''
    AND founder_names ~ ','  -- Only process comma-separated lists
)
SELECT 
  id,
  name,
  yc_link,
  original_names,
  cleaned_names,
  CASE 
    WHEN cleaned_names = '' OR cleaned_names IS NULL THEN 'Will be set to NULL'
    WHEN cleaned_names != original_names THEN 'Will be updated'
    ELSE 'No change needed'
  END AS action
FROM cleaned_names
WHERE original_names != COALESCE(cleaned_names, '')
ORDER BY name
LIMIT 100;

-- ============================================================
-- 2. COUNT: How many will be affected
-- ============================================================

WITH false_positives AS (
  SELECT unnest(ARRAY[
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
  ]) AS false_positive
),
cleaned_names AS (
  SELECT 
    id,
    founder_names AS original_names,
    TRIM(BOTH ' ' FROM 
      array_to_string(
        array(
          SELECT TRIM(name_part)
          FROM unnest(string_to_array(founder_names, ',')) AS name_part
          WHERE TRIM(name_part) NOT IN (SELECT false_positive FROM false_positives)
            AND TRIM(name_part) != ''
        ),
        ', '
      )
    ) AS cleaned_names
  FROM startups
  WHERE data_source = 'yc'
    AND founder_names IS NOT NULL
    AND founder_names != ''
    AND founder_names ~ ','  -- Only process comma-separated lists
)
SELECT 
  COUNT(*) AS total_with_comma_separated_names,
  COUNT(CASE WHEN cleaned_names = '' OR cleaned_names IS NULL THEN 1 END) AS will_be_set_to_null,
  COUNT(CASE WHEN cleaned_names != original_names AND cleaned_names != '' AND cleaned_names IS NOT NULL THEN 1 END) AS will_be_updated,
  COUNT(CASE WHEN cleaned_names = original_names THEN 1 END) AS no_change_needed
FROM cleaned_names;

-- ============================================================
-- 3. CLEANUP: Remove false positive names from comma-separated lists
-- ============================================================
-- ⚠️  WARNING: This will UPDATE the database
-- ⚠️  SAFETY: Only removes exact matches to known false positives
-- ⚠️  Real founder names are preserved
-- 
-- Run the preview queries above first to see what will be changed

WITH false_positives AS (
  SELECT unnest(ARRAY[
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
  ]) AS false_positive
),
cleaned_data AS (
  SELECT 
    id,
    TRIM(BOTH ' ' FROM 
      array_to_string(
        array(
          SELECT TRIM(name_part)
          FROM unnest(string_to_array(founder_names, ',')) AS name_part
          WHERE TRIM(name_part) NOT IN (SELECT false_positive FROM false_positives)
            AND TRIM(name_part) != ''
        ),
        ', '
      )
    ) AS cleaned_names
  FROM startups
  WHERE data_source = 'yc'
    AND founder_names IS NOT NULL
    AND founder_names != ''
    AND founder_names ~ ','  -- Only process comma-separated lists
)
UPDATE startups
SET founder_names = CASE 
  WHEN cleaned_data.cleaned_names = '' OR cleaned_data.cleaned_names IS NULL THEN NULL
  ELSE cleaned_data.cleaned_names
END
FROM cleaned_data
WHERE startups.id = cleaned_data.id
  AND startups.data_source = 'yc'
  AND startups.founder_names IS NOT NULL
  AND startups.founder_names != ''
  AND startups.founder_names ~ ',';

-- ============================================================
-- 4. VERIFICATION: Check results after cleanup
-- ============================================================

SELECT 
  'After Cleanup' AS status,
  COUNT(*) AS total_startups,
  SUM(CASE WHEN founder_names IS NULL OR founder_names = '' THEN 1 ELSE 0 END) AS missing_founder_names,
  SUM(CASE WHEN founder_names IS NOT NULL AND founder_names != '' THEN 1 ELSE 0 END) AS has_founder_names,
  SUM(CASE WHEN founder_names ~ ',' THEN 1 ELSE 0 END) AS comma_separated_lists,
  SUM(CASE WHEN founder_names IS NOT NULL AND founder_names != '' AND founder_names !~ ',' THEN 1 ELSE 0 END) AS single_names
FROM startups
WHERE data_source = 'yc';

-- ============================================================
-- 5. FIND REMAINING FALSE POSITIVES IN COMMA-SEPARATED LISTS (Optional)
-- ============================================================
-- This helps identify any remaining false positives that weren't caught

WITH false_positives AS (
  SELECT unnest(ARRAY[
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
  ]) AS false_positive
),
name_parts AS (
  SELECT 
    s.id,
    s.name,
    s.yc_link,
    s.founder_names,
    TRIM(name_part) AS individual_name
  FROM startups s
  CROSS JOIN LATERAL unnest(string_to_array(s.founder_names, ',')) AS name_part
  WHERE s.data_source = 'yc'
    AND s.founder_names IS NOT NULL
    AND s.founder_names != ''
    AND s.founder_names ~ ','
)
SELECT DISTINCT
  np.id,
  np.name,
  np.yc_link,
  np.founder_names,
  np.individual_name AS suspicious_name,
  'Review manually' AS recommendation
FROM name_parts np
WHERE np.individual_name IN (SELECT false_positive FROM false_positives)
ORDER BY np.name
LIMIT 50;

-- ============================================================
-- NOTES:
-- ============================================================
-- 1. This script ONLY removes exact matches to known false positives
-- 2. Real founder names like "John Smith", "Sarah Johnson" are preserved
-- 3. Only processes comma-separated lists (founder_names containing commas)
-- 4. If all names in a list are false positives, the field is set to NULL
-- 5. Run section 1 (PREVIEW) first to see exactly what will be cleaned
-- 6. Run section 2 (COUNT) to see how many will be affected
-- 7. Run section 3 (CLEANUP) to actually clean the data
-- 8. Run section 4 (VERIFICATION) to check results
-- 9. Run section 5 to find any remaining suspicious patterns
--
-- After cleaning, re-run re-scrape script to get real founder names:
--   npm run re-scrape:missing




