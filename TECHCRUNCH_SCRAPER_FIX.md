# TechCrunch Scraper - Recent Articles Fix

## Problem
The scraper was getting valid articles but not the most recent ones visible on the [TechCrunch fundraising page](https://techcrunch.com/category/fundraising/).

## Root Cause
1. **Outdated CSS Selectors**: TechCrunch's HTML structure has changed, and the old selectors weren't matching the actual article elements
2. **Lazy Loading**: Articles may be loaded dynamically, requiring scrolling
3. **Duplicate Detection**: Articles were being duplicated across pages

## Fixes Applied

### 1. Improved Article Detection
- **New Strategy**: First finds all links containing "/202" (article URL pattern)
- **Better Selectors**: Uses multiple fallback strategies to find article containers
- **Title Extraction**: Improved logic to find article titles from various locations

### 2. Scrolling for Lazy-Loaded Content
- Scrolls to middle of page, then to bottom
- Waits for content to load after each scroll
- Ensures all articles are visible before extraction

### 3. Deduplication
- Removes duplicate articles by URL
- Tracks seen URLs across pages
- Logs duplicate counts for debugging

### 4. Better Logging
- Shows sample articles found (first 3)
- Displays article dates for verification
- Logs duplicate counts per page

## How It Works Now

1. **Navigate to Page**: Goes to `https://techcrunch.com/category/fundraising/`
2. **Scroll & Wait**: Scrolls to load lazy-loaded content
3. **Find Article Links**: Looks for all links matching article URL pattern (`/2025/11/22/...`)
4. **Extract Metadata**: Gets title, description, date from article containers
5. **Deduplicate**: Removes duplicates by URL
6. **Sort by Date**: Sorts articles by date (newest first)
7. **Process**: Extracts startup data and saves to Supabase

## Expected Output

```
📄 Scraping page 1...
   Navigating to: https://techcrunch.com/category/fundraising/
   Sample articles found:
     1. Nordic founders are taking bigger swings, and it's paying off... (2025-11-22)
     2. Here are the 49 US AI startups that have raised $100M or more... (2025-11-22)
     3. The Nordic startup scene has quietly become one of tech's... (2025-11-22)
   Found 20 unique valid articles on page 1 (25 total, 20 valid)
   Total unique articles collected so far: 20
```

## Testing

Run the scraper and check:
1. **Recent Articles**: Should see articles from today/recent days
2. **No Duplicates**: Each article URL should appear only once
3. **Correct Dates**: Article dates should match what's on the page
4. **Sample Output**: First 3 articles should match what you see on TechCrunch

## If Still Not Working

If you're still not getting the most recent articles:

1. **Check Browser Console**: The page might have JavaScript errors
2. **Verify URL**: Make sure we're hitting the right URL
3. **Check Selectors**: TechCrunch might have changed their HTML structure again
4. **Add More Delays**: Some content might need more time to load

## Next Steps

After verifying the scraper gets recent articles:
1. Run it during active hours (6 AM - 10 PM Pacific)
2. Check Supabase to verify new startups are being added
3. Verify article dates match what's on TechCrunch
4. Monitor for any errors or issues

