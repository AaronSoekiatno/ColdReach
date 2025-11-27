# TechCrunch Scraper Edge Function

This Supabase Edge Function processes startup data and stores it in Supabase + Pinecone.

## Setup

1. **Deploy the function:**
   ```bash
   supabase functions deploy scrape-techcrunch
   ```

2. **Set environment variables (secrets):**
   ```bash
   supabase secrets set PINECONE_API_KEY=your_pinecone_api_key
   supabase secrets set PINECONE_INDEX_NAME=startups
   supabase secrets set GEMINI_API_KEY=your_gemini_api_key
   ```

   Note: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available.

## Usage

This Edge Function expects startup data in the request body. Since the `techcrunch-api` package uses Puppeteer (which doesn't work in Deno), you have two options:

### Option 1: Call from your Node.js scraper

Modify your Node.js scraper to call this Edge Function after scraping:

```typescript
// After scraping startups
const response = await fetch('https://your-project.supabase.co/functions/v1/scrape-techcrunch', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ startups: allStartups }),
});
```

### Option 2: Use as a scheduled job

Set up a cron job that:
1. Runs your Node.js scraper (locally or on a server)
2. Calls this Edge Function with the scraped data

## Scheduling

You can schedule this function using Supabase Cron:

1. Go to your Supabase dashboard
2. Navigate to Database > Cron Jobs
3. Create a new cron job that calls your Node.js scraper first, then this function

Or use an external scheduler (like GitHub Actions, Vercel Cron, etc.) to:
1. Run the Node.js scraper
2. POST the results to this Edge Function

## Alternative: Full Deno Implementation

If you want a fully serverless solution, you could:
- Use a different scraping library that works in Deno (like `deno-dom` for HTML parsing)
- Call TechCrunch's RSS feeds or API if available
- Use a third-party scraping service API

