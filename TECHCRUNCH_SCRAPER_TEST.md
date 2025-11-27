# TechCrunch Scraper - Testing & Verification Guide

## Quick Test

Run the scraper to test if it's working:

```bash
npm run scrape-techcrunch-supabase
```

## What the Scraper Does

1. **Checks Active Hours**: Only runs during 6 AM - 10 PM Pacific Time
2. **Scrapes TechCrunch**: Gets articles from `/category/fundraising/` (up to 5 pages)
3. **Extracts Data**: Uses Gemini to extract startup information from articles
4. **Saves to Supabase**: Stores in `startups` table with `data_source = 'techcrunch'`
5. **Saves to Pinecone**: Stores embeddings for semantic search

## Expected Output

```
🚀 Starting TechCrunch FUNDRAISING scraping...
⏰ Pacific Time: 14:30 (✅ Active)
📅 Run started at: 2025-11-22T21:30:00.000Z

✓ Connected to Supabase
✓ Connected to Pinecone index: startups

🔍 Checking for already-scraped articles...
   Found 15 already-scraped articles

📂 Scraping TechCrunch fundraising category...
📄 Scraping page 1...
   Found 20 valid articles on page 1
   Total articles collected so far: 20

📊 Found 20 total funding articles across 1 page(s)

📅 Sorted articles by date (newest first)
   Newest: 2025-11-22
   Oldest: 2025-11-15

📋 Filtered to 5 new articles (15 already scraped)

[1/5] 📄 Scraping: StartupX raises $10M Series A...
   🤖 Extracting data with Gemini...
   ✅ Extracted: StartupX (Series A - $10M)
   Generating embedding...
   Creating startup in Supabase...
   Storing embedding in Pinecone...
   ✓ Successfully processed StartupX
```

## Common Issues & Fixes

### Issue 1: "Outside TechCrunch publishing hours"
**Fix**: This is expected behavior. The scraper only runs during 6 AM - 10 PM Pacific Time.

### Issue 2: "Gemini API not available"
**Fix**: Make sure `GEMINI_API_KEY` is set in `.env.local`

### Issue 3: "Cannot connect to Supabase"
**Fix**: Check that `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set

### Issue 4: "No articles found"
**Fix**: 
- Check if TechCrunch website is accessible
- Verify the fundraising category page exists
- Check browser/Puppeteer is working

### Issue 5: "Could not extract company name"
**Fix**: 
- Article might not be about a specific startup
- Gemini extraction might have failed
- Falls back to regex extraction automatically

## Verification Steps

1. **Check Supabase Dashboard**:
   - Go to https://supabase.com/dashboard
   - Navigate to Table Editor → `startups`
   - Filter by `data_source = 'techcrunch'`
   - Verify new startups were added

2. **Check Logs**:
   - Look for "✅ Extracted" messages
   - Check for any error messages
   - Verify "Successfully processed" messages

3. **Check Data Quality**:
   ```sql
   SELECT name, funding_amount, round_type, techcrunch_article_link
   FROM startups 
   WHERE data_source = 'techcrunch'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

## What Data Gets Saved

From TechCrunch articles, the scraper extracts:
- ✅ Company name
- ✅ Funding amount
- ✅ Funding stage (Seed, Series A, etc.)
- ✅ Date raised
- ✅ Location
- ✅ Industry
- ✅ Business type (B2B, Consumer, etc.)
- ✅ Website
- ✅ Description
- ✅ TechCrunch article link
- ✅ Full article content

**Note**: Some fields may be empty if not found in the article. The web search agent can enrich these later.

## Next Steps After Scraping

Once TechCrunch scraping is working:
1. Startups are marked with `needs_enrichment = true`
2. Run the enrichment agent: `npm run enrich-startups`
3. The web search agent will fill in missing data (founders, jobs, etc.)

