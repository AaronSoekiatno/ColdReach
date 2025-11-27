import { getByCategory, getByTag } from 'techcrunch-api';
import * as fs from 'fs';
import * as path from 'path';

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
  YC_Link: string;
  Company_Logo: string;
  Company_Name: string;
  company_description: string;
  '': string;
  Batch: string;
  business_type: string;
  industry: string;
  location: string;
  founder_first_name: string;
  founder_last_name: string;
  founder_email: string;
  founder_linkedin: string;
  website: string;
  job_openings: string;
  funding_stage: string;
  amount_raised: string;
  date_raised: string;
  data_quality: string;
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

/**
 * Extract company name from article title or content
 */
function extractCompanyName(article: TechCrunchArticle): string | null {
  const title = article.title || '';
  const content = article.content || article.description || '';
  const fullText = `${title} ${content}`;

  // Common patterns for company names in TechCrunch articles
  // Look for patterns like "Company X raises", "Company X secures", etc.
  const patterns = [
    // "Company raises $X"
    /([A-Z][a-zA-Z0-9\s&.-]{2,40}?)\s+(?:raises|secures|closes|announces|launches|gets|receives)\s+(?:\$|\d)/i,
    // "Company has raised"
    /([A-Z][a-zA-Z0-9\s&.-]{2,40}?)\s+has\s+(?:raised|secured|closed|announced|launched)/i,
    // "Company raised $X"
    /([A-Z][a-zA-Z0-9\s&.-]{2,40}?)\s+(?:raised|secured|closed)\s+\$/i,
    // "Company is a startup"
    /([A-Z][a-zA-Z0-9\s&.-]{2,40}?)\s+(?:is|was)\s+(?:a|an)\s+(?:startup|company|platform|service)/i,
    // "Startup Company X"
    /(?:startup|company|platform)\s+([A-Z][a-zA-Z0-9\s&.-]{2,40}?)(?:\s|$|,|\.)/i,
    // "Company, a startup"
    /([A-Z][a-zA-Z0-9\s&.-]{2,40}?),\s+(?:a|an)\s+(?:startup|company|platform)/i,
  ];

  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      let name = match[1].trim();
      
      // Clean up the name
      name = name.replace(/^(the|a|an)\s+/i, ''); // Remove leading articles
      name = name.replace(/\s+(the|a|an)$/i, ''); // Remove trailing articles
      name = name.replace(/[.,;:!?]+$/, ''); // Remove trailing punctuation
      
      // Filter out common false positives
      const falsePositives = ['The', 'A', 'An', 'This', 'That', 'Startup', 'Company', 'Platform'];
      if (!falsePositives.includes(name) && name.length > 2 && name.length < 50) {
        // Check if it looks like a company name (has at least one capital letter)
        if (/[A-Z]/.test(name)) {
          return name;
        }
      }
    }
  }

  // Fallback: try to extract from title (first few words before common keywords)
  const titleMatch = title.match(/^([A-Z][a-zA-Z0-9\s&.-]{2,40}?)(?:\s+(?:raises|secures|closes|announces|launches|gets|receives|is|was|has|raised|secured|closed))/i);
  if (titleMatch && titleMatch[1]) {
    const name = titleMatch[1].trim();
    if (name.length > 2 && name.length < 50) {
      return name;
    }
  }

  // Another fallback: look for quoted company names
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
  // Patterns for funding amounts: $10M, $10 million, 10M, etc.
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
      const unit = match[0].toLowerCase().includes('billion') || match[0].toLowerCase().includes('B') ? 'B' : 
                   match[0].toLowerCase().includes('million') || match[0].toLowerCase().includes('M') ? 'M' : 
                   match[0].toLowerCase().includes('k') || match[0].toLowerCase().includes('K') ? 'K' : 'M';
      
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
  
  return 'Seed'; // Default
}

/**
 * Extract date from article
 */
function extractDate(article: TechCrunchArticle): string {
  if (article.date) {
    return article.date;
  }
  
  // Try to extract from content
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
  // Common startup locations
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

  // Try to extract city, state pattern
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
  
  return 'B2B'; // Default
}

/**
 * Extract website from article content or generate from company name
 */
function extractWebsite(companyName: string, text: string): string {
  // Try to find website in content
  const urlPattern = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+)/g;
  const matches = text.matchAll(urlPattern);
  
  for (const match of matches) {
    const domain = match[1];
    // Filter out common non-company domains
    if (!['techcrunch.com', 'twitter.com', 'linkedin.com', 'facebook.com', 'youtube.com'].includes(domain)) {
      return domain;
    }
  }

  // Generate from company name
  const domain = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '');
  
  return `${domain}.com`;
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
    YC_Link: '',
    Company_Logo: '',
    Company_Name: companyName,
    company_description: article.description || article.title || '',
    '': '',
    Batch: '',
    business_type: businessType,
    industry: industry,
    location: location,
    founder_first_name: 'Team',
    founder_last_name: '',
    founder_email: `hello@${website}`,
    founder_linkedin: '',
    website: website,
    job_openings: 'Software Engineering Intern, Product Intern',
    funding_stage: fundingStage,
    amount_raised: fundingAmount || '$1.5M',
    date_raised: dateRaised,
    data_quality: '📰 TECHCRUNCH'
  };
}

/**
 * Normalize article data from API response
 */
function normalizeArticle(article: any): TechCrunchArticle {
  // Handle different possible response formats
  if (typeof article === 'string') {
    return { title: article, description: article };
  }
  
  if (Array.isArray(article)) {
    // If it's an array, take the first item or combine
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
 * Main scraping function
 */
async function scrapeTechCrunch() {
  console.log('🚀 Starting TechCrunch scraping...\n');
  
  const allStartups: StartupData[] = [];
  const seenCompanies = new Set<string>();

  // Scrape by categories
  console.log('📂 Scraping by categories...');
  for (const category of STARTUP_CATEGORIES) {
    try {
      console.log(`   Fetching articles from category: ${category}...`);
      const response = await getByCategory(category);
      
      // Handle different response formats
      let articles: any[] = [];
      if (Array.isArray(response)) {
        articles = response;
      } else if (response && typeof response === 'object') {
        // Check if response has a data or articles property
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
          // Skip articles that can't be parsed
          continue;
        }
      }
      
      // Add delay to avoid rate limiting
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
      
      // Handle different response formats
      let articles: any[] = [];
      if (Array.isArray(response)) {
        articles = response;
      } else if (response && typeof response === 'object') {
        // Check if response has a data or articles property
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
          // Skip articles that can't be parsed
          continue;
        }
      }
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`   ❌ Error scraping tag ${tag}:`, error);
    }
  }

  // Save results
  console.log(`\n💾 Saving ${allStartups.length} startups...`);
  
  const outputDir = path.join(__dirname);
  const jsonPath = path.join(outputDir, 'techcrunch_startups.json');
  const csvPath = path.join(outputDir, 'techcrunch_startups.csv');

  // Save JSON
  fs.writeFileSync(jsonPath, JSON.stringify(allStartups, null, 2), 'utf-8');
  console.log(`   ✅ Saved JSON: ${jsonPath}`);

  // Save CSV
  if (allStartups.length > 0) {
    const headers = Object.keys(allStartups[0]);
    const csvRows = [
      headers.join(','),
      ...allStartups.map(startup => 
        headers.map(header => {
          const value = startup[header as keyof StartupData] || '';
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ];
    
    fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf-8');
    console.log(`   ✅ Saved CSV: ${csvPath}`);
  }

  console.log(`\n✅ Scraping complete! Found ${allStartups.length} unique startups.`);
  console.log(`\n📊 Summary:`);
  console.log(`   - Total startups: ${allStartups.length}`);
  console.log(`   - With funding info: ${allStartups.filter(s => s.amount_raised !== '$1.5M').length}`);
  console.log(`   - With location: ${allStartups.filter(s => s.location).length}`);
  console.log(`   - With industry: ${allStartups.filter(s => s.industry).length}`);
}

// Run the scraper
scrapeTechCrunch().catch(console.error);

