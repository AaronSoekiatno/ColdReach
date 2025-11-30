# Quick Start: TechCrunch Scraper + Enrichment

## Overview

This system scrapes TechCrunch articles, extracts startup data, saves to Supabase + Pinecone, and then enriches the data using web search.

## Setup

### 1. Run Database Migration

```bash
# Apply the migration to add TechCrunch and enrichment columns
# This should be done via Supabase CLI or dashboard
```

The migration file is at: `supabase/migrations/005_add_techcrunch_columns.sql`

### 2. Set Up Web Search

The system uses **Gemini Grounding with Google Search** (uses your existing `GEMINI_API_KEY`) and falls back to **DuckDuckGo** (free, no API key needed).

**Required:**
```env
GEMINI_API_KEY=your_gemini_key_here
```

That's it! The system will automatically use Gemini for search and extraction. DuckDuckGo is used as a free fallback if needed.

### 3. Ensure Supabase Credentials

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Ensure Pinecone Credentials (Optional)

```env
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX_NAME=startups
```

## Usage

### Step 1: Scrape TechCrunch

```bash
npm run scrape-techcrunch-supabase
```

This will:
- Scrape TechCrunch articles
- Extract startup data
- Save to Supabase with `needs_enrichment=true`
- Store embeddings in Pinecone

### Step 2: Enrich the Data

```bash
# Enrich all startups needing enrichment (default: 10)
npm run enrich-startups

# Enrich more at once
npm run enrich-startups 20

# Enrich a specific startup by ID
npm run enrich-startup --id=123e4567-e89b-12d3-a456-426614174000
```

## What Gets Enriched?

The web search agent enriches:

1. **Founder Information**
   - Names
   - LinkedIn profiles
   - Email addresses

2. **Job Openings**
   - Current open positions
   - Job titles

3. **Company Website**
   - Official website (if current one is generated)

4. **Funding Details**
   - More accurate funding amounts (if placeholder was used)

5. **Additional Context**
   - Better descriptions
   - More accurate locations
   - Industry classifications

## Data Flow

```
TechCrunch Article
    ↓
Scraper extracts basic data
    ↓
Saved to Supabase (needs_enrichment=true)
    ↓
Web Search Agent finds additional data
    ↓
Updates Supabase (needs_enrichment=false)
```

## Monitoring

### Check Enrichment Status

```sql
-- See how many need enrichment
SELECT COUNT(*) FROM startups WHERE needs_enrichment = true;

-- See status breakdown
SELECT enrichment_status, COUNT(*) 
FROM startups 
GROUP BY enrichment_status;
```

### View TechCrunch Startups

```sql
SELECT name, techcrunch_article_link, enrichment_status 
FROM startups 
WHERE data_source = 'techcrunch';
```

## Troubleshooting

### No Search Results

- Check `GEMINI_API_KEY` is set correctly
- Verify Gemini API quota/limits
- System will automatically fall back to DuckDuckGo if needed

### Enrichment Failing

- Check Supabase connection
- Verify RLS policies allow updates
- Check logs for specific errors

### Missing Data

- Some startups may not have public information
- Try different search queries
- Consider manual review for important startups

## Next Steps

1. **Customize Search Queries:** Edit `enrich_startup_data.ts` to add more searches
2. **Improve Extraction:** Enhance `web_search_agent.ts` with better parsing
3. **Add AI Extraction:** Use OpenAI/Claude for better data extraction
4. **Automate:** Set up cron jobs or scheduled tasks
5. **Monitor:** Track enrichment success rates

## Files Created

- `supabase/migrations/005_add_techcrunch_columns.sql` - Database migration
- `yc_companies/enrich_startup_data.ts` - Main enrichment agent
- `yc_companies/web_search_agent.ts` - Web search implementation
- `ENRICHMENT_WORKFLOW.md` - Detailed documentation
- `QUICK_START_ENRICHMENT.md` - This file

