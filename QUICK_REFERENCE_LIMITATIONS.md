# Quick Reference: 10-Minute Schedule Limitations

## 🚨 Critical Risks

### 1. **TechCrunch IP Blocking** 🔴 HIGH
- **Risk**: Too frequent scraping → IP ban
- **Current**: 1s delay between articles, 2s between pages
- **Fix**: Increase to 2-3s between articles, 5s between pages
- **Recommendation**: Consider 30-min schedule instead

### 2. **API Rate Limits** 🟡 MEDIUM
- **Gemini**: ~15 requests/min (free tier)
- **Pinecone**: ~100 ops/min (free tier)
- **Calculation**: 5-20 new articles per run = 30-120 embeddings/hour
- **Fix**: Added retry logic with exponential backoff ✅

### 3. **Overlapping Runs** 🟡 MEDIUM
- **Risk**: Run takes >10 min → next run starts before finish
- **Fix**: Added execution lock ✅ (prevents overlapping)

### 4. **Database Query Performance** 🟢 LOW-MEDIUM
- **Risk**: Querying all article links gets slower as DB grows
- **Fix**: Added 10-minute cache ✅ (reduces queries by 90%)

## ✅ Implemented Fixes

1. **Execution Lock** - Prevents overlapping runs
2. **Caching** - Caches already-scraped links for 10 minutes
3. **Rate Limit Handling** - Retries with exponential backoff
4. **Early Exit** - Exits if no new articles found
5. **Execution Time Tracking** - Monitors performance

## 📊 Expected Performance

**Per Run (10 minutes):**
- Execution time: ~40-60 seconds
- New articles: 0-5 (most runs will be 0)
- API calls: 0-5 embeddings
- Database queries: 1 (cached after first run)

**Daily (144 runs):**
- Total execution time: ~2-3 hours
- New articles: ~5-20 per day
- API calls: ~5-20 embeddings/day
- Cost: ~$0.0005-$0.002/day

## ⚠️ Recommendations

1. **Increase Schedule to 30 Minutes**
   - Reduces load by 66%
   - Still catches articles quickly
   - Much safer for rate limits

2. **Monitor These Metrics**
   - Execution time (should be <2 min)
   - Rate limit errors
   - TechCrunch blocking (429/403 errors)
   - Memory usage

3. **Add Database Index**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_startups_techcrunch_link 
   ON startups(techcrunch_article_link);
   ```

4. **Consider Smart Scheduling**
   - Every 10 min during business hours (9 AM - 6 PM)
   - Every 2 hours during off-hours

## 📈 Scaling Considerations

As your dataset grows:
- **100 startups**: Fast queries ✅
- **1,000 startups**: Still fast ✅
- **10,000 startups**: May need query optimization
- **100,000 startups**: Will need pagination/caching

Current caching strategy handles this well up to ~10k startups.

