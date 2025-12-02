import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { randomUUID } from 'crypto';
import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as csv from 'csv-parse/sync';

// Types
interface YCCompany {
  YC_Link?: string;
  YC_link?: string; // Alternative column name
  Company_Logo?: string;
  Company_Name: string;
  company_description: string;
  Batch: string;
  business_type?: string;
  industry?: string;
  Industry?: string; // Alternative column name
  'Sub-Industry'?: string;
  location?: string;
  Location?: string; // Alternative column name
}

interface YCPageData {
  founders: Array<{
    firstName: string;
    lastName: string;
    linkedIn: string;
    description?: string; // Founder bio/description
  }>;
  website: string;
  teamSize: string;
  jobPostings: Array<{
    title: string;
    description: string;
    location?: string; // Job location
  }>;
  location: string;
  oneLineSummary: string;
  fundingAmount?: string; // Funding amount (e.g., "US$ 500.0K", "$20M")
  roundType?: string; // Funding round type (e.g., "Pre seed", "Seed", "Series A")
  fundingDate?: string; // Funding date (e.g., "Oct 9, 2025", "2025-10-09")
  linkedInCompanyUrl?: string | null; // Constructed LinkedIn URL for future enrichment
}

interface EnrichedYCData extends YCCompany {
  founder_first_name: string;
  founder_last_name: string;
  founder_linkedin: string;
  website: string;
  team_size: string;
  job_openings: string;
  hiring_roles: string;
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

/**
 * Normalize company data to handle both CSV formats
 */
function normalizeCompanyData(company: YCCompany): {
  ycLink: string;
  companyLogo: string;
  companyName: string;
  description: string;
  batch: string;
  businessType: string;
  industry: string;
  location: string;
} {
  return {
    ycLink: company.YC_Link || company.YC_link || '',
    companyLogo: company.Company_Logo || '',
    companyName: company.Company_Name || '',
    description: company.company_description || '',
    batch: company.Batch || '',
    businessType: company.business_type || '',
    industry: company.industry || company.Industry || company['Sub-Industry'] || '',
    location: company.location || company.Location || '',
  };
}

/**
 * Extract company slug from YC URL
 */
function extractCompanySlug(ycLink: string): string | null {
  const match = ycLink.match(/\/companies\/([^/?]+)/);
  return match ? match[1] : null;
}

/**
 * Load companies from CSV file
 */
function loadCompaniesFromCSV(csvPath: string): YCCompany[] {
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const records = csv.parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });
  return records as YCCompany[];
}

/**
 * Get all CSV files from yc_companies directory
 */
function getAllYCCsvFiles(): string[] {
  // Check if we're already in yc_companies directory or if we need to navigate to it
  const currentDir = process.cwd();
  const ycDir = currentDir.endsWith('yc_companies') ? currentDir : resolve(currentDir, 'yc_companies');

  const files = fs.readdirSync(ycDir);
  return files
    .filter(file => (file.startsWith('ycombinator') || file.toLowerCase().includes('yc')) && file.endsWith('.csv'))
    .map(file => resolve(ycDir, file))
    .sort(); // Sort for consistent ordering
}

/**
 * Construct LinkedIn company URL from website domain
 * NOTE: We store this URL for future enrichment via APIs, but don't scrape it directly
 */
function constructLinkedInCompanyUrl(website: string): string | null {
  if (!website) return null;

  try {
    const url = new URL(website);
    const hostname = url.hostname.replace('www.', '');
    const domainParts = hostname.split('.');
    const domain = domainParts[0];

    // LinkedIn company URL format: linkedin.com/company/{company-slug}/
    const linkedInUrl = `https://www.linkedin.com/company/${domain.toLowerCase()}`;
    console.log(`   🔗 Constructed LinkedIn URL: ${linkedInUrl}`);
    return linkedInUrl;
  } catch (error) {
    return null;
  }
}

/**
 * Scrape YC company page for founder, job, and company data
 * Enhanced with better selectors, founder descriptions, and jobs page scraping
 */
async function scrapeYCCompanyPage(page: Page, ycUrl: string): Promise<YCPageData | null> {
  try {
    console.log(`   Navigating to: ${ycUrl}`);
    
    // Check if page is still attached
    if (page.isClosed()) {
      throw new Error('Page is closed');
    }
    
    // Navigate with better error handling and retry logic
    let navigationSuccess = false;
    let navError: any = null;
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // Check if page is still attached before navigation
        if (page.isClosed()) {
          throw new Error('Page was closed before navigation');
        }
        
        await page.goto(ycUrl, { 
          waitUntil: attempt === 0 ? 'networkidle2' : 'domcontentloaded', 
          timeout: 30000 
        });
        
        // Wait a bit after navigation to ensure stability
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        navigationSuccess = true;
        break;
      } catch (error: any) {
        navError = error;
        const errorMsg = error?.message || String(error);
        
        // If it's a detached frame error, wait and try again
        if (errorMsg.includes('detached') || errorMsg.includes('Target closed')) {
          console.warn(`   ⚠️  Detached frame error (attempt ${attempt + 1}/3), retrying...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        // For other errors, try with domcontentloaded on next attempt
        if (attempt < 2) {
          console.warn(`   ⚠️  Navigation error (attempt ${attempt + 1}/3): ${errorMsg}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      }
    }
    
    if (!navigationSuccess) {
      console.error(`   ❌ Failed to load page after 3 attempts: ${navError instanceof Error ? navError.message : String(navError)}`);
      return null;
    }

    // Wait for content to load
    try {
      await page.waitForSelector('body', { timeout: 10000 });
    } catch (error) {
      console.warn(`   ⚠️  Body selector timeout, continuing anyway...`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Scroll to trigger lazy-loaded content
    try {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (scrollError) {
      console.warn(`   ⚠️  Scroll error (non-critical): ${scrollError instanceof Error ? scrollError.message : String(scrollError)}`);
    }

    // Check if page loaded correctly
    const pageTitle = await page.title();
    console.log(`   Page title: ${pageTitle}`);
    
    // Check for common error pages
    const isErrorPage = await page.evaluate(() => {
      const bodyText = document.body.textContent?.toLowerCase() || '';
      return bodyText.includes('404') || 
             bodyText.includes('not found') || 
             bodyText.includes('page not found') ||
             bodyText.includes('access denied');
    });
    
    if (isErrorPage) {
      console.error(`   ❌ Page appears to be an error page (404/not found)`);
      return null;
    }

    // Check if page is still attached before evaluation
    if (page.isClosed()) {
      throw new Error('Page was closed before evaluation');
    }

    const pageData = await page.evaluate(() => {
      try {
      const data: YCPageData = {
        founders: [],
        website: '',
        teamSize: '',
        jobPostings: [],
        location: '',
        oneLineSummary: '',
      };

      // ============================================
      // 1. EXTRACT FOUNDERS WITH DESCRIPTIONS
      // ============================================
      // Strategy: Multiple approaches with increasing complexity
      // 1. Simple text-based extraction (most reliable)
      // 2. CSS selector-based extraction
      // 3. Fallback text extraction
      
      // First, get the company name to filter it out
      const companyName = (document.querySelector('h1')?.textContent?.trim() || '').toLowerCase();
      
      // PRIORITY METHOD: Simple text-based extraction FIRST (before CSS selectors)
      // This is more reliable because it doesn't depend on CSS classes or HTML structure
      // Works whether "Active Founders" is in a heading, div, span, or any element
      const bodyText = document.body.textContent || '';
      const bodyLower = bodyText.toLowerCase();
      
      // Find "Active Founders" or "Founders" in the raw text (works for any element type)
      let simpleExtractionIndex = bodyLower.indexOf('active founders');
      if (simpleExtractionIndex < 0) {
        simpleExtractionIndex = bodyLower.indexOf('founders');
      }
      
      if (simpleExtractionIndex >= 0) {
        // Get text after "Active Founders" (works whether it's in a div, heading, or any element)
        const sectionText = bodyText.slice(simpleExtractionIndex);
        const lines = sectionText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        // Look through first 30 lines after "Active Founders" to find founder names
        for (let i = 1; i < Math.min(31, lines.length); i++) {
          const line = lines[i];
          
          // Skip if we hit another section
          if (line.match(/^(Company|Location|Jobs|Team|Status|Founded|Website|Batch):?$/i)) break;
          
          // Pattern: Line is exactly a name (First Last or First Middle Last)
          const namePattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+[A-Z][a-z]+)$/;
          const nameMatch = line.match(namePattern);
          
          if (nameMatch) {
            const fullName = nameMatch[1];
            const nameParts = fullName.split(/\s+/);
            
            // Must be 2-4 words
            if (nameParts.length >= 2 && nameParts.length <= 4) {
              // Skip if it's the company name
              if (fullName.toLowerCase() === companyName) continue;
              
              // Skip common words
              const skipWords = ['Active', 'Founders', 'Founder', 'Company', 'Location', 
                                'Team', 'Size', 'Jobs', 'Status', 'Founded', 'Website', 'Batch',
                                'San Francisco', 'New York', 'Remote', 'United States'];
              if (skipWords.some(word => fullName.toLowerCase().includes(word.toLowerCase()))) continue;
              
              // Get description from next line
              let description = '';
              if (i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                if (nextLine.length > 15 && nextLine.length < 500 &&
                    !nextLine.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+$/) && // Not another name
                    !nextLine.match(/^(Company|Location|Jobs):?$/i) && // Not a heading
                    (nextLine.includes('Building') || nextLine.includes('Prior') || 
                     nextLine.match(/\b(at|from|worked|led)\b/i))) {
                  description = nextLine;
                }
              }
              
              // Try to find LinkedIn link
              let linkedIn = '';
              const allLinkedInLinks = Array.from(document.querySelectorAll('a[href*="linkedin.com/in/"]'));
              
              // Find links that appear after the founders section
              const linkIndex = bodyText.indexOf('linkedin.com/in/');
              if (linkIndex > simpleExtractionIndex && linkIndex < simpleExtractionIndex + 3000) {
                for (const link of allLinkedInLinks) {
                  const linkHref = (link as HTMLAnchorElement).href;
                  const linkText = link.textContent || '';
                  const linkNearbyText = link.parentElement?.textContent || '';
                  
                  // If the link is near this name
                  if (linkNearbyText.toLowerCase().includes(fullName.toLowerCase().split(' ')[0]) ||
                      linkText.toLowerCase().includes(nameParts[0].toLowerCase())) {
                    linkedIn = linkHref;
                    break;
                  }
                }
              }
              
              const firstName = nameParts[0];
              const lastName = nameParts.slice(1).join(' ');
              
              // Add to founders (will deduplicate later)
              data.founders.push({
                firstName,
                lastName,
                linkedIn,
                description: description || undefined,
              });
            }
          }
        }
      }
      
      // If we already found founders with simple extraction, skip CSS-based extraction
      // Otherwise, continue with CSS selector-based approach below
      
      // Find "Active Founders" section - can be in ANY element (heading, div, span, etc.)
      let foundersHeading: Element | null = null;
      
      // Method 1: Search ALL elements for "Active Founders" text (not just headings!)
      const allElements = Array.from(document.querySelectorAll('*'));
      foundersHeading = allElements.find(el => {
        const text = el.textContent?.trim() || '';
        // Match if text is exactly "Active Founders" or contains it
        // This works for divs, spans, headings, or any element
        return text.toLowerCase() === 'active founders' ||
               text.toLowerCase().includes('active founders');
      }) || null;
      
      // Method 2: If not found, try just "Founders"
      if (!foundersHeading) {
        foundersHeading = allElements.find(el => {
          const text = el.textContent?.trim() || '';
          return text.toLowerCase() === 'founders';
        }) || null;
      }
      
      // Method 3: Look in headings as fallback
      if (!foundersHeading) {
      const allHeadings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        foundersHeading = allHeadings.find(h => {
        const text = h.textContent?.trim() || '';
        return text.toLowerCase().includes('active founders') || 
               text.toLowerCase() === 'founders';
        }) || null;
      }
      
      // Track seen founders to avoid duplicates
      const seenFounders = new Set<string>(); // Track by LinkedIn URL or full name
      
      // If we already found founders with simple extraction, mark them as seen for deduplication
      for (const founder of data.founders) {
        const key = founder.linkedIn || `${founder.firstName} ${founder.lastName}`.toLowerCase();
        seenFounders.add(key);
      }
      
      // Continue with CSS selector-based extraction (may find additional founders)
      // Final deduplication will handle duplicates

      // Find the container with founder cards
      let foundersContainer: Element | null = null;
      
      if (foundersHeading) {
        // Look for container with founder cards - typically a parent or sibling
        let current: Element | null = foundersHeading.parentElement;
        while (current && !foundersContainer) {
          // Check if this container has founder name elements
          const nameElements = current.querySelectorAll('.text-xl.font-bold, div[class*="text-xl"][class*="font-bold"]');
          if (nameElements.length > 0) {
            foundersContainer = current;
            break;
          }
          current = current.parentElement;
        }
      }
      
      // If no heading found, try to find founder cards directly
      if (!foundersContainer) {
        const nameElements = document.querySelectorAll('.text-xl.font-bold, div[class*="text-xl"][class*="font-bold"]');
        if (nameElements.length > 0) {
          // Find common parent of all name elements
          const parents = Array.from(nameElements).map(el => el.parentElement).filter(Boolean);
          if (parents.length > 0) {
            // Find the deepest common ancestor
            let commonParent = parents[0];
            for (let i = 1; i < parents.length && commonParent; i++) {
              while (commonParent && !commonParent.contains(parents[i] as Node)) {
                commonParent = commonParent.parentElement;
              }
            }
            foundersContainer = commonParent;
          }
        }
      }
      
      if (foundersContainer) {
        // Find all founder name elements in the container
        const nameElements = foundersContainer.querySelectorAll('.text-xl.font-bold, div[class*="text-xl"][class*="font-bold"]');
        
        nameElements.forEach(nameEl => {
          const fullName = nameEl.textContent?.trim() || '';
          
          if (!fullName || fullName.length < 3 || fullName.length > 100) return;
          
          // Skip if it's not a person's name (has numbers, special chars, etc.)
          if (!/^[A-Za-z\s\.\-\']+$/.test(fullName)) return;
          
          // Find the founder card container (parent that likely contains both name and description)
          let founderCard = nameEl.parentElement;
          let attempts = 0;
          while (founderCard && attempts < 5) {
            // Check if this container has a description element
            const descEl = founderCard.querySelector('.prose.max-w-full.whitespace-pre-line, div[class*="prose"][class*="max-w-full"]');
            if (descEl) {
              break; // Found the right container
            }
            founderCard = founderCard.parentElement;
            attempts++;
          }
          
          // If no card found, use the name element's parent
          if (!founderCard) {
            founderCard = nameEl.parentElement;
          }
          
          // Extract description/background
          // Use broader extraction when we're in Active Founders section - don't require "founder" keyword
          let description = '';
          
          // Try to find description in prose div
          const proseDiv = founderCard?.querySelector('.prose.max-w-full.whitespace-pre-line, div[class*="prose"][class*="max-w-full"]') as HTMLElement;
          if (proseDiv) {
            description = proseDiv.textContent?.trim() || '';
          }
          
          // Fallback: Try to find ForwardRef component with content attribute
          if (!description && founderCard) {
            // Look for elements that might have the description in a content attribute
            const forwardRef = founderCard.querySelector('[content]') as HTMLElement;
            if (forwardRef) {
              const contentAttr = forwardRef.getAttribute('content');
              if (contentAttr && contentAttr.length > 20) {
                description = contentAttr;
              }
            }
          }
          
          // Fallback: Look for paragraph text in the founder card
          if (!description && founderCard) {
            const paragraphs = founderCard.querySelectorAll('p');
            for (const p of Array.from(paragraphs)) {
              const pText = p.textContent?.trim() || '';
              // If we're in Active Founders section, be more lenient - accept any descriptive text
              const isInFoundersSection = foundersHeading && foundersContainer && foundersContainer.contains(nameEl);
              
              if (pText.length > 20 && pText.length < 1000) {
                // Check if it looks like a bio/description
                const looksLikeBio = pText.includes('Prior') || 
                                    pText.includes('studied') || 
                                    pText.includes('worked') || 
                                    pText.includes('led') ||
                                    pText.includes('Building') ||
                                    pText.includes('Previously') ||
                                    pText.includes('Experience') ||
                                    pText.match(/\b(at|from|co-founded|founded)\b/i);
                
                // If in Active Founders section, accept any descriptive text
                // Otherwise, require "founder" keyword or bio-like content
                if (isInFoundersSection && looksLikeBio) {
                  description = pText;
                  break;
                } else if (!isInFoundersSection && 
                          (pText.includes('Co-founder') || pText.includes('Founder') || looksLikeBio)) {
                description = pText;
                break;
                }
              }
            }
          }
          
          // Additional fallback: Search in parent containers if we're in Active Founders section
          if (!description && founderCard && foundersHeading && foundersContainer) {
            let searchContainer: Element | null = founderCard.parentElement;
            let searchAttempts = 0;
            
            while (!description && searchContainer && searchAttempts < 3) {
              const paragraphs = searchContainer.querySelectorAll('p');
              for (const p of Array.from(paragraphs)) {
                const pText = p.textContent?.trim() || '';
                // Accept any descriptive text near the founder name in Active Founders section
                if (pText.length > 20 && pText.length < 1000 && 
                    (pText.includes('Building') || pText.includes('Prior') || 
                     pText.includes('studied') || pText.match(/\b(at|from)\b/i))) {
                  description = pText;
                  break;
                }
              }
              searchContainer = searchContainer.parentElement;
              searchAttempts++;
            }
          }
          
          // Extract LinkedIn link - look for LinkedIn link near this founder card
          // Use broader search when we're in the Active Founders section
          let linkedIn = '';
          if (founderCard) {
            // First try in the founder card itself
            let linkedInLink = founderCard.querySelector('a[href*="linkedin.com"]') as HTMLAnchorElement;
            
            // If not found, search in parent containers (broader search)
            if (!linkedInLink && foundersHeading) {
              let searchContainer: Element | null = founderCard.parentElement;
              let searchAttempts = 0;
              while (!linkedInLink && searchContainer && searchAttempts < 5) {
                linkedInLink = searchContainer.querySelector('a[href*="linkedin.com"]') as HTMLAnchorElement;
                searchContainer = searchContainer.parentElement;
                searchAttempts++;
              }
            }
            
            // If still not found and we're in Active Founders section, search more broadly
            if (!linkedInLink && foundersHeading && foundersContainer) {
              // Look for LinkedIn links near this name element in the founders container
              const nameElementParent = nameEl.parentElement;
              if (nameElementParent) {
                // Search in siblings and nearby elements
                const allLinks = foundersContainer.querySelectorAll('a[href*="linkedin.com"]');
                if (allLinks.length > 0) {
                  // Find the closest LinkedIn link to this name element
                  let closestLink: HTMLAnchorElement | null = null;
                  let closestDistance = Infinity;
                  
                  allLinks.forEach(link => {
                    const linkEl = link as HTMLAnchorElement;
                    const namePos = Array.from(nameEl.parentElement?.children || []).indexOf(nameEl.parentElement || nameEl);
                    const linkPos = Array.from(linkEl.parentElement?.children || []).indexOf(linkEl);
                    const distance = Math.abs(linkPos - namePos);
                    
                    if (distance < closestDistance) {
                      closestDistance = distance;
                      closestLink = linkEl;
                    }
                  });
                  
                  if (closestLink && closestDistance < 10) {
                    linkedInLink = closestLink;
                  }
                }
              }
            }
            
            if (linkedInLink) {
              linkedIn = linkedInLink.href;
            }
          }
          
          // Skip if this is the company name
          if (fullName.toLowerCase() === companyName) return;
          
          // Skip if name is too short or looks like a company name (single word, all caps, etc.)
          if (fullName.split(/\s+/).length < 2) return;
          if (fullName === fullName.toUpperCase() && fullName.length > 10) return; // Likely company name
          
          // Check if we're in the Active Founders section
          // Use more lenient check - if we found the heading and this name element is anywhere after it, trust it
          let isInFoundersSection = false;
          if (foundersHeading && foundersContainer) {
            // Check if nameEl is a descendant of foundersContainer
            isInFoundersSection = foundersContainer.contains(nameEl);
            
            // Also check if nameEl comes after foundersHeading in the DOM (broader check)
            if (!isInFoundersSection) {
              const namePos = Array.from(document.querySelectorAll('*')).indexOf(nameEl as Element);
              const headingPos = Array.from(document.querySelectorAll('*')).indexOf(foundersHeading);
              isInFoundersSection = namePos > headingPos && namePos < headingPos + 50; // Within 50 elements after heading
            }
          }
          
          const hasFounderDescription = description && (
            description.toLowerCase().includes('founder') || 
            description.toLowerCase().includes('co-founder')
          );
          
          // If we're in the Active Founders section, trust it - don't require "founder" in description
          // This fixes cases like mlop where description doesn't mention "founder" but we're clearly in the right section
          if (!isInFoundersSection && !hasFounderDescription) return;
          
          // Split name into first and last
          const nameParts = fullName.trim().split(/\s+/);
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          
          // Create unique key for deduplication
          const founderKey = linkedIn || fullName.toLowerCase();
          
          // Skip if we've already seen this founder
          if (seenFounders.has(founderKey)) return;
          seenFounders.add(founderKey);
          
          // Only add if we have at least a first name
          if (firstName) {
            data.founders.push({
              firstName,
              lastName,
              linkedIn,
              description: description || undefined,
            });
          }
        });
      }
      
      // Enhanced Fallback 1: If we found Active Founders heading but no founders, use text-based extraction
      if (data.founders.length === 0 && foundersHeading) {
        // More aggressive text-based extraction - get all text after the heading
        let sectionText = '';
        let currentElement: Element | null = foundersHeading.nextElementSibling;
        
        // Collect text from the next several siblings
        for (let i = 0; i < 20 && currentElement; i++) {
          const text = currentElement.textContent?.trim() || '';
          if (text) {
            sectionText += ' ' + text;
          }
          currentElement = currentElement.nextElementSibling;
        }
        
        // Also try getting text from parent's children after the heading
        if (sectionText.length < 100 && foundersHeading.parentElement) {
          const parent = foundersHeading.parentElement;
          const headingIndex = Array.from(parent.children).indexOf(foundersHeading);
          const siblings = Array.from(parent.children).slice(headingIndex + 1, headingIndex + 10);
          
          for (const sibling of siblings) {
            const text = sibling.textContent?.trim() || '';
            if (text) {
              sectionText += ' ' + text;
            }
          }
        }
        
        // Extract all potential names using multiple patterns
        const namePatterns = [
          /\b([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,  // "First Last" or "First Middle Last"
          /^([A-Z][a-z]+\s+[A-Z][a-z]+)$/gm,  // Standalone names on lines
        ];
        
        const foundNames = new Set<string>();
        
        for (const pattern of namePatterns) {
          const matches = sectionText.match(pattern);
          if (matches) {
            matches.forEach(match => {
              const name = match.trim();
              if (name.length >= 3 && name.length <= 100) {
                foundNames.add(name);
              }
            });
          }
        }
        
        // Process each found name
        for (const potentialName of foundNames) {
          const nameParts = potentialName.split(/\s+/);
          
          // Validate it looks like a name
          if (nameParts.length >= 2 && nameParts.length <= 4) {
            // Skip if it's the company name
            if (potentialName.toLowerCase() === companyName) continue;
            
            // Skip common words/phrases
            const commonWords = ['Active', 'Founders', 'Founder', 'Company', 'Location', 'Team', 'Size', 
                                'San Francisco', 'New York', 'Remote', 'United States'];
            if (commonWords.some(word => potentialName.toLowerCase().includes(word.toLowerCase()))) continue;
            
            // Skip if it's all caps (likely not a name)
            if (potentialName === potentialName.toUpperCase() && potentialName.length > 10) continue;
            
            // Look for LinkedIn link anywhere after the heading
            let linkedIn = '';
            const allLinkedInLinks = Array.from(document.querySelectorAll('a[href*="linkedin.com/in/"]'));
            
            // Find LinkedIn links that appear after the Active Founders heading
            const headingIndex = Array.from(document.querySelectorAll('*')).indexOf(foundersHeading);
            for (const link of allLinkedInLinks) {
              const linkIndex = Array.from(document.querySelectorAll('*')).indexOf(link);
              if (linkIndex > headingIndex && linkIndex < headingIndex + 200) {
                // Check if this link might belong to this founder
                const linkContainer = link.closest('div, section, article');
                const linkText = linkContainer?.textContent || '';
                
                // If the name appears near this LinkedIn link, associate them
                if (linkText.toLowerCase().includes(potentialName.toLowerCase().split(' ')[0])) {
                  linkedIn = (link as HTMLAnchorElement).href;
                  break;
                }
              }
            }
            
            // Extract description - look for text after the name that looks like a bio
            let description = '';
            const lines = sectionText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(potentialName)) {
                // Look at lines after the name for description
                for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                  const line = lines[j];
                  if (line.length > 20 && line.length < 500 &&
                      line !== potentialName &&
                      !line.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+$/) && // Not another name
                      (line.includes('Building') || line.includes('Prior') || 
                       line.includes('studied') || line.match(/\b(at|from|worked|led)\b/i))) {
                    description = line;
                    break;
                  }
                }
                break;
              }
            }
            
            const founderKey = linkedIn || potentialName.toLowerCase();
            
            if (!seenFounders.has(founderKey)) {
              seenFounders.add(founderKey);
              data.founders.push({
                firstName: nameParts[0],
                lastName: nameParts.slice(1).join(' '),
                linkedIn,
                description: description || undefined,
              });
            }
          }
        }
      }
      
      // Ultra-Simple Fallback 2: Direct line-by-line text extraction
      if (data.founders.length === 0) {
        // Get all text on the page, split into lines
        const bodyText = document.body.textContent || '';
        const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        // Look for "Active Founders" or just "Founders" in the lines
        let foundersSectionStart = -1;
        for (let i = 0; i < lines.length; i++) {
          const lineLower = lines[i].toLowerCase();
          if (lineLower.includes('active founders') || lineLower === 'founders') {
            foundersSectionStart = i;
            break;
          }
        }
        
        if (foundersSectionStart >= 0) {
          // Look at lines after the heading (skip the heading line itself)
          const sectionLines = lines.slice(foundersSectionStart + 1, foundersSectionStart + 30);
          
          for (let i = 0; i < sectionLines.length; i++) {
            const line = sectionLines[i];
            
            // Stop if we hit another section heading
            if (line.match(/^(Company|Location|Jobs|Team|Status|Founded|Website|Batch):?$/i)) break;
            
            // Pattern: Line is exactly "First Last" or "First Middle Last" (2-4 capitalized words)
            // This matches lines that are standalone names
            const nameMatch = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+[A-Z][a-z]+)$/);
            
            if (nameMatch) {
              const potentialName = nameMatch[1];
              const nameParts = potentialName.split(/\s+/);
              
              // Must be 2-4 words
              if (nameParts.length >= 2 && nameParts.length <= 4) {
                // Skip if it's the company name
                if (potentialName.toLowerCase() === companyName) continue;
                
                // Skip common section headings/words
                const skipWords = ['Active', 'Founders', 'Founder', 'Company', 'Location', 
                                  'Team', 'Size', 'Jobs', 'Status', 'Founded', 'Website', 'Batch',
                                  'San Francisco', 'New York', 'Remote', 'United States'];
                const shouldSkip = skipWords.some(word => {
                  return potentialName.toLowerCase() === word.toLowerCase() ||
                         potentialName.toLowerCase().startsWith(word.toLowerCase() + ' ') ||
                         potentialName.toLowerCase().endsWith(' ' + word.toLowerCase());
                });
                
                if (shouldSkip) continue;
                
                // Extract description from next line if available
                let description = '';
                if (i + 1 < sectionLines.length) {
                  const nextLine = sectionLines[i + 1];
                  // If next line looks like a description (not another name, has descriptive words)
                  if (nextLine.length > 15 && nextLine.length < 500 &&
                      !nextLine.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+$/) && // Not another name
                      !nextLine.match(/^(Company|Location|Jobs|Team|Status):?$/i) && // Not a heading
                      (nextLine.includes('Building') || 
                       nextLine.includes('Prior') || 
                       nextLine.includes('studied') ||
                       nextLine.match(/\b(at|from|worked|led|co-founded|founded)\b/i))) {
                    description = nextLine;
                  }
                }
                
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(' ');
                const founderKey = potentialName.toLowerCase();
                
                if (!seenFounders.has(founderKey)) {
                  seenFounders.add(founderKey);
                  data.founders.push({
                    firstName,
                    lastName,
                    linkedIn: '',
                    description: description || undefined,
                  });
                }
              }
            }
          }
          
          // Try to associate LinkedIn links with found founders
          if (data.founders.length > 0) {
            const allLinkedInLinks = Array.from(document.querySelectorAll('a[href*="linkedin.com/in/"]'));
            
            for (const link of allLinkedInLinks) {
              const linkElement = link as HTMLAnchorElement;
              const linkHref = linkElement.href;
              
              // Skip navigation/footer links
              const parent = link.closest('nav, footer, header');
              if (parent) continue;
              
              // Get container text around the link
              const linkContainer = link.closest('div, section, article, p');
              const containerText = (linkContainer?.textContent || '').toLowerCase();
              
              // Try to match with a founder
              for (const founder of data.founders) {
                if (!founder.linkedIn && containerText.includes(founder.firstName.toLowerCase())) {
                  founder.linkedIn = linkHref;
                  break;
                }
              }
            }
          }
        }
      }
      
      // Ultra-Simple Fallback: Direct text extraction from page body
      if (data.founders.length === 0) {
        // Get all text from the page
        const bodyText = document.body.textContent || '';
        const bodyLower = bodyText.toLowerCase();
        
        // Find "Active Founders" in text
        const activeFoundersIndex = bodyLower.indexOf('active founders');
        const foundersIndex = activeFoundersIndex >= 0 ? activeFoundersIndex : bodyLower.indexOf('founders');
        
        if (foundersIndex >= 0) {
          // Get text after "Active Founders" or "Founders"
          const afterFounders = bodyText.slice(foundersIndex);
          const lines = afterFounders.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          
          // Look through first 30 lines after heading
          for (let i = 1; i < Math.min(31, lines.length); i++) {
            const line = lines[i];
            
            // Skip empty lines, common headings
            if (line.length < 3) continue;
            if (line.toLowerCase().includes('company') || 
                line.toLowerCase().includes('location') ||
                line.toLowerCase().includes('jobs')) break; // Stop if we hit another section
            
            // Pattern: Line contains just "First Last" (two capitalized words, possibly with middle name)
            const simpleNamePattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+[A-Z][a-z]+)$/;
            const nameMatch = line.match(simpleNamePattern);
            
            if (nameMatch) {
              const fullName = nameMatch[1];
              const nameParts = fullName.split(/\s+/);
              
              // Must be 2-4 words (First Last or First Middle Last)
              if (nameParts.length >= 2 && nameParts.length <= 4) {
                // Skip if company name
                if (fullName.toLowerCase() === companyName) continue;
                
                // Skip common non-name words
                const skipWords = ['Active', 'Founders', 'Founder', 'Company', 'Location', 'Team', 'Size',
                                 'San Francisco', 'New York', 'Remote', 'United States', 'Founded',
                                 'Website', 'Jobs', 'Batch', 'Status'];
                if (skipWords.some(word => fullName.toLowerCase().includes(word.toLowerCase()))) continue;
                
                // Extract description from next line if it looks like a bio
                let description = '';
                if (i + 1 < lines.length) {
                  const nextLine = lines[i + 1];
                  if (nextLine.length > 15 && nextLine.length < 500 &&
                      !nextLine.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+$/) && // Not another name
                      (nextLine.includes('Building') || 
                       nextLine.includes('Prior') || 
                       nextLine.includes('studied') ||
                       nextLine.match(/\b(at|from|worked|led|co-founded)\b/i))) {
                    description = nextLine;
                  }
                }
                
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(' ');
                const founderKey = fullName.toLowerCase();
                
                if (!seenFounders.has(founderKey)) {
                  seenFounders.add(founderKey);
                  data.founders.push({
                    firstName,
                    lastName,
                    linkedIn: '',
                    description: description || undefined,
                  });
                }
              }
            }
          }
          
          // Try to associate LinkedIn links
          if (data.founders.length > 0) {
            const allLinkedInLinks = Array.from(document.querySelectorAll('a[href*="linkedin.com/in/"]'));
            
            for (const link of allLinkedInLinks) {
              const linkElement = link as HTMLAnchorElement;
              const linkHref = linkElement.href;
              
              // Get text around the link
              const linkContainer = link.closest('div, section, article, p');
              const containerText = (linkContainer?.textContent || '').toLowerCase();
              
              for (const founder of data.founders) {
                if (!founder.linkedIn && containerText.includes(founder.firstName.toLowerCase())) {
                  founder.linkedIn = linkHref;
                  break;
                }
              }
            }
          }
        }
      }
      
      // Fallback 3: If still no founders found, try finding by LinkedIn links
      if (data.founders.length === 0) {
        const allLinkedInLinks = document.querySelectorAll('a[href*="linkedin.com/in/"]');
        
        allLinkedInLinks.forEach(link => {
          const linkedIn = (link as HTMLAnchorElement).href;
          
          // Skip if we've already seen this LinkedIn
          if (seenFounders.has(linkedIn)) return;
          
          // Skip if it's in navigation or footer
          const parent = link.closest('nav, footer, header');
          if (parent) return;
          
          // Find nearby name - look for text-xl font-bold div
          const container = link.closest('div, section, article') || link.parentElement;
          if (!container) return;
          
          const nameEl = container.querySelector('.text-xl.font-bold, div[class*="text-xl"][class*="font-bold"]') as HTMLElement;
          if (nameEl) {
            const fullName = nameEl.textContent?.trim() || '';
            
            // Skip if this is the company name
            if (fullName.toLowerCase() === companyName) return;
            
            // Skip if name is too short or looks like company name
            if (fullName.split(/\s+/).length < 2) return;
            if (fullName === fullName.toUpperCase() && fullName.length > 10) return;
            
            if (fullName && fullName.length > 3 && fullName.length < 100) {
              const nameParts = fullName.trim().split(/\s+/);
              if (nameParts.length >= 2) {
                // Try to find description
                const proseDiv = container.querySelector('.prose.max-w-full.whitespace-pre-line') as HTMLElement;
                const description = proseDiv?.textContent?.trim() || undefined;
                
                // Only add if description mentions founder
                if (description && description.toLowerCase().includes('founder')) {
                  seenFounders.add(linkedIn);
                  
                  data.founders.push({
                    firstName: nameParts[0],
                    lastName: nameParts.slice(1).join(' '),
                    linkedIn,
                    description,
                  });
                }
              }
            }
          }
        });
      }
      
      // Final deduplication pass - remove any remaining duplicates
      const uniqueFounders: typeof data.founders = [];
      const seenKeys = new Set<string>();
      
      for (const founder of data.founders) {
        const key = founder.linkedIn || `${founder.firstName} ${founder.lastName}`.toLowerCase();
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueFounders.push(founder);
        }
      }
      
      data.founders = uniqueFounders;

      // ============================================
      // 2. EXTRACT WEBSITE
      // ============================================
      // Look for external website links - YC pages typically show the company website prominently
      const allLinks = Array.from(document.querySelectorAll('a[href^="http"]'));
      const excludedDomains = ['ycombinator.com', 'linkedin.com', 'twitter.com', 'x.com', 
                                'facebook.com', 'instagram.com', 'github.com', 'youtube.com'];
      
      for (const link of allLinks) {
        try {
          const href = (link as HTMLAnchorElement).href;
          if (!href) continue;
          
          // Skip excluded domains
          if (excludedDomains.some(domain => href.includes(domain))) continue;
          
          // Look for common TLDs
          if (href.match(/\.(com|io|ai|co|org|net|dev|app|tech)(\/|$)/i)) {
            // Prefer links that are visible and in main content (not nav/footer)
            const parent = link.closest('nav, footer, header');
            if (!parent) {
              data.website = href;
              break;
            }
          }
        } catch (linkError) {
          continue;
        }
      }

      // ============================================
      // 3. EXTRACT TEAM SIZE
      // ============================================
      const bodyTextForTeamSize = document.body.innerText || '';
      const teamSizePatterns = [
        /team\s+size[:\s]+(\d+)/i,
        /(\d+)\s+employees/i,
        /team\s+of\s+(\d+)/i,
      ];
      
      for (const pattern of teamSizePatterns) {
        const match = bodyTextForTeamSize.match(pattern);
        if (match && match[1]) {
          data.teamSize = match[1];
          break;
        }
      }

      // ============================================
      // 4. EXTRACT JOBS (from main page)
      // ============================================
      // Look for "Jobs" tab or section
      const jobsHeading = Array.from(document.querySelectorAll('h2, h3, button, [role="tab"]'))
        .find(el => {
          const text = el.textContent?.toLowerCase() || '';
          return text.includes('jobs') && !text.includes('guide');
        });
      
      if (jobsHeading) {
        // Find job listings near the heading
        const container = jobsHeading.closest('section, div, [role="tabpanel"]') || 
                         jobsHeading.parentElement;
        
        if (container) {
          // Look for job title patterns - typically in headings or links
          const jobElements = container.querySelectorAll('h3, h4, h5, a, div[class*="job"]');
          
          jobElements.forEach(jobEl => {
            const text = jobEl.textContent?.trim() || '';
            
            // Job titles are typically 5-80 characters, not navigation text
            if (text.length >= 5 && 
                text.length <= 80 &&
                !text.match(/^(view|apply|see|all|jobs?)$/i) &&
                !text.includes('View all') &&
                !text.includes('Apply Now') &&
                !text.includes('Jobs at')) {
              
              // Check if it looks like a job title (has common job words or is in a job container)
              const isJobTitle = /engineer|developer|designer|manager|director|lead|intern|analyst|scientist|specialist/i.test(text) ||
                                jobEl.closest('[class*="job"], [class*="position"], [class*="opening"]');
              
              if (isJobTitle) {
                // Extract location if present in the same element or nearby
                const parentText = jobEl.parentElement?.textContent || '';
                const locationMatch = parentText.match(/([A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*),\s*(United States|US|USA|California|New York|Texas)/);
                const location = locationMatch ? locationMatch[0] : undefined;
                
                // Extract description from nearby paragraph
                const descEl = jobEl.parentElement?.querySelector('p');
                const description = descEl?.textContent?.trim() || '';
                
                data.jobPostings.push({
                  title: text,
                  description: description.substring(0, 500),
                  location: location,
                });
              }
            }
          });
        }
      }

      // ============================================
      // 5. EXTRACT LOCATION
      // ============================================
      const locationPatterns = [
        /location[:\s]+([A-Za-z\s,]+(?:,\s*[A-Za-z]+)?)/i,
        /based\s+in[:\s]+([A-Za-z\s,]+(?:,\s*[A-Za-z]+)?)/i,
        /headquarters[:\s]+([A-Za-z\s,]+(?:,\s*[A-Za-z]+)?)/i,
      ];
      
      for (const pattern of locationPatterns) {
        const match = bodyText.match(pattern);
        if (match && match[1]) {
          const loc = match[1].trim();
          // Filter out obviously wrong matches
          if (loc.length > 3 && loc.length < 100 && !loc.includes('http')) {
            data.location = loc;
            break;
          }
        }
      }

      // ============================================
      // 6. EXTRACT FUNDING DATA
      // ============================================
      // Look for funding information (LinkedIn-style pattern)
      try {
        // Pattern 1: Look for funding amount in text-display-lg class (LinkedIn pattern)
        const fundingAmountEl = document.querySelector('p.text-display-lg, p[class*="text-display-lg"]') as HTMLElement;
        if (fundingAmountEl) {
          const amountText = fundingAmountEl.textContent?.trim() || '';
          // Match patterns like "US$ 500.0K", "$20M", "$1.5M", etc.
          const amountMatch = amountText.match(/(?:US\$|USD\$|\$)?\s*([\d.,]+[KMB]?)/i);
          if (amountMatch) {
            data.fundingAmount = amountText.trim();
          }
        }
        
        // Pattern 2: Look for funding round and date in link-styled elements (LinkedIn pattern)
        const fundingLink = Array.from(document.querySelectorAll('a[class*="link-styled"], a[class*="text-sm"]'))
          .find(link => {
            const text = link.textContent?.toLowerCase() || '';
            return text.includes('seed') || 
                   text.includes('series') || 
                   text.includes('pre-seed') ||
                   text.includes('round') ||
                   (text.match(/\d{4}/) && (text.includes('jan') || text.includes('feb') || text.includes('mar') || 
                    text.includes('apr') || text.includes('may') || text.includes('jun') ||
                    text.includes('jul') || text.includes('aug') || text.includes('sep') ||
                    text.includes('oct') || text.includes('nov') || text.includes('dec')));
          }) as HTMLAnchorElement;
        
        if (fundingLink) {
          const fundingText = fundingLink.textContent?.trim() || '';
          
          // Extract round type (Pre seed, Seed, Series A, etc.)
          const roundMatch = fundingText.match(/(pre[- ]?seed|seed|series\s+[a-z]|angel|bridge|convertible|grant)/i);
          if (roundMatch) {
            data.roundType = roundMatch[1].trim();
          }
          
          // Extract date (e.g., "Oct 9, 2025", "2025-10-09")
          const dateMatch = fundingText.match(/([A-Z][a-z]{2,9}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            data.fundingDate = dateMatch[1].trim();
          }
        }
        
        // Pattern 3: Look for "Funding" section header and extract nearby data
        const fundingSection = Array.from(document.querySelectorAll('h2, h3'))
          .find(el => {
            const text = el.textContent?.toLowerCase() || '';
            return text.includes('funding');
          });
        
        if (fundingSection && !data.fundingAmount) {
          const container = fundingSection.closest('section, div') || fundingSection.parentElement;
          if (container) {
            // Look for amount in the container
            const containerText = container.textContent || '';
            const amountMatch = containerText.match(/(?:US\$|USD\$|\$)?\s*([\d.,]+[KMB]?)/i);
            if (amountMatch) {
              data.fundingAmount = amountMatch[0].trim();
            }
            
            // Look for round type
            if (!data.roundType) {
              const roundMatch = containerText.match(/(pre[- ]?seed|seed|series\s+[a-z]|angel|bridge|convertible|grant)/i);
              if (roundMatch) {
                data.roundType = roundMatch[1].trim();
              }
            }
            
            // Look for date
            if (!data.fundingDate) {
              const dateMatch = containerText.match(/([A-Z][a-z]{2,9}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/);
              if (dateMatch) {
                data.fundingDate = dateMatch[1].trim();
              }
            }
          }
        }
      } catch (fundingError) {
        // Funding extraction failed, continue
      }

      // ============================================
      // 7. EXTRACT ONE-LINE SUMMARY / DESCRIPTION
      // ============================================
      // Try multiple strategies to find the company description
      
      // Strategy 1: Meta description
      const metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement;
      if (metaDesc?.content && metaDesc.content.length > 20) {
        data.oneLineSummary = metaDesc.content.trim();
      }
      
      // Strategy 2: First paragraph after h1 (company name)
      if (!data.oneLineSummary) {
        const h1 = document.querySelector('h1');
        if (h1) {
          let next = h1.nextElementSibling;
          while (next && !data.oneLineSummary) {
            if (next.tagName === 'P' || next.tagName === 'DIV') {
              const text = next.textContent?.trim() || '';
              if (text.length > 20 && text.length < 500) {
                data.oneLineSummary = text;
                break;
              }
            }
            next = next.nextElementSibling;
          }
        }
      }
      
      // Strategy 3: Look for description in main content area
      if (!data.oneLineSummary) {
        const mainContent = document.querySelector('main, [role="main"], article') || document.body;
        const paragraphs = mainContent.querySelectorAll('p');
        
        for (const p of Array.from(paragraphs)) {
          const text = p.textContent?.trim() || '';
          // Good description is usually 50-400 chars, not too short, not too long
          if (text.length >= 50 && text.length <= 400 && 
              !text.includes('Apply') && 
              !text.includes('View') &&
              !text.includes('LinkedIn')) {
            data.oneLineSummary = text;
            break;
          }
        }
      }

        return data;
      } catch (evalError) {
        console.error('   ❌ Error in page evaluation:', evalError);
        // Return empty data structure instead of throwing
        return {
          founders: [],
          website: '',
          teamSize: '',
          jobPostings: [],
          location: '',
          oneLineSummary: '',
          fundingAmount: undefined,
          roundType: undefined,
          fundingDate: undefined,
        };
      }
    });

    // Check if we got valid data
    if (!pageData) {
      console.error(`   ❌ Page evaluation returned null`);
      return null;
    }

    // ============================================
    // 7. CONSTRUCT LINKEDIN URL (for future enrichment)
    // ============================================
    // Construct LinkedIn company URL from website domain (stored for future API enrichment)
    pageData.linkedInCompanyUrl = pageData.website ? constructLinkedInCompanyUrl(pageData.website) : null;

    // ============================================
    // 8. SCRAPE COMPANY-SPECIFIC JOBS PAGE
    // ============================================
    // Construct the company-specific jobs URL directly
    // Format: https://www.ycombinator.com/companies/{company-slug}/jobs
    const companySlug = extractCompanySlug(ycUrl);
    const jobsPageUrl = companySlug 
      ? `https://www.ycombinator.com/companies/${companySlug}/jobs`
      : null;

    // Always try to scrape the company-specific jobs page if we have a valid slug
    if (jobsPageUrl) {
      console.log(`   📋 Found jobs page, scraping: ${jobsPageUrl}`);
      try {
        await page.goto(jobsPageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const jobsPageData = await page.evaluate(() => {
          const jobs: Array<{ title: string; description: string; location?: string }> = [];
          
          // Look for "Jobs at [Company]" heading or job listings
          const jobsHeading = Array.from(document.querySelectorAll('h2, h3'))
            .find(el => el.textContent?.includes('Jobs at'));
          
          // Also look for job listings directly - they're often in articles or list items
          const allJobElements = Array.from(document.querySelectorAll('article, li[class*="job"], div[class*="job"]'));
          
          // If we found a heading, look for jobs in that section
          if (jobsHeading) {
            const section = jobsHeading.closest('section') || jobsHeading.parentElement;
            const sectionJobs = section?.querySelectorAll('article, li, div[class*="job"]') || [];
            
            sectionJobs.forEach(jobEl => {
              const fullText = jobEl.textContent?.trim() || '';
              
              // Extract job title - usually the first heading or strong text
              const titleEl = jobEl.querySelector('h3, h4, h5, strong, a[href*="/jobs/"]');
              const title = titleEl?.textContent?.trim() || '';
              
              // Extract location - pattern like "London, England, GB" or "San Francisco, CA"
              const locationMatch = fullText.match(/([A-Z][a-zA-Z\s]+(?:,\s*[A-Z][a-zA-Z\s]+)*),\s*(GB|US|USA|CA|NY|TX|England|United States)/);
              const location = locationMatch ? locationMatch[0].trim() : undefined;
              
              // Extract salary if present
              const salaryMatch = fullText.match(/(\$|£|€)[\d.,]+[KMB]?/);
              
              // Filter valid job titles
              if (title && 
                  title.length > 5 && 
                  title.length < 100 &&
                  !title.toLowerCase().includes('view all') &&
                  !title.toLowerCase().includes('apply now') &&
                  !title.toLowerCase().includes('jobs at') &&
                  !title.toLowerCase().includes('why you should')) {
                
                // Build description from available info
                let description = '';
                const descEl = jobEl.querySelector('p');
                if (descEl) {
                  description = descEl.textContent?.trim() || '';
                }
                
                // Add salary to description if found
                if (salaryMatch && !description.includes(salaryMatch[0])) {
                  description = salaryMatch[0] + (description ? ' | ' + description : '');
                }
                
                jobs.push({
                  title: title,
                  description: description.substring(0, 500),
                  location: location,
                });
              }
            });
          }
          
          // Also check for standalone job listings if we didn't find many
          if (jobs.length === 0) {
            allJobElements.forEach(jobEl => {
              const titleEl = jobEl.querySelector('h3, h4, h5, strong');
              const title = titleEl?.textContent?.trim() || '';
              
              if (title && title.length > 5 && title.length < 100) {
                const fullText = jobEl.textContent?.trim() || '';
                const locationMatch = fullText.match(/([A-Z][a-zA-Z\s]+(?:,\s*[A-Z][a-zA-Z\s]+)*),\s*(GB|US|USA|CA|NY|TX)/);
                const location = locationMatch ? locationMatch[0].trim() : undefined;
                
                const descEl = jobEl.querySelector('p');
                const description = descEl?.textContent?.trim() || '';
                
                jobs.push({
                  title,
                  description: description.substring(0, 500),
                  location,
                });
              }
            });
          }
          
          return jobs;
        });
        
        // Merge jobs from jobs page (avoid duplicates)
        const existingTitles = new Set(pageData.jobPostings.map(j => j.title.toLowerCase()));
        jobsPageData.forEach(job => {
          if (!existingTitles.has(job.title.toLowerCase())) {
            pageData.jobPostings.push(job);
          }
        });
        
        console.log(`   ✅ Found ${jobsPageData.length} additional jobs from jobs page`);
      } catch (error) {
        console.warn(`   ⚠️  Could not scrape jobs page: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return pageData;
  } catch (error) {
    console.error(`   ❌ Error scraping YC page: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error(`   Stack trace: ${error.stack}`);
    }
    return null;
  }
}

/**
 * Get already processed company links from Supabase
 */
async function getAlreadyProcessedLinks(): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('startups')
      .select('yc_link')
      .eq('data_source', 'yc')
      .not('yc_link', 'is', null);

    if (error) {
      console.warn('  ⚠️  Could not fetch already-processed companies:', error);
      return new Set();
    }

    const links = new Set<string>();
    data?.forEach((row: any) => {
      if (row.yc_link) {
        // Normalize URL for comparison (lowercase, remove trailing slash)
        const normalized = row.yc_link.toLowerCase().replace(/\/$/, '');
        links.add(normalized);
      }
    });

    return links;
  } catch (error) {
    console.warn('  ⚠️  Error fetching already-processed companies:', error);
    return new Set();
  }
}

/**
 * Store YC company data in Supabase
 */
async function storeYCCompanyInSupabase(company: YCCompany, pageData: YCPageData): Promise<boolean> {
  try {
    // Normalize company data to handle both CSV formats
    const normalized = normalizeCompanyData(company);

    const slug = extractCompanySlug(normalized.ycLink);
    if (!slug) {
      console.warn('  ⚠️  Could not extract slug from YC link');
      return false;
    }

    // Helper to convert empty strings to null
    const toNull = (value: string | undefined): string | null => {
      return value && value.trim() ? value.trim() : null;
    };

    // Format founder data - use existing schema (founder_names as comma-separated string)
    const founderNames = pageData.founders
      .map(f => `${f.firstName} ${f.lastName}`.trim())
      .filter(name => name.length > 0)
      .join(', ');

    const founderLinkedIns = pageData.founders
      .map(f => f.linkedIn)
      .filter(linkedin => linkedin.length > 0)
      .join(', ');

    // Combine founder descriptions
    const founderDescriptions = pageData.founders
      .map(f => f.description ? `${f.firstName} ${f.lastName}: ${f.description}` : null)
      .filter(Boolean)
      .join('\n\n');

    // Get primary founder for separate fields
    const firstFounder = pageData.founders[0] || { firstName: '', lastName: '', linkedIn: '', description: undefined };

    // Combine all job titles and descriptions with locations
    const jobOpenings = pageData.jobPostings.map(j => j.title).join(', ');
    const hiringRoles = pageData.jobPostings
      .map(j => {
        let role = j.title;
        if (j.location) role += ` (${j.location})`;
        if (j.description) role += `: ${j.description}`;
        return role;
      })
      .join('\n\n');

    const startupId = randomUUID();

    const { data, error } = await supabase
      .from('startups')
      .insert({
        id: startupId,
        name: normalized.companyName,
        description: toNull(normalized.description || pageData.oneLineSummary),
        location: toNull(normalized.location || pageData.location),
        website: toNull(pageData.website),
        industry: toNull(normalized.industry),
        business_type: toNull(normalized.businessType),
        batch: toNull(normalized.batch),
        yc_link: toNull(normalized.ycLink),
        company_logo: toNull(normalized.companyLogo),
        // Founder data (using existing schema)
        founder_names: toNull(founderNames), // Comma-separated names
        founder_linkedin: toNull(founderLinkedIns), // Comma-separated LinkedIn URLs
        founder_first_name: toNull(firstFounder.firstName), // Primary founder
        founder_last_name: toNull(firstFounder.lastName), // Primary founder
        // Store founder descriptions in founder_backgrounds if column exists
        founder_backgrounds: toNull(founderDescriptions),
        // Team and jobs
        team_size: toNull(pageData.teamSize),
        job_openings: toNull(jobOpenings),
        hiring_roles: toNull(hiringRoles),
        // Data source
        data_source: 'yc',
        needs_enrichment: true,
        enrichment_status: 'pending',
        // Funding data (extracted from YC page or LinkedIn)
        funding_amount: toNull(pageData.fundingAmount),
        round_type: toNull(pageData.roundType),
        date: toNull(pageData.fundingDate),
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Duplicate - already exists
        console.log('  ℹ️  Company already exists in database');
        return false;
      }
      throw error;
    }

    return true;
  } catch (error) {
    console.error(`  ❌ Error storing in Supabase: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Main scraping function
 */
async function scrapeYCCompanies() {
  console.log('🚀 Starting YC Company Scraping...\n');

  // Get command line arguments
  const args = process.argv.slice(2);
  const batchFilter = args.find(arg => arg.startsWith('--batch='))?.split('=')[1];

  // Test Supabase connection
  try {
    const { data, error } = await supabase.from('startups').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    console.log('✓ Connected to Supabase\n');
  } catch (error) {
    throw new Error(
      `Cannot connect to Supabase: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Get already processed companies
  console.log('🔍 Checking for already-processed companies...');
  const processedLinks = await getAlreadyProcessedLinks();
  console.log(`   Found ${processedLinks.size} already-processed companies\n`);

  // Load all companies from CSV files
  console.log('📂 Loading YC companies from CSV files...');
  const csvFiles = getAllYCCsvFiles();
  console.log(`   Found ${csvFiles.length} CSV file(s)`);

  let allCompanies: YCCompany[] = [];
  for (const csvFile of csvFiles) {
    const companies = loadCompaniesFromCSV(csvFile);
    console.log(`   Loaded ${companies.length} companies from ${csvFile.split(/[/\\]/).pop()}`);
    allCompanies = allCompanies.concat(companies);
  }

  // Filter by batch if specified
  if (batchFilter) {
    console.log(`\n🔍 Filtering for batch: ${batchFilter}`);
    allCompanies = allCompanies.filter(c => {
      const normalized = normalizeCompanyData(c);
      return normalized.batch.toLowerCase() === batchFilter.toLowerCase();
    });
  }

  console.log(`\n📊 Total companies to process: ${allCompanies.length}`);

  // Filter out already processed companies
  const newCompanies = allCompanies.filter(company => {
    const normalized = normalizeCompanyData(company);
    if (!normalized.ycLink) return false;
    // Normalize URL for comparison (lowercase, remove trailing slash)
    const normalizedLink = normalized.ycLink.toLowerCase().replace(/\/$/, '');
    return !processedLinks.has(normalizedLink);
  });

  console.log(`📋 New companies to scrape: ${newCompanies.length} (${allCompanies.length - newCompanies.length} already processed)\n`);

  if (newCompanies.length === 0) {
    console.log('✅ All companies already processed!');
    return;
  }

  // Launch Puppeteer browser
  console.log('🌐 Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  try {
    for (let i = 0; i < newCompanies.length; i++) {
      const company = newCompanies[i];
      const normalized = normalizeCompanyData(company);

      try {
        console.log(`\n[${i + 1}/${newCompanies.length}] 🏢 Processing: ${normalized.companyName}`);
        console.log(`   Batch: ${normalized.batch}`);
        console.log(`   URL: ${normalized.ycLink}`);

        // Scrape YC page
        const pageData = await scrapeYCCompanyPage(page, normalized.ycLink);

        if (!pageData) {
          console.log('  ⚠️  Failed to scrape page data, skipping...');
          errorCount++;
          continue;
        }

        // Log what we found
        console.log(`   Found ${pageData.founders.length} founder(s)`);
        if (pageData.founders.length > 0) {
          const foundersWithDescriptions = pageData.founders.filter(f => f.description).length;
          console.log(`   Founders with descriptions: ${foundersWithDescriptions}/${pageData.founders.length}`);
        }
        console.log(`   Website: ${pageData.website || 'Not found'}`);
        console.log(`   Team size: ${pageData.teamSize || 'Not found'}`);
        console.log(`   Job postings: ${pageData.jobPostings.length}`);
        if (pageData.fundingAmount || pageData.roundType || pageData.fundingDate) {
          console.log(`   💰 Funding: ${pageData.fundingAmount || 'N/A'} | ${pageData.roundType || 'N/A'} | ${pageData.fundingDate || 'N/A'}`);
        }

        // Store in Supabase
        const success = await storeYCCompanyInSupabase(company, pageData);

        if (success) {
          successCount++;
          console.log('   ✅ Successfully stored in Supabase');
        } else {
          skippedCount++;
        }

        // Rate limiting - wait between requests
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        errorCount++;
        console.error(`   ❌ Error processing ${normalized.companyName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } finally {
    // Close browser
    try {
      await browser.close();
      console.log('\n🌐 Browser closed');
    } catch (closeError) {
      console.warn('⚠️  Browser cleanup warning:', closeError instanceof Error ? closeError.message : String(closeError));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Scraping Complete');
  console.log('='.repeat(60));
  console.log(`Total processed: ${newCompanies.length}`);
  console.log(`Successfully stored: ${successCount}`);
  console.log(`Skipped (duplicates): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log('='.repeat(60));
}

// Run the scraper
if (require.main === module) {
  scrapeYCCompanies()
    .then(() => {
      console.log('\n✅ Process completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Process failed:', error);
      process.exit(1);
    });
}

export { scrapeYCCompanies, extractCompanySlug, scrapeYCCompanyPage };
