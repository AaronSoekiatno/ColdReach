/**
 * Web Search Agent Implementation
 * 
 * This module provides web search functionality using:
 * - Gemini Grounding (paid tier only) - Google Search integrated with Gemini
 * - DuckDuckGo (free, no API key needed) - Primary search method
 * 
 * Includes LLM-based extraction (Phase 1 of Agentic Workflow):
 * - Uses Gemini AI for intelligent data extraction
 * - Falls back to regex patterns if LLM unavailable
 * - Provides confidence scores for extracted data
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface ExtractionConfidence {
  founder_names?: number;
  founder_linkedin?: number;
  founder_emails?: number;
  website?: number;
  job_openings?: number;
  tech_stack?: number;
  [key: string]: number | undefined;
}

// Global flag to track if Gemini quota is exceeded
let geminiQuotaExceeded = false;

/**
 * Check if Gemini quota is exceeded
 */
export function isGeminiQuotaExceeded(): boolean {
  return geminiQuotaExceeded;
}

/**
 * Check if an error indicates quota exceeded
 */
function isQuotaExceededError(error: any): boolean {
  if (!error) return false;
  const errorStr = error.toString() + JSON.stringify(error);
  return (
    error.status === 429 ||
    errorStr.includes('429') ||
    errorStr.includes('quota') ||
    errorStr.includes('Quota exceeded') ||
    errorStr.includes('exceeded your current quota')
  );
}

/**
 * Get Gemini client (lazy initialization)
 * Returns null if quota exceeded or API key not set
 */
function getGeminiClient() {
  // Skip if quota exceeded
  if (geminiQuotaExceeded) {
    return null;
  }
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Clean JSON response from LLM (removes markdown code blocks if present)
 */
function cleanJsonResponse(text: string): string {
  // Remove markdown code blocks
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  // Find JSON object in response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }
  
  return cleaned;
}

/**
 * Search using Google Custom Search API
 * @deprecated Not used - removed in favor of DuckDuckGo and Gemini Grounding
 */
async function searchWithGoogle(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  
  if (!apiKey || !searchEngineId) {
    throw new Error('Google Search API credentials not found. Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID');
  }
  
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.items) {
      return [];
    }
    
    return data.items.map((item: any) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
    }));
  } catch (error) {
    console.error('Google Search API error:', error);
    return [];
  }
}

/**
 * Search using SerpAPI
 * @deprecated Not used - removed in favor of DuckDuckGo and Gemini Grounding
 */
async function searchWithSerpAPI(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.SERPAPI_KEY;
  
  if (!apiKey) {
    throw new Error('SerpAPI key not found. Set SERPAPI_KEY');
  }
  
  const url = `https://serpapi.com/search.json?api_key=${apiKey}&q=${encodeURIComponent(query)}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.organic_results) {
      return [];
    }
    
    return data.organic_results.map((result: any) => ({
      title: result.title,
      url: result.link,
      snippet: result.snippet,
    }));
  } catch (error) {
    console.error('SerpAPI error:', error);
    return [];
  }
}

/**
 * Search using Bing Search API
 * @deprecated Not used - removed in favor of DuckDuckGo and Gemini Grounding
 */
async function searchWithBing(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.BING_SEARCH_API_KEY;
  
  if (!apiKey) {
    throw new Error('Bing Search API key not found. Set BING_SEARCH_API_KEY');
  }
  
  const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
      },
    });
    
    const data = await response.json();
    
    if (!data.webPages || !data.webPages.value) {
      return [];
    }
    
    return data.webPages.value.map((result: any) => ({
      title: result.name,
      url: result.url,
      snippet: result.snippet,
    }));
  } catch (error) {
    console.error('Bing Search API error:', error);
    return [];
  }
}

/**
 * Search using DuckDuckGo (free, no API key needed)
 * Uses DuckDuckGo's instant answer API and web search
 */
async function searchWithDuckDuckGo(query: string): Promise<SearchResult[]> {
  try {
    // Use DuckDuckGo's API endpoint (more reliable than HTML scraping)
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      throw new Error(`DuckDuckGo API failed: ${response.status}`);
    }
    
    const data = await response.json();
    const results: SearchResult[] = [];
    
    // Add instant answer if available
    if (data.AbstractText) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL || '',
        snippet: data.AbstractText,
      });
    }
    
    // Add related topics
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics.slice(0, 5)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text,
            url: topic.FirstURL,
            snippet: topic.Text,
          });
        }
      }
    }
    
    // If we have results, return them
    if (results.length > 0) {
      return results.slice(0, 10);
    }
    
    // Fallback: Use HTML search with better parsing
    return await searchWithDuckDuckGoHTML(query);
  } catch (error) {
    console.warn('DuckDuckGo API search failed, trying HTML fallback...', error);
    // Fallback to HTML search
    return await searchWithDuckDuckGoHTML(query);
  }
}

/**
 * Fallback: Search using DuckDuckGo HTML (more reliable parsing)
 */
async function searchWithDuckDuckGoHTML(query: string): Promise<SearchResult[]> {
  try {
    const { default: puppeteer } = await import('puppeteer');
    
    // Launch headless browser with timeout
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      timeout: 30000,
    });
    
    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Navigate to DuckDuckGo with shorter timeout
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      
      // Wait a bit for results to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Extract search results with multiple selector strategies
      const results = await page.evaluate(() => {
        const searchResults: Array<{ title: string; url: string; snippet: string }> = [];
        
        // Try multiple selectors for DuckDuckGo's varying HTML structure
        const selectors = [
          '.result .result__a',
          '.web-result .result__a',
          '.result a.result__a',
          'a.result__a',
          '.result__title',
          '.result-title a',
        ];
        
        let titleElements: NodeListOf<Element> | null = null;
        for (const selector of selectors) {
          titleElements = document.querySelectorAll(selector);
          if (titleElements.length > 0) break;
        }
        
        if (!titleElements || titleElements.length === 0) {
          return [];
        }
        
        titleElements.forEach((titleEl, index) => {
          if (index >= 10) return; // Limit to 10 results
          
          const title = titleEl.textContent?.trim() || '';
          const url = (titleEl as HTMLAnchorElement).href || '';
          
          // Find snippet - look in parent or sibling elements
          let snippet = '';
          const parent = titleEl.closest('.result, .web-result');
          if (parent) {
            const snippetEl = parent.querySelector('.result__snippet, .result-snippet, .snippet');
            snippet = snippetEl?.textContent?.trim() || '';
          }
          
          if (title && url && url.startsWith('http')) {
            searchResults.push({ title, url, snippet });
          }
        });
        
        return searchResults;
      });
      
      return results.length > 0 ? results : [];
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.warn('DuckDuckGo HTML search error:', error instanceof Error ? error.message : String(error));
    // Return empty results rather than throwing
    return [];
  }
}

/**
 * Search using Gemini Grounding with Google Search
 * Uses Gemini API with Google Search integration - no separate search API needed!
 * Requires: GEMINI_API_KEY (which you already have for extraction)
 */
async function searchWithGeminiGrounding(query: string): Promise<SearchResult[]> {
  const genAI = getGeminiClient();
  if (!genAI) {
    throw new Error('GEMINI_API_KEY not set');
  }

  // Rate limit before calling Gemini API
  await rateLimitGemini();

  try {
    // Use configurable model (defaults to gemini-2.5-pro)
    // For paid tier, can use gemini-2.0-flash-exp or gemini-1.5-pro
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      tools: [{
        googleSearchRetrieval: {} // Enable Google Search grounding (paid tier feature)
      }]
    });

    const prompt = `Search the web for: "${query}"

Return a JSON array of search results in this exact format:
[
  {
    "title": "Page title",
    "url": "https://example.com/page",
    "snippet": "Brief description or excerpt"
  }
]

Include the top 10 most relevant results.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((item: any) => ({
        title: item.title || '',
        url: item.url || '',
        snippet: item.snippet || '',
      }));
    }

    // If JSON parsing fails, try to extract from text
    // Gemini might return structured text instead of JSON
    return [];
  } catch (error) {
    console.warn('Gemini Grounding search failed:', error);
    throw error;
  }
}

// Rate limiter for Gemini API
// Free tier: 2 RPM = 30s between calls
// Paid tier: 15 RPM = 4s between calls (or higher limits)
let lastGeminiCall = 0;

function getGeminiRateLimit(): number {
  // Check if user has set a custom rate limit
  const customLimit = process.env.GEMINI_RATE_LIMIT_MS;
  if (customLimit) {
    return parseInt(customLimit, 10);
  }
  
  // Check if user explicitly wants paid tier behavior
  const isPaidTier = process.env.GEMINI_PAID_TIER === 'true';
  if (isPaidTier) {
    // Paid tier: 15 RPM = 4 seconds between calls (conservative)
    return 4000;
  }
  
  // Default: Free tier (2 RPM = 30 seconds)
  return 30000;
}

export async function rateLimitGemini(): Promise<void> {
  const minInterval = getGeminiRateLimit();
  const now = Date.now();
  const timeSinceLastCall = now - lastGeminiCall;
  
  if (timeSinceLastCall < minInterval) {
    const waitTime = minInterval - timeSinceLastCall;
    if (waitTime > 1000) { // Only log if waiting more than 1 second
      console.log(`  ⏳ Rate limiting: waiting ${Math.ceil(waitTime / 1000)}s before next Gemini API call...`);
    }
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastGeminiCall = Date.now();
}

/**
 * Main search function - tries different APIs in order
 * Priority: Gemini Grounding (if paid tier) > DuckDuckGo > Google > SerpAPI > Bing
 */
export async function searchWeb(query: string): Promise<SearchResult[]> {
  // Try Gemini Grounding first if on paid tier (requires GEMINI_PAID_TIER=true)
  // This uses Google Search integrated with Gemini - no separate search API needed!
  const isPaidTier = process.env.GEMINI_PAID_TIER === 'true';
  if (process.env.GEMINI_API_KEY && isPaidTier) {
    try {
      const results = await searchWithGeminiGrounding(query);
      if (results.length > 0) {
        return results;
      }
    } catch (error: any) {
      // If it's a 400 error about google_search_retrieval, fall back
      if (error?.status === 400) {
        console.warn('Gemini Grounding not available (may require paid tier), using alternatives...');
      } else {
        console.warn('Gemini Grounding search failed, trying alternatives...', error);
      }
    }
  }
  
  // Use DuckDuckGo (free, no API key needed) - with retry logic
  let lastError: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const results = await searchWithDuckDuckGo(query);
      if (results.length > 0) {
        return results;
      }
      // If we got empty results, wait a bit and retry (might be rate limited)
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
      }
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        console.warn(`DuckDuckGo search attempt ${attempt + 1} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
      }
    }
  }
  
  // If DuckDuckGo failed after retries, log but don't throw yet
  if (lastError) {
    console.warn('DuckDuckGo search failed after retries:', lastError instanceof Error ? lastError.message : String(lastError));
  }
  
  // If we get here, DuckDuckGo failed after all retries
  // Return empty results instead of throwing - let the agent continue with other queries
  console.warn('⚠️  DuckDuckGo search failed for this query. It may be rate-limited or the query may be too specific.');
  console.warn('   The agent will continue with other search queries.');
  return [];
}

// ============================================================================
// LLM-BASED EXTRACTION (Agentic Phase 1)
// ============================================================================

/**
 * Extract founder information using LLM (Gemini)
 * Returns data with confidence scores
 */
async function extractFounderInfoWithLLM(
  results: SearchResult[],
  companyName: string
): Promise<{
  founder_names: string;
  founder_linkedin: string;
  founder_emails: string;
  confidence: ExtractionConfidence;
}> {
  const genAI = getGeminiClient();
  if (!genAI) {
    throw new Error('GEMINI_API_KEY not set');
  }

  const context = results
    .slice(0, 10) // Use top 10 results
    .map((r, idx) => `[${idx + 1}] ${r.title}\n${r.snippet}\nURL: ${r.url}`)
    .join('\n\n');

  const prompt = `You are a data extraction agent. Extract founder information about "${companyName}" from these search results.

Search Results:
${context}

Extract the following information and return ONLY valid JSON (no markdown, no explanation):
{
  "founder_names": "Comma-separated full names of founders/CEOs, or empty string if not found",
  "founder_linkedin": "LinkedIn profile URL (e.g., linkedin.com/in/username) or empty string",
  "founder_emails": "Comma-separated email addresses or empty string if not found",
  "confidence": {
    "founder_names": 0.0-1.0,
    "founder_linkedin": 0.0-1.0,
    "founder_emails": 0.0-1.0
  }
}

Rules:
- Only extract information you're confident about (confidence >= 0.7)
- If information is ambiguous or unclear, set confidence < 0.7
- For founder_names: Extract full names (first + last), not just first names
- For founder_linkedin: Extract full URL or profile path (linkedin.com/in/...)
- For founder_emails: 
  * ONLY extract emails that are EXPLICITLY mentioned in the search results
  * NEVER generate, guess, or infer email addresses
  * NEVER create emails from names or domains (e.g., don't create "john@company.com" from "John Doe" and "company.com")
  * Skip emails from example.com, test.com, or any placeholder domains
  * If no real email is found in the results, return empty string
  * Set confidence to 0 if you're not certain the email is real and mentioned
- Cross-reference multiple results for accuracy
- Return empty strings if information is not found or uncertain`;

  try {
    // Rate limit before calling Gemini API
    await rateLimitGemini();
    
    // Use Flash model for cost-effectiveness (22.5x cheaper than Pro)
    // Try gemini-2.0-flash first, fallback to 2.5-flash, then 2.5-pro
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const model = genAI.getGenerativeModel({ 
      model: modelName
    });
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const cleanedResponse = cleanJsonResponse(responseText);
    const parsed = JSON.parse(cleanedResponse);

    // Validate and filter emails - only keep if high confidence and not generic patterns
    let founderEmails = parsed.founder_emails || '';
    const emailConfidence = parsed.confidence?.founder_emails || 0;
    
    // If confidence is low (< 0.8) or emails look generic/hallucinated, clear them
    if (founderEmails && emailConfidence < 0.8) {
      founderEmails = '';
    } else if (founderEmails) {
      // Filter out generic email patterns that might be hallucinations
      const emailList = founderEmails.split(',').map((e: string) => e.trim()).filter((e: string) => e);
      const filteredEmails = emailList.filter((email: string) => {
        const emailLower = email.toLowerCase();
        // Exclude generic patterns
        if (emailLower.match(/^(hello|info|contact|support|admin|noreply|no-reply|team|founders?)@/)) {
          return false;
        }
        // Exclude example/test domains
        if (emailLower.includes('example.com') || 
            emailLower.includes('test.com') ||
            emailLower.includes('placeholder') ||
            emailLower.includes('sample')) {
          return false;
        }
        return true;
      });
      founderEmails = filteredEmails.join(', ');
    }

    return {
      founder_names: parsed.founder_names || '',
      founder_linkedin: parsed.founder_linkedin || '',
      founder_emails: founderEmails,
      confidence: parsed.confidence || {},
    };
  } catch (error) {
    // Check if quota exceeded
    if (isQuotaExceededError(error)) {
      geminiQuotaExceeded = true;
      console.warn('⚠️  Gemini quota exceeded. Disabling LLM extraction for this session. Using regex-only extraction.');
    }
    console.warn('LLM extraction failed, falling back to regex:', error instanceof Error ? error.message : String(error));
    throw error; // Will trigger fallback
  }
}

/**
 * Extract comprehensive enrichment data using LLM
 */
async function extractAllEnrichmentDataWithLLM(
  results: SearchResult[],
  companyName: string
): Promise<EnrichmentData & { confidence: ExtractionConfidence }> {
  const genAI = getGeminiClient();
  if (!genAI) {
    throw new Error('GEMINI_API_KEY not set');
  }

  const context = results
    .slice(0, 15) // Use top 15 results for comprehensive extraction
    .map((r, idx) => `[${idx + 1}] ${r.title}\n${r.snippet}\nURL: ${r.url}`)
    .join('\n\n');

  const prompt = `You are a data extraction agent. Extract comprehensive information about "${companyName}" from these search results.

Search Results:
${context}

Extract the following information and return ONLY valid JSON (no markdown, no explanation):
{
  "founder_names": "Comma-separated full names of founders/CEOs, or empty string",
  "founder_linkedin": "LinkedIn profile URL or empty string",
  "founder_emails": "Comma-separated email addresses or empty string",
  "website": "Official company website domain (e.g., example.com) or empty string",
  "location": "City, State/Country (e.g., 'San Francisco, CA', 'London, UK') or empty string",
  "industry": "Primary industry (e.g., 'Fintech', 'Healthcare', 'SaaS', 'AI') or empty string",
  "hiring_roles": "Comma-separated job titles they're hiring for, or empty string",
  "tech_stack": "Comma-separated technologies/languages/frameworks, or empty string",
  "target_customer": "Enterprise, SMBs, Consumers, Developers, Startups, B2B, B2C, B2B2C, or empty string",
  "market_vertical": "Specific market vertical (e.g., 'Fintech - Payments', 'Healthcare - Telemedicine') or empty string",
  "team_size": "Team size range (e.g., '1-10', '10-50', '50-200', '200-500', '500+') or empty string",
  "founder_backgrounds": "Comma-separated previous companies/universities, or empty string",
  "website_keywords": "Comma-separated relevant keywords describing the company, or empty string",
  "confidence": {
    "founder_names": 0.0-1.0,
    "founder_linkedin": 0.0-1.0,
    "founder_emails": 0.0-1.0,
    "website": 0.0-1.0,
    "location": 0.0-1.0,
    "industry": 0.0-1.0,
    "hiring_roles": 0.0-1.0,
    "tech_stack": 0.0-1.0,
    "target_customer": 0.0-1.0,
    "market_vertical": 0.0-1.0,
    "team_size": 0.0-1.0,
    "founder_backgrounds": 0.0-1.0,
    "website_keywords": 0.0-1.0
  }
}

Rules:
- Only extract information you're confident about (confidence >= 0.7 for important fields)
- Return empty strings if information is not found or uncertain
- For website: Extract just the domain (e.g., "stripe.com"), not full URLs
- NEVER extract search engine domains (duckduckgo.com, google.com, bing.com, etc.)
- NEVER extract social media domains (linkedin.com, twitter.com, facebook.com, etc.)
- NEVER extract news/aggregator sites (crunchbase.com, techcrunch.com, medium.com, etc.)
- Only extract the actual company's official website domain
- For founder_emails:
  * ONLY extract emails that are EXPLICITLY mentioned in the search results
  * NEVER generate, guess, or infer email addresses from names or domains
  * NEVER create emails like "founder@company.com" or "hello@company.com" unless explicitly found
  * Skip emails from example.com, test.com, or any placeholder domains
  * If no real email is found in the results, return empty string
  * Set confidence to 0 if you're not certain the email is real and mentioned
- For tech_stack: List actual technologies mentioned, not inferred
- For target_customer: Choose the most specific applicable category
- Cross-reference multiple results for accuracy`;

  try {
    // Rate limit before calling Gemini API
    await rateLimitGemini();
    
    // Use Flash model for cost-effectiveness (22.5x cheaper than Pro)
    // Try gemini-2.0-flash first, fallback to 2.5-flash, then 2.5-pro
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const model = genAI.getGenerativeModel({ 
      model: modelName
    });
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const cleanedResponse = cleanJsonResponse(responseText);
    const parsed = JSON.parse(cleanedResponse);

    // Validate and clean website domain
    let website = parsed.website || '';
    if (website) {
      try {
        // Remove protocol if present
        website = website.replace(/^https?:\/\//, '').replace(/^www\./, '');
        // Extract domain (remove path)
        const domain = website.split('/')[0].toLowerCase();
        // Filter out excluded domains
        if (isExcludedDomain(domain)) {
          website = '';
        } else {
          website = domain;
        }
      } catch (error) {
        // Invalid domain format, set to empty
        website = '';
      }
    }

    // Validate and filter emails - only keep if high confidence and not generic patterns
    let founderEmails = parsed.founder_emails || '';
    const emailConfidence = parsed.confidence?.founder_emails || 0;
    
    // If confidence is low (< 0.8) or emails look generic/hallucinated, clear them
    if (founderEmails && emailConfidence < 0.8) {
      founderEmails = '';
    } else if (founderEmails) {
      // Filter out generic email patterns that might be hallucinations
      const emailList = founderEmails.split(',').map((e: string) => e.trim()).filter((e: string) => e);
      const filteredEmails = emailList.filter((email: string) => {
        const emailLower = email.toLowerCase();
        // Exclude generic patterns
        if (emailLower.match(/^(hello|info|contact|support|admin|noreply|no-reply|team|founders?)@/)) {
          return false;
        }
        // Exclude example/test domains
        if (emailLower.includes('example.com') || 
            emailLower.includes('test.com') ||
            emailLower.includes('placeholder') ||
            emailLower.includes('sample')) {
          return false;
        }
        return true;
      });
      founderEmails = filteredEmails.join(', ');
    }

    return {
      founder_names: parsed.founder_names || '',
      founder_linkedin: parsed.founder_linkedin || '',
      founder_emails: founderEmails,
      website: website,
      location: parsed.location || '',
      industry: parsed.industry || '',
      hiring_roles: parsed.hiring_roles || '',
      tech_stack: parsed.tech_stack || '',
      target_customer: parsed.target_customer || '',
      market_vertical: parsed.market_vertical || '',
      team_size: parsed.team_size || '',
      founder_backgrounds: parsed.founder_backgrounds || '',
      website_keywords: parsed.website_keywords || '',
      confidence: parsed.confidence || {},
    };
  } catch (error) {
    // Check if quota exceeded
    if (isQuotaExceededError(error)) {
      geminiQuotaExceeded = true;
      console.warn('⚠️  Gemini quota exceeded. Disabling LLM extraction for this session. Using regex-only extraction.');
    }
    console.warn('LLM extraction failed, falling back to regex:', error instanceof Error ? error.message : String(error));
    throw error; // Will trigger fallback
  }
}

// ============================================================================
// REGEX-BASED EXTRACTION (Fallback)
// ============================================================================

/**
 * Extract founder information from search results (Regex-based fallback)
 */
function extractFounderInfoRegex(results: SearchResult[], companyName: string): {
  founder_names: string;
  founder_linkedin: string;
  founder_emails: string;
} {
  const allText = results.map(r => `${r.title} ${r.snippet}`).join(' ');
  
  // Extract LinkedIn profiles
  const linkedinPattern = /linkedin\.com\/in\/([a-zA-Z0-9-]+)/gi;
  const linkedinMatches = allText.match(linkedinPattern) || [];
  const linkedin = linkedinMatches[0] || '';
  
  // Extract names (look for patterns like "John Doe, CEO" or "founder John Doe")
  const namePatterns = [
    /(?:founder|CEO|co-founder|founder and CEO)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
    /([A-Z][a-z]+\s+[A-Z][a-z]+),\s*(?:founder|CEO|co-founder)/gi,
  ];
  
  const names: string[] = [];
  for (const pattern of namePatterns) {
    const matches = allText.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && !names.includes(match[1])) {
        names.push(match[1]);
      }
    }
  }
  
  // Extract emails - be very strict, only extract if explicitly found
  // Do NOT generate emails from names or domains
  const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  const emailMatches = allText.match(emailPattern) || [];
  const emails = emailMatches.filter((email, index, self) => {
    const emailLower = email.toLowerCase();
    // Remove duplicates
    if (self.indexOf(email) !== index) return false;
    // Exclude example/test domains
    if (emailLower.includes('example.com') || 
        emailLower.includes('test.com') ||
        emailLower.includes('placeholder') ||
        emailLower.includes('sample')) return false;
    // Exclude common generic patterns that might be hallucinations
    if (emailLower.match(/^(hello|info|contact|support|admin|noreply|no-reply)@/)) {
      // Only include if it's clearly a company email (not generic)
      // We'll be conservative and exclude these unless we're very confident
      return false;
    }
    return true;
  }).join(', ');
  
  return {
    founder_names: names.join(', '),
    founder_linkedin: linkedin,
    founder_emails: emails,
  };
}

/**
 * Extract founder information (Hybrid: LLM first, regex fallback)
 */
export async function extractFounderInfo(
  results: SearchResult[],
  companyName: string
): Promise<{
  founder_names: string;
  founder_linkedin: string;
  founder_emails: string;
  confidence?: ExtractionConfidence;
}> {
  // Try LLM extraction first if available and quota not exceeded
  if (process.env.GEMINI_API_KEY && !geminiQuotaExceeded) {
    try {
      const llmResult = await extractFounderInfoWithLLM(results, companyName);
      // Only use LLM results if confidence is reasonable
      // For emails, require higher confidence (0.8) to prevent hallucinations
      const emailConfidence = llmResult.confidence.founder_emails || 0;
      if (llmResult.founder_emails && emailConfidence < 0.8) {
        // Clear emails if confidence is too low
        llmResult.founder_emails = '';
      }
      if (
        (llmResult.confidence.founder_names || 0) >= 0.5 ||
        (llmResult.confidence.founder_linkedin || 0) >= 0.5 ||
        (emailConfidence >= 0.8 && llmResult.founder_emails) ||
        (!llmResult.founder_emails && (llmResult.confidence.founder_names || 0) >= 0.5)
      ) {
        return llmResult;
      }
    } catch (error) {
      // Check if quota exceeded
      if (isQuotaExceededError(error)) {
        geminiQuotaExceeded = true;
        console.warn('⚠️  Gemini quota exceeded. Switching to regex-only extraction.');
      }
      console.warn('LLM extraction failed, using regex fallback:', error instanceof Error ? error.message : String(error));
    }
  } else if (geminiQuotaExceeded) {
    console.log('  ℹ️  Using regex-only extraction (Gemini quota exceeded)');
  }

  // Fallback to regex
  const regexResult = extractFounderInfoRegex(results, companyName);
  return {
    ...regexResult,
    confidence: {
      founder_names: regexResult.founder_names ? 0.6 : 0,
      founder_linkedin: regexResult.founder_linkedin ? 0.6 : 0,
      founder_emails: regexResult.founder_emails ? 0.6 : 0,
    },
  };
}

/**
 * Extract job openings from search results (Regex-based)
 */
function extractJobOpeningsRegex(results: SearchResult[], companyName: string): string {
  const allText = results.map(r => `${r.title} ${r.snippet}`).join(' ');
  
  // Look for job titles
  const jobPatterns = [
    /(?:hiring|looking for|openings?|positions?)[\s:]+([A-Z][a-zA-Z\s,]+(?:Engineer|Developer|Designer|Manager|Intern|Analyst))/gi,
    /(?:Software|Product|Data|ML|AI|Frontend|Backend|Full.?Stack)\s+(?:Engineer|Developer|Intern|Manager)/gi,
  ];
  
  const jobs: string[] = [];
  for (const pattern of jobPatterns) {
    const matches = allText.matchAll(pattern);
    for (const match of matches) {
      const job = match[1] || match[0];
      if (job && !jobs.includes(job)) {
        jobs.push(job.trim());
      }
    }
  }
  
  return jobs.join(', ');
}

/**
 * Extract job openings (Hybrid: uses regex for now, can be enhanced with LLM)
 */
export function extractJobOpenings(results: SearchResult[], companyName: string): string {
  return extractJobOpeningsRegex(results, companyName);
}

/**
 * Check if a domain should be excluded (search engines, social media, news sites, etc.)
 */
function isExcludedDomain(domain: string): boolean {
  const excludedDomains = [
    // Search engines
    'duckduckgo.com',
    'google.com',
    'bing.com',
    'yahoo.com',
    'yandex.com',
    'baidu.com',
    // Social media
    'linkedin.com',
    'twitter.com',
    'facebook.com',
    'instagram.com',
    'youtube.com',
    'tiktok.com',
    // News/aggregator sites
    'crunchbase.com',
    'techcrunch.com',
    'bloomberg.com',
    'reuters.com',
    'wsj.com',
    'forbes.com',
    'medium.com',
    // Other aggregators
    'producthunt.com',
    'angel.co',
    'pitchbook.com',
    'cbinsights.com',
    // Generic domains
    'wikipedia.org',
    'reddit.com',
    'quora.com',
  ];
  
  const domainLower = domain.toLowerCase();
  return excludedDomains.some(excluded => 
    domainLower === excluded || domainLower.endsWith('.' + excluded)
  );
}

/**
 * Extract company website from search results (Regex-based)
 */
function extractCompanyWebsiteRegex(results: SearchResult[], companyName: string): string {
  // Look for the company's official website (usually first result or one with company name)
  for (const result of results) {
    try {
      const url = new URL(result.url);
      const domain = url.hostname.replace('www.', '');
      
      // Skip excluded domains
      if (isExcludedDomain(domain)) {
        continue;
      }
      
      // Check if domain name matches company name
      const companySlug = companyName.toLowerCase().replace(/\s+/g, '');
      if (domain.includes(companySlug) || result.title.toLowerCase().includes(companyName.toLowerCase())) {
        return domain;
      }
    } catch (error) {
      // Invalid URL, skip
      continue;
    }
  }
  
  // Return first non-excluded result
  for (const result of results) {
    try {
      const url = new URL(result.url);
      const domain = url.hostname.replace('www.', '');
      
      if (!isExcludedDomain(domain)) {
        return domain;
      }
    } catch (error) {
      // Invalid URL, skip
      continue;
    }
  }
  
  return '';
}

/**
 * Extract company website (Hybrid: uses regex for now)
 */
export function extractCompanyWebsite(results: SearchResult[], companyName: string): string {
  return extractCompanyWebsiteRegex(results, companyName);
}

/**
 * Extract tech stack from search results (Regex-based)
 * Looks for mentions of technologies, frameworks, languages, etc.
 */
function extractTechStackRegex(results: SearchResult[], companyName: string): string {
  const allText = results.map(r => `${r.title} ${r.snippet}`).join(' ').toLowerCase();
  
  // Common tech stack keywords
  const techKeywords = [
    // Languages
    'python', 'javascript', 'typescript', 'java', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'dart',
    // Frameworks
    'react', 'vue', 'angular', 'next.js', 'nuxt', 'svelte', 'django', 'flask', 'fastapi', 'express', 'nestjs',
    'spring', 'laravel', 'rails', 'phoenix', 'gin', 'echo',
    // Databases
    'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'cassandra', 'dynamodb', 'firebase',
    // Cloud & Infrastructure
    'aws', 'azure', 'gcp', 'kubernetes', 'docker', 'terraform', 'ansible',
    // AI/ML
    'tensorflow', 'pytorch', 'scikit-learn', 'pandas', 'numpy', 'opencv',
    // Other
    'graphql', 'rest api', 'microservices', 'serverless', 'lambda', 'node.js', 'deno'
  ];
  
  const foundTech: string[] = [];
  for (const tech of techKeywords) {
    if (allText.includes(tech) && !foundTech.includes(tech)) {
      foundTech.push(tech);
    }
  }
  
  return foundTech.join(', ');
}

/**
 * Extract tech stack (Hybrid: uses regex for now)
 */
export function extractTechStack(results: SearchResult[], companyName: string): string {
  return extractTechStackRegex(results, companyName);
}

/**
 * Extract target customer from search results (Regex-based)
 */
function extractTargetCustomerRegex(results: SearchResult[], companyName: string): string {
  const allText = results.map(r => `${r.title} ${r.snippet}`).join(' ').toLowerCase();
  
  // Common target customer patterns
  const customerPatterns = [
    { pattern: /(?:target|serving|focusing on|for)\s+(?:enterprises?|enterprise customers?)/i, value: 'Enterprise' },
    { pattern: /(?:target|serving|focusing on|for)\s+(?:smbs?|small.?medium businesses?|small businesses?)/i, value: 'SMBs' },
    { pattern: /(?:target|serving|focusing on|for)\s+(?:consumers?|end.?users?|individuals?)/i, value: 'Consumers' },
    { pattern: /(?:target|serving|focusing on|for)\s+(?:developers?|devs?)/i, value: 'Developers' },
    { pattern: /(?:target|serving|focusing on|for)\s+(?:startups?)/i, value: 'Startups' },
    { pattern: /b2b|business.?to.?business/i, value: 'B2B' },
    { pattern: /b2c|business.?to.?consumer/i, value: 'B2C' },
    { pattern: /b2b2c/i, value: 'B2B2C' },
  ];
  
  for (const { pattern, value } of customerPatterns) {
    if (pattern.test(allText)) {
      return value;
    }
  }
  
  return '';
}

/**
 * Extract target customer (Hybrid: uses regex for now)
 */
export function extractTargetCustomer(results: SearchResult[], companyName: string): string {
  return extractTargetCustomerRegex(results, companyName);
}

/**
 * Extract market vertical (more specific than industry) (Regex-based)
 */
function extractMarketVerticalRegex(results: SearchResult[], companyName: string): string {
  const allText = results.map(r => `${r.title} ${r.snippet}`).join(' ').toLowerCase();
  
  // Specific verticals within industries
  const verticals = [
    // Fintech
    { keywords: ['payments', 'payment processing', 'payment gateway'], value: 'Fintech - Payments' },
    { keywords: ['lending', 'loans', 'credit'], value: 'Fintech - Lending' },
    { keywords: ['banking', 'neobank', 'digital bank'], value: 'Fintech - Banking' },
    { keywords: ['insurance', 'insurtech'], value: 'Fintech - Insurance' },
    { keywords: ['trading', 'investing', 'robo-advisor'], value: 'Fintech - Trading/Investing' },
    // Healthcare
    { keywords: ['telemedicine', 'telehealth', 'remote healthcare'], value: 'Healthcare - Telemedicine' },
    { keywords: ['mental health', 'therapy', 'counseling'], value: 'Healthcare - Mental Health' },
    { keywords: ['pharmacy', 'prescription'], value: 'Healthcare - Pharmacy' },
    { keywords: ['medical devices', 'medtech'], value: 'Healthcare - Medical Devices' },
    // SaaS
    { keywords: ['crm', 'customer relationship'], value: 'SaaS - CRM' },
    { keywords: ['hr', 'human resources', 'hris'], value: 'SaaS - HR Tech' },
    { keywords: ['accounting', 'bookkeeping', 'financial software'], value: 'SaaS - Accounting' },
    { keywords: ['project management', 'collaboration'], value: 'SaaS - Project Management' },
    // E-commerce
    { keywords: ['marketplace', 'platform'], value: 'E-commerce - Marketplace' },
    { keywords: ['d2c', 'direct to consumer'], value: 'E-commerce - D2C' },
    // AI/ML
    { keywords: ['computer vision', 'image recognition'], value: 'AI - Computer Vision' },
    { keywords: ['nlp', 'natural language processing', 'language model'], value: 'AI - NLP' },
    { keywords: ['recommendation', 'personalization'], value: 'AI - Recommendations' },
  ];
  
  for (const { keywords, value } of verticals) {
    if (keywords.some(keyword => allText.includes(keyword))) {
      return value;
    }
  }
  
  return '';
}

/**
 * Extract market vertical (Hybrid: uses regex for now)
 */
export function extractMarketVertical(results: SearchResult[], companyName: string): string {
  return extractMarketVerticalRegex(results, companyName);
}

/**
 * Extract team size from search results (Regex-based)
 */
function extractTeamSizeRegex(results: SearchResult[], companyName: string): string {
  const allText = results.map(r => `${r.title} ${r.snippet}`).join(' ');
  
  // Look for team size patterns
  const teamSizePatterns = [
    /(?:team|employees?|staff|headcount|workforce).*?(?:of|is|has|with|about|around|approximately)?\s*(\d+)\s*(?:people|employees?|members?|staff)/i,
    /(\d+)\s*(?:people|employees?|members?|staff).*?(?:team|company|startup)/i,
    /(?:team|company|startup).*?(?:of|is|has|with|about|around|approximately)?\s*(\d+)/i,
  ];
  
  for (const pattern of teamSizePatterns) {
    const match = allText.match(pattern);
    if (match && match[1]) {
      const size = parseInt(match[1]);
      if (size > 0) {
        // Categorize into ranges
        if (size < 10) return '1-10';
        if (size < 50) return '10-50';
        if (size < 200) return '50-200';
        if (size < 500) return '200-500';
        return '500+';
      }
    }
  }
  
  // Look for range patterns
  const rangePattern = /(?:team|employees?|staff).*?(\d+)\s*[-–]\s*(\d+)/i;
  const rangeMatch = allText.match(rangePattern);
  if (rangeMatch) {
    return `${rangeMatch[1]}-${rangeMatch[2]}`;
  }
  
  return '';
}

/**
 * Extract team size (Hybrid: uses regex for now)
 */
export function extractTeamSize(results: SearchResult[], companyName: string): string {
  return extractTeamSizeRegex(results, companyName);
}

/**
 * Extract founder backgrounds (previous experience, education, etc.) (Regex-based)
 */
function extractFounderBackgroundsRegex(results: SearchResult[], companyName: string): string {
  const allText = results.map(r => `${r.title} ${r.snippet}`).join(' ');
  
  const backgrounds: string[] = [];
  
  // Look for previous company mentions
  const previousCompanyPattern = /(?:previously|formerly|ex-|former)\s+(?:at|worked at|founded|co-founded|led)\s+([A-Z][a-zA-Z0-9\s&.-]+)/gi;
  const companyMatches = allText.matchAll(previousCompanyPattern);
  for (const match of companyMatches) {
    if (match[1] && !backgrounds.includes(match[1])) {
      backgrounds.push(match[1]);
    }
  }
  
  // Look for education
  const educationPattern = /(?:graduated|studied|degree|alumni).*?(?:from|at)\s+([A-Z][a-zA-Z\s&.-]+(?:University|College|MIT|Stanford|Harvard|Berkeley|Yale|Princeton))/gi;
  const eduMatches = allText.matchAll(educationPattern);
  for (const match of eduMatches) {
    if (match[1] && !backgrounds.includes(match[1])) {
      backgrounds.push(match[1]);
    }
  }
  
  // Look for role titles
  const rolePattern = /(?:previously|formerly|ex-|former)\s+(?:CEO|CTO|CFO|VP|Director|Manager|Engineer|Developer|Designer|Product Manager)\s+(?:at|of)\s+([A-Z][a-zA-Z0-9\s&.-]+)/gi;
  const roleMatches = allText.matchAll(rolePattern);
  for (const match of roleMatches) {
    if (match[1] && !backgrounds.includes(match[1])) {
      backgrounds.push(match[1]);
    }
  }
  
  return backgrounds.join(', ');
}

/**
 * Extract founder backgrounds (Hybrid: uses regex for now)
 */
export function extractFounderBackgrounds(results: SearchResult[], companyName: string): string {
  return extractFounderBackgroundsRegex(results, companyName);
}

/**
 * Extract keywords from website content (from search results) (Regex-based)
 * This extracts relevant keywords that describe the company
 */
function extractWebsiteKeywordsRegex(results: SearchResult[], companyName: string): string {
  const allText = results.map(r => `${r.title} ${r.snippet}`).join(' ').toLowerCase();
  
  // Common startup/company keywords
  const keywordPatterns = [
    // Business models
    'saas', 'subscription', 'marketplace', 'platform', 'api', 'enterprise', 'b2b', 'b2c',
    // Technologies
    'ai', 'machine learning', 'blockchain', 'cloud', 'mobile', 'web', 'api-first',
    // Industries
    'fintech', 'healthtech', 'edtech', 'proptech', 'legaltech', 'insurtech',
    // Features
    'automation', 'analytics', 'security', 'compliance', 'integration', 'scalable',
    // Other
    'startup', 'scale-up', 'unicorn', 'y combinator', 'accelerator', 'incubator'
  ];
  
  const foundKeywords: string[] = [];
  for (const keyword of keywordPatterns) {
    if (allText.includes(keyword) && !foundKeywords.includes(keyword)) {
      foundKeywords.push(keyword);
    }
  }
  
  return foundKeywords.join(', ');
}

/**
 * Extract website keywords (Hybrid: uses regex for now)
 */
export function extractWebsiteKeywords(results: SearchResult[], companyName: string): string {
  return extractWebsiteKeywordsRegex(results, companyName);
}

/**
 * Comprehensive enrichment function that extracts all features
 */
export interface EnrichmentData {
  tech_stack: string;
  target_customer: string;
  market_vertical: string;
  team_size: string;
  founder_backgrounds: string;
  website_keywords: string;
  hiring_roles: string; // job_openings
  website: string;
  founder_names: string;
  founder_linkedin: string;
  founder_emails: string;
  industry: string; // Primary industry category
  location: string; // Company headquarters location
  confidence?: ExtractionConfidence;
}

/**
 * Comprehensive enrichment (Hybrid: LLM first, regex fallback)
 */
export async function extractAllEnrichmentData(
  results: SearchResult[],
  companyName: string
): Promise<EnrichmentData> {
  // Try LLM extraction first if available and quota not exceeded
  if (process.env.GEMINI_API_KEY && !geminiQuotaExceeded) {
    try {
      const llmResult = await extractAllEnrichmentDataWithLLM(results, companyName);
      // Use LLM results if we got meaningful data
      const hasGoodData = Object.values(llmResult.confidence || {}).some(
        (conf) => (conf || 0) >= 0.5
      );
      if (hasGoodData) {
        return llmResult;
      }
    } catch (error) {
      // Check if quota exceeded
      if (isQuotaExceededError(error)) {
        geminiQuotaExceeded = true;
        console.warn('⚠️  Gemini quota exceeded. Switching to regex-only extraction.');
      }
      console.warn('LLM extraction failed, using regex fallback:', error instanceof Error ? error.message : String(error));
    }
  } else if (geminiQuotaExceeded) {
    console.log('  ℹ️  Using regex-only extraction (Gemini quota exceeded)');
  }

  // Fallback to regex-based extraction
  const founderInfo = await extractFounderInfo(results, companyName);

  // Extract location and industry from search results
  const allText = results.map(r => `${r.title} ${r.snippet}`).join(' ');
  const location = extractLocationFromText(allText);
  const industry = extractIndustryFromText(allText);

  return {
    tech_stack: extractTechStack(results, companyName),
    target_customer: extractTargetCustomer(results, companyName),
    market_vertical: extractMarketVertical(results, companyName),
    team_size: extractTeamSize(results, companyName),
    founder_backgrounds: extractFounderBackgrounds(results, companyName),
    website_keywords: extractWebsiteKeywords(results, companyName),
    hiring_roles: extractJobOpenings(results, companyName),
    website: extractCompanyWebsite(results, companyName),
    location: location,
    industry: industry,
    founder_names: founderInfo.founder_names,
    founder_linkedin: founderInfo.founder_linkedin,
    founder_emails: founderInfo.founder_emails,
    confidence: founderInfo.confidence,
  };
}

/**
 * Extract location from text (simple regex-based)
 */
function extractLocationFromText(text: string): string {
  // Look for common city, state patterns
  const cityStatePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2}|[A-Z][a-z]+)/g;
  const matches = text.matchAll(cityStatePattern);

  const commonCities = new Set(['San Francisco', 'New York', 'London', 'Boston', 'Seattle', 'Austin', 'Los Angeles', 'Chicago']);

  for (const match of matches) {
    const city = match[1];
    if (commonCities.has(city)) {
      return `${match[1]}, ${match[2]}`;
    }
  }

  // Return first match if no common city found
  const firstMatch = text.match(cityStatePattern);
  if (firstMatch) {
    return firstMatch[0];
  }

  return '';
}

/**
 * Extract industry from text (simple regex-based)
 */
function extractIndustryFromText(text: string): string {
  const textLower = text.toLowerCase();

  const industries = [
    { keywords: ['fintech', 'financial technology', 'payments'], value: 'Fintech' },
    { keywords: ['healthcare', 'health tech', 'medical'], value: 'Healthcare' },
    { keywords: ['saas', 'software as a service'], value: 'SaaS' },
    { keywords: ['artificial intelligence', 'machine learning', 'ai'], value: 'AI' },
    { keywords: ['e-commerce', 'ecommerce', 'online retail'], value: 'E-commerce' },
    { keywords: ['cybersecurity', 'security'], value: 'Security' },
    { keywords: ['blockchain', 'crypto', 'web3'], value: 'Blockchain' },
    { keywords: ['edtech', 'education'], value: 'EdTech' },
  ];

  for (const { keywords, value } of industries) {
    if (keywords.some(keyword => textLower.includes(keyword))) {
      return value;
    }
  }

  return '';
}

