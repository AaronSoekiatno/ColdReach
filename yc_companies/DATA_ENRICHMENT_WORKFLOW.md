# Data Enrichment Workflow

## Overview

The data enrichment process is split into two steps because **emails depend on founder names**. This ensures we get all founder names first, then discover emails efficiently in batch.

## Two-Step Process

### Step 1: Re-scrape Missing Data (Get Founder Names)

**Purpose**: Extract founder names, websites, LinkedIn links, and other missing data from YC pages.

**Script**: `re_scrape_missing_data.ts`

```bash
# Re-scrape all missing data
npm run re-scrape:missing

# Or limit to a specific number
npm run re-scrape:missing -- --limit=100
```

**What it does**:
- ✅ Finds startups missing founder names, websites, LinkedIn
- ✅ Scrapes YC pages to extract missing data
- ✅ Updates only NULL/empty fields (doesn't overwrite existing data)
- ❌ **Skips email discovery** (disabled by default)

**Output**: Startups now have founder names, websites, LinkedIn links

---

### Step 2: Discover Founder Emails (After Names Are Populated)

**Purpose**: Discover founder emails using pattern matching once we have founder names + websites.

**Script**: `enrich_founder_emails.ts`

```bash
# Discover emails for all founders
npm run enrich:emails

# Or with options
npm run enrich:emails -- --limit=50 --patterns=4
```

**What it does**:
- ✅ Finds startups with founder names + websites but no emails
- ✅ Tries multiple email patterns (e.g., `first@domain.com`, `first.last@domain.com`)
- ✅ Validates emails using Rapid Email Verifier API
- ✅ Updates founder_emails field in Supabase

**Requirements**:
- Startup must have `founder_names` populated
- Startup must have `website` populated
- Email discovery will be skipped if either is missing

---

## Why This Workflow?

1. **Emails depend on founder names** - We can't discover emails without knowing who the founders are
2. **Efficiency** - Batch email discovery is faster than doing it one-by-one during scraping
3. **Separation of concerns** - Scraping focuses on extracting visible data, email discovery focuses on pattern matching
4. **Rate limiting** - Email discovery can be rate-limited separately from scraping

## Complete Workflow Example

```bash
# Step 1: Get all founder names and websites
npm run re-scrape:missing

# Step 2: Discover emails for all founders
npm run enrich:emails

# Optional: Check results
# Query Supabase to see how many startups now have emails
```

## Advanced Options

### Re-scrape Script Options

```bash
# Limit number of startups
npm run re-scrape:missing -- --limit=50

# Only fix specific fields
npm run re-scrape:missing -- --fields=founder_names,website

# Enable email discovery (not recommended - use Step 2 instead)
npm run re-scrape:missing -- --enable-email-discovery
```

### Email Enrichment Options

```bash
# Process in batches of 10
npm run enrich:emails -- --batch=10

# Only process 50 startups
npm run enrich:emails -- --limit=50

# Try 4 patterns per founder (default: 2)
npm run enrich:emails -- --patterns=4

# Only process primary founder (first founder)
npm run enrich:emails -- --primary-only

# Set hourly rate limit (default: unlimited)
npm run enrich:emails -- --rate-limit=1000
```

## Monitoring Progress

### Check Missing Data

```sql
-- Count startups missing founder names
SELECT COUNT(*) FROM startups 
WHERE (founder_names IS NULL OR founder_names = '') 
  AND (founder_first_name IS NULL OR founder_first_name = '');

-- Count startups missing emails (but have names)
SELECT COUNT(*) FROM startups 
WHERE (founder_emails IS NULL OR founder_emails = '')
  AND founder_names IS NOT NULL
  AND founder_names != '';
```

### Check Enrichment Status

```sql
-- Summary of data completeness
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN founder_names IS NOT NULL AND founder_names != '' THEN 1 ELSE 0 END) as has_names,
  SUM(CASE WHEN founder_emails IS NOT NULL AND founder_emails != '' THEN 1 ELSE 0 END) as has_emails,
  SUM(CASE WHEN website IS NOT NULL AND website != '' THEN 1 ELSE 0 END) as has_website
FROM startups
WHERE data_source = 'yc';
```

## Troubleshooting

### "No emails found" after Step 2

- Check that founder names are correctly formatted (e.g., "John Smith" not "Team")
- Verify websites are valid domains (not placeholder values)
- Try increasing pattern attempts: `--patterns=4`

### Re-scrape not finding founder names

- Check if YC page structure has changed
- Run debug script: `npx tsx yc_companies/debug_founder_extraction.ts --url="<yc-url>"`
- Verify the page actually has founder information visible

### Email discovery is slow

- The API is unlimited, but you can set a rate limit: `--rate-limit=1000`
- Use `--primary-only` to only process first founder
- Process in smaller batches: `--batch=5`

## Related Scripts

- `test_single_update.ts` - Test re-scraping a single startup
- `debug_founder_extraction.ts` - Debug why founder names aren't being extracted
- `test_scrape_yc_companies.ts` - Test scraping a specific YC page

