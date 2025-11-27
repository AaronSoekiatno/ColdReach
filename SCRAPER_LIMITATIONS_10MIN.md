# TechCrunch Scraper - 10-Minute Schedule Limitations

## Overview

Running the scraper every 10 minutes presents several challenges and limitations. This document outlines potential issues and solutions.

## Critical Limitations

### 1. **TechCrunch Rate Limiting & Blocking** ⚠️ HIGH RISK

**Issue:**
- TechCrunch may detect automated scraping and block your IP
- Too frequent requests (every 10 min) can trigger anti-bot measures
- Risk of CAPTCHA challenges or IP bans

**Current Protection:**
- 1 second delay between articles
- 2 seconds between pages
- User agent set to mimic browser

**Recommendations:**
- ✅ **Increase delays**: 2-3 seconds between articles, 5 seconds between pages
- ✅ **Use proxy rotation** (if available)
- ✅ **Monitor for 429/403 errors** and back off
- ✅ **Consider 30-60 minute intervals** instead of 10 minutes
- ⚠️ **Risk**: IP ban if detected

**Impact:** 🔴 **HIGH** - Could stop scraping entirely

---

### 2. **Gemini API Rate Limits** ⚠️ MEDIUM RISK

**Issue:**
- Gemini API has rate limits (varies by tier)
- Free tier: ~15 requests per minute
- Paid tier: Higher limits but still capped

**Calculation (10-min schedule):**
- If 5 new articles per run: 5 embeddings per 10 min = **30 embeddings/hour**
- If 10 new articles per run: 10 embeddings per 10 min = **60 embeddings/hour**
- If 20 new articles per run: 20 embeddings per 10 min = **120 embeddings/hour**

**Gemini Limits (typical):**
- Free tier: ~900 requests/hour (15/min)
- Paid tier: Varies (check your quota)

**Recommendations:**
- ✅ **Monitor API usage** - track requests per hour
- ✅ **Add exponential backoff** on rate limit errors
- ✅ **Batch processing** - process in smaller batches
- ✅ **Upgrade API tier** if needed
- ⚠️ **Risk**: Rate limit errors, failed embeddings

**Impact:** 🟡 **MEDIUM** - Could cause failed embeddings

---

### 3. **Pinecone API Rate Limits** ⚠️ MEDIUM RISK

**Issue:**
- Pinecone has rate limits on upserts
- Free tier: Lower limits
- Paid tier: Higher but still limited

**Calculation:**
- Same as Gemini (1 upsert per startup)
- 30-120 upserts/hour depending on new articles

**Pinecone Limits (typical):**
- Free tier: ~100 operations/minute
- Paid tier: Higher limits

**Recommendations:**
- ✅ **Monitor Pinecone usage**
- ✅ **Batch upserts** if possible
- ✅ **Add retry logic** with backoff
- ⚠️ **Risk**: Failed Pinecone writes

**Impact:** 🟡 **MEDIUM** - Could cause failed Pinecone writes

---

### 4. **Supabase Rate Limits** ⚠️ LOW-MEDIUM RISK

**Issue:**
- Supabase has rate limits on queries/writes
- Free tier: 500 requests/second (usually fine)
- Querying all article links every 10 min could add up

**Calculation:**
- 1 query to get already-scraped links per run
- 1 insert per new startup
- If 1000 startups in DB: query returns 1000 rows every 10 min

**Recommendations:**
- ✅ **Optimize query** - only select `techcrunch_article_link` column
- ✅ **Add caching** - cache already-scraped links for 5-10 minutes
- ✅ **Use indexed queries** - ensure `techcrunch_article_link` is indexed
- ⚠️ **Risk**: Slower queries as dataset grows

**Impact:** 🟢 **LOW-MEDIUM** - Should be fine, but optimize queries

---

### 5. **Performance & Execution Time** ⚠️ MEDIUM RISK

**Current Timing (estimated):**
- Browser launch: ~2-3 seconds
- Scrape 5 pages: ~10-15 seconds (2s delay between pages)
- Process 20 articles: ~20-30 seconds (1s delay + scraping time)
- Generate embeddings: ~5-10 seconds (API calls)
- Save to Supabase/Pinecone: ~2-5 seconds
- **Total: ~40-60 seconds per run**

**Issue:**
- If run takes >10 minutes, next run starts before previous finishes
- Could cause resource conflicts
- Browser instances could pile up

**Recommendations:**
- ✅ **Add execution lock** - prevent overlapping runs
- ✅ **Monitor execution time** - log duration
- ✅ **Optimize delays** - reduce if safe
- ✅ **Parallel processing** - process multiple articles concurrently (with limits)
- ⚠️ **Risk**: Overlapping executions, resource exhaustion

**Impact:** 🟡 **MEDIUM** - Could cause conflicts

---

### 6. **Resource Usage (Memory/CPU)** ⚠️ MEDIUM RISK

**Issue:**
- Puppeteer uses ~100-200MB RAM per browser instance
- If runs overlap, memory usage multiplies
- CPU usage during scraping

**Recommendations:**
- ✅ **Single browser instance** - reuse if possible
- ✅ **Close browser properly** - ensure cleanup
- ✅ **Monitor memory usage**
- ✅ **Use headless mode** (already enabled)
- ⚠️ **Risk**: High memory usage, server crashes

**Impact:** 🟡 **MEDIUM** - Could cause server issues

---

### 7. **Data Freshness vs. Frequency** ⚠️ LOW RISK

**Issue:**
- TechCrunch doesn't publish new funding articles every 10 minutes
- Most articles are published 1-5 times per day
- Running every 10 min = 144 runs/day, but maybe only 5-10 new articles

**Calculation:**
- If 5 new articles/day: 5 articles / 144 runs = **0.03 articles per run**
- Most runs will find 0 new articles
- Wasted resources on empty runs

**Recommendations:**
- ✅ **Adjust frequency** - 30-60 minutes might be better
- ✅ **Early exit** - if no new articles, exit quickly
- ✅ **Smart scheduling** - run more frequently during business hours
- ⚠️ **Risk**: Wasted API calls, unnecessary load

**Impact:** 🟢 **LOW** - Inefficient but not breaking

---

### 8. **Cost Implications** 💰

**Per Run Costs (estimated):**
- Gemini embeddings: ~$0.0001 per embedding (if paid tier)
- Pinecone upserts: Usually included in plan
- Supabase: Usually included in plan
- Server resources: Minimal

**Daily Costs (144 runs/day):**
- If 5 new articles/day: 5 embeddings = **$0.0005/day**
- If 20 new articles/day: 20 embeddings = **$0.002/day**
- **Monthly: ~$0.015 - $0.06** (very low)

**Recommendations:**
- ✅ **Monitor costs** - track API usage
- ✅ **Use free tiers** if possible
- ⚠️ **Risk**: Costs scale with usage

**Impact:** 🟢 **LOW** - Costs are minimal

---

### 9. **Database Growth** ⚠️ LOW-MEDIUM RISK

**Issue:**
- Database grows with each run
- Querying all article links gets slower as dataset grows
- Need to optimize queries

**Recommendations:**
- ✅ **Add index** on `techcrunch_article_link`
- ✅ **Add index** on `created_at` for time-based queries
- ✅ **Archive old data** if needed
- ✅ **Use pagination** for large queries
- ⚠️ **Risk**: Slower queries over time

**Impact:** 🟢 **LOW-MEDIUM** - Manageable with indexing

---

### 10. **Error Handling & Reliability** ⚠️ MEDIUM RISK

**Issue:**
- Network failures
- API timeouts
- TechCrunch site changes
- Browser crashes

**Recommendations:**
- ✅ **Add retry logic** with exponential backoff
- ✅ **Graceful error handling** - continue on individual failures
- ✅ **Logging** - track errors and success rates
- ✅ **Alerts** - notify on repeated failures
- ⚠️ **Risk**: Silent failures, missed articles

**Impact:** 🟡 **MEDIUM** - Could miss articles on errors

---

## Recommended Solutions

### 1. **Optimize Scraping Frequency**

```typescript
// Instead of every 10 minutes, consider:
// - Every 30 minutes during business hours (9 AM - 6 PM)
// - Every 2 hours during off-hours
// - Or: Check if new articles exist first, then scrape
```

### 2. **Add Execution Lock**

```typescript
// Prevent overlapping runs
let isRunning = false;

async function scrapeAndIngestTechCrunch() {
  if (isRunning) {
    console.log('⚠️  Previous run still in progress, skipping...');
    return;
  }
  
  isRunning = true;
  try {
    // ... scraping logic
  } finally {
    isRunning = false;
  }
}
```

### 3. **Optimize Database Queries**

```sql
-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_startups_techcrunch_link 
ON startups(techcrunch_article_link);

-- Query only what you need
SELECT techcrunch_article_link 
FROM startups 
WHERE techcrunch_article_link IS NOT NULL;
```

### 4. **Add Caching**

```typescript
// Cache already-scraped links for 10 minutes
let cachedLinks: Set<string> | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function getAlreadyScrapedArticleLinks(): Promise<Set<string>> {
  const now = Date.now();
  if (cachedLinks && (now - cacheTime) < CACHE_TTL) {
    return cachedLinks;
  }
  
  // Fetch from Supabase
  cachedLinks = await fetchFromSupabase();
  cacheTime = now;
  return cachedLinks;
}
```

### 5. **Add Rate Limit Handling**

```typescript
// Handle rate limits gracefully
async function generateEmbeddingWithRetry(text: string, retries = 3): Promise<number[]> {
  for (let i = 0; i < retries; i++) {
    try {
      return await generateEmbedding(text);
    } catch (error) {
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        console.warn(`Rate limited, waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Failed after retries');
}
```

### 6. **Early Exit for No New Articles**

```typescript
// Exit early if no new articles
if (newArticles.length === 0) {
  console.log('✅ No new articles to scrape!');
  await browser.close();
  return; // Exit early, save resources
}
```

---

## Recommended Schedule

### Option 1: **Every 30 Minutes** (Recommended)
- **144 runs/day → 48 runs/day**
- Still frequent enough to catch new articles
- Reduces load by 66%
- Less likely to trigger rate limits

### Option 2: **Every Hour**
- **144 runs/day → 24 runs/day**
- Reduces load by 83%
- Still catches articles within 1 hour
- Much safer for rate limits

### Option 3: **Smart Scheduling**
- **Every 10 min during business hours (9 AM - 6 PM)**
- **Every 2 hours during off-hours**
- Balances freshness with efficiency

### Option 4: **Event-Driven** (Best)
- **Check for new articles first** (lightweight)
- **Only scrape if new articles exist**
- Most efficient approach

---

## Monitoring Checklist

Track these metrics:
- ✅ **Execution time** per run
- ✅ **New articles found** per run
- ✅ **API errors** (rate limits, timeouts)
- ✅ **Failed scrapes** (TechCrunch blocking)
- ✅ **Memory usage** (browser instances)
- ✅ **Database query time** (already-scraped check)
- ✅ **Cost per run** (API usage)

---

## Risk Summary

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| TechCrunch IP ban | 🔴 High | Medium | Increase delays, reduce frequency |
| Gemini rate limits | 🟡 Medium | Medium | Monitor usage, add retries |
| Pinecone rate limits | 🟡 Medium | Low | Monitor usage, batch if needed |
| Supabase limits | 🟢 Low | Low | Optimize queries, add indexes |
| Overlapping runs | 🟡 Medium | Medium | Add execution lock |
| Memory issues | 🟡 Medium | Low | Proper cleanup, monitor usage |
| Wasted resources | 🟢 Low | High | Early exit, smart scheduling |

---

## Immediate Actions

1. ✅ **Add execution lock** to prevent overlapping runs
2. ✅ **Add caching** for already-scraped articles query
3. ✅ **Add rate limit handling** with retries
4. ✅ **Add early exit** if no new articles
5. ✅ **Monitor execution time** and log it
6. ✅ **Consider 30-min schedule** instead of 10-min
7. ✅ **Add database indexes** for performance

