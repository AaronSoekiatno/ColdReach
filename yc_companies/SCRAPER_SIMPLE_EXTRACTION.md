# Simple Text-Based Founder Extraction

## Problem

The CSS selector-based extraction was failing to find founder names even when they're clearly visible on YC pages (like "Stephen Sun" on mlop's page).

## Solution: Simple Text-Based Extraction (Priority Method)

A new **simple text-based extraction** method now runs **FIRST** before any CSS selector attempts. This method:

1. **Finds "Active Founders" in raw page text** - doesn't rely on HTML structure
2. **Extracts names line-by-line** - looks for patterns like "First Last"
3. **Works regardless of CSS classes** - completely independent of DOM structure changes

## How It Works

### Step 1: Find the Section
- Searches the entire page text for "Active Founders" or "Founders"
- Gets the position/index of this text

### Step 2: Extract Names
- Gets all text after "Active Founders"
- Splits into lines
- Looks at first 30 lines after the heading
- Matches lines that look like names: `First Last` or `First Middle Last`
- Pattern: `^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+[A-Z][a-z]+$`

### Step 3: Extract Additional Data
- **Descriptions**: Looks at the next line after a name for bio text
- **LinkedIn**: Searches for LinkedIn links near the name in the page text
- **Backgrounds**: Extracts descriptive text that mentions "Building", "Prior", etc.

### Step 4: Filter Out False Positives
- Skips company name
- Skips common words like "Active", "Founders", "Company", "Location"
- Skips section headings

## Advantages

1. **No CSS dependency** - Works even if YC changes their HTML/CSS
2. **Simple and reliable** - Direct text extraction is harder to break
3. **Runs first** - If it finds founders, we skip complex CSS selector logic
4. **Falls back gracefully** - If it doesn't find anything, CSS selector method still runs

## Testing

To test the extraction:

```bash
# Debug a specific page
npx tsx yc_companies/debug_founder_extraction.ts --url="https://www.ycombinator.com/companies/mlop"

# Or test with the scraper
npx tsx yc_companies/test_scrape_yc_companies.ts --url="https://www.ycombinator.com/companies/mlop"
```

## Expected Results

For mlop (https://www.ycombinator.com/companies/mlop):
- Should find: **Stephen Sun**
- Description: "Building high quality tools for ML engineers"
- Should extract even though description doesn't mention "founder"

## Code Location

The simple extraction runs at the **start** of the `scrapeYCCompanyPage` function (around line 233-322) before any CSS selector logic.

## Fallback Chain

1. ✅ **Simple text extraction** (NEW - runs first)
2. CSS selector extraction (if simple extraction found nothing)
3. Enhanced text fallback (if CSS selectors fail)
4. LinkedIn link-based extraction (final fallback)

This ensures maximum extraction success rate!

