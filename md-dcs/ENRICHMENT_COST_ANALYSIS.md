# Enrichment Cost Analysis

## Current Cost Per Enrichment

### API Calls Made Per Startup:
1. **1 Web Search** (DuckDuckGo) - **FREE** ✅
2. **1 Gemini API Call** for comprehensive extraction

### Token Usage Estimate:
- **Input**: ~4,000 tokens (prompt + 15 search results with titles/snippets/URLs)
- **Output**: ~800 tokens (JSON response with all fields)

### Cost with Current Model (gemini-2.5-pro):
- **Input**: 4,000 × $1.25 / 1,000,000 = **$0.005**
- **Output**: 800 × $10.00 / 1,000,000 = **$0.008**
- **Total: ~$0.013 per enrichment** 💰

### Cost with Flash Model (gemini-2.0-flash) - RECOMMENDED:
- **Input**: 4,000 × $0.075 / 1,000,000 = **$0.0003**
- **Output**: 800 × $0.30 / 1,000,000 = **$0.00024**
- **Total: ~$0.00054 per enrichment** 💰
- **Savings: 96% cheaper!** (24x less expensive)

## Monthly Cost Estimates

### Scenario 1: 10 startups/day (300/month)
- **With Pro**: 300 × $0.013 = **$3.90/month**
- **With Flash**: 300 × $0.00054 = **$0.16/month**
- **Savings: $3.74/month**

### Scenario 2: 50 startups/day (1,500/month)
- **With Pro**: 1,500 × $0.013 = **$19.50/month**
- **With Flash**: 1,500 × $0.00054 = **$0.81/month**
- **Savings: $18.69/month**

### Scenario 3: 100 startups/day (3,000/month)
- **With Pro**: 3,000 × $0.013 = **$39.00/month**
- **With Flash**: 3,000 × $0.00054 = **$1.62/month**
- **Savings: $37.38/month**

## Fallback Path (If LLM Fails)

If comprehensive extraction fails, the system falls back to:
- **3-4 additional web searches** (all FREE via DuckDuckGo)
- **1 additional Gemini call** for founder extraction (if LLM available)
- **Regex extraction** (FREE, no API calls)

**Additional cost in fallback**: Same as above (~$0.00054 with Flash)

## Free Tier Option

Google provides a free tier:
- **15 requests per minute** (free tier)
- **Daily limits** vary by model
- **Cost**: $0 for usage within limits

If you stay within free tier limits, enrichment is **completely free**! 🎉

## Cost Optimization Recommendations

### ✅ Already Implemented:
1. **Single comprehensive extraction** (1 API call instead of multiple)
2. **DuckDuckGo for search** (free, no API key needed)
3. **Regex fallback** (free when LLM unavailable)
4. **Rate limiting** (prevents quota exceeded errors)

### 🔧 Recommended Changes:
1. **Switch to Flash models** (gemini-2.0-flash or gemini-2.5-flash)
   - 96% cost reduction
   - Same quality for extraction tasks
   - Already implemented in code (just need to set `GEMINI_MODEL` env var)

2. **Use free tier for development/testing**
   - Monitor usage to stay within limits
   - Scale to paid tier only when needed

3. **Batch processing**
   - Process multiple startups efficiently
   - Respect rate limits

## Summary

| Model | Cost/Enrichment | 100/day Cost | 1000/day Cost |
|-------|----------------|--------------|---------------|
| **gemini-2.5-pro** (current) | $0.013 | $39/month | $390/month |
| **gemini-2.0-flash** (recommended) | $0.00054 | $1.62/month | $16.20/month |
| **Savings** | **96%** | **$37.38/month** | **$373.80/month** |

## Action Items

1. ✅ **Switch to Flash model** - Update code to use `gemini-2.0-flash` by default
2. ✅ **Set environment variable** - `GEMINI_MODEL=gemini-2.0-flash` (optional, already default)
3. ✅ **Monitor usage** - Track costs in Google Cloud Console
4. ✅ **Use free tier** - Start with free tier, scale when needed

The enrichment script is now optimized for cost-effectiveness while maintaining high quality extraction!

