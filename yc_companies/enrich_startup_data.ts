/**
 * Web Search Enrichment Agent
 * 
 * This agent takes startups that need enrichment and uses web search
 * to find additional information like:
 * - Founder names and LinkedIn profiles
 * - Accurate company website
 * - Job openings
 * - More detailed company description
 * - Additional funding details
 * - Company logo/YC link if applicable
 */

import { resolve } from 'path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { searchWeb, extractFounderInfo, extractJobOpenings, extractCompanyWebsite } from './web_search_agent';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

interface StartupRecord {
  id: string;
  name: string;
  website?: string;
  description?: string;
  techcrunch_article_link?: string;
  techcrunch_article_content?: string;
  [key: string]: any;
}

interface EnrichedData {
  founder_names?: string;
  founder_emails?: string;
  founder_linkedin?: string;
  website?: string;
  job_openings?: string;
  description?: string;
  funding_amount?: string;
  funding_stage?: string;
  location?: string;
  industry?: string;
  company_logo?: string;
  yc_link?: string;
}

/**
 * Search the web for information about a startup
 */
async function searchWebForStartup(startup: StartupRecord): Promise<EnrichedData> {
  const companyName = startup.name;
  const existingWebsite = startup.website;
  const articleContent = startup.techcrunch_article_content || '';
  
  console.log(`  🔍 Searching web for: ${companyName}`);
  
  const enrichedData: EnrichedData = {};
  
  try {
    // Search for founder information
    const founderQuery = `${companyName} founder CEO co-founder`;
    console.log(`    Searching for founders: ${founderQuery}`);
    const founderResults = await searchWeb(founderQuery);
    
    if (founderResults.length > 0) {
      const founderInfo = extractFounderInfo(founderResults, companyName);
      if (founderInfo.names) enrichedData.founder_names = founderInfo.names;
      if (founderInfo.linkedin) enrichedData.founder_linkedin = founderInfo.linkedin;
      if (founderInfo.emails) enrichedData.founder_emails = founderInfo.emails;
    }
    
    // Search for job openings
    const jobsQuery = `${companyName} careers jobs hiring open positions`;
    console.log(`    Searching for jobs: ${jobsQuery}`);
    const jobsResults = await searchWeb(jobsQuery);
    
    if (jobsResults.length > 0) {
      const jobs = extractJobOpenings(jobsResults, companyName);
      if (jobs) enrichedData.job_openings = jobs;
    }
    
    // Search for company website (if not already have one or it looks generated)
    if (!existingWebsite || existingWebsite.includes('.com') && !existingWebsite.includes('.')) {
      const websiteQuery = `${companyName} official website`;
      console.log(`    Searching for website: ${websiteQuery}`);
      const websiteResults = await searchWeb(websiteQuery);
      
      if (websiteResults.length > 0) {
        const website = extractCompanyWebsite(websiteResults, companyName);
        if (website) enrichedData.website = website;
      }
    }
    
    // Search for more funding details if we have default/placeholder values
    if (!startup.funding_amount || startup.funding_amount === '$1.5M') {
      const fundingQuery = `${companyName} funding raised investment`;
      console.log(`    Searching for funding: ${fundingQuery}`);
      const fundingResults = await searchWeb(fundingQuery);
      
      // Extract funding amount from results
      const fundingText = fundingResults.map(r => r.snippet).join(' ');
      const fundingMatch = fundingText.match(/\$(\d+(?:\.\d+)?)\s*(?:million|M|billion|B)/i);
      if (fundingMatch) {
        enrichedData.funding_amount = `$${fundingMatch[1]}${fundingMatch[0].includes('billion') || fundingMatch[0].includes('B') ? 'B' : 'M'}`;
      }
    }
    
  } catch (error) {
    console.warn(`  ⚠️  Web search error: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return enrichedData;
}


/**
 * Merge enriched data with existing startup data
 */
function mergeEnrichedData(existing: StartupRecord, enriched: EnrichedData): Partial<StartupRecord> {
  const updates: Partial<StartupRecord> = {};
  
  // Only update fields that are missing or can be improved
  if (enriched.founder_names && !existing.founder_names) {
    updates.founder_names = enriched.founder_names;
  }
  
  if (enriched.founder_emails && !existing.founder_emails) {
    updates.founder_emails = enriched.founder_emails;
  }
  
  if (enriched.founder_linkedin && !existing.founder_linkedin) {
    updates.founder_linkedin = enriched.founder_linkedin;
  }
  
  if (enriched.website && (!existing.website || existing.website.includes('.com'))) {
    // Update if no website or if current one looks generated
    updates.website = enriched.website;
  }
  
  if (enriched.job_openings && !existing.job_openings) {
    updates.job_openings = enriched.job_openings;
  }
  
  if (enriched.description && (!existing.description || existing.description.length < 50)) {
    // Update if description is too short
    updates.description = enriched.description;
  }
  
  if (enriched.funding_amount && (!existing.funding_amount || existing.funding_amount === '$1.5M')) {
    // Update if funding amount is default/placeholder
    updates.funding_amount = enriched.funding_amount;
  }
  
  if (enriched.location && !existing.location) {
    updates.location = enriched.location;
  }
  
  if (enriched.industry && !existing.industry) {
    updates.industry = enriched.industry;
  }
  
  return updates;
}

/**
 * Enrich a single startup
 */
async function enrichStartup(startup: StartupRecord): Promise<boolean> {
  try {
    console.log(`\n📊 Enriching: ${startup.name}`);
    
    // Update status to in_progress
    await supabase
      .from('startups')
      .update({ enrichment_status: 'in_progress' })
      .eq('id', startup.id);
    
    // Search web for additional information
    const enrichedData = await searchWebForStartup(startup);
    
    // Merge enriched data
    const updates = mergeEnrichedData(startup, enrichedData);
    
    if (Object.keys(updates).length > 0) {
      // Update startup in Supabase
      const { error } = await supabase
        .from('startups')
        .update({
          ...updates,
          needs_enrichment: false,
          enrichment_status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', startup.id);
      
      if (error) {
        throw error;
      }
      
      console.log(`  ✅ Enriched with: ${Object.keys(updates).join(', ')}`);
      return true;
    } else {
      // No new data found, mark as completed anyway
      await supabase
        .from('startups')
        .update({
          needs_enrichment: false,
          enrichment_status: 'completed',
        })
        .eq('id', startup.id);
      
      console.log(`  ℹ️  No additional data found`);
      return true;
    }
  } catch (error) {
    console.error(`  ❌ Error enriching ${startup.name}:`, error);
    
    // Mark as failed
    await supabase
      .from('startups')
      .update({ enrichment_status: 'failed' })
      .eq('id', startup.id);
    
    return false;
  }
}

/**
 * Get startups that need enrichment
 */
async function getStartupsNeedingEnrichment(limit: number = 10): Promise<StartupRecord[]> {
  const { data, error } = await supabase
    .from('startups')
    .select('*')
    .eq('needs_enrichment', true)
    .in('enrichment_status', ['pending', 'failed'])
    .limit(limit);
  
  if (error) {
    throw error;
  }
  
  return data || [];
}

/**
 * Main enrichment function
 */
async function enrichStartups(limit?: number) {
  console.log('🚀 Starting startup data enrichment...\n');
  
  // Get startups that need enrichment
  const startups = await getStartupsNeedingEnrichment(limit);
  
  if (startups.length === 0) {
    console.log('✅ No startups need enrichment!');
    return;
  }
  
  console.log(`Found ${startups.length} startups needing enrichment\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < startups.length; i++) {
    const startup = startups[i];
    const success = await enrichStartup(startup);
    
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`\n=== Enrichment Complete ===`);
  console.log(`Total processed: ${startups.length}`);
  console.log(`Successfully enriched: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
}

/**
 * Enrich a specific startup by ID
 */
async function enrichStartupById(startupId: string) {
  const { data, error } = await supabase
    .from('startups')
    .select('*')
    .eq('id', startupId)
    .single();
  
  if (error || !data) {
    throw new Error(`Startup not found: ${startupId}`);
  }
  
  await enrichStartup(data);
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] && args[0].startsWith('--id=')) {
    // Enrich specific startup by ID
    const startupId = args[0].replace('--id=', '');
    enrichStartupById(startupId)
      .then(() => {
        console.log('\n✅ Enrichment completed!');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n❌ Enrichment failed:', error);
        process.exit(1);
      });
  } else {
    // Enrich all startups needing enrichment
    const limit = args[0] ? parseInt(args[0]) : undefined;
    enrichStartups(limit)
      .then(() => {
        console.log('\n✅ Enrichment completed!');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n❌ Enrichment failed:', error);
        process.exit(1);
      });
  }
}

export { enrichStartups, enrichStartupById, enrichStartup };

