# TechCrunch Scraper Improvements

## Recent Updates

### 1. **Pagination Support** ✅
- Now scrapes multiple pages (up to 5 pages) to get the most recent articles
- Pages are scraped in order: page 1 (most recent) → page 2 → page 3, etc.
- Automatically detects if more pages are available

### 2. **Duplicate Prevention** ✅
- Checks Supabase before scraping to see which articles have already been processed
- Skips articles that already exist in the database (by `techcrunch_article_link`)
- Prevents re-scraping the same articles

### 3. **Enhanced Embedding Data** ✅
- Embedding now includes more comprehensive data:
  - Company name
  - Full description (up to 1000 chars)
  - Funding stage
  - Funding amount
  - Location
  - Tags (business_type, industry)

### 4. **Better Content Extraction** ✅
- Improved article content extraction with multiple selector strategies
- Filters out short text snippets (likely navigation/ads)
- Removes duplicate paragraphs
- Extracts more comprehensive article text

### 5. **Enhanced Pinecone Metadata** ✅
- Stores more metadata in Pinecone for better filtering:
  - name
  - industry
  - description
  - keywords
  - business_type
  - location
  - funding_stage
  - funding_amount
  - website

## How It Works Now

### Step 1: Check Already Scraped
```typescript
// Fetches all techcrunch_article_link values from Supabase
const alreadyScrapedLinks = await getAlreadyScrapedArticleLinks();
// Result: Set of URLs that have already been processed
```

### Step 2: Scrape with Pagination
```typescript
// Scrapes pages 1-5 (most recent first)
for (let pageNum = 1; pageNum <= 5; pageNum++) {
  const articles = await scrapeCategoryPage(page, 'fundraising', pageNum);
  // Collects articles from each page
}
```

### Step 3: Filter New Articles
```typescript
// Only process articles that haven't been scraped before
const newArticles = allArticles.filter(article => 
  !alreadyScrapedLinks.has(article.link)
);
```

### Step 4: Enhanced Embedding
```typescript
// Embedding includes comprehensive data
const embeddingText = `
  ${description}
  Company: ${companyName}
  Funding Stage: ${fundingStage}
  Funding Amount: ${fundingAmount}
  Location: ${location}
  Tags: ${business_type}, ${industry}
`;
```

## Benefits

1. **Gets Most Recent Articles**: Pagination ensures you get the latest funding news
2. **No Duplicates**: Skips already-scraped articles automatically
3. **Better Matching**: Enhanced embeddings improve semantic search results
4. **More Data**: Extracts comprehensive article content
5. **Efficient**: Only processes new articles

## Usage

```bash
npm run scrape-techcrunch-supabase
```

The scraper will:
1. Check Supabase for already-scraped articles
2. Scrape pages 1-5 of the fundraising category
3. Filter out already-scraped articles
4. Process only new articles
5. Extract comprehensive data
6. Create enhanced embeddings
7. Save to Supabase + Pinecone

## Configuration

You can adjust the number of pages to scrape:

```typescript
const maxPages = 5; // Change this to scrape more/fewer pages
```

## Expected Output

```
🔍 Checking for already-scraped articles in Supabase...
   Found 15 already-scraped articles

📂 Scraping TechCrunch fundraising category (with pagination)...

📄 Scraping page 1...
   Found 18 valid articles on page 1
   Total articles collected so far: 18

📄 Scraping page 2...
   Found 18 valid articles on page 2
   Total articles collected so far: 36

📊 Found 36 total funding articles across 2 page(s)

📋 Filtered to 21 new articles (15 already scraped)

[1/21] 📄 Scraping: Company X raises $10M...
   ✅ Extracted: Company X
```

