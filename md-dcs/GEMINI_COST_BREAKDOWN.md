# Gemini Model Costs for TechCrunch Scraper

## Model Options & Pricing

### Gemini 2.0 Flash (Recommended) ⭐
- **Input**: ~$0.075 per million tokens
- **Output**: ~$0.30 per million tokens
- **Best for**: Fast, cost-effective extraction

### Gemini 2.5 Flash
- **Input**: ~$0.075 per million tokens (same as 2.0)
- **Output**: ~$0.30 per million tokens (same as 2.0)
- **Best for**: Latest features, same cost

### Gemini 2.5 Pro (Not Recommended)
- **Input**: $1.25 per million tokens
- **Output**: $10.00 per million tokens
- **Cost**: **22.5x more expensive** than Flash
- **Best for**: Complex reasoning (not needed for extraction)

## Cost Per Article

**Typical Article:**
- Input: ~3,000 tokens (title + 4,000 char content)
- Output: ~300 tokens (JSON response)

**With Flash Models:**
- Input: 3,000 × $0.075 / 1,000,000 = **$0.000225**
- Output: 300 × $0.30 / 1,000,000 = **$0.00009**
- **Total: ~$0.0003 per article** 💰

**With Pro Models (for comparison):**
- Input: 3,000 × $1.25 / 1,000,000 = **$0.00375**
- Output: 300 × $10.00 / 1,000,000 = **$0.003**
- **Total: ~$0.00675 per article** (22.5x more!)

## Monthly Cost Estimates

### Scenario 1: 10 articles/day (300/month)
- **Flash**: ~$0.10/month
- **Pro**: ~$2.03/month
- **Savings**: $1.93/month

### Scenario 2: 50 articles/day (1,500/month)
- **Flash**: ~$0.48/month
- **Pro**: ~$10.13/month
- **Savings**: $9.65/month

### Scenario 3: 100 articles/day (3,000/month)
- **Flash**: ~$0.95/month
- **Pro**: ~$20.25/month
- **Savings**: $19.30/month (95% cheaper!)

## Why Use Flash Models?

✅ **95% cheaper** than Pro models
✅ **Fast**: Optimized for speed
✅ **Sufficient**: More than capable for extraction
✅ **Same quality**: Flash models excel at structured extraction

## Current Implementation

The scraper now uses a **fallback approach**:
1. Try `gemini-2.0-flash` first (most compatible)
2. Fall back to `gemini-2.5-flash` if 2.0 not available
3. Fall back to `gemini-1.5-flash` as last resort

This ensures compatibility while keeping costs low.

## Free Tier

Google provides a free tier:
- **Rate Limits**: 15 requests per minute
- **Daily Limits**: Varies by model
- **Cost**: $0 for usage within limits

## Cost Optimization Tips

1. ✅ **Limit Content**: Only send first 4,000 characters (already implemented)
2. ✅ **Cache Results**: Don't re-extract already processed articles
3. ✅ **Use Flash Models**: 95% cheaper than Pro
4. ✅ **Monitor Usage**: Track token consumption
5. ✅ **Free Tier First**: Use free tier for development

## Summary

- **Flash Models**: ~$0.0003 per article (very cheap!)
- **Pro Models**: ~$0.00675 per article (22.5x more expensive)
- **Monthly (100 articles/day)**: ~$0.95 with Flash vs ~$20.25 with Pro
- **Recommendation**: ✅ Use Flash models (2.0 or 2.5) for extraction

The scraper is now configured to automatically use the best available Flash model, keeping costs minimal while ensuring compatibility.

