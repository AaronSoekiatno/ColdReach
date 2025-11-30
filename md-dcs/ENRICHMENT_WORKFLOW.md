# Startup Data Enrichment Workflow

## Overview

This document explains how the TechCrunch scraper hands off data to a web search agent for enrichment, creating a comprehensive data pipeline.

## Architecture

```
TechCrunch Scraper → Supabase (with needs_enrichment=true) → Web Search Agent → Enriched Supabase Data
```

## Step-by-Step Flow

### 1. **TechCrunch Scraping** (`scrape_techcrunch_supabase_pinecone.ts`)

When a startup is scraped from TechCrunch:

1. **Extract Basic Data:**
   - Company name
   - Description (from article)
   - Funding amount/stage (if mentioned)
   - Location (if mentioned)
   - Industry
   - Website (extracted or generated)

2. **Save Article Context:**
   - `techcrunch_article_link`: Link to the original article
   - `techcrunch_article_content`: Full article content for context

3. **Insert into Supabase:**
   ```typescript
   {
     name: "Company Name",
     description: "Company description",
     techcrunch_article_link: "https://techcrunch.com/...",
     techcrunch_article_content: "Full article text...",
     data_source: "techcrunch",
     needs_enrichment: true,  // ← Flags for enrichment
     enrichment_status: "pending"
   }
   ```

4. **Store Embedding in Pinecone:**
   - Creates embedding from description + keywords
   - Stores in Pinecone for semantic search

### 2. **Enrichment Queue**

Startups that need enrichment are identified by:
- `needs_enrichment = true`
- `enrichment_status IN ('pending', 'failed')`

Query to get startups needing enrichment:
```sql
SELECT * FROM startups 
WHERE needs_enrichment = true 
AND enrichment_status IN ('pending', 'failed')
LIMIT 10;
```

### 3. **Web Search Agent** (`enrich_startup_data.ts`)

The enrichment agent:

1. **Fetches startups needing enrichment:**
   ```typescript
   const startups = await getStartupsNeedingEnrichment(limit);
   ```

2. **For each startup, searches the web for:**
   - **Founder Information:**
     - Query: `"{companyName} founder CEO co-founder"`
     - Extracts: names, LinkedIn profiles, emails
   
   - **Job Openings:**
     - Query: `"{companyName} careers jobs hiring"`
     - Extracts: open positions, job titles
   
   - **Company Website:**
     - Query: `"{companyName} official website"`
     - Extracts: actual website (if current one is generated)
   
   - **Funding Details:**
     - Query: `"{companyName} funding raised investment"`
     - Extracts: more accurate funding amounts

3. **Merges enriched data:**
   - Only updates fields that are missing or can be improved
   - Preserves existing good data
   - Updates `needs_enrichment = false` and `enrichment_status = 'completed'`

### 4. **Web Search Implementation** (`web_search_agent.ts`)

The web search agent uses **Gemini Grounding with Google Search** (via `GEMINI_API_KEY`) and falls back to **DuckDuckGo** (free, no API key needed).

**Required:**
```env
GEMINI_API_KEY=your_gemini_key
```

The agent automatically uses Gemini for search and extraction. DuckDuckGo is used as a free fallback.

## Usage

### Run TechCrunch Scraper

```bash
# Scrape and ingest into Supabase + Pinecone
npm run scrape-techcrunch-supabase
```

This will:
- Scrape TechCrunch articles
- Extract startup data
- Save to Supabase with `needs_enrichment=true`
- Store embeddings in Pinecone

### Run Enrichment Agent

```bash
# Enrich all startups needing enrichment (default: 10 at a time)
npm run enrich-startups

# Enrich specific number
npm run enrich-startups 20

# Enrich specific startup by ID
npm run enrich-startup --id=123e4567-e89b-12d3-a456-426614174000
```

### Automated Workflow

You can set up a cron job or scheduled task to run enrichment:

```bash
# Run every hour
0 * * * * cd /path/to/project && npm run enrich-startups
```

Or use a workflow orchestrator like:
- GitHub Actions
- AWS Lambda (scheduled)
- Supabase Edge Functions (scheduled)
- Temporal workflows

## Database Schema

### New Columns Added

```sql
-- TechCrunch article tracking
techcrunch_article_link TEXT
techcrunch_article_content TEXT

-- Enrichment tracking
needs_enrichment BOOLEAN DEFAULT false
enrichment_status TEXT DEFAULT 'pending'  -- pending, in_progress, completed, failed
data_source TEXT  -- 'techcrunch', 'yc', 'manual', etc.
```

### Enrichment Status Values

- `pending`: Startup needs enrichment, not started
- `in_progress`: Currently being enriched
- `completed`: Enrichment finished successfully
- `failed`: Enrichment failed (can retry)

## Data Flow Example

### Initial Scrape
```json
{
  "name": "Stripe",
  "description": "Payment processing platform",
  "techcrunch_article_link": "https://techcrunch.com/...",
  "funding_amount": "$600M",
  "needs_enrichment": true,
  "enrichment_status": "pending"
}
```

### After Enrichment
```json
{
  "name": "Stripe",
  "description": "Payment processing platform for internet businesses",
  "techcrunch_article_link": "https://techcrunch.com/...",
  "funding_amount": "$600M",
  "founder_names": "Patrick Collison, John Collison",
  "founder_linkedin": "linkedin.com/in/patrickcollison",
  "founder_emails": "patrick@stripe.com",
  "job_openings": "Software Engineer, Product Manager, Data Scientist",
  "website": "stripe.com",
  "needs_enrichment": false,
  "enrichment_status": "completed"
}
```

## Customization

### Adding More Search Queries

Edit `enrich_startup_data.ts` to add more search queries:

```typescript
// Search for company logo
const logoQuery = `${companyName} logo`;
const logoResults = await searchWeb(logoQuery);
enrichedData.company_logo = extractLogo(logoResults);

// Search for YC link
const ycQuery = `${companyName} Y Combinator`;
const ycResults = await searchWeb(ycQuery);
enrichedData.yc_link = extractYCLink(ycResults);
```

### Improving Extraction

Edit `web_search_agent.ts` to improve extraction logic:

```typescript
// Better founder name extraction using NLP
function extractFounderInfo(results: SearchResult[]): {
  names: string;
  linkedin: string;
  emails: string;
} {
  // Use more sophisticated NLP or structured data extraction
  // Consider using OpenAI API for better extraction
}
```

### Using AI for Better Extraction

You can enhance extraction using OpenAI or other LLMs:

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function extractWithAI(searchResults: SearchResult[], companyName: string) {
  const context = searchResults.map(r => r.snippet).join('\n');
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{
      role: 'system',
      content: 'Extract founder information from the following search results.'
    }, {
      role: 'user',
      content: `Company: ${companyName}\n\nSearch Results:\n${context}\n\nExtract founder names, LinkedIn profiles, and emails.`
    }]
  });
  
  return JSON.parse(response.choices[0].message.content);
}
```

## Monitoring

### Check Enrichment Status

```sql
-- Startups needing enrichment
SELECT COUNT(*) FROM startups WHERE needs_enrichment = true;

-- Enrichment status breakdown
SELECT enrichment_status, COUNT(*) 
FROM startups 
GROUP BY enrichment_status;

-- Failed enrichments (can retry)
SELECT name, enrichment_status 
FROM startups 
WHERE enrichment_status = 'failed';
```

### Retry Failed Enrichments

```bash
# Get failed startups and retry
npm run enrich-startups
# The agent automatically retries failed startups
```

## Best Practices

1. **Rate Limiting:** Add delays between searches to avoid API rate limits
2. **Error Handling:** Log failures and allow retries
3. **Data Validation:** Validate extracted data before saving
4. **Incremental Updates:** Only update fields that are missing or improved
5. **Monitoring:** Track enrichment success rates and common failures

## Next Steps

1. **Set up a search API** (Google, SerpAPI, or Bing)
2. **Run the scraper** to populate initial data
3. **Run the enrichment agent** to enrich the data
4. **Monitor and iterate** on extraction quality
5. **Set up automation** for continuous enrichment

