# Gemini Model Pricing Comparison

## Current Models Available

Based on your codebase, you're using a fallback approach with these models:
1. `gemini-2.0-flash` (primary)
2. `gemini-2.5-flash` (fallback)
3. `gemini-1.5-flash` (legacy fallback)

## Pricing (as of 2025)

### Gemini 2.0 Flash
- **Input Tokens**: ~$0.075 per million tokens
- **Output Tokens**: ~$0.30 per million tokens
- **Best for**: Fast, cost-effective extraction tasks

### Gemini 2.5 Flash
- **Input Tokens**: ~$0.075 per million tokens (same as 2.0 Flash)
- **Output Tokens**: ~$0.30 per million tokens (same as 2.0 Flash)
- **Best for**: Latest features with same cost as 2.0 Flash

### Gemini 2.5 Pro
- **Input Tokens**: $1.25 per million tokens (up to 200k tokens)
- **Output Tokens**: $10.00 per million tokens (up to 200k tokens)
- **Best for**: Complex reasoning tasks (not needed for extraction)

### Gemini 1.5 Flash (Legacy)
- **Input Tokens**: ~$0.075 per million tokens
- **Output Tokens**: ~$0.30 per million tokens
- **Status**: May have compatibility issues, use as last resort

## Cost Estimation for TechCrunch Scraper

### Per Article Extraction

**Typical Article Size:**
- Input: ~2,000-4,000 tokens (title + content excerpt)
- Output: ~200-400 tokens (JSON response)

**Cost per Article:**
- **Input**: 3,000 tokens × $0.075 / 1,000,000 = **$0.000225**
- **Output**: 300 tokens × $0.30 / 1,000,000 = **$0.00009**
- **Total**: **~$0.0003 per article** ($0.000315)

### Monthly Cost Estimates

**Scenario 1: 10 articles/day (300/month)**
- Input: 300 × 3,000 = 900,000 tokens = **$0.068**
- Output: 300 × 300 = 90,000 tokens = **$0.027**
- **Total: ~$0.10/month**

**Scenario 2: 50 articles/day (1,500/month)**
- Input: 1,500 × 3,000 = 4,500,000 tokens = **$0.34**
- Output: 1,500 × 300 = 450,000 tokens = **$0.14**
- **Total: ~$0.48/month**

**Scenario 3: 100 articles/day (3,000/month)**
- Input: 3,000 × 3,000 = 9,000,000 tokens = **$0.68**
- Output: 3,000 × 300 = 900,000 tokens = **$0.27**
- **Total: ~$0.95/month**

## Cost Comparison: Flash vs Pro

If you were to use **Gemini 2.5 Pro** instead:

**Per Article (same size):**
- Input: 3,000 tokens × $1.25 / 1,000,000 = **$0.00375**
- Output: 300 tokens × $10.00 / 1,000,000 = **$0.003**
- **Total: ~$0.00675 per article** (22.5x more expensive!)

**Monthly (100 articles/day):**
- **Flash**: ~$0.95/month
- **Pro**: ~$20.25/month
- **Savings with Flash**: ~$19.30/month (95% cheaper!)

## Why Use Flash Models?

✅ **Cost-Effective**: 95% cheaper than Pro models
✅ **Fast**: Optimized for speed
✅ **Sufficient**: More than capable for structured extraction
✅ **Same Quality**: Flash models are excellent for extraction tasks

## Free Tier

Google provides a free tier for Gemini API:
- **Rate Limits**: 15 requests per minute (free tier)
- **Daily Limits**: Varies by model
- **Cost**: $0 for usage within free tier limits

## Recommendations

1. **Use Flash Models**: Gemini 2.0 Flash or 2.5 Flash are perfect for extraction
2. **Monitor Usage**: Track token consumption to stay within budget
3. **Optimize Prompts**: Keep prompts concise to reduce token usage
4. **Batch Processing**: Process multiple articles efficiently
5. **Free Tier First**: Start with free tier to test, then scale up

## Current Implementation

The scraper now uses a fallback approach:
1. Try `gemini-2.0-flash` first (most compatible)
2. Fall back to `gemini-2.5-flash` if 2.0 not available
3. Fall back to `gemini-1.5-flash` as last resort

This ensures compatibility while keeping costs low.

## Cost Optimization Tips

1. **Limit Content**: Only send first 4,000 characters (already implemented)
2. **Cache Results**: Don't re-extract already processed articles
3. **Batch Requests**: Process multiple articles in one request (if API supports)
4. **Monitor Usage**: Set up alerts for unexpected costs
5. **Use Free Tier**: Leverage free tier for development/testing

## Summary

- **Flash Models**: ~$0.0003 per article (very cheap!)
- **Pro Models**: ~$0.00675 per article (22.5x more expensive)
- **Monthly (100 articles/day)**: ~$0.95 with Flash vs ~$20.25 with Pro
- **Recommendation**: Stick with Flash models for extraction tasks

