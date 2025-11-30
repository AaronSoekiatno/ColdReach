# Search API Options for Web Search Agent

## Currently Supported

### 1. Gemini Grounding with Google Search ⭐ (PRIMARY)
- **Cost**: Included with Gemini API usage
- **Setup**: Uses existing `GEMINI_API_KEY`
- **Pros**: 
  - No separate search API needed!
  - Real-time Google Search results
  - Already integrated with our LLM extraction
  - Single API key for both search and extraction
- **Cons**: Results come through Gemini, not direct search results
- **Status**: Available in Gemini 2.0+ models
- **Config**: `GEMINI_API_KEY` (required)

### 2. DuckDuckGo Search API (Free Fallback)
- **Cost**: FREE (no API key needed for basic use)
- **Setup**: No authentication required
- **Pros**: 
  - Completely free
  - Privacy-focused
  - No rate limits (reasonable use)
- **Cons**: 
  - Unofficial API (HTML scraping)
  - May be less reliable
  - No official support
- **Config**: None needed (automatic fallback)

## Additional Options (Not Currently Used)

### 3. Tavily Search API
- **Cost**: Free tier: 1,000 queries/month, then $0.10 per 1,000 queries
- **Setup**: API key
- **Pros**: 
  - Built for AI agents
  - Returns structured data
  - Good for research tasks
- **Cons**: Newer service, less established
- **Config**: `TAVILY_API_KEY` (not currently used)

### 4. Exa Search API (formerly Metaphor)
- **Cost**: Free tier: 1,000 queries/month, then $0.10 per 1,000 queries
- **Setup**: API key
- **Pros**: 
  - Semantic search (understands meaning)
  - Great for finding similar content
  - Good for research
- **Cons**: Different from traditional keyword search
- **Config**: `EXA_API_KEY` (not currently used)

## Current Setup (Recommended)

### Primary: Gemini Grounding ⭐
- Uses your existing `GEMINI_API_KEY`
- No additional API keys needed
- Search + extraction in one step
- Real-time Google Search results

### Fallback: DuckDuckGo
- Free, unlimited
- No API key needed
- Automatic fallback if Gemini unavailable

## Cost Comparison

| API | Cost | Status |
|-----|------|--------|
| **Gemini Grounding** | Included with Gemini usage | ✅ Primary |
| **DuckDuckGo** | FREE | ✅ Fallback |
| Tavily | $0.10 per 1k queries | ❌ Not used |
| Exa | $0.10 per 1k queries | ❌ Not used |

## Configuration

**Required:**
```env
GEMINI_API_KEY=your_gemini_key
```

That's it! The system automatically uses Gemini for search and falls back to DuckDuckGo if needed.

