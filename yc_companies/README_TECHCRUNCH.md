# TechCrunch Scraper

This script scrapes startup data from TechCrunch articles using the [techcrunch-api](https://github.com/suhailroushan13/techcrunch-api) package.

## Three Options

### Option 1: Scrape to Files (CSV/JSON)

Scrapes TechCrunch and saves data to local files. You can then use the existing `ingest` script to load into HelixDB.

```bash
npm run scrape-techcrunch
```

This creates:
- `techcrunch_startups.json`
- `techcrunch_startups.csv`

Then ingest with:
```bash
npm run ingest
```

### Option 2: Scrape and Directly Ingest to HelixDB

Scrapes TechCrunch and directly ingests data into your HelixDB database.

```bash
npm run scrape-and-ingest-techcrunch
```

**Requirements for Option 2:**
- `HELIX_URL` environment variable (defaults to `http://localhost:6969`)
- `HELIX_API_KEY` (optional, if your HelixDB requires authentication)
- `GEMINI_API_KEY` (optional, for generating embeddings - will work without it but with empty embeddings)

### Option 3: Scrape and Ingest to Supabase + Pinecone (Recommended for Migration)

Scrapes TechCrunch and directly ingests data into Supabase (relational data) and Pinecone (vector embeddings).

```bash
npm run scrape-techcrunch-supabase
```

**Requirements for Option 3:**
- `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `PINECONE_API_KEY` (optional, for storing embeddings)
- `PINECONE_INDEX_NAME` (defaults to `startups`)
- `GEMINI_API_KEY` (for generating embeddings)

**Setup:**
1. Run the Supabase migration: `supabase/migrations/001_initial_schema.sql`
2. Create a Pinecone index with 768 dimensions (for Gemini embeddings)
3. Set environment variables in `.env.local`

See `SUPABASE_PINECONE_MIGRATION.md` for detailed setup instructions.

## What it does

1. **Scrapes articles** from multiple TechCrunch categories:
   - startups
   - venture
   - fintech
   - artificial-intelligence
   - apps
   - hardware
   - security
   - cryptocurrency
   - transportation
   - media-entertainment

2. **Scrapes articles** with relevant tags:
   - startup, funding, seed, series-a, series-b, unicorn, y-combinator, yc, venture-capital, vc

3. **Extracts startup information** from articles:
   - Company name
   - Description
   - Funding amount and stage
   - Location
   - Industry
   - Business type
   - Website
   - Date raised

4. **Saves data** in two formats:
   - `techcrunch_startups.json` - JSON format
   - `techcrunch_startups.csv` - CSV format matching your existing schema

## Output Schema

The scraped data matches your existing company schema:

```typescript
{
  YC_Link: string;
  Company_Logo: string;
  Company_Name: string;
  company_description: string;
  Batch: string;
  business_type: string;
  industry: string;
  location: string;
  founder_first_name: string;
  founder_last_name: string;
  founder_email: string;
  founder_linkedin: string;
  website: string;
  job_openings: string;
  funding_stage: string;
  amount_raised: string;
  date_raised: string;
  data_quality: string; // "📰 TECHCRUNCH"
}
```

## Data Extraction

The script uses pattern matching to extract:
- **Company names** from article titles and content
- **Funding amounts** (e.g., "$10M", "$5 million")
- **Funding stages** (Seed, Series A, Series B, etc.)
- **Locations** (cities and states)
- **Industries** (AI, Fintech, Healthcare, etc.)
- **Business types** (B2B, Consumer, Marketplace, etc.)

## Notes

- The script includes rate limiting delays (2 seconds between requests) to avoid overwhelming the API
- Duplicate companies are automatically filtered out
- Some fields may be empty if they can't be extracted from the articles
- The `data_quality` field is set to "📰 TECHCRUNCH" to distinguish scraped data

## Prerequisites

- Node.js >= 22.0.0
- The `techcrunch-api` package (already installed)
- The `tsx` package for running TypeScript files (already installed)

## Troubleshooting

If you encounter errors:
1. Make sure you have a stable internet connection
2. The techcrunch-api package may require system dependencies (see package README)
3. Some articles may not contain extractable startup data - this is normal

