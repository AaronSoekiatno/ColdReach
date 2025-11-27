import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { randomUUID } from 'crypto';
import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Types
interface TechCrunchArticle {
  title?: string;
  link?: string;
  description?: string;
  content?: string;
  author?: string;
  date?: string;
  [key: string]: any;
}

interface StartupData {
  Company_Name: string;
  company_description: string;
  business_type: string;
  industry: string;
  location: string;
  website: string;
  funding_stage: string | null; // Can be null if not found
  amount_raised: string | null; // Can be null if not found - no guessing
  date_raised: string | null; // Can be null if not found - no guessing
  techcrunch_article_link?: string;
  techcrunch_article_content?: string;
}

/**
 * FUNDING-FOCUSED SCRAPING
 * 
 * This scraper focuses exclusively on TechCrunch's dedicated fundraising category:
 * https://techcrunch.com/category/fundraising/
 * 
 * This is the most efficient way to get all funding-related articles in one place.
 */

// Only scrape the dedicated fundraising category
const FUNDRAISING_CATEGORY = 'fundraising';

// Initialize clients
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Initialize Pinecone
const pineconeApiKey = process.env.PINECONE_API_KEY;
const pineconeIndexName = process.env.PINECONE_INDEX_NAME || 'startups';

let pinecone: Pinecone | null = null;
let pineconeIndex: any = null;

if (pineconeApiKey) {
  pinecone = new Pinecone({ apiKey: pineconeApiKey });
} else {
  console.warn('⚠️  PINECONE_API_KEY not set. Embeddings will not be stored in Pinecone.');
}

// Initialize Gemini for embeddings
const genAI = process.env.GEMINI_API_KEY 
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

/**
 * Generates an embedding using Gemini
 */
async function generateEmbedding(text: string, retries: number = 3): Promise<number[]> {
  if (!genAI) {
    return [];
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
      const result = await model.embedContent({
        content: {
          role: 'user',
          parts: [{ text: text }],
        },
      });

      if (!result.embedding || !result.embedding.values || !Array.isArray(result.embedding.values)) {
        throw new Error('Failed to generate embedding: Invalid response structure');
      }

      return result.embedding.values;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check for rate limit errors
      if (errorMessage.includes('rate limit') || errorMessage.includes('429') || errorMessage.includes('quota')) {
        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.warn(`  ⚠️  Rate limited, waiting ${delay}ms before retry ${attempt + 2}/${retries}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      // For non-rate-limit errors or final attempt, log and return empty
      if (attempt === retries - 1) {
        console.warn(`  ⚠️  Failed to generate embedding after ${retries} attempts: ${errorMessage}`);
        return [];
      }
    }
  }
  
  return [];
}

/**
 * Store embedding in Pinecone
 */
async function storeEmbeddingInPinecone(id: string, embedding: number[], metadata: Record<string, any>): Promise<void> {
  if (!pinecone || !pineconeIndex) {
    return;
  }

  try {
    await pineconeIndex.upsert([{
      id: id,
      values: embedding,
      metadata: metadata,
    }]);
  } catch (error) {
    console.warn(`Failed to store embedding in Pinecone: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Normalize article data from API response
 */
function normalizeArticle(article: any): TechCrunchArticle {
  if (typeof article === 'string') {
    return { title: article, description: article };
  }
  
  if (Array.isArray(article)) {
    return Array.isArray(article[0]) ? normalizeArticle(article[0]) : normalizeArticle(article[0]);
  }

  return {
    title: article.title || article.headline || article.name || '',
    link: article.link || article.url || article.href || '',
    description: article.description || article.summary || article.excerpt || '',
    content: article.content || article.body || article.text || article.description || '',
    author: article.author || article.writer || '',
    date: article.date || article.publishedDate || article.pubDate || '',
    ...article
  };
}

/**
 * Extract company name from article
 */
function extractCompanyName(article: TechCrunchArticle): string | null {
  const title = article.title || '';
  const content = article.content || article.description || '';
  const fullText = `${title} ${content}`;

  const patterns = [
    /([A-Z][a-zA-Z0-9\s&.-]{2,40}?)\s+(?:raises|secures|closes|announces|launches|gets|receives)\s+(?:\$|\d)/i,
    /([A-Z][a-zA-Z0-9\s&.-]{2,40}?)\s+has\s+(?:raised|secured|closed|announced|launched)/i,
    /([A-Z][a-zA-Z0-9\s&.-]{2,40}?)\s+(?:raised|secured|closed)\s+\$/i,
    /([A-Z][a-zA-Z0-9\s&.-]{2,40}?)\s+(?:is|was)\s+(?:a|an)\s+(?:startup|company|platform|service)/i,
    /(?:startup|company|platform)\s+([A-Z][a-zA-Z0-9\s&.-]{2,40}?)(?:\s|$|,|\.)/i,
    /([A-Z][a-zA-Z0-9\s&.-]{2,40}?),\s+(?:a|an)\s+(?:startup|company|platform)/i,
  ];

  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      let name = match[1].trim();
      name = name.replace(/^(the|a|an)\s+/i, '');
      name = name.replace(/\s+(the|a|an)$/i, '');
      name = name.replace(/[.,;:!?]+$/, '');
      
      const falsePositives = ['The', 'A', 'An', 'This', 'That', 'Startup', 'Company', 'Platform'];
      if (!falsePositives.includes(name) && name.length > 2 && name.length < 50) {
        if (/[A-Z]/.test(name)) {
          return name;
        }
      }
    }
  }

  const titleMatch = title.match(/^([A-Z][a-zA-Z0-9\s&.-]{2,40}?)(?:\s+(?:raises|secures|closes|announces|launches|gets|receives|is|was|has|raised|secured|closed))/i);
  if (titleMatch && titleMatch[1]) {
    const name = titleMatch[1].trim();
    if (name.length > 2 && name.length < 50) {
      return name;
    }
  }

  const quotedMatch = fullText.match(/"([A-Z][a-zA-Z0-9\s&.-]{2,40}?)"/);
  if (quotedMatch && quotedMatch[1]) {
    const name = quotedMatch[1].trim();
    if (name.length > 2 && name.length < 50) {
      return name;
    }
  }

  return null;
}

/**
 * Extract funding amount
 */
function extractFundingAmount(text: string): string | null {
  const patterns = [
    /\$?(\d+(?:\.\d+)?)\s*(?:million|M|billion|B|k|K)/gi,
    /raised\s+\$?(\d+(?:\.\d+)?)\s*(?:million|M|billion|B|k|K)/gi,
    /secured\s+\$?(\d+(?:\.\d+)?)\s*(?:million|M|billion|B|k|K)/gi,
    /closed\s+(?:a|an)?\s+\$?(\d+(?:\.\d+)?)\s*(?:million|M|billion|B|k|K)/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const amount = parseFloat(match[1]);
      const unit = text.toLowerCase().includes('billion') || text.toLowerCase().includes('B') ? 'B' : 
                   text.toLowerCase().includes('million') || text.toLowerCase().includes('M') ? 'M' : 
                   text.toLowerCase().includes('k') || text.toLowerCase().includes('K') ? 'K' : 'M';
      
      if (amount > 0) {
        return `$${amount}${unit}`;
      }
    }
  }

  return null;
}

/**
 * Extract funding stage - only if explicitly mentioned
 */
function extractFundingStage(text: string): string | null {
  const textLower = text.toLowerCase();
  
  if (textLower.includes('seed') || textLower.includes('pre-seed')) {
    return 'Seed';
  } else if (textLower.includes('series a') || textLower.includes('series-a')) {
    return 'Series A';
  } else if (textLower.includes('series b') || textLower.includes('series-b')) {
    return 'Series B';
  } else if (textLower.includes('series c') || textLower.includes('series-c')) {
    return 'Series C';
  } else if (textLower.includes('series d') || textLower.includes('series-d')) {
    return 'Series D';
  } else if (textLower.includes('ipo') || textLower.includes('initial public offering')) {
    return 'IPO';
  } else if (textLower.includes('bridge') || textLower.includes('bridge round')) {
    return 'Bridge';
  }
  
  return null; // Don't guess - return null if not found
}

/**
 * Parse article date from various sources (URL, date field, etc.)
 * Returns null if date cannot be determined - no guessing
 */
function parseArticleDate(article: TechCrunchArticle): Date | null {
  // Try to parse date from URL first (most reliable)
  if (article.link) {
    const urlMatch = article.link.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
    if (urlMatch) {
      const [, year, month, day] = urlMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }
  
  // Try to parse from date field
  if (article.date) {
    const parsed = new Date(article.date);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  
  // No fallback - return null if date cannot be determined
  return null;
}

/**
 * Extract date - only if explicitly found in article
 */
function extractDate(article: TechCrunchArticle): string | null {
  // Try to parse date from URL first (most reliable)
  if (article.link) {
    const urlMatch = article.link.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
    if (urlMatch) {
      const [, year, month, day] = urlMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      }
    }
  }
  
  // Try to parse from date field
  if (article.date) {
    const parsed = new Date(article.date);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
  }
  
  return null; // Don't guess - return null if not found
}

/**
 * Extract location
 */
function extractLocation(text: string): string {
  const locations = [
    'San Francisco, CA',
    'New York, NY',
    'Los Angeles, CA',
    'Boston, MA',
    'Seattle, WA',
    'Austin, TX',
    'Chicago, IL',
    'London, UK',
    'Berlin, Germany',
    'Tel Aviv, Israel',
    'Bangalore, India',
    'Singapore',
  ];

  const textLower = text.toLowerCase();
  for (const location of locations) {
    if (textLower.includes(location.toLowerCase())) {
      return location;
    }
  }

  const cityStatePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2})/;
  const match = text.match(cityStatePattern);
  if (match) {
    return `${match[1]}, ${match[2]}, USA`;
  }

  return '';
}

/**
 * Extract industry
 */
function extractIndustry(text: string): string {
  const textLower = text.toLowerCase();
  
  const industryMap: { [key: string]: string } = {
    'artificial intelligence': 'Artificial Intelligence',
    'machine learning': 'Artificial Intelligence',
    'ai': 'Artificial Intelligence',
    'ml': 'Artificial Intelligence',
    'fintech': 'Fintech',
    'financial': 'Fintech',
    'banking': 'Fintech',
    'healthcare': 'Healthcare',
    'health': 'Healthcare',
    'biotech': 'Healthcare',
    'saas': 'SaaS',
    'software': 'SaaS',
    'e-commerce': 'E-commerce',
    'retail': 'E-commerce',
    'transportation': 'Transportation',
    'mobility': 'Transportation',
    'automotive': 'Transportation',
    'cryptocurrency': 'Cryptocurrency',
    'blockchain': 'Cryptocurrency',
    'crypto': 'Cryptocurrency',
    'security': 'Security',
    'cybersecurity': 'Security',
    'hardware': 'Hardware',
    'iot': 'Hardware',
    'gaming': 'Gaming',
    'entertainment': 'Media & Entertainment',
    'media': 'Media & Entertainment',
  };

  for (const [keyword, industry] of Object.entries(industryMap)) {
    if (textLower.includes(keyword)) {
      return industry;
    }
  }

  return '';
}

/**
 * Extract business type - only if explicitly mentioned
 */
function extractBusinessType(text: string): string {
  const textLower = text.toLowerCase();
  
  if (textLower.includes('b2b') || textLower.includes('enterprise') || textLower.includes('business-to-business')) {
    return 'B2B';
  } else if (textLower.includes('b2c') || textLower.includes('consumer') || textLower.includes('business-to-consumer')) {
    return 'Consumer';
  } else if (textLower.includes('marketplace')) {
    return 'Marketplace';
  } else if (textLower.includes('platform')) {
    return 'Platform';
  }
  
  return ''; // Don't guess - return empty string if not found
}

/**
 * Extract website
 */
function extractWebsite(companyName: string, text: string): string {
  const urlPattern = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+)/g;
  const matches = text.matchAll(urlPattern);
  
  for (const match of matches) {
    const domain = match[1];
    if (!['techcrunch.com', 'twitter.com', 'linkedin.com', 'facebook.com', 'youtube.com'].includes(domain)) {
      return domain;
    }
  }

  const domain = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '');
  
  return `${domain}.com`;
}

/**
 * Extract structured startup data from article using Gemini
 */
async function extractStartupDataWithGemini(article: TechCrunchArticle): Promise<StartupData | null> {
  if (!genAI) {
    console.warn('  ⚠️  Gemini API not available, falling back to regex extraction');
    return parseArticleToStartupRegex(article);
  }

  try {
    const articleText = `
Title: ${article.title || ''}
Content: ${(article.content || article.description || '').substring(0, 4000)}
Link: ${article.link || ''}
Date: ${article.date || ''}
`.trim();

    const prompt = `Extract structured startup funding information from this TechCrunch article. Return ONLY valid JSON, no markdown, no explanation.

IMPORTANT: Only extract information that is explicitly stated in the article. Do NOT guess, infer, or use defaults. If information is not mentioned, use null or empty string.

Article:
${articleText}

Extract the following information:
- Company_Name: The name of the startup/company (required, must be exact from article)
- funding_stage: Only if explicitly stated: Seed, Series A, Series B, Series C, Series D, Bridge, IPO. Use null if not mentioned.
- amount_raised: Funding amount ONLY if explicitly stated in format like "$5M", "$10.5M", "$2.5B". Use null if not mentioned.
- date_raised: Date of funding announcement ONLY if explicitly stated (format: "Month Year" or "YYYY-MM-DD"). Use null if not mentioned.
- location: City, State/Country ONLY if explicitly stated (e.g., "San Francisco, CA" or "London, UK"). Use empty string if not mentioned.
- industry: Primary industry ONLY if explicitly stated (e.g., "Artificial Intelligence", "Fintech", "Healthcare", "SaaS"). Use empty string if not mentioned.
- business_type: ONLY if explicitly stated: "B2B", "Consumer", "Marketplace", "Platform". Use empty string if not mentioned.
- website: Company website domain ONLY if explicitly stated (without http://). Use empty string if not mentioned.
- company_description: First 2-3 sentences summarizing what the company does ONLY from the article content (max 500 chars). Use empty string if no description available.

Return JSON in this exact format:
{
  "Company_Name": "string or null",
  "funding_stage": "string or null",
  "amount_raised": "string or null",
  "date_raised": "string or null",
  "location": "string",
  "industry": "string",
  "business_type": "string",
  "website": "string",
  "company_description": "string"
}

If no company name can be identified, return null.`;

    // Try different model names in order of preference
    // Using newer Gemini 2.x models as 1.5 models may have compatibility issues
    const modelNames = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
    let result = null;
    let lastError: any = null;
    
    for (const modelName of modelNames) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        result = await model.generateContent(prompt);
        // If we get here, the model worked
        break;
      } catch (error: any) {
        lastError = error;
        // If it's a model not found error (404), try the next model
        if (error?.message?.includes('not found') || error?.message?.includes('404')) {
          console.warn(`  ⚠️  Model ${modelName} not available, trying next model...`);
          continue;
        }
        // For other errors (parsing, validation, etc.), re-throw immediately
        throw error;
      }
    }
    
    if (!result) {
      throw new Error(`All Gemini models failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }
    const response = result.response;
    const text = response.text();
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const extracted = JSON.parse(jsonText);
    
    // Validate that we have a company name
    if (!extracted.Company_Name || extracted.Company_Name === 'null') {
      return null;
    }

    // Use ONLY what Gemini extracted - no defaults, no guessing
    // Convert null strings to actual null values
    const toNull = (value: any): string | null => {
      if (value === null || value === undefined || value === 'null' || value === '') {
        return null;
      }
      return String(value).trim() || null;
    };

    const toEmptyString = (value: any): string => {
      if (value === null || value === undefined || value === 'null') {
        return '';
      }
      return String(value).trim() || '';
    };

    return {
      Company_Name: extracted.Company_Name,
      company_description: toEmptyString(extracted.company_description), // Only use what was extracted
      business_type: toEmptyString(extracted.business_type), // No default
      industry: toEmptyString(extracted.industry),
      location: toEmptyString(extracted.location),
      website: toEmptyString(extracted.website), // No guessing website
      funding_stage: toNull(extracted.funding_stage), // No default to 'Seed'
      amount_raised: toNull(extracted.amount_raised), // No default to '$1.5M'
      date_raised: toNull(extracted.date_raised), // No fallback date
      techcrunch_article_link: article.link || '',
      techcrunch_article_content: article.content || article.description || '',
    };
  } catch (error) {
    console.warn(`  ⚠️  Gemini extraction failed, falling back to regex: ${error instanceof Error ? error.message : String(error)}`);
    return parseArticleToStartupRegex(article);
  }
}

/**
 * Parse article to startup data using regex (fallback)
 */
function parseArticleToStartupRegex(article: TechCrunchArticle): StartupData | null {
  const companyName = extractCompanyName(article);
  if (!companyName) {
    return null;
  }

  const content = `${article.title || ''} ${article.content || article.description || ''}`;
  const fundingAmount = extractFundingAmount(content);
  const fundingStage = extractFundingStage(content);
  const dateRaised = extractDate(article);
  const location = extractLocation(content);
  const industry = extractIndustry(content);
  const businessType = extractBusinessType(content);
  const website = extractWebsite(companyName, content);

  // Only use article content if it exists - don't create fake descriptions
  // For embeddings, we'll use the full article content stored in techcrunch_article_content
  const description = article.content || article.description || '';

  return {
    Company_Name: companyName,
    company_description: description, // Only real article content, no guessing
    business_type: businessType, // May be empty string if not found
    industry: industry,
    location: location,
    website: website,
    funding_stage: fundingStage, // May be null if not found
    amount_raised: fundingAmount, // May be null if not found - NO DEFAULT
    date_raised: dateRaised, // May be null if not found - NO DEFAULT
    techcrunch_article_link: article.link || '',
    techcrunch_article_content: article.content || article.description || '',
  };
}

/**
 * Generate funding round ID
 */
function generateFundingRoundId(startupName: string, dateRaised: string): string {
  return `techcrunch-${startupName.toLowerCase().replace(/\s+/g, '-')}-${dateRaised.toLowerCase().replace(/\s+/g, '-')}`;
}

/**
 * Check if URL is a valid article URL (not category/tag page)
 */
function isValidArticleUrl(url: string): boolean {
  if (!url || !url.includes('techcrunch.com')) return false;
  
  // Filter out category, tag, and other non-article pages
  const invalidPatterns = [
    '/category/',
    '/tag/',
    '/author/',
    '/page/',
    '/search/',
    '/about/',
    '/contact/',
    '/privacy/',
    '/terms/',
    '/newsletters/',
    '/events/',
    '/advertise/',
  ];
  
  // Must be a date-based article URL (e.g., /2025/11/22/article-name/)
  const hasDatePattern = /\/(\d{4})\/(\d{2})\/(\d{2})\//.test(url);
  
  return hasDatePattern && !invalidPatterns.some(pattern => url.includes(pattern));
}

/**
 * Scrape TechCrunch category page using Puppeteer with pagination support
 */
async function scrapeCategoryPage(page: Page, category: string, pageNum: number = 1): Promise<TechCrunchArticle[]> {
  const url = pageNum === 1 
    ? `https://techcrunch.com/category/${category}/`
    : `https://techcrunch.com/category/${category}/page/${pageNum}/`;
  
  try {
    console.log(`   Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Scroll down to load more content (TechCrunch may lazy-load)
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Wait for articles to load - try multiple selectors for modern TechCrunch
    await page.waitForSelector('article, a[href*="/202"], .post-block, .river-block, [data-module="ArticleListItem"]', { timeout: 10000 }).catch(() => {});
    
    // Small delay to ensure all content is loaded
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Extract article links and basic info with date parsing
    // TechCrunch uses various structures, so we'll look for article links directly
    const articles = await page.evaluate(() => {
      const results: any[] = [];
      
      // Strategy 1: Find all links that match article URL pattern (most reliable)
      const allLinks = document.querySelectorAll('a[href*="/202"]');
      const seenUrls = new Set<string>();
      
      allLinks.forEach((linkEl) => {
        const href = linkEl.getAttribute('href');
        if (!href) return;
        
        const fullUrl = href.startsWith('http') ? href : `https://techcrunch.com${href}`;
        
        // Only include if it looks like an article URL and we haven't seen it
        if (fullUrl && /\/(\d{4})\/(\d{2})\/(\d{2})\//.test(fullUrl) && !seenUrls.has(fullUrl)) {
          seenUrls.add(fullUrl);
          
          // Extract date from URL (format: /2025/11/22/)
          const dateMatch = fullUrl.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
          let articleDate = '';
          if (dateMatch) {
            const [, year, month, day] = dateMatch;
            articleDate = `${year}-${month}-${day}`;
          }
          
          // Find the article container (parent or nearby)
          let container = linkEl.closest('article') || 
                         linkEl.closest('[class*="post"]') || 
                         linkEl.closest('[class*="article"]') ||
                         linkEl.parentElement;
          
          // Try to find title - could be in the link itself or nearby
          let titleEl = linkEl.querySelector('h2, h3, h4') || 
                       container?.querySelector('h2, h3, h4, [class*="title"]') ||
                       (linkEl.textContent?.trim() ? linkEl : null);
          
          // Try to find description/excerpt
          const descEl = container?.querySelector('p, [class*="excerpt"], [class*="summary"], [class*="description"]') ||
                        linkEl.nextElementSibling?.querySelector('p');
          
          // Try to find date
          const dateEl = container?.querySelector('time[datetime], [datetime], [class*="date"]') ||
                        linkEl.parentElement?.querySelector('time, [datetime]');
          
          const title = titleEl?.textContent?.trim() || linkEl.textContent?.trim() || '';
          
          // Only add if we have a title (indicates it's a real article link)
          if (title && title.length > 10) {
            results.push({
              title: title,
              link: fullUrl,
              description: descEl?.textContent?.trim() || '',
              date: dateEl?.getAttribute('datetime') || articleDate || dateEl?.textContent?.trim() || '',
              dateFromUrl: articleDate, // Store parsed date for sorting
            });
          }
        }
      });
      
      // Strategy 2: Also check article elements (fallback)
      const articleElements = document.querySelectorAll('article, [class*="post"], [data-module="ArticleListItem"]');
      articleElements.forEach((element) => {
        const linkEl = element.querySelector('a[href*="/202"]');
        if (!linkEl) return;
        
        const href = linkEl.getAttribute('href');
        if (!href) return;
        
        const fullUrl = href.startsWith('http') ? href : `https://techcrunch.com${href}`;
        
        // Skip if we already have this URL
        if (results.some(r => r.link === fullUrl)) return;
        
        // Only include if it looks like an article URL
        if (fullUrl && /\/(\d{4})\/(\d{2})\/(\d{2})\//.test(fullUrl)) {
          const dateMatch = fullUrl.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
          let articleDate = '';
          if (dateMatch) {
            const [, year, month, day] = dateMatch;
            articleDate = `${year}-${month}-${day}`;
          }
          
          const titleEl = element.querySelector('h2, h3, h4, [class*="title"]') || linkEl;
          const descEl = element.querySelector('p, [class*="excerpt"], [class*="summary"]');
          const dateEl = element.querySelector('time[datetime], [datetime], [class*="date"]');
          
          const title = titleEl?.textContent?.trim() || '';
          
          if (title && title.length > 10) {
            results.push({
              title: title,
              link: fullUrl,
              description: descEl?.textContent?.trim() || '',
              date: dateEl?.getAttribute('datetime') || articleDate || dateEl?.textContent?.trim() || '',
              dateFromUrl: articleDate,
            });
          }
        }
      });
      
      return results;
    });
    
    // Filter out invalid URLs
    const validArticles = articles.filter(article => isValidArticleUrl(article.link));
    
    // Remove duplicates by URL
    const uniqueArticles = Array.from(
      new Map(validArticles.map(article => [article.link, article])).values()
    );
    
    // Log first few articles for debugging
    if (uniqueArticles.length > 0) {
      console.log(`   Sample articles found:`);
      uniqueArticles.slice(0, 3).forEach((article, i) => {
        console.log(`     ${i + 1}. ${article.title.substring(0, 60)}... (${article.dateFromUrl || 'no date'})`);
      });
    }
    
    console.log(`   Found ${uniqueArticles.length} unique valid articles on page ${pageNum} (${articles.length} total, ${validArticles.length} valid)`);
    return uniqueArticles;
  } catch (error) {
    console.error(`   Error scraping category page ${category} (page ${pageNum}):`, error);
    return [];
  }
}

/**
 * Check if there are more pages available
 */
async function hasMorePages(page: Page): Promise<boolean> {
  try {
    const hasNext = await page.evaluate(() => {
      // Look for "Next" button or pagination links
      const nextButton = document.querySelector('a[rel="next"], .pagination a:last-child, [class*="next"]');
      return nextButton !== null && nextButton.textContent?.toLowerCase().includes('next');
    });
    return hasNext;
  } catch {
    return false;
  }
}

/**
 * Get already scraped article links from Supabase
 */
async function getAlreadyScrapedArticleLinks(): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('startups')
      .select('techcrunch_article_link')
      .not('techcrunch_article_link', 'is', null);
    
    if (error) {
      console.warn('  ⚠️  Could not fetch already-scraped articles:', error);
      return new Set();
    }
    
    const links = new Set<string>();
    data?.forEach((row: any) => {
      if (row.techcrunch_article_link) {
        links.add(row.techcrunch_article_link);
      }
    });
    
    return links;
  } catch (error) {
    console.warn('  ⚠️  Error fetching already-scraped articles:', error);
    return new Set();
  }
}

/**
 * Scrape individual article page to get full content
 * Uses a new page to avoid frame detachment issues
 */
async function scrapeArticlePage(browser: Browser, articleLink: string): Promise<TechCrunchArticle | null> {
  // Validate URL first
  if (!isValidArticleUrl(articleLink)) {
    return null;
  }
  
  let articlePage: Page | null = null;
  
  try {
    // Create a new page for each article to avoid frame detachment
    articlePage = await browser.newPage();
    await articlePage.setViewport({ width: 1920, height: 1080 });
    await articlePage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate with shorter timeout and more lenient wait condition
    await articlePage.goto(articleLink, { 
      waitUntil: 'domcontentloaded', 
      timeout: 20000 
    });
    
    // Wait for article content with shorter timeout
    await articlePage.waitForSelector('article, .article-content, .entry-content, h1', { timeout: 5000 }).catch(() => {});
    
    // Small delay to ensure content is loaded
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const articleData = await articlePage.evaluate(() => {
      const titleEl = document.querySelector('h1, .article-title, .entry-title');
      const authorEl = document.querySelector('.author, [rel="author"], .byline');
      const dateEl = document.querySelector('time[datetime], .article-date, .published-date');
      
      // Get all paragraph text for content - try multiple selectors for comprehensive extraction
      const contentSelectors = [
        'article p',
        '.article-content p',
        '.entry-content p',
        '[class*="article"] p',
        '[class*="content"] p',
        'main p',
      ];
      
      const allParagraphs: string[] = [];
      contentSelectors.forEach(selector => {
        const paragraphs = Array.from(document.querySelectorAll(selector))
          .map(p => p.textContent?.trim())
          .filter(Boolean)
          .filter(text => text.length > 20); // Filter out very short text (likely navigation/ads)
        allParagraphs.push(...paragraphs);
      });
      
      // Remove duplicates while preserving order
      const uniqueParagraphs = Array.from(new Set(allParagraphs));
      const fullContent = uniqueParagraphs.join('\n\n');
      
      // Get first paragraph as description (usually the summary)
      const description = uniqueParagraphs[0] || fullContent.substring(0, 500) || '';
      
      return {
        title: titleEl?.textContent?.trim() || '',
        link: window.location.href,
        description: description.substring(0, 500) || '',
        content: fullContent || '',
        author: authorEl?.textContent?.trim() || '',
        date: dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '',
      };
    });
    
    return articleData;
  } catch (error) {
    // Silently handle errors - we'll just skip this article
    return null;
  } finally {
    // Always close the page to prevent resource leaks
    if (articlePage) {
      try {
        await articlePage.close();
      } catch (closeError) {
        // Ignore close errors
      }
    }
  }
}

/**
 * Scrape TechCrunch tag page using Puppeteer
 */
async function scrapeTagPage(page: Page, tag: string): Promise<TechCrunchArticle[]> {
  const url = `https://techcrunch.com/tag/${tag}/`;
  
  try {
    console.log(`   Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for articles to load
    await page.waitForSelector('article, .post-block, .river-block', { timeout: 10000 }).catch(() => {});
    
    // Extract article links and basic info (same as category page)
    const articles = await page.evaluate(() => {
      const articleElements = document.querySelectorAll('article, .post-block, .river-block, [class*="post"]');
      const results: any[] = [];
      
      articleElements.forEach((element) => {
        const linkEl = element.querySelector('a[href*="/"]');
        const titleEl = element.querySelector('h2, h3, .post-title, [class*="title"]');
        const descEl = element.querySelector('p, .excerpt, [class*="excerpt"], [class*="summary"]');
        const dateEl = element.querySelector('time, [datetime], .date');
        
        if (linkEl) {
          const href = linkEl.getAttribute('href');
          const fullUrl = href?.startsWith('http') ? href : `https://techcrunch.com${href}`;
          
          // Only include if it looks like an article URL
          if (fullUrl && /\/(\d{4})\/(\d{2})\/(\d{2})\//.test(fullUrl)) {
            results.push({
              title: titleEl?.textContent?.trim() || '',
              link: fullUrl,
              description: descEl?.textContent?.trim() || '',
              date: dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '',
            });
          }
        }
      });
      
      return results;
    });
    
    // Filter out invalid URLs
    const validArticles = articles.filter(article => isValidArticleUrl(article.link));
    
    console.log(`   Found ${validArticles.length} valid articles on tag page (${articles.length} total)`);
    return validArticles;
  } catch (error) {
    console.error(`   Error scraping tag page ${tag}:`, error);
    return [];
  }
}

// Execution lock to prevent overlapping runs
let isScraping = false;
let lastRunTime = 0;

/**
 * Check if current time is within TechCrunch's active publishing hours
 * TechCrunch typically publishes during US business hours (6 AM - 10 PM Pacific)
 */
function isWithinTechCrunchHours(): boolean {
  const now = new Date();
  
  // Convert to Pacific Time (TechCrunch's timezone)
  const pacificTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const hour = pacificTime.getHours();
  
  // TechCrunch publishes articles roughly between 6 AM - 10 PM Pacific
  // This covers US business hours and evening news cycles
  const isActive = hour >= 6 && hour < 22;
  
  return isActive;
}

/**
 * Get human-readable time info
 */
function getTimeInfo(): string {
  const now = new Date();
  const pacificTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const hour = pacificTime.getHours();
  const minute = pacificTime.getMinutes();
  const isActive = isWithinTechCrunchHours();
  
  return `Pacific Time: ${hour}:${minute.toString().padStart(2, '0')} (${isActive ? '✅ Active' : '⏸️  Inactive'})`;
}

/**
 * Main scraping and ingestion function
 * Focus: Funding-related articles only
 * 
 * NOTE: Designed to run every 30 minutes during TechCrunch's active hours (6 AM - 10 PM Pacific).
 * See SCRAPER_LIMITATIONS_10MIN.md for limitations.
 */
async function scrapeAndIngestTechCrunch() {
  // Check if within TechCrunch's active hours
  // COMMENTED OUT FOR TESTING - Remove comments to re-enable active hours check
  // if (!isWithinTechCrunchHours()) {
  //   const timeInfo = getTimeInfo();
  //   console.log(`⏸️  Outside TechCrunch publishing hours. ${timeInfo}`);
  //   console.log('   Skipping this run. Will resume during active hours (6 AM - 10 PM Pacific).\n');
  //   return;
  // }
  
  // Prevent overlapping runs
  if (isScraping) {
    console.log('⚠️  Previous scraping run still in progress, skipping this run...');
    return;
  }
  
  const startTime = Date.now();
  const timeSinceLastRun = startTime - lastRunTime;
  
  // Minimum interval: 25 minutes (for 30-minute schedule with buffer)
  if (lastRunTime > 0 && timeSinceLastRun < 25 * 60 * 1000) {
    console.log(`⚠️  Last run was ${Math.round(timeSinceLastRun / 60000)} minutes ago. Minimum interval: 25 minutes. Skipping...`);
    return;
  }
  
  isScraping = true;
  lastRunTime = startTime;
  
  try {
    const timeInfo = getTimeInfo();
    console.log('🚀 Starting TechCrunch FUNDRAISING scraping with Supabase + Pinecone...\n');
    console.log('📊 Source: https://techcrunch.com/category/fundraising/\n');
    console.log('🎯 Focus: All funding announcements and startup investments\n');
    console.log(`⏰ ${timeInfo}`);
    console.log(`📅 Run started at: ${new Date().toISOString()}\n`);

  // Initialize Pinecone index if available
  if (pinecone) {
    try {
      pineconeIndex = pinecone.index(pineconeIndexName);
      console.log(`✓ Connected to Pinecone index: ${pineconeIndexName}\n`);
    } catch (error) {
      console.warn(`⚠️  Could not connect to Pinecone index: ${error instanceof Error ? error.message : String(error)}`);
      console.warn('   Continuing without Pinecone...\n');
      pinecone = null;
    }
  }

  // Test Supabase connection
  try {
    const { data, error } = await supabase.from('startups').select('id').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 is "relation does not exist" - table might not be created yet
      throw error;
    }
    console.log('✓ Connected to Supabase\n');
  } catch (error) {
    throw new Error(
      `Cannot connect to Supabase. Make sure your database is set up and migrations are run. ` +
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Get already-scraped articles from Supabase to avoid duplicates
  console.log('🔍 Checking for already-scraped articles in Supabase...');
  const alreadyScrapedLinks = await getAlreadyScrapedArticleLinks();
  console.log(`   Found ${alreadyScrapedLinks.size} already-scraped articles\n`);

  const allStartups: StartupData[] = [];
  const seenCompanies = new Set<string>();
  const seenArticleLinks = new Set<string>();

  // Launch Puppeteer browser
  console.log('🌐 Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  
  // Set a reasonable viewport
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Set user agent to avoid blocking
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    // Scrape only the dedicated fundraising category with pagination
    console.log('📂 Scraping TechCrunch fundraising category (with pagination)...');
    console.log('   URL: https://techcrunch.com/category/fundraising/\n');
    
    let allArticles: TechCrunchArticle[] = [];
    let pageNum = 1;
    const maxPages = 2; // TESTING: Scrape only 1 page. Change back to 5 for production
    let hasMore = true;
    
    // Scrape multiple pages to get recent articles
    // Start with page 1 (most recent articles)
    while (hasMore && pageNum <= maxPages) {
      try {
        console.log(`\n📄 Scraping page ${pageNum}...`);
        const pageArticles = await scrapeCategoryPage(page, FUNDRAISING_CATEGORY, pageNum);
        
        if (pageArticles.length === 0) {
          console.log(`   No articles found on page ${pageNum}, stopping pagination`);
          hasMore = false;
          break;
        }
        
        // Add articles, avoiding duplicates
        const existingUrls = new Set(allArticles.map(a => a.link));
        const newArticles = pageArticles.filter(a => !existingUrls.has(a.link));
        allArticles = allArticles.concat(newArticles);
        
        console.log(`   Found ${pageArticles.length} articles on this page (${newArticles.length} new, ${pageArticles.length - newArticles.length} duplicates)`);
        console.log(`   Total unique articles collected so far: ${allArticles.length}`);
        
        // Check if there's a next page
        hasMore = await hasMorePages(page);
        pageNum++;
        
        // Wait between pages
        if (hasMore && pageNum <= maxPages) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`   ❌ Error scraping page ${pageNum}:`, error);
        hasMore = false;
      }
    }
    
    console.log(`\n📊 Found ${allArticles.length} total funding articles across ${pageNum - 1} page(s)\n`);
    
    // Sort articles by date (newest first)
    // Articles without dates go to the end
    allArticles.sort((a, b) => {
      const dateA = parseArticleDate(a);
      const dateB = parseArticleDate(b);
      
      // Handle null dates - put them at the end
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1; // dateA goes after dateB
      if (!dateB) return -1; // dateB goes after dateA
      
      return dateB.getTime() - dateA.getTime(); // Newest first
    });
    
    console.log(`📅 Sorted articles by date (newest first)`);
    if (allArticles.length > 0) {
      const newestDate = parseArticleDate(allArticles[0]);
      const oldestDate = parseArticleDate(allArticles[allArticles.length - 1]);
      if (newestDate) {
        console.log(`   Newest: ${newestDate.toISOString().split('T')[0]}`);
      }
      if (oldestDate) {
        console.log(`   Oldest: ${oldestDate.toISOString().split('T')[0]}\n`);
      } else {
        console.log(`   (Some articles have no date)\n`);
      }
    }
    
    // Filter out already-scraped articles
    const newArticles = allArticles.filter(article => {
      const link = article.link || '';
      return !alreadyScrapedLinks.has(link) && !seenArticleLinks.has(link);
    });
    
    console.log(`📋 Filtered to ${newArticles.length} new articles (${allArticles.length - newArticles.length} already scraped)\n`);
    
    if (newArticles.length === 0) {
      console.log('✅ No new articles to scrape! All articles have already been processed.');
      return;
    }
    
    // TESTING: Limit to first 3 startups for testing
    const maxStartupsToProcess = 3;
    const articlesToProcess = newArticles.slice(0, maxStartupsToProcess);
    
    if (newArticles.length > maxStartupsToProcess) {
      console.log(`🧪 TESTING MODE: Processing only first ${maxStartupsToProcess} articles (${newArticles.length} total available)\n`);
    }
    
    // Process each new article
    for (let i = 0; i < articlesToProcess.length; i++) {
      const article = articlesToProcess[i];
      
      seenArticleLinks.add(article.link || '');
      
      try {
        // Scrape full article content
        if (article.link && isValidArticleUrl(article.link)) {
          console.log(`[${i + 1}/${articlesToProcess.length}] 📄 Scraping: ${article.title?.substring(0, 60)}...`);
          const fullArticle = await scrapeArticlePage(browser, article.link);
          
          if (fullArticle) {
            // Merge with basic info
            const mergedArticle = {
              ...article,
              ...fullArticle,
              content: fullArticle.content || article.description || '',
            };
            
            const normalizedArticle = normalizeArticle(mergedArticle);
            
            // Use Gemini to extract startup data
            console.log(`   🤖 Extracting data with Gemini...`);
            const startup = await extractStartupDataWithGemini(normalizedArticle);
            
            if (startup && !seenCompanies.has(startup.Company_Name.toLowerCase())) {
              seenCompanies.add(startup.Company_Name.toLowerCase());
              allStartups.push(startup);
              console.log(`   ✅ Extracted: ${startup.Company_Name} (${startup.funding_stage} - ${startup.amount_raised})`);
            } else if (startup) {
              console.log(`   ⏭️  Duplicate company: ${startup.Company_Name} (skipped)`);
            } else {
              console.log(`   ⚠️  Could not extract company name`);
            }
          }
          
          // Rate limiting - wait between articles and Gemini API calls
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (err) {
        // Silently continue on errors
        continue;
      }
    }
  } finally {
    // Close browser with better error handling for Windows
    try {
      const pages = await browser.pages();
      for (const p of pages) {
        try {
          await p.close();
        } catch (e) {
          // Ignore page close errors
        }
      }
      await browser.close();
      console.log('🌐 Browser closed');
    } catch (closeError) {
      // On Windows, sometimes temp files are locked - this is okay
      console.warn('⚠️  Browser cleanup warning (this is usually safe to ignore):', closeError instanceof Error ? closeError.message : String(closeError));
    }
  }

  console.log(`\n💾 Ingesting ${allStartups.length} startups into Supabase + Pinecone...\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < allStartups.length; i++) {
    const startup = allStartups[i];
    
    // Validate required fields before processing
    if (!startup.Company_Name || startup.Company_Name.trim().length === 0) {
      console.log(`[${i + 1}/${allStartups.length}] ⚠️  Skipping: Missing company name`);
      errorCount++;
      continue;
    }
    
    try {
      console.log(`[${i + 1}/${allStartups.length}] Processing: ${startup.Company_Name}`);

      // Generate embedding - include all relevant data for better matching
      const description = startup.company_description || '';
      const tags = startup.business_type && startup.industry 
        ? `${startup.business_type}, ${startup.industry}` 
        : startup.business_type || startup.industry || '';
      
      // Include more context in embedding for better semantic search
      const embeddingParts = [
        description,
        startup.Company_Name ? `Company: ${startup.Company_Name}` : '',
        startup.funding_stage ? `Funding Stage: ${startup.funding_stage}` : '',
        startup.amount_raised ? `Funding Amount: ${startup.amount_raised}` : '',
        startup.location ? `Location: ${startup.location}` : '',
        tags ? `Tags: ${tags}` : '',
      ].filter(Boolean);
      
      const embeddingText = embeddingParts.join('\n');

      console.log('  Generating embedding...');
      const embedding = await generateEmbedding(embeddingText);
      
      if (embedding.length === 0) {
        console.warn('  ⚠️  No embedding generated (empty array). Continuing without embedding...');
      } else {
        console.log(`  ✓ Generated embedding (${embedding.length} dimensions)`);
      }

      // Create startup in Supabase (all data in one table)
      console.log('  Creating startup in Supabase...');
      
      // Validate required fields before insert
      if (!startup.Company_Name || startup.Company_Name.trim().length === 0) {
        throw new Error('Company name is required but missing');
      }
      const pineconeId = `startup-${startup.Company_Name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      
      // Combine business_type and industry into keywords
      const keywords = [startup.business_type, startup.industry].filter(Boolean).join(', ');
      
      // For TechCrunch scraping, we don't have founder info, so leave empty
      // These can be populated later from other sources
      const founderNames = '';
      const founderEmails = '';
      const founderLinkedin = '';
      const jobOpenings = ''; // Can be populated from other sources
      
      // Generate UUID explicitly to ensure id is set (fixes null constraint violation)
      const startupId = randomUUID();
      
      // Helper to convert empty strings to null (PostgreSQL prefers null for optional fields)
      const toNull = (value: string | null | undefined): string | null => {
        return value && value.trim() ? value : null;
      };
      
      const { data: startupData, error: startupError } = await supabase
        .from('startups')
        .insert({
          id: startupId, // Explicitly set UUID to avoid null constraint violation
          name: startup.Company_Name,
          funding_amount: toNull(startup.amount_raised),
          job_openings: toNull(jobOpenings),
          round_type: toNull(startup.funding_stage),
          date: toNull(startup.date_raised),
          location: toNull(startup.location),
          website: toNull(startup.website),
          founder_linkedin: toNull(founderLinkedin),
          industry: toNull(startup.industry),
          founder_names: toNull(founderNames),
          founder_emails: toNull(founderEmails),
          keywords: toNull(keywords),
          description: description || null, // Keep for embeddings, but allow null if empty
          pinecone_id: pineconeId,
          techcrunch_article_link: toNull(startup.techcrunch_article_link),
          techcrunch_article_content: toNull(startup.techcrunch_article_content),
          data_source: 'techcrunch',
          needs_enrichment: true, // Mark for web search enrichment
          enrichment_status: 'pending',
        })
        .select()
        .single();

      if (startupError) {
        if (startupError.code === '23505') { // Unique violation - startup already exists
          console.log('  Startup already exists, skipping...');
          continue;
        }
        // Log detailed error information
        console.error(`  Supabase error details:`);
        console.error(`    Code: ${startupError.code || 'N/A'}`);
        console.error(`    Message: ${startupError.message || 'N/A'}`);
        console.error(`    Details: ${startupError.details || 'N/A'}`);
        console.error(`    Hint: ${startupError.hint || 'N/A'}`);
        throw startupError;
      }

      // Store embedding in Pinecone (only if we have an embedding)
      if (embedding.length > 0 && pineconeIndex) {
        console.log('  Storing embedding in Pinecone...');
        try {
          await storeEmbeddingInPinecone(pineconeId, embedding, {
            name: startup.Company_Name,
            industry: startup.industry || '',
            description: description,
            keywords: keywords,
            business_type: startup.business_type || '',
            location: startup.location || '',
            funding_stage: startup.funding_stage || '',
            funding_amount: startup.amount_raised || '',
            website: startup.website || '',
          });
          console.log('  ✓ Embedding stored in Pinecone');
        } catch (pineconeError) {
          console.warn(`  ⚠️  Failed to store embedding in Pinecone: ${pineconeError instanceof Error ? pineconeError.message : String(pineconeError)}`);
          // Continue even if Pinecone fails - Supabase insert is more important
        }
      } else if (embedding.length === 0) {
        console.warn('  ⚠️  No embedding to store (empty array)');
      } else if (!pineconeIndex) {
        console.warn('  ⚠️  Pinecone index not available, skipping embedding storage');
      }

      successCount++;
      console.log(`  ✓ Successfully processed ${startup.Company_Name}\n`);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      errorCount++;
      // Better error logging to see actual error details
      let errorMessage = 'Unknown error';
      let errorDetails = '';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = error.stack || '';
      } else if (typeof error === 'object' && error !== null) {
        // Handle Supabase errors which are objects
        const errorObj = error as any;
        errorMessage = errorObj.message || errorObj.error || JSON.stringify(errorObj);
        if (errorObj.code) {
          errorDetails = `Code: ${errorObj.code}`;
        }
        if (errorObj.details) {
          errorDetails += ` | Details: ${errorObj.details}`;
        }
        if (errorObj.hint) {
          errorDetails += ` | Hint: ${errorObj.hint}`;
        }
      } else {
        errorMessage = String(error);
      }
      
      console.error(`  ✗ Error processing ${startup.Company_Name}:`);
      console.error(`    Error: ${errorMessage}`);
      if (errorDetails) {
        console.error(`    ${errorDetails}`);
      }
      console.error('');
    }
  }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n=== Scraping and Ingestion Complete ===`);
    console.log(`Total scraped: ${allStartups.length}`);
    console.log(`Successfully ingested: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`⏱️  Execution time: ${duration}s`);
    console.log(`⏰ Run completed at: ${new Date().toISOString()}\n`);
  } finally {
    isScraping = false;
  }
}

// Run the scraper
if (require.main === module) {
  scrapeAndIngestTechCrunch()
    .then(() => {
      console.log('\n✅ Process completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Process failed:', error);
      process.exit(1);
    });
}

export { scrapeAndIngestTechCrunch };

