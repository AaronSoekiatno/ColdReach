# Phase 1 Email Discovery - Test Results & Analysis

**Date**: 2025-11-29
**Test Script**: `yc_companies/test_email_discovery.ts`
**Companies Tested**: 4 (Revolut, Sierra, Find Your Grind, Onton)

---

## Summary

❌ **FAILED** - 0% success rate (Target: 60%)

**Key Metrics**:
- Companies tested: 4
- Emails found: 0
- Success rate: 0.0%
- Founders identified: 27 (many false positives)
- Rate limit errors: ~10 DuckDuckGo failures

---

## Critical Issues Identified

### 1. **Fundamental Approach Flaw** 🚨

**Problem**: The current approach searches the web but only looks at search result **snippets**, not the actual web pages.

**Why This Fails**:
- Search result snippets from Google/DuckDuckGo rarely include email addresses
- LinkedIn **never** shows emails in public search results
- GitHub only shows emails in commit history (not search results)
- Company websites hide emails behind "Contact Us" forms or team pages (not in snippets)

**Example**:
```typescript
// Current approach (FLAWED):
const results = await searchWeb("site:revolut.com founders email");
// Gets: [{snippet: "Meet our founders, Vlad and Nik..."}]
// Problem: Snippet doesn't contain the actual email!

// What we need:
const results = await searchWeb("site:revolut.com/team");
await fetchAndParseWebpage(results[0].url); // Actually visit the page
// Extract: vladimir@revolut.com from the HTML
```

### 2. **Rate Limiting from DuckDuckGo** ⚠️

**Errors Encountered**:
```
⚠️  DuckDuckGo search failed for this query. It may be rate-limited...
```

**Cause**:
- 3 queries per company (website, LinkedIn, GitHub) × 3 tiers × 4 companies = 36+ queries in ~30 seconds
- DuckDuckGo rate limits aggressive scraping
- Even with 3 retries + exponential backoff, we're hitting limits

**Impact**: Many searches returned empty results, reducing founder discovery effectiveness.

### 3. **Poor Name Extraction** 😬

**Bad Extractions** (from test output):
- "from our"
- "is the"
- "and co"
- "as US"
- "of Revolut"
- "Technical research"

**Good Extractions**:
- "Vlad Yatsenko" (Revolut)
- "Nik Storonsky" (Revolut)
- "Bret Taylor" (Sierra)
- "Nick Gross" (Find Your Grind)

**Root Cause**: Regex pattern too broad:
```typescript
/([A-Z][a-z]+\s+[A-Z][a-z]+),?\s*(?:CEO|CTO|CFO|Co-?founder|Founder)/gi
```
This matches ANY capitalized words near "CEO/Founder", including:
- "from our Founder" → extracts "from our"
- "is the CEO" → extracts "is the"

### 4. **No Emails Found** ❌

**Zero emails extracted** despite finding 27 "founders".

**Why**:
1. Search snippets don't contain emails
2. Email extraction regex only runs on snippets
3. Even real founder names (Vlad, Bret) had no associated emails

**Current email extraction**:
```typescript
const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
const emails = text.match(emailPattern) || [];
```
This works fine, but the `text` (snippet) doesn't contain emails!

---

## Detailed Test Results

### Revolut
- **Founders Found**: 6
- **Emails Found**: 0
- **Good Names**: Vlad Yatsenko, Nik Storonsky
- **Bad Names**: "from our", "as US", "and co", "of Revolut"
- **Tier 1 Success**: ❌
- **Tier 2 Success**: ❌

### Sierra
- **Founders Found**: 11
- **Emails Found**: 0
- **Good Names**: Bret Taylor, Rafat Ali
- **Bad Names**: "and CEO", "Bret is", "and was", "of Sierra", "of Salesforce", "are the"
- **Tier 1 Success**: ❌
- **Tier 2 Success**: ❌

### Find Your Grind
- **Founders Found**: 9
- **Emails Found**: 0
- **Good Names**: Nick Gross
- **Bad Names**: "is the", "of Gross", "as Dire", "by Vi", "is using", "and CEO"
- **Tier 1 Success**: ❌
- **Tier 2 Success**: ❌

### Onton
- **Founders Found**: 1
- **Emails Found**: 0
- **Good Names**: None
- **Bad Names**: "Technical research"
- **Tier 1 Success**: ❌
- **Tier 2 Success**: ❌

---

## Why This Approach Won't Reach 60% Success Rate

Even with improved name extraction and rate limit handling, **we cannot get emails from search snippets alone**.

**Calculation**:
- If we fix rate limiting: might find more names
- If we fix name extraction: fewer garbage names
- **But**: Search snippets don't contain emails → 0% email success rate

**Fundamental limitation**: We need to actually **visit web pages**, not just read snippets.

---

## Recommended Solutions

### Option A: Scrape Actual Web Pages (High Success, More Complex) ✅ RECOMMENDED

**Approach**:
1. Search for company team/about pages
2. **Actually visit the URLs** using Puppeteer
3. Parse HTML to extract emails from the full page content
4. Use LLM (Gemini) to extract structured data from HTML

**Pros**:
- Can actually find emails (they're on the pages, just not in snippets)
- Can get more context (roles, LinkedIn URLs, bios)
- Likely 40-70% success rate

**Cons**:
- More API calls (Gemini extractions)
- Slower (need to load full pages)
- More complex error handling

**Implementation**:
```typescript
// 1. Search for team page
const results = await searchWeb("site:revolut.com team");

// 2. Visit the actual page
const html = await fetchWebpage(results[0].url); // Puppeteer

// 3. Extract using LLM
const extracted = await extractWithGemini(html, {
  task: "Find all founders and their emails",
  schema: { founders: [{ name, email, role, linkedin }] }
});
```

### Option B: Use Existing Enrichment + Apollo.io Pattern Matching (Medium Success, Simple) 🔄

**Approach**:
1. Use existing enrichment to get founder names (from TechCrunch scraper or web search)
2. Use LinkedIn URLs to extract first name + last name
3. Generate email patterns: `{first}@{domain}`, `{first}.{last}@{domain}`, etc.
4. Verify with email validation service (free: `mailcheck.ai` API)

**Pros**:
- Simpler than web scraping
- Can work with existing data
- Common pattern-based approach (Apollo.io uses this)
- Likely 30-50% success rate

**Cons**:
- Not as accurate as finding real emails
- Might generate incorrect emails
- Needs validation API (adds dependency)

**Implementation**:
```typescript
// 1. Get founder name + company domain
const founder = { name: "Vlad Yatsenko", company: "revolut.com" };

// 2. Generate patterns
const patterns = [
  "vlad@revolut.com",
  "v.yatsenko@revolut.com",
  "vlad.yatsenko@revolut.com",
  "vyatsenko@revolut.com",
];

// 3. Verify with email validator
for (const email of patterns) {
  const isValid = await verifyEmail(email); // mailcheck.ai or similar
  if (isValid) return email;
}
```

### Option C: Hybrid Approach (Best Success, Balanced Complexity) ⭐ BEST

**Approach**:
1. Try scraping actual web pages first (Option A)
2. If no email found, fall back to pattern matching (Option B)
3. If still no email, mark for manual Hunter.io lookup

**Pros**:
- Best of both worlds
- High success rate (50-70%)
- Graceful degradation

**Cons**:
- Most complex
- More API calls

---

## Next Steps

### Immediate Actions Required

1. **Pivot Strategy** ✅
   - Current approach (search snippets) is fundamentally flawed
   - Must implement web page scraping to find emails

2. **Choose Implementation Path**:
   - **Option A** (web scraping): 2-3 hours implementation
   - **Option B** (pattern matching): 1-2 hours implementation
   - **Option C** (hybrid): 3-4 hours implementation

3. **Fix Name Extraction** (low priority since emails are the blocker)
   - Improve regex to avoid garbage matches
   - Add name validation (min 2 chars, no common words like "from", "and")

### Recommended Path Forward

**Use Option C (Hybrid Approach)**:

**Phase 1A** (2 hours): Web Scraping for Emails
- Modify `founder_email_discovery.ts` to actually fetch web pages
- Use Puppeteer to load team/about pages
- Extract emails from full HTML (not just snippets)
- Use Gemini LLM to parse structured founder data from HTML

**Phase 1B** (1 hour): Pattern Matching Fallback
- For founders without emails after scraping, generate patterns
- Use company domain + founder names to create common patterns
- Optionally validate with email checking API

**Phase 1C** (30 min): Re-test
- Run test script again on same 4 companies
- Target: 50-70% success rate
- If successful, proceed to integration into enrichment workflow

**Phase 2**: Database Migration (unchanged from plan)

---

## Key Learnings

1. **Search result snippets ≠ web page content**
   - Snippets are summaries, not raw data
   - Emails are almost never in snippets

2. **Rate limiting is a real concern**
   - Need delays between searches (2-3 seconds minimum)
   - Need exponential backoff on failures
   - Consider caching search results

3. **LLM extraction is powerful but underutilized**
   - Currently using LLM for TechCrunch scraping
   - Should use LLM to extract structured data from HTML
   - Can find emails + context (roles, LinkedIn, etc.)

4. **Testing early saved time**
   - Discovered fundamental flaw before full integration
   - Can pivot strategy before wasting time on database migration

---

## Conclusion

The current email discovery approach **cannot succeed** because it only reads search result snippets, which don't contain emails.

**Recommendation**: Implement **Option C (Hybrid)** to:
1. Actually visit web pages and extract emails from full HTML
2. Fall back to pattern matching for missing emails
3. Target 50-70% success rate before proceeding to database migration

**Estimated Time to Fix**: 3-4 hours

**Success Probability**: High (similar approaches used by Apollo.io, Hunter.io, etc.)
