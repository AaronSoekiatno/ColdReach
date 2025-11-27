import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { getByCategory, getByTag } from 'techcrunch-api';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { HelixDB } from 'helix-ts';

// Types matching your existing schema
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
}

// Categories to scrape for startup data
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

// Tags that might contain startup information
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

// Initialize Gemini client for embeddings
const genAI = process.env.GEMINI_API_KEY 
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

/**
 * Generates an embedding for text using Gemini
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
 * Extract company name from article title or content
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
 * Extract funding amount from article content
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
 * Extract funding stage from article content
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
 * Extract date from article
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
 * Extract location from article content
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
 * Extract industry from article content
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
 * Extract business type from article content
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
 * Extract website from article content or generate from company name
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
 * Creates tags from business_type and industry
 */
function createTags(businessType: string, industry: string): string {
  const tags: string[] = [];
  if (businessType) tags.push(businessType);
  if (industry) {
    const industries = industry.split(',').map(i => i.trim()).filter(Boolean);
    tags.push(...industries);
  }
  return tags.join(', ');
}

/**
 * Generates a unique funding round ID
 */
function generateFundingRoundId(startupName: string, dateRaised: string): string {
  return `${startupName.toLowerCase().replace(/\s+/g, '-')}-${dateRaised.toLowerCase().replace(/\s+/g, '-')}`;
}

/**
 * Parse article and extract startup data
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
  };
}

/**
 * Wrapper function to handle HelixDB query errors
 */
async function safeQuery(helixUrl: string, helixApiKey: string | null, queryName: string, params: any) {
  try {
    const response = await fetch(`${helixUrl}/${queryName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(helixApiKey ? { 'x-api-key': helixApiKey } : {}),
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HelixDB query "${queryName}" failed with status ${response.status}: ${errorText.substring(0, 200)}`
      );
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error(
        `HelixDB returned non-JSON response for query "${queryName}". ` +
        `Content-Type: ${contentType}, Response: ${text.substring(0, 200)}`
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.message.includes('HelixDB')) {
      throw error;
    }
    throw new Error(`Failed to execute HelixDB query "${queryName}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Main scraping and ingestion function
 */
async function scrapeAndIngestTechCrunch() {
  console.log('🚀 Starting TechCrunch scraping and ingestion...\n');

  // Check for HelixDB configuration
  const helixUrl = process.env.HELIX_URL || 'http://localhost:6969';
  const helixApiKey = process.env.HELIX_API_KEY || null;

  console.log(`Connecting to HelixDB at ${helixUrl}...`);
  try {
    const testResponse = await fetch(helixUrl);
    console.log(`✓ HelixDB is accessible\n`);
  } catch (error) {
    throw new Error(
      `Cannot connect to HelixDB at ${helixUrl}. ` +
      `Make sure HelixDB is running. Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const allStartups: StartupData[] = [];
  const seenCompanies = new Set<string>();

  // Scrape by categories
  console.log('📂 Scraping by categories...');
  for (const category of STARTUP_CATEGORIES) {
    try {
      console.log(`   Fetching articles from category: ${category}...`);
      const response = await getByCategory(category);
      
      let articles: any[] = [];
      if (Array.isArray(response)) {
        articles = response;
      } else if (response && typeof response === 'object') {
        articles = (response as any).data || (response as any).articles || [response];
      }
      
      console.log(`   Found ${articles.length} articles in ${category}`);
      
      for (const article of articles) {
        try {
          const normalizedArticle = normalizeArticle(article);
          const startup = parseArticleToStartup(normalizedArticle);
          if (startup && !seenCompanies.has(startup.Company_Name.toLowerCase())) {
            seenCompanies.add(startup.Company_Name.toLowerCase());
            allStartups.push(startup);
            console.log(`   ✅ Extracted: ${startup.Company_Name}`);
          }
        } catch (err) {
          continue;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`   ❌ Error scraping category ${category}:`, error);
    }
  }

  // Scrape by tags
  console.log('\n🏷️  Scraping by tags...');
  for (const tag of STARTUP_TAGS) {
    try {
      console.log(`   Fetching articles with tag: ${tag}...`);
      const response = await getByTag(tag);
      
      let articles: any[] = [];
      if (Array.isArray(response)) {
        articles = response;
      } else if (response && typeof response === 'object') {
        articles = (response as any).data || (response as any).articles || [response];
      }
      
      console.log(`   Found ${articles.length} articles with tag ${tag}`);
      
      for (const article of articles) {
        try {
          const normalizedArticle = normalizeArticle(article);
          const startup = parseArticleToStartup(normalizedArticle);
          if (startup && !seenCompanies.has(startup.Company_Name.toLowerCase())) {
            seenCompanies.add(startup.Company_Name.toLowerCase());
            allStartups.push(startup);
            console.log(`   ✅ Extracted: ${startup.Company_Name}`);
          }
        } catch (err) {
          continue;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`   ❌ Error scraping tag ${tag}:`, error);
    }
  }

  console.log(`\n💾 Ingesting ${allStartups.length} startups into HelixDB...\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < allStartups.length; i++) {
    const startup = allStartups[i];
    
    try {
      console.log(`[${i + 1}/${allStartups.length}] Processing: ${startup.Company_Name}`);

      // Prepare data
      const description = startup.company_description || '';
      const tags = createTags(startup.business_type || '', startup.industry || '');
      const embeddingText = `${description}\nTags: ${tags}`;

      // Generate embedding
      console.log('  Generating embedding...');
      const embedding = await generateEmbedding(embeddingText);

      // Create startup node
      console.log('  Creating startup node...');
      try {
        const startupResult = await safeQuery(helixUrl, helixApiKey, 'AddStartup', {
          name: startup.Company_Name,
          industry: startup.industry || '',
          description: description,
          funding_stage: startup.funding_stage || '',
          funding_amount: startup.amount_raised || '',
          location: startup.location || '',
          website: startup.website || '',
          tags: tags,
          embedding: embedding,
        });
        
        if (!startupResult) {
          throw new Error(`Failed to create startup node - no result returned`);
        }
      } catch (queryError) {
        const errorMessage = queryError instanceof Error ? queryError.message : String(queryError);
        if (errorMessage.includes('already exists') || errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
          console.log('  Startup already exists, skipping...');
          continue;
        } else {
          throw queryError;
        }
      }

      // Create funding round node
      if (startup.funding_stage && startup.date_raised) {
        console.log('  Creating funding round node...');
        
        const fundingRoundId = generateFundingRoundId(startup.Company_Name, startup.date_raised);
        
        try {
          const fundingRoundResult = await safeQuery(helixUrl, helixApiKey, 'AddFundingRound', {
            round_id: fundingRoundId,
            stage: startup.funding_stage,
            amount: startup.amount_raised || '',
            date_raised: startup.date_raised,
            batch: '',
          });
          
          if (fundingRoundResult) {
            console.log('  Connecting startup to funding round...');
            await safeQuery(helixUrl, helixApiKey, 'ConnectStartupToFundingRound', {
              startup_name: startup.Company_Name,
              funding_round_id: fundingRoundId,
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('404') || errorMessage.includes('Couldn\'t find')) {
            console.warn(`  Skipping funding round (query not deployed): ${errorMessage.substring(0, 100)}`);
          } else {
            console.error(`  Error processing funding round: ${errorMessage}`);
          }
        }
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

