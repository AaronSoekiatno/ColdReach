# Gemini-Based Extraction Update

## Overview

The TechCrunch scraper has been updated to use **Gemini AI** for intelligent extraction of startup data from articles, replacing the previous regex-based approach.

## Key Changes

### 1. **Gemini-Powered Extraction** 🤖

- **New Function**: `extractStartupDataWithGemini()`
  - Uses Gemini 1.5 Flash model for structured data extraction
  - Extracts: company name, funding stage, amount, date, location, industry, business type, website, description
  - Falls back to regex extraction if Gemini API is unavailable

- **Benefits**:
  - More accurate company name extraction
  - Better understanding of funding context
  - Handles edge cases and variations in article format
  - Extracts structured data from unstructured text

### 2. **Article Date Sorting** 📅

- **New Function**: `parseArticleDate()`
  - Extracts date from article URL (most reliable source)
  - Falls back to article date field or current date
  - Used for sorting articles by recency

- **Sorting Logic**:
  - Articles are now sorted by date (newest first)
  - Ensures most recent articles are processed first
  - Logs newest and oldest article dates for verification

### 3. **Enhanced Date Extraction**

- Extracts date from URL pattern: `/2025/11/22/article-name/`
- Stores date in `dateFromUrl` field for reference
- Uses date for sorting and display

## How It Works

### Extraction Flow

1. **Scrape Article**: Get full article content from TechCrunch
2. **Gemini Extraction**: Send article to Gemini with structured prompt
3. **Parse Response**: Extract JSON from Gemini response
4. **Validate**: Ensure company name is present
5. **Fallback**: Use regex extraction if Gemini fails

### Gemini Prompt Structure

```
Extract structured startup funding information from this TechCrunch article.

Extract:
- Company_Name (required)
- funding_stage (Seed, Series A, etc.)
- amount_raised ($5M format)
- date_raised
- location
- industry
- business_type
- website
- company_description
```

### Date Sorting Flow

1. **Collect Articles**: Scrape articles from multiple pages
2. **Parse Dates**: Extract dates from URLs or article metadata
3. **Sort**: Sort by date (newest first)
4. **Filter**: Remove already-scraped articles
5. **Process**: Process newest articles first

## Example Output

```
📊 Found 45 total funding articles across 3 page(s)

📅 Sorted articles by date (newest first)
   Newest: 2025-11-22
   Oldest: 2025-11-15

📋 Filtered to 5 new articles (40 already scraped)

[1/5] 📄 Scraping: StartupX raises $10M Series A...
   🤖 Extracting data with Gemini...
   ✅ Extracted: StartupX (Series A - $10M)
```

## Configuration

### Required Environment Variables

```env
GEMINI_API_KEY=your_gemini_api_key
```

### Fallback Behavior

If `GEMINI_API_KEY` is not set:
- Falls back to regex-based extraction
- Logs warning: "⚠️ Gemini API not available, falling back to regex extraction"
- Still processes articles, but with less accuracy

## Performance

### API Calls

- **Gemini API**: 1 call per article
- **Rate Limiting**: 2-second delay between articles
- **Cost**: ~$0.0001 per article (Gemini 1.5 Flash)

### Processing Time

- **Per Article**: ~2-3 seconds (Gemini extraction + delays)
- **10 Articles**: ~20-30 seconds
- **50 Articles**: ~2-3 minutes

## Benefits

1. **Accuracy**: Better extraction of company names and funding details
2. **Context Understanding**: Gemini understands article context
3. **Flexibility**: Handles various article formats and styles
4. **Recency**: Processes newest articles first
5. **Reliability**: Falls back to regex if Gemini fails

## Limitations

1. **API Dependency**: Requires Gemini API key
2. **Rate Limits**: Gemini has rate limits (15 req/min free tier)
3. **Cost**: Small cost per article (~$0.0001)
4. **Processing Time**: Slightly slower than regex (2-3s vs <1s)

## Future Improvements

- [ ] Cache Gemini responses for duplicate articles
- [ ] Batch processing for multiple articles
- [ ] Retry logic for API failures
- [ ] Cost tracking and optimization
- [ ] A/B testing: Gemini vs regex accuracy

