import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

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
  funding_stage: string;
  amount_raised: string;
  date_raised: string;
  techcrunch_article_link?: string;
  techcrunch_article_content?: string;
}

// Categories to scrape
const STARTUP_CATEGORIES = [
  'startups',
  'venture',
  'fintech',
  'artificial-intelligence',
  'apps',
  'hardware',
  'security',
  'cryptocurrency',
  'transportation',
  'media-entertainment'
];

const STARTUP_TAGS = [
  'startup',
  'funding',
  'seed',
  'series-a',
  'series-b',
  'unicorn',
  'y-combinator',
  'yc',
  'venture-capital',
  'vc'
];

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
async function generateEmbedding(text: string): Promise<number[]> {
  if (!genAI) {
    return [];
  }

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
    console.warn(`Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
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
 * Extract funding stage
 */
function extractFundingStage(text: string): string {
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
  
  return 'Seed';
}

/**
 * Extract date
 */
function extractDate(article: TechCrunchArticle): string {
  if (article.date) {
    return article.date;
  }
  
  const content = article.content || article.description || '';
  const datePatterns = [
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i,
    /\b\d{1,2}\/(\d{1,2})\/\d{4}\b/,
    /\b\d{4}-\d{2}-\d{2}\b/,
  ];

  for (const pattern of datePatterns) {
    const match = content.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
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
 * Extract business type
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
  
  return 'B2B';
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
 * Parse article to startup data
 */
function parseArticleToStartup(article: TechCrunchArticle): StartupData | null {
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

  return {
    Company_Name: companyName,
    company_description: article.description || article.title || '',
    business_type: businessType,
    industry: industry,
    location: location,
    website: website,
    funding_stage: fundingStage,
    amount_raised: fundingAmount || '$1.5M',
    date_raised: dateRaised,
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
 * Scrape TechCrunch category page using Puppeteer
 */
async function scrapeCategoryPage(page: Page, category: string): Promise<TechCrunchArticle[]> {
  const url = `https://techcrunch.com/category/${category}/`;
  
  try {
    console.log(`   Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for articles to load
    await page.waitForSelector('article, .post-block, .river-block', { timeout: 10000 }).catch(() => {});
    
    // Extract article links and basic info
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
          
          results.push({
            title: titleEl?.textContent?.trim() || '',
            link: fullUrl,
            description: descEl?.textContent?.trim() || '',
            date: dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '',
          });
        }
      });
      
      return results;
    });
    
    console.log(`   Found ${articles.length} articles on category page`);
    return articles;
  } catch (error) {
    console.error(`   Error scraping category page ${category}:`, error);
    return [];
  }
}

/**
 * Scrape individual article page to get full content
 */
async function scrapeArticlePage(page: Page, articleLink: string): Promise<TechCrunchArticle | null> {
  try {
    await page.goto(articleLink, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for article content
    await page.waitForSelector('article, .article-content, .entry-content', { timeout: 10000 }).catch(() => {});
    
    const articleData = await page.evaluate(() => {
      const titleEl = document.querySelector('h1, .article-title, .entry-title');
      const contentEl = document.querySelector('article .article-content, .entry-content, article p');
      const authorEl = document.querySelector('.author, [rel="author"], .byline');
      const dateEl = document.querySelector('time[datetime], .article-date, .published-date');
      
      // Get all paragraph text for content
      const paragraphs = Array.from(document.querySelectorAll('article p, .article-content p, .entry-content p'))
        .map(p => p.textContent?.trim())
        .filter(Boolean)
        .join('\n\n');
      
      return {
        title: titleEl?.textContent?.trim() || '',
        link: window.location.href,
        description: paragraphs.substring(0, 500) || '',
        content: paragraphs || '',
        author: authorEl?.textContent?.trim() || '',
        date: dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '',
      };
    });
    
    return articleData;
  } catch (error) {
    console.warn(`   Could not scrape article ${articleLink}:`, error);
    return null;
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
          
          results.push({
            title: titleEl?.textContent?.trim() || '',
            link: fullUrl,
            description: descEl?.textContent?.trim() || '',
            date: dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '',
          });
        }
      });
      
      return results;
    });
    
    console.log(`   Found ${articles.length} articles on tag page`);
    return articles;
  } catch (error) {
    console.error(`   Error scraping tag page ${tag}:`, error);
    return [];
  }
}

/**
 * Main scraping and ingestion function
 */
async function scrapeAndIngestTechCrunch() {
  console.log('🚀 Starting TechCrunch scraping with Supabase + Pinecone...\n');

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
    // Scrape by categories
    console.log('📂 Scraping by categories...');
    for (const category of STARTUP_CATEGORIES) {
      try {
        const articles = await scrapeCategoryPage(page, category);
        
        // Process each article
        for (const article of articles) {
          // Skip if we've already seen this article
          if (seenArticleLinks.has(article.link || '')) {
            continue;
          }
          seenArticleLinks.add(article.link || '');
          
          try {
            // Scrape full article content
            if (article.link) {
              console.log(`   📄 Scraping article: ${article.title?.substring(0, 50)}...`);
              const fullArticle = await scrapeArticlePage(page, article.link);
              
              if (fullArticle) {
                // Merge with basic info
                const mergedArticle = {
                  ...article,
                  ...fullArticle,
                  content: fullArticle.content || article.description || '',
                };
                
                const normalizedArticle = normalizeArticle(mergedArticle);
                const startup = parseArticleToStartup(normalizedArticle);
                
                if (startup && !seenCompanies.has(startup.Company_Name.toLowerCase())) {
                  seenCompanies.add(startup.Company_Name.toLowerCase());
                  allStartups.push(startup);
                  console.log(`   ✅ Extracted: ${startup.Company_Name}`);
                }
              }
              
              // Rate limiting - wait between articles
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (err) {
            console.warn(`   ⚠️  Error processing article: ${err instanceof Error ? err.message : String(err)}`);
            continue;
          }
        }
        
        // Wait between categories
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`   ❌ Error scraping category ${category}:`, error);
      }
    }

    // Scrape by tags
    console.log('\n🏷️  Scraping by tags...');
    for (const tag of STARTUP_TAGS) {
      try {
        const articles = await scrapeTagPage(page, tag);
        
        // Process each article
        for (const article of articles) {
          // Skip if we've already seen this article
          if (seenArticleLinks.has(article.link || '')) {
            continue;
          }
          seenArticleLinks.add(article.link || '');
          
          try {
            // Scrape full article content
            if (article.link) {
              console.log(`   📄 Scraping article: ${article.title?.substring(0, 50)}...`);
              const fullArticle = await scrapeArticlePage(page, article.link);
              
              if (fullArticle) {
                // Merge with basic info
                const mergedArticle = {
                  ...article,
                  ...fullArticle,
                  content: fullArticle.content || article.description || '',
                };
                
                const normalizedArticle = normalizeArticle(mergedArticle);
                const startup = parseArticleToStartup(normalizedArticle);
                
                if (startup && !seenCompanies.has(startup.Company_Name.toLowerCase())) {
                  seenCompanies.add(startup.Company_Name.toLowerCase());
                  allStartups.push(startup);
                  console.log(`   ✅ Extracted: ${startup.Company_Name}`);
                }
              }
              
              // Rate limiting - wait between articles
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (err) {
            console.warn(`   ⚠️  Error processing article: ${err instanceof Error ? err.message : String(err)}`);
            continue;
          }
        }
        
        // Wait between tags
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`   ❌ Error scraping tag ${tag}:`, error);
      }
    }
  } finally {
    // Close browser
    await browser.close();
    console.log('🌐 Browser closed');
  }

  console.log(`\n💾 Ingesting ${allStartups.length} startups into Supabase + Pinecone...\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < allStartups.length; i++) {
    const startup = allStartups[i];
    
    try {
      console.log(`[${i + 1}/${allStartups.length}] Processing: ${startup.Company_Name}`);

      // Generate embedding
      const description = startup.company_description || '';
      const tags = startup.business_type && startup.industry 
        ? `${startup.business_type}, ${startup.industry}` 
        : startup.business_type || startup.industry || '';
      const embeddingText = `${description}\nTags: ${tags}`;

      console.log('  Generating embedding...');
      const embedding = await generateEmbedding(embeddingText);

      // Create startup in Supabase (all data in one table)
      console.log('  Creating startup in Supabase...');
      const pineconeId = `startup-${startup.Company_Name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      
      // Combine business_type and industry into keywords
      const keywords = [startup.business_type, startup.industry].filter(Boolean).join(', ');
      
      // For TechCrunch scraping, we don't have founder info, so leave empty
      // These can be populated later from other sources
      const founderNames = '';
      const founderEmails = '';
      const founderLinkedin = '';
      const jobOpenings = ''; // Can be populated from other sources
      
      const { data: startupData, error: startupError } = await supabase
        .from('startups')
        .insert({
          name: startup.Company_Name,
          funding_amount: startup.amount_raised || null,
          job_openings: jobOpenings || null,
          round_type: startup.funding_stage || null,
          date: startup.date_raised || null,
          location: startup.location || null,
          website: startup.website || null,
          founder_linkedin: founderLinkedin || null,
          industry: startup.industry || null,
          founder_names: founderNames || null,
          founder_emails: founderEmails || null,
          keywords: keywords || null,
          description: description, // Keep for embeddings
          pinecone_id: pineconeId,
          techcrunch_article_link: startup.techcrunch_article_link || null,
          techcrunch_article_content: startup.techcrunch_article_content || null,
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
        throw startupError;
      }

      // Store embedding in Pinecone
      if (embedding.length > 0 && pineconeIndex) {
        console.log('  Storing embedding in Pinecone...');
        await storeEmbeddingInPinecone(pineconeId, embedding, {
          name: startup.Company_Name,
          industry: startup.industry || '',
          description: description,
          keywords: keywords,
        });
      }

      successCount++;
      console.log(`  ✓ Successfully processed ${startup.Company_Name}\n`);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      errorCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ Error processing ${startup.Company_Name}:`);
      console.error(`    Error: ${errorMessage}\n`);
    }
  }

  console.log(`\n=== Scraping and Ingestion Complete ===`);
  console.log(`Total scraped: ${allStartups.length}`);
  console.log(`Successfully ingested: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
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

