/**
 * Enhanced Founder Email Discovery Agent
 *
 * Multi-tier approach to finding founder emails:
 * 1. Get founder names from existing data or web search
 * 2. Generate email patterns (first@domain, first.last@domain, etc.)
 * 3. Verify patterns using Rapid Email Verifier (free, 1000/month)
 * 4. Mark remaining for manual Hunter.io lookup
 *
 * This ensures we maximize accuracy while minimizing API costs.
 */

import { searchWeb, SearchResult } from './web_search_agent';
import { findFounderEmailByPattern } from './email_pattern_matcher';

export interface FounderInfo {
  name: string;
  email?: string;
  linkedin?: string;
  role?: string;
  background?: string;
  emailSource?: 'website' | 'linkedin' | 'github' | 'angellist' | 'producthunt' | 'pattern_matched' | 'hunter.io' | 'other';
  confidence?: number; // 0.0 - 1.0
}

export interface FounderEmailDiscoveryResult {
  founders: FounderInfo[];
  totalFound: number;
  emailsFound: number;
  primaryFounder?: FounderInfo;
}

/**
 * Validate if a name is legitimate (not garbage from regex extraction)
 */
function isValidName(name: string): boolean {
  if (!name || name.length < 3) return false;

  // Remove common garbage patterns
  const invalidPatterns = [
    /^(from|to|is|the|and|or|of|in|on|at|by|for|with|as|our|their|his|her)\s/i,
    /\s(from|to|is|the|and|or|of|in|on|at|by|for|with|as|our|their|his|her)$/i,
    /^(co-?founder|founder|ceo|cto|cfo)\s*$/i, // Just a title, no name
    /^(technical|research|industry|innovators?)\s/i,
  ];

  for (const pattern of invalidPatterns) {
    if (pattern.test(name)) return false;
  }

  // Must have at least 2 parts (first + last name)
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return false;

  // Each part should be at least 2 characters
  if (parts.some(part => part.length < 2)) return false;

  return true;
}

/**
 * Tier 1: Search company website for founder emails
 * Most reliable source - direct from company
 */
async function searchCompanyWebsite(
  companyName: string,
  websiteDomain?: string
): Promise<FounderInfo[]> {
  const founders: FounderInfo[] = [];

  if (!websiteDomain) {
    return founders;
  }

  // Search for team/about pages
  const queries = [
    `site:${websiteDomain} team founders`,
    `site:${websiteDomain} about leadership`,
    `site:${websiteDomain} contact founders`,
  ];

  for (const query of queries) {
    try {
      const results = await searchWeb(query);

      // Extract emails from website content
      for (const result of results) {
        const emails = extractEmailsFromText(result.snippet);
        const names = extractFounderNamesFromText(result.snippet);

        // Try to match emails with names
        for (let i = 0; i < names.length; i++) {
          const founder: FounderInfo = {
            name: names[i],
            email: emails[i] || undefined,
            emailSource: 'website',
            confidence: emails[i] ? 0.9 : 0.7, // High confidence for website emails
          };
          founders.push(founder);
        }
      }

      if (founders.length > 0) break; // Found founders, no need to continue
    } catch (error) {
      console.warn(`Website search failed for ${query}:`, error);
      continue;
    }
  }

  return founders;
}

/**
 * Tier 1: Search LinkedIn for founder profiles
 * Often has publicly visible emails or contact info
 */
async function searchLinkedInProfiles(companyName: string): Promise<FounderInfo[]> {
  const founders: FounderInfo[] = [];

  const query = `site:linkedin.com/in "${companyName}" founder OR CEO`;

  try {
    const results = await searchWeb(query);

    for (const result of results) {
      // Extract LinkedIn profile URL
      const linkedinMatch = result.url.match(/linkedin\.com\/in\/([a-zA-Z0-9-]+)/);
      if (!linkedinMatch) continue;

      const linkedinUrl = `linkedin.com/in/${linkedinMatch[1]}`;

      // Extract name from title (LinkedIn format: "Name - Title | Company")
      const nameMatch = result.title.match(/^([^-|]+)/);
      const name = nameMatch ? nameMatch[1].trim() : '';

      // Extract role
      const roleMatch = result.title.match(/-\s*([^|]+)/);
      const role = roleMatch ? roleMatch[1].trim() : undefined;

      // Try to find email in snippet
      const emails = extractEmailsFromText(result.snippet);

      if (name) {
        founders.push({
          name,
          email: emails[0] || undefined,
          linkedin: linkedinUrl,
          role,
          emailSource: emails[0] ? 'linkedin' : undefined,
          confidence: 0.85,
        });
      }
    }
  } catch (error) {
    console.warn('LinkedIn search failed:', error);
  }

  return founders;
}

/**
 * Tier 1: Search GitHub for developer emails
 * Many developers have public emails on GitHub
 */
async function searchGitHubProfiles(companyName: string): Promise<FounderInfo[]> {
  const founders: FounderInfo[] = [];

  const query = `site:github.com "${companyName}" @`;

  try {
    const results = await searchWeb(query);

    for (const result of results) {
      const emails = extractEmailsFromText(result.snippet);
      const githubMatch = result.url.match(/github\.com\/([a-zA-Z0-9-]+)/);

      if (emails.length > 0 && githubMatch) {
        // Try to extract name from GitHub profile
        const nameMatch = result.title.match(/^([^-·]+)/);
        const name = nameMatch ? nameMatch[1].trim() : githubMatch[1];

        founders.push({
          name,
          email: emails[0],
          emailSource: 'github',
          confidence: 0.8,
        });
      }
    }
  } catch (error) {
    console.warn('GitHub search failed:', error);
  }

  return founders;
}

/**
 * Tier 2: Search AngelList/Wellfound
 * Startup-focused platform with founder info
 */
async function searchAngelList(companyName: string): Promise<FounderInfo[]> {
  const founders: FounderInfo[] = [];

  const query = `site:wellfound.com OR site:angel.co "${companyName}" founder`;

  try {
    const results = await searchWeb(query);

    for (const result of results) {
      const names = extractFounderNamesFromText(result.snippet);
      const emails = extractEmailsFromText(result.snippet);

      for (let i = 0; i < names.length; i++) {
        founders.push({
          name: names[i],
          email: emails[i] || undefined,
          emailSource: emails[i] ? 'angellist' : undefined,
          confidence: 0.75,
        });
      }
    }
  } catch (error) {
    console.warn('AngelList search failed:', error);
  }

  return founders;
}

/**
 * Tier 2: Search Product Hunt
 * Makers often list contact info
 */
async function searchProductHunt(companyName: string): Promise<FounderInfo[]> {
  const founders: FounderInfo[] = [];

  const query = `site:producthunt.com "${companyName}" maker`;

  try {
    const results = await searchWeb(query);

    for (const result of results) {
      const names = extractFounderNamesFromText(result.snippet);
      const emails = extractEmailsFromText(result.snippet);

      for (let i = 0; i < names.length; i++) {
        founders.push({
          name: names[i],
          email: emails[i] || undefined,
          emailSource: emails[i] ? 'producthunt' : undefined,
          confidence: 0.7,
        });
      }
    }
  } catch (error) {
    console.warn('Product Hunt search failed:', error);
  }

  return founders;
}

/**
 * Tier 3: Use Hunter.io API (paid fallback)
 * Only called if free sources don't find emails
 */
async function searchHunterIO(
  companyName: string,
  websiteDomain?: string
): Promise<FounderInfo[]> {
  const founders: FounderInfo[] = [];

  if (!websiteDomain || !process.env.HUNTER_IO_API_KEY) {
    return founders;
  }

  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${websiteDomain}&api_key=${process.env.HUNTER_IO_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.data && data.data.emails) {
      for (const emailData of data.data.emails) {
        // Hunter.io provides confidence scores
        if (emailData.position && emailData.position.toLowerCase().includes('founder')) {
          founders.push({
            name: `${emailData.first_name} ${emailData.last_name}`,
            email: emailData.value,
            role: emailData.position,
            emailSource: 'hunter.io',
            confidence: emailData.confidence / 100, // Convert to 0-1 scale
          });
        }
      }
    }
  } catch (error) {
    console.warn('Hunter.io search failed:', error);
  }

  return founders;
}

/**
 * Main function: Discover founder emails using multi-tier approach
 */
export async function discoverFounderEmails(
  companyName: string,
  websiteDomain?: string,
  useHunterIO: boolean = false
): Promise<FounderEmailDiscoveryResult> {
  console.log(`\n🔍 Discovering founder emails for: ${companyName}`);

  let allFounders: FounderInfo[] = [];

  // Tier 1: Free public sources (run in parallel for speed)
  console.log('  📊 Tier 1: Searching public sources...');
  const [websiteFounders, linkedinFounders, githubFounders] = await Promise.all([
    searchCompanyWebsite(companyName, websiteDomain),
    searchLinkedInProfiles(companyName),
    searchGitHubProfiles(companyName),
  ]);

  allFounders.push(...websiteFounders, ...linkedinFounders, ...githubFounders);
  console.log(`    Found ${allFounders.length} potential founders from public sources`);

  // Tier 2: Specialized aggregators (only if needed)
  const hasEmails = allFounders.some(f => f.email);
  if (!hasEmails || allFounders.length === 0) {
    console.log('  📊 Tier 2: Searching specialized platforms...');
    const [angelListFounders, productHuntFounders] = await Promise.all([
      searchAngelList(companyName),
      searchProductHunt(companyName),
    ]);

    allFounders.push(...angelListFounders, ...productHuntFounders);
    console.log(`    Total founders after Tier 2: ${allFounders.length}`);
  }

  // Deduplicate and merge founder data FIRST
  let mergedFounders = mergeFounderData(allFounders);

  // Tier 3: Pattern Matching (for founders without emails)
  const foundersWithoutEmails = mergedFounders.filter(f => !f.email && isValidName(f.name));
  if (foundersWithoutEmails.length > 0 && websiteDomain) {
    console.log(`  🔍 Tier 3: Pattern matching for ${foundersWithoutEmails.length} founders without emails...`);

    for (const founder of foundersWithoutEmails) {
      const result = await findFounderEmailByPattern(founder.name, websiteDomain);

      if (result && result.isDeliverable) {
        founder.email = result.email;
        founder.emailSource = 'pattern_matched';
        founder.confidence = result.confidence * 0.75; // Pattern matched = medium confidence
      }
    }
  }

  // Tier 4: Hunter.io (only if still no emails and enabled)
  const foundersWithEmails = mergedFounders.filter(f => f.email);
  if (useHunterIO && foundersWithEmails.length === 0 && websiteDomain) {
    console.log('  💰 Tier 4: Using Hunter.io API...');
    const hunterFounders = await searchHunterIO(companyName, websiteDomain);
    allFounders.push(...hunterFounders);
    mergedFounders = mergeFounderData([...mergedFounders, ...hunterFounders]);
    console.log(`    Found ${hunterFounders.length} founders from Hunter.io`);
  }

  // Find primary founder (usually CEO or first founder)
  const primaryFounder = mergedFounders.find(f =>
    f.role?.toLowerCase().includes('ceo') ||
    f.role?.toLowerCase().includes('founder')
  ) || mergedFounders[0];

  const emailsFound = mergedFounders.filter(f => f.email).length;

  console.log(`  ✅ Discovery complete: ${mergedFounders.length} founders, ${emailsFound} emails found\n`);

  return {
    founders: mergedFounders,
    totalFound: mergedFounders.length,
    emailsFound,
    primaryFounder,
  };
}

/**
 * Merge duplicate founder entries (same name, different sources)
 */
function mergeFounderData(founders: FounderInfo[]): FounderInfo[] {
  const founderMap = new Map<string, FounderInfo>();

  for (const founder of founders) {
    const key = founder.name.toLowerCase().trim();
    const existing = founderMap.get(key);

    if (existing) {
      // Merge data, preferring higher confidence sources
      const merged: FounderInfo = {
        name: existing.name, // Keep first occurrence of name
        email: existing.email || founder.email,
        linkedin: existing.linkedin || founder.linkedin,
        role: existing.role || founder.role,
        background: existing.background || founder.background,
        emailSource: (existing.confidence || 0) > (founder.confidence || 0)
          ? existing.emailSource
          : founder.emailSource,
        confidence: Math.max(existing.confidence || 0, founder.confidence || 0),
      };
      founderMap.set(key, merged);
    } else {
      founderMap.set(key, founder);
    }
  }

  // Sort by confidence (highest first)
  return Array.from(founderMap.values())
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
}

/**
 * Extract emails from text (strict filtering)
 */
function extractEmailsFromText(text: string): string[] {
  const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  const matches = text.match(emailPattern) || [];

  return matches.filter(email => {
    const emailLower = email.toLowerCase();
    // Exclude generic/placeholder emails
    if (emailLower.includes('example.com') ||
        emailLower.includes('test.com') ||
        emailLower.match(/^(noreply|no-reply)@/)) {
      return false;
    }
    return true;
  });
}

/**
 * Extract founder names from text
 */
function extractFounderNamesFromText(text: string): string[] {
  const names: string[] = [];

  // Pattern: "Name, Title" or "Title Name"
  const patterns = [
    /([A-Z][a-z]+\s+[A-Z][a-z]+),?\s*(?:CEO|CTO|CFO|Co-?founder|Founder)/gi,
    /(?:CEO|CTO|CFO|Co-?founder|Founder)[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        names.push(match[1].trim());
      }
    }
  }

  return Array.from(new Set(names)); // Remove duplicates
}
