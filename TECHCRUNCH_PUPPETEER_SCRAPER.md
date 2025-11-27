# TechCrunch Puppeteer Scraper

## Overview

The TechCrunch scraper has been rebuilt to use **Puppeteer** for direct web scraping instead of the broken `techcrunch-api` package. This provides more reliable and up-to-date article extraction.

## What Changed

### Before (Broken)
- Used `techcrunch-api` npm package
- Returned 0 articles for all categories/tags
- Package appears to be deprecated or broken

### After (Working)
- Uses Puppeteer to scrape TechCrunch directly
- Scrapes category pages: `https://techcrunch.com/category/{category}/`
- Scrapes tag pages: `https://techcrunch.com/tag/{tag}/`
- Extracts full article content from individual article pages
- More reliable and maintainable

## How It Works

### 1. Category Scraping
```typescript
// Navigates to: https://techcrunch.com/category/startups/
// Extracts article links, titles, descriptions from the category page
const articles = await scrapeCategoryPage(page, 'startups');
```

### 2. Tag Scraping
```typescript
// Navigates to: https://techcrunch.com/tag/funding/
// Extracts article links, titles, descriptions from the tag page
const articles = await scrapeTagPage(page, 'funding');
```

### 3. Full Article Scraping
```typescript
// For each article link, navigates to the full article page
// Extracts complete article content, author, date, etc.
const fullArticle = await scrapeArticlePage(page, articleLink);
```

### 4. Data Extraction
- Uses existing extraction functions (same as before)
- Extracts company names, funding amounts, locations, etc.
- Saves to Supabase with `needs_enrichment=true`
- Stores embeddings in Pinecone

## Features

✅ **Direct Web Scraping**: No API dependencies  
✅ **Full Article Content**: Scrapes complete article text  
✅ **Rate Limiting**: Built-in delays to avoid overwhelming servers  
✅ **Duplicate Detection**: Skips articles already processed  
✅ **Error Handling**: Continues processing even if individual articles fail  
✅ **Browser Management**: Properly launches and closes browser  

## Usage

```bash
npm run scrape-techcrunch-supabase
```

## Configuration

The scraper uses the same environment variables as before:
- `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `PINECONE_API_KEY` (optional)
- `PINECONE_INDEX_NAME` (optional, defaults to 'startups')
- `GEMINI_API_KEY` (optional, for embeddings)

## Rate Limiting

- **1 second** delay between individual articles
- **2 seconds** delay between categories/tags
- Prevents overwhelming TechCrunch servers
- Respectful scraping practices

## Categories Scraped

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

## Tags Scraped

- startup
- funding
- seed
- series-a
- series-b
- unicorn
- y-combinator
- yc
- venture-capital
- vc

## Output

The scraper:
1. Scrapes articles from TechCrunch
2. Extracts startup information
3. Saves to Supabase with:
   - `techcrunch_article_link`: Link to original article
   - `techcrunch_article_content`: Full article content
   - `needs_enrichment`: true (for web search enrichment)
   - `data_source`: 'techcrunch'
4. Stores embeddings in Pinecone (if configured)

## Troubleshooting

### Browser Launch Issues
If Puppeteer fails to launch:
- Ensure Chromium is downloaded (first run downloads it automatically)
- On Linux, may need: `sudo apt-get install -y chromium-browser`
- Check system requirements for Puppeteer

### No Articles Found
- TechCrunch website structure may have changed
- Check browser console for errors
- Verify category/tag URLs are correct
- May need to update CSS selectors in scraping functions

### Timeout Errors
- Increase timeout values in `page.goto()` calls
- Check network connectivity
- TechCrunch may be slow to load

## Next Steps

After scraping, run the enrichment agent to find additional data:

```bash
npm run enrich-startups
```

This will use web search APIs (Google/SerpAPI/Bing) to find:
- Founder information
- Job openings
- More accurate company websites
- Additional funding details

## Performance

- **Speed**: ~1-2 seconds per article (including delays)
- **Memory**: Puppeteer uses ~100-200MB RAM
- **Network**: Downloads full article pages (larger than API responses)

## Maintenance

If TechCrunch changes their website structure, update the CSS selectors in:
- `scrapeCategoryPage()` - for category page structure
- `scrapeTagPage()` - for tag page structure  
- `scrapeArticlePage()` - for article page structure

