# Testing Agentic Enrichment

This guide explains how to test the agentic enrichment system that reasons about missing data and intelligently searches for it.

## Quick Start

### 1. Find a Startup to Test

List startups that need enrichment:

```bash
npm run list-startups
```

This will show you:
- Startup names and IDs
- Current enrichment status
- Ready-to-use commands

### 2. Run Agentic Enrichment

Test on a specific startup:

```bash
npm run enrich-agentic -- --id=<startup_id>
```

**Example:**
```bash
npm run enrich-agentic -- --id=3d2864ae-7839-4694-84d2-f8a7b6a16999
```

## What the Agent Does

The agentic enrichment system performs these steps:

1. **📊 Analyzes Missing Data** - Identifies what information is missing
2. **🧠 Generates Search Plan** - Reasons about WHERE and HOW to find data
3. **🔍 Executes Searches** - Runs multiple targeted searches
4. **✅ Checks Relevance** - Validates if search results match the startup
5. **📝 Extracts Data** - Uses LLM to extract structured data from results
6. **🔍 Validates Data** - Checks if extracted data is correct
7. **🤔 Decides Next Steps** - Determines if more searches are needed
8. **💾 Updates Database** - Saves enriched data

## Expected Output

You'll see detailed logs showing the agent's reasoning:

```
🤖 Starting AGENTIC enrichment for: Cactus
   This agent will REASON about what's missing and WHERE to find it

📊 Step 1: Analyzing missing data...
   Missing: Founder Names, Founder LinkedIn, Tech Stack, Location / HQ
   Priority: high
   Reasoning: The most critical missing information is about the founders...

🔄 Attempt 1/5
🧠 Step 2: Generating search plan...
   Reasoning: The search plan is prioritized to build a foundational understanding...
   Generated 4 queries:

   🔍 Query: "site:crunchbase.com cactus "AI engine""
      Purpose: To get a comprehensive overview of the company...
      Source: crunchbase
      Found 5 results
   ✅ Results are relevant (confidence: 0.85)
   📝 Extracting data...
   ✅ Extracted: founder_names (confidence: 0.9)
   
... (continues for all queries and attempts)
```

## Testing Scenarios

### Test 1: Startup with Missing Founders

Find a startup with placeholder founder data (e.g., "Team" or empty):

```bash
# List startups
npm run list-startups

# Test on one
npm run enrich-agentic -- --id=<id>
```

**Expected:** Agent should find actual founder names, LinkedIn profiles, and emails.

### Test 2: Startup with Missing Website

Find a startup with an incorrect or missing website:

```bash
npm run enrich-agentic -- --id=<id>
```

**Expected:** Agent should find the correct company website.

### Test 3: Startup with Missing Tech Stack

Find a startup with no tech stack information:

```bash
npm run enrich-agentic -- --id=<id>
```

**Expected:** Agent should find tech stack from job postings or company pages.

## Rate Limiting (Free Tier)

On the free tier, you'll see rate limiting messages:

```
⏳ Rate limiting: waiting 30s before next Gemini API call...
```

This is normal! The system automatically waits to respect the 2 RPM limit.

**Time estimates:**
- **Free tier**: ~5-10 minutes per startup (due to rate limits)
- **Paid tier**: ~1-2 minutes per startup

## Troubleshooting

### "No startups need enrichment!"

If you see this message, you can:

1. **Create a test startup** (if the script exists):
   ```bash
   npm run create-test-startup
   ```

2. **Reset an existing startup** in Supabase:
   ```sql
   UPDATE startups 
   SET 
     needs_enrichment = true,
     enrichment_status = 'pending',
     website = '',
     founder_names = '',
     founder_linkedin = '',
     founder_emails = ''
   WHERE name = 'Some Startup Name';
   ```

3. **Use TechCrunch scraper** to create new startups:
   ```bash
   npm run scrape-techcrunch-supabase
   ```

### "Rate limited" Errors

If you see rate limit errors:

1. **Wait** - The system will automatically retry with delays
2. **Check your tier** - Free tier has 2 RPM limit
3. **Upgrade** - Set `GEMINI_PAID_TIER=true` for higher limits (see `GEMINI_BILLING_SETUP.md`)

### "No search API configured"

The system should automatically use DuckDuckGo (free). If you see this error:

1. Check that `.env.local` has `GEMINI_API_KEY` set
2. The system will use DuckDuckGo as fallback
3. For paid tier, set `GEMINI_PAID_TIER=true` to enable Gemini Grounding

### No Data Found

If the agent completes but finds no data:

1. **Check the logs** - See what queries were generated
2. **Verify startup exists** - The startup might be too new or obscure
3. **Try a well-known startup** - Test with a famous company first (e.g., "Stripe", "OpenAI")

## Comparing with Regular Enrichment

You can compare agentic vs regular enrichment:

```bash
# Agentic (intelligent, reasons about where to find data)
npm run enrich-agentic -- --id=<id>

# Regular (uses fixed search patterns)
npm run enrich-startup -- --id=<id>
```

**Key differences:**
- **Agentic**: Adapts queries based on missing data, validates relevance, retries intelligently
- **Regular**: Uses fixed search patterns, simpler extraction

## Monitoring Progress

The agent shows detailed progress:

- `🔄 Attempt X/5` - Current search attempt
- `🧠 Step 2: Generating search plan...` - Agent reasoning
- `🔍 Query: "..."` - Search queries being executed
- `✅ Results are relevant` - Relevance checking
- `📝 Extracting data...` - LLM extraction
- `💾 Step 8: Updating database...` - Saving results

## Success Indicators

Look for these in the output:

✅ **Good signs:**
- "Results are relevant (confidence: 0.8+)"
- "Extracted: founder_names (confidence: 0.9)"
- "Found X results"
- "Updating database with new data"

⚠️ **Warnings (but still working):**
- "Rate limiting: waiting..."
- "LLM extraction failed, using fallback"
- "Results are partially relevant (confidence: 0.6)"

❌ **Issues:**
- "No search API configured"
- "Search error: ..."
- "No new data found or confidence too low"

## Next Steps

After testing:

1. **Review enriched data** in Supabase to verify accuracy
2. **Check confidence scores** - Higher is better
3. **Compare with manual research** - Validate agent's findings
4. **Adjust prompts** if needed (in `reasoning_agent.ts` and `web_search_agent.ts`)

## Example Test Session

```bash
# 1. Find startups to test
$ npm run list-startups
📋 Found 5 startups needing enrichment:
1. Cactus
   ID: 3d2864ae-7839-4694-84d2-f8a7b6a16999
   Command: npm run enrich-agentic -- --id=3d2864ae-7839-4694-84d2-f8a7b6a16999

# 2. Run enrichment
$ npm run enrich-agentic -- --id=3d2864ae-7839-4694-84d2-f8a7b6a16999

# 3. Watch the agent work...
🤖 Starting AGENTIC enrichment for: Cactus
📊 Step 1: Analyzing missing data...
🧠 Step 2: Generating search plan...
🔍 Query: "site:crunchbase.com cactus "AI engine""
...

# 4. Check results in Supabase or wait for completion message
✅ Agentic enrichment completed!
```

Happy testing! 🚀

