# TechCrunch Scraper - Detailed Explanation

## Overview
The `scrape_techcrunch.ts` file is a web scraper that extracts startup information from TechCrunch articles and saves it to JSON and CSV files. It uses the `techcrunch-api` npm package to fetch articles and then uses regex patterns and text analysis to extract structured data.

---

## Step-by-Step Breakdown

### 1. **Imports and Setup** (Lines 1-3)
```typescript
import { getByCategory, getByTag } from 'techcrunch-api';
import * as fs from 'fs';
import * as path from 'path';
```
- Imports the TechCrunch API functions to fetch articles by category and tag
- Imports Node.js file system and path modules for saving files

### 2. **Data Structures** (Lines 5-35)

**TechCrunchArticle Interface:**
- Defines the structure of an article from TechCrunch
- Fields: title, link, description, content, author, date
- Uses `[key: string]: any` to allow additional fields

**StartupData Interface:**
- Defines the output format matching your YC companies CSV structure
- Includes all fields like Company_Name, funding_stage, amount_raised, etc.
- Note: Some fields are empty strings (like YC_Link, Company_Logo) since TechCrunch doesn't provide this data

### 3. **Configuration Arrays** (Lines 37-63)

**STARTUP_CATEGORIES:**
- 10 categories to scrape: startups, venture, fintech, AI, apps, hardware, security, crypto, transportation, media-entertainment
- These are TechCrunch's category URLs/slugs

**STARTUP_TAGS:**
- 10 tags to search: startup, funding, seed, series-a, series-b, unicorn, y-combinator, yc, venture-capital, vc
- These help find articles specifically about funding and startups

### 4. **Data Extraction Functions**

#### `extractCompanyName()` (Lines 68-130)
**Purpose:** Finds the company name in an article

**How it works:**
1. Combines title and content into one text string
2. Uses 6 regex patterns to find company names:
   - Pattern 1: "Company raises $X" → extracts "Company"
   - Pattern 2: "Company has raised" → extracts "Company"
   - Pattern 3: "Company raised $X" → extracts "Company"
   - Pattern 4: "Company is a startup" → extracts "Company"
   - Pattern 5: "Startup Company X" → extracts "Company X"
   - Pattern 6: "Company, a startup" → extracts "Company"
3. Cleans up the name:
   - Removes leading/trailing articles (the, a, an)
   - Removes punctuation
   - Filters out false positives (The, A, An, This, That, etc.)
4. Validates: name must be 2-50 characters and contain at least one capital letter
5. Fallback methods:
   - Tries to extract from title before keywords like "raises", "secures"
   - Looks for quoted company names

**Example:**
- Input: "Stripe raises $600M in Series H funding"
- Output: "Stripe"

#### `extractFundingAmount()` (Lines 135-159)
**Purpose:** Extracts funding amounts like "$10M", "$5.5B", etc.

**How it works:**
1. Uses 4 regex patterns to find amounts:
   - `$10M`, `10 million`, `$5.5B`, etc.
   - Looks for "raised $X", "secured $X", "closed $X"
2. Parses the number and determines unit (M=million, B=billion, K=thousand)
3. Returns formatted string like "$10M"

**Example:**
- Input: "The company raised $25 million in Series A"
- Output: "$25M"

#### `extractFundingStage()` (Lines 164-184)
**Purpose:** Determines the funding round type

**How it works:**
1. Converts text to lowercase
2. Checks for keywords in order:
   - "seed" or "pre-seed" → "Seed"
   - "series a" or "series-a" → "Series A"
   - "series b" or "series-b" → "Series B"
   - "series c" or "series-c" → "Series C"
   - "series d" or "series-d" → "Series D"
   - "ipo" → "IPO"
   - "bridge" → "Bridge"
3. Defaults to "Seed" if nothing found

**Example:**
- Input: "announced its Series B funding round"
- Output: "Series B"

#### `extractDate()` (Lines 189-210)
**Purpose:** Extracts the publication or funding date

**How it works:**
1. First checks if article has a date field
2. If not, searches content for date patterns:
   - "January 15, 2024"
   - "01/15/2024"
   - "2024-01-15"
3. If no date found, uses current date formatted as "January 2024"

#### `extractLocation()` (Lines 215-247)
**Purpose:** Finds the company's location

**How it works:**
1. Checks for common startup cities in a predefined list:
   - San Francisco, New York, Los Angeles, Boston, Seattle, Austin, Chicago
   - London, Berlin, Tel Aviv, Bangalore, Singapore
2. If not found, tries to match "City, State" pattern (e.g., "Austin, TX")
3. Returns empty string if nothing found

#### `extractIndustry()` (Lines 252-292)
**Purpose:** Categorizes the company's industry

**How it works:**
1. Uses a keyword mapping dictionary:
   - "ai", "machine learning", "ml" → "Artificial Intelligence"
   - "fintech", "financial", "banking" → "Fintech"
   - "healthcare", "health", "biotech" → "Healthcare"
   - etc.
2. Searches text (case-insensitive) for keywords
3. Returns the first matching industry or empty string

**Example:**
- Input: "AI-powered fintech startup"
- Output: "Artificial Intelligence" (first match)

#### `extractBusinessType()` (Lines 297-311)
**Purpose:** Determines if company is B2B, B2C, Marketplace, or Platform

**How it works:**
1. Checks for keywords:
   - "b2b", "enterprise" → "B2B"
   - "b2c", "consumer" → "Consumer"
   - "marketplace" → "Marketplace"
   - "platform" → "Platform"
2. Defaults to "B2B"

#### `extractWebsite()` (Lines 316-336)
**Purpose:** Finds or generates the company website

**How it works:**
1. Searches for URLs in the content using regex
2. Filters out common non-company domains (techcrunch.com, twitter.com, etc.)
3. If no URL found, generates one from company name:
   - "Stripe Inc" → "stripeinc.com"
   - Removes special characters, converts to lowercase

### 5. **Main Processing Functions**

#### `parseArticleToStartup()` (Lines 341-377)
**Purpose:** Orchestrates all extraction functions to create a complete StartupData object

**How it works:**
1. Calls `extractCompanyName()` - if null, returns null (can't create startup without name)
2. Combines title and content
3. Calls all other extraction functions
4. Creates and returns a StartupData object with:
   - Extracted data where available
   - Default values for missing data:
     - `founder_first_name: 'Team'`
     - `founder_email: 'hello@website.com'`
     - `job_openings: 'Software Engineering Intern, Product Intern'`
     - `amount_raised: '$1.5M'` (if not found)
     - `data_quality: '📰 TECHCRUNCH'` (marks source)

#### `normalizeArticle()` (Lines 382-402)
**Purpose:** Handles different API response formats

**How it works:**
1. If response is a string, wraps it in an object
2. If response is an array, extracts first item
3. Maps various field names to standard format:
   - `headline` or `name` → `title`
   - `url` or `href` → `link`
   - `summary` or `excerpt` → `description`
   - `body` or `text` → `content`
   - `publishedDate` or `pubDate` → `date`
4. Returns normalized TechCrunchArticle

### 6. **Main Scraping Function** (Lines 407-531)

#### `scrapeTechCrunch()`

**Phase 1: Scrape by Categories** (Lines 413-451)
1. Loops through each category in STARTUP_CATEGORIES
2. Calls `getByCategory(category)` API
3. Handles different response formats (array, object with data property, etc.)
4. For each article:
   - Normalizes the article
   - Parses to startup data
   - Checks for duplicates (case-insensitive company name)
   - Adds to results if unique
5. Waits 2 seconds between categories (rate limiting)

**Phase 2: Scrape by Tags** (Lines 453-491)
1. Same process as categories but uses `getByTag(tag)`
2. Loops through STARTUP_TAGS
3. Also checks for duplicates against previously found companies

**Phase 3: Save Results** (Lines 493-531)
1. Creates output directory path
2. Saves JSON file with all startups (pretty-printed)
3. Saves CSV file:
   - Creates header row from object keys
   - Escapes commas and quotes in values
   - One row per startup
4. Prints summary statistics:
   - Total startups found
   - How many have funding info
   - How many have location
   - How many have industry

---

## How to Test

### Option 1: Quick Test (Recommended)
```bash
npm run test-scrape-techcrunch
```
- Tests with only 2 categories and 2 tags
- Limits to first 5 articles per category, 3 per tag
- Shows detailed output for each article
- Saves to `techcrunch_startups_TEST.json` and `techcrunch_startups_TEST.csv`

### Option 2: Full Test
```bash
npm run scrape-techcrunch
```
- Runs full scraper with all categories and tags
- Takes longer (20+ categories/tags × 2 seconds delay = 40+ seconds minimum)
- Saves to `techcrunch_startups.json` and `techcrunch_startups.csv`

### What to Check:
1. **API Connection:** Should see "✅ API connection successful!"
2. **Article Fetching:** Should see "Found X articles in category..."
3. **Extraction:** Should see "✅ Extracted: CompanyName" for each successful extraction
4. **Output Files:** Check the JSON/CSV files in `yc_companies/` directory
5. **Data Quality:** Review extracted data - company names should be accurate, funding amounts reasonable

### Common Issues:
- **API Errors:** The `techcrunch-api` package might have rate limits or API changes
- **No Results:** Some categories/tags might not return articles
- **Poor Extraction:** Regex patterns might miss some company names or extract incorrectly
- **Rate Limiting:** If you get errors, increase the delay between requests

---

## Limitations

1. **Regex-Based Extraction:** Not 100% accurate - may miss companies or extract wrong names
2. **Limited Data:** TechCrunch articles don't have all fields (no YC link, logo, founder details)
3. **Default Values:** Many fields use placeholder/default values
4. **No Validation:** Doesn't verify if extracted websites actually exist
5. **Rate Limiting:** 2-second delays between requests (could be slow for many categories)

---

## Output Format

The scraper outputs data matching your YC companies CSV structure:
- **Company_Name:** Extracted from article
- **amount_raised:** Extracted or default "$1.5M"
- **funding_stage:** Extracted or default "Seed"
- **industry:** Extracted or empty
- **location:** Extracted or empty
- **website:** Extracted or generated
- **data_quality:** "📰 TECHCRUNCH" (marks the source)

---

## Next Steps

After testing, you can:
1. Run the full scraper to get more data
2. Use `scrape_techcrunch_supabase_pinecone.ts` to ingest into your database
3. Improve extraction functions based on test results
4. Add more categories/tags if needed

