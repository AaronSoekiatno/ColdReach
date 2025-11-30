# Gemini API Billing Setup Guide

This guide explains how to configure the agentic enrichment system for both free and paid Gemini API tiers.

## Free Tier (Current Default)

**Limits:**
- 2 requests per minute (RPM)
- 50 requests per day (RPD)
- 125,000 tokens per minute (TPM)

**Configuration:**
No special setup needed - the system automatically uses free tier limits:
- 30 second delay between Gemini API calls
- DuckDuckGo for web search (free, no limits)
- `gemini-2.5-pro` model

## Paid Tier Setup

When you upgrade to a paid Gemini API plan, you'll get higher rate limits and access to additional features.

### 1. Enable Paid Tier Mode

Add to your `.env.local`:

```bash
# Enable paid tier features
GEMINI_PAID_TIER=true

# Optional: Use a faster model (paid tier only)
GEMINI_MODEL=gemini-2.0-flash-exp
# OR
GEMINI_MODEL=gemini-1.5-pro
```

### 2. Configure Rate Limits

The system will automatically use paid tier limits (15 RPM = 4s between calls). For custom limits:

```bash
# Custom rate limit in milliseconds (e.g., 2000ms = 2 seconds = 30 RPM)
GEMINI_RATE_LIMIT_MS=2000
```

### 3. Enable Gemini Grounding (Google Search Integration)

With paid tier, you can use Gemini Grounding which integrates Google Search directly:

**Benefits:**
- No separate search API needed (no Google Search API key, SerpAPI, etc.)
- Better search results integrated with AI reasoning
- Single API key for both search and extraction

**How it works:**
- Set `GEMINI_PAID_TIER=true`
- The system will automatically use Gemini Grounding for web search
- Falls back to DuckDuckGo if Grounding fails

### 4. Paid Tier Rate Limits

Typical paid tier limits (varies by plan):
- **15-60 RPM** (requests per minute)
- **1M+ TPM** (tokens per minute)
- **Higher daily limits**

The system defaults to **4 seconds between calls** (15 RPM) when `GEMINI_PAID_TIER=true`, which is conservative and works with most paid plans.

## Model Options

### Free Tier Models
- `gemini-2.5-pro` ✅ (recommended)
- `gemini-1.5-flash` ✅

### Paid Tier Models
- `gemini-2.0-flash-exp` ⚡ (fastest, paid only)
- `gemini-1.5-pro` (more capable, paid only)
- `gemini-2.5-pro` (works on both tiers)

## Migration Checklist

When upgrading from free to paid tier:

1. ✅ Upgrade your Gemini API plan in Google AI Studio
2. ✅ Add `GEMINI_PAID_TIER=true` to `.env.local`
3. ✅ (Optional) Set `GEMINI_MODEL=gemini-2.0-flash-exp` for faster responses
4. ✅ (Optional) Adjust `GEMINI_RATE_LIMIT_MS` if you have custom limits
5. ✅ Test with a single startup: `npm run enrich-agentic -- --id=<startup_id>`

## Performance Comparison

| Tier | Rate Limit | Search Method | Speed | Cost |
|------|------------|---------------|-------|------|
| **Free** | 2 RPM | DuckDuckGo | ~30s per LLM call | $0 |
| **Paid** | 15+ RPM | Gemini Grounding | ~4s per LLM call | Pay-as-you-go |

**Example enrichment time:**
- **Free tier**: ~5-10 minutes per startup (due to rate limits)
- **Paid tier**: ~1-2 minutes per startup

## Troubleshooting

### "google_search_retrieval is not supported"
- This means Gemini Grounding requires paid tier
- Set `GEMINI_PAID_TIER=true` or the system will use DuckDuckGo

### Still hitting rate limits on paid tier
- Check your actual plan limits in Google AI Studio
- Adjust `GEMINI_RATE_LIMIT_MS` to match your plan
- Example: For 60 RPM, set `GEMINI_RATE_LIMIT_MS=1000` (1 second)

### Want to use free tier but faster
- Keep `GEMINI_PAID_TIER` unset or `false`
- The system will use DuckDuckGo (no rate limits on search)
- Only LLM calls are rate-limited (30s between calls)

## Current Configuration

Check your current setup:

```bash
# In your .env.local file:
GEMINI_API_KEY=your_key_here
GEMINI_PAID_TIER=false  # or true for paid tier
GEMINI_MODEL=gemini-2.5-pro  # optional
GEMINI_RATE_LIMIT_MS=30000  # optional, defaults based on tier
```

The system automatically detects your tier and adjusts behavior accordingly!

