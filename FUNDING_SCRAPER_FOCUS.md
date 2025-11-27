# TechCrunch Fundraising Scraper - Focus Documentation

## Overview

The TechCrunch scraper has been **optimized to scrape exclusively from TechCrunch's dedicated fundraising category page**. This is the most efficient and focused approach to collecting funding-related startup data.

## Source

**Single Source:** [https://techcrunch.com/category/fundraising/](https://techcrunch.com/category/fundraising/)

This dedicated category page contains all funding-related articles in one place, including:
- Seed funding rounds
- Series A, B, C, D+ funding
- Venture capital investments
- Unicorn announcements
- Startup funding news
- Investment rounds of all stages

## What We Scrape

✅ **Only the fundraising category page**
- Single, focused source
- All funding articles in one place
- No duplicate articles from multiple sources
- Faster scraping (one page instead of many)

## What We DON'T Scrape

We've removed all other sources to focus exclusively on fundraising:
- ❌ Other categories (startups, venture, fintech, AI, etc.)
- ❌ Tag pages (funding, seed, series-a, etc.)
- ❌ General news articles

## Benefits

1. **Fastest Scraping**: Single page = fastest execution
2. **Best Data Quality**: 100% funding-focused articles = most relevant startup data
3. **No Duplicates**: One source = no duplicate articles
4. **Higher Success Rate**: Fundraising articles are guaranteed to contain:
   - Company names
   - Funding amounts
   - Funding stages
   - Investor information
   - Company descriptions
5. **Easier Maintenance**: One URL to monitor and maintain

## Article Filtering

The scraper also validates that URLs are actual article pages (not category/tag pages) by checking for the date pattern:
- ✅ Valid: `https://techcrunch.com/2025/11/22/company-raises-10m/`
- ❌ Invalid: `https://techcrunch.com/category/funding/`
- ❌ Invalid: `https://techcrunch.com/tag/seed/`

## Usage

```bash
npm run scrape-techcrunch-supabase
```

The scraper will:
1. Scrape only funding-related categories and tags
2. Extract startup information from funding articles
3. Save to Supabase with `needs_enrichment=true`
4. Store embeddings in Pinecone

## Expected Results

You should see articles like:
- "Company X raises $10M Series A"
- "Startup Y secures $5M seed funding"
- "VC firm invests $50M in Company Z"
- "Unicorn Company reaches $1B valuation"

## Customization

If you want to add more funding-related sources in the future, you can:

1. **Add pagination** to scrape more articles from the fundraising category:
   ```typescript
   // Could add: https://techcrunch.com/category/fundraising/page/2/
   // https://techcrunch.com/category/fundraising/page/3/
   ```

2. **Add date filtering** to only scrape recent articles:
   ```typescript
   // Could filter articles by date to only get recent funding news
   ```

## Notes

- The scraper still uses the same extraction logic
- All existing features (Supabase, Pinecone, enrichment flags) remain the same
- Only the source URLs have been narrowed to funding-focused content

