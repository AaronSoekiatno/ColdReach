/**
 * Web Search Agent Implementation
 * 
 * This module provides actual web search functionality using various APIs.
 * You can use Google Custom Search, SerpAPI, Bing Search, or other services.
 */

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Search using Google Custom Search API
 * Requires: GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID in .env
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
 * Requires: SERPAPI_KEY in .env
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
 * Requires: BING_SEARCH_API_KEY in .env
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
 * Main search function - tries different APIs in order
 */
export async function searchWeb(query: string): Promise<SearchResult[]> {
  // Try Google Custom Search first
  if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
    try {
      return await searchWithGoogle(query);
    } catch (error) {
      console.warn('Google Search failed, trying alternatives...');
    }
  }
  
  // Try SerpAPI
  if (process.env.SERPAPI_KEY) {
    try {
      return await searchWithSerpAPI(query);
    } catch (error) {
      console.warn('SerpAPI failed, trying alternatives...');
    }
  }
  
  // Try Bing
  if (process.env.BING_SEARCH_API_KEY) {
    try {
      return await searchWithBing(query);
    } catch (error) {
      console.warn('Bing Search failed');
    }
  }
  
  throw new Error('No search API configured. Set one of: GOOGLE_SEARCH_API_KEY, SERPAPI_KEY, or BING_SEARCH_API_KEY');
}

/**
 * Extract founder information from search results
 */
export function extractFounderInfo(results: SearchResult[], companyName: string): {
  names: string;
  linkedin: string;
  emails: string;
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
  
  // Extract emails
  const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  const emailMatches = allText.match(emailPattern) || [];
  const emails = emailMatches.filter((email, index, self) => 
    self.indexOf(email) === index && 
    !email.includes('example.com') && 
    !email.includes('test.com')
  ).join(', ');
  
  return {
    names: names.join(', '),
    linkedin: linkedin,
    emails: emails,
  };
}

/**
 * Extract job openings from search results
 */
export function extractJobOpenings(results: SearchResult[], companyName: string): string {
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
 * Extract company website from search results
 */
export function extractCompanyWebsite(results: SearchResult[], companyName: string): string {
  // Look for the company's official website (usually first result or one with company name)
  for (const result of results) {
    try {
      const url = new URL(result.url);
      const domain = url.hostname.replace('www.', '');
      
      // Skip social media and news sites
      if (
        !domain.includes('linkedin.com') &&
        !domain.includes('twitter.com') &&
        !domain.includes('facebook.com') &&
        !domain.includes('crunchbase.com') &&
        !domain.includes('techcrunch.com') &&
        !domain.includes('bloomberg.com')
      ) {
        // Check if domain name matches company name
        const companySlug = companyName.toLowerCase().replace(/\s+/g, '');
        if (domain.includes(companySlug) || result.title.toLowerCase().includes(companyName.toLowerCase())) {
          return domain;
        }
      }
    } catch (error) {
      // Invalid URL, skip
      continue;
    }
  }
  
  // Return first non-social-media result
  for (const result of results) {
    try {
      const url = new URL(result.url);
      const domain = url.hostname.replace('www.', '');
      
      if (
        !domain.includes('linkedin.com') &&
        !domain.includes('twitter.com') &&
        !domain.includes('facebook.com') &&
        !domain.includes('crunchbase.com')
      ) {
        return domain;
      }
    } catch (error) {
      // Invalid URL, skip
      continue;
    }
  }
  
  return '';
}

