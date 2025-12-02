/**
 * Re-scrape Missing Data from YC Pages
 * 
 * This script identifies startups missing critical fields (founder names, emails, website)
 * and re-scrapes them from YC pages to fill in the missing information.
 * 
 * It updates existing records instead of creating new ones.
 * 
 * Usage:
 *   npx tsx yc_companies/re_scrape_missing_data.ts
 *   npx tsx yc_companies/re_scrape_missing_data.ts --limit=50  # Process only 50 startups
 *   npx tsx yc_companies/re_scrape_missing_data.ts --fields=founder_names,website  # Only fix specific fields
 * 
 * Note: Email discovery is DISABLED by default. Emails depend on founder names, so:
 *   1. First: Run this script to get all founder names
 *   2. Then: Run enrich_founder_emails.ts to discover emails in batch
 * 
 * Workflow:
 *   Step 1: npm run re-scrape:missing  # Get founder names, websites, etc.
 *   Step 2: npm run enrich:emails       # Discover emails for all founders
 */

import { resolve } from 'path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });

import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { scrapeYCCompanyPage, extractCompanySlug } from './scrape_yc_companies';
import { discoverFounderEmails } from './founder_email_discovery';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

interface StartupRecord {
  id: string;
  name: string;
  yc_link?: string | null;
  website?: string | null;
  founder_names?: string | null;
  founder_first_name?: string | null;
  founder_emails?: string | null;
  founder_linkedin?: string | null;
  location?: string | null;
  data_source?: string | null;
}

/**
 * Helper to check if a value is null or empty
 */
function isEmpty(value: any): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

/**
 * Check if a startup is missing critical fields
 */
function isMissingCriticalFields(startup: StartupRecord): {
  missing: boolean;
  missingFields: string[];
  needsWebsite: boolean;
  needsFounderNames: boolean;
  needsFounderEmails: boolean;
} {
  const missingFields: string[] = [];
  let needsWebsite = false;
  let needsFounderNames = false;
  let needsFounderEmails = false;

  // Check website
  if (isEmpty(startup.website)) {
    missingFields.push('website');
    needsWebsite = true;
  }

  // Check founder names (check both founder_names and founder_first_name)
  if (isEmpty(startup.founder_names) && isEmpty(startup.founder_first_name)) {
    missingFields.push('founder_names');
    needsFounderNames = true;
  }

  // Check founder emails
  if (isEmpty(startup.founder_emails)) {
    missingFields.push('founder_emails');
    needsFounderEmails = true;
  }

  return {
    missing: missingFields.length > 0,
    missingFields,
    needsWebsite,
    needsFounderNames,
    needsFounderEmails,
  };
}

/**
 * Get startups missing critical fields
 */
async function getStartupsMissingData(
  limit?: number,
  fieldFilter?: string[]
): Promise<StartupRecord[]> {
  console.log('🔍 Finding startups missing critical data...\n');

  // Build query
  let query = supabase
    .from('startups')
    .select('id, name, yc_link, website, founder_names, founder_first_name, founder_emails, founder_linkedin, location, data_source')
    .eq('data_source', 'yc')
    .not('yc_link', 'is', null);

  // Apply field filters if specified
  if (fieldFilter) {
    if (fieldFilter.includes('website')) {
      query = query.or('website.is.null,website.eq.');
    }
    if (fieldFilter.includes('founder_names')) {
      query = query.or('founder_names.is.null,founder_names.eq.,founder_first_name.is.null,founder_first_name.eq.');
    }
    if (fieldFilter.includes('founder_emails')) {
      query = query.or('founder_emails.is.null,founder_emails.eq.');
    }
   } else {
     // Default: find startups missing founder names OR website (NOT emails)
     // Emails are discovered separately via enrich_founder_emails.ts after names are populated
     query = query.or(
       'website.is.null,website.eq.,' +
       'founder_names.is.null,founder_names.eq.,' +
       'founder_first_name.is.null,founder_first_name.eq.'
       // Note: founder_emails excluded - use enrich_founder_emails.ts after getting names
     );
   }

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching startups:', error);
    throw error;
  }

   // Filter to only those actually missing founder names or website (NOT just emails)
   const missing = (data || []).filter(startup => {
     const check = isMissingCriticalFields(startup);
     // Only include if missing founder names OR website (not just emails)
     return check.needsFounderNames || check.needsWebsite;
   });

  return missing;
}

/**
 * Update startup with missing data from scraped page
 * Only updates fields that are currently NULL or empty
 */
async function updateStartupWithScrapedData(
  startupId: string,
  pageData: any,
  currentStartup: StartupRecord,
  skipEmailDiscovery: boolean = false
): Promise<{ updated: boolean; emailEnriched: boolean }> {
  try {
    const updates: any = {};
    let emailEnriched = false;

    // Helper to convert empty strings to null
    const toNull = (value: string | undefined): string | null => {
      return value && value.trim() ? value.trim() : null;
    };

    // Helper to check if field is empty
    const isEmpty = (value: any): boolean => {
      return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
    };

    // Format founder names - only update if currently missing
    if (pageData.founders && pageData.founders.length > 0) {
      const founderNames = pageData.founders
        .map((f: any) => `${f.firstName} ${f.lastName}`.trim())
        .filter((name: string) => name.length > 0)
        .join(', ');

      const founderLinkedIns = pageData.founders
        .map((f: any) => f.linkedIn)
        .filter((linkedin: string) => linkedin && linkedin.length > 0)
        .join(', ');

      const firstFounder = pageData.founders[0];

      // Only update if currently missing
      if (founderNames && (isEmpty(currentStartup.founder_names) && isEmpty(currentStartup.founder_first_name))) {
        updates.founder_names = toNull(founderNames);
        updates.founder_first_name = toNull(firstFounder.firstName);
        if (firstFounder.lastName) {
          updates.founder_last_name = toNull(firstFounder.lastName);
        }
      }

      // Only update LinkedIn if currently missing
      if (founderLinkedIns && isEmpty(currentStartup.founder_linkedin)) {
        updates.founder_linkedin = toNull(founderLinkedIns);
      }
    }

    // Update website only if currently missing
    if (pageData.website && isEmpty(currentStartup.website)) {
      updates.website = toNull(pageData.website);
    }

    // Update location if available and currently missing
    if (pageData.location && isEmpty(currentStartup.location)) {
      updates.location = toNull(pageData.location);
    }

    // Email discovery is disabled by default - run enrich_founder_emails.ts separately after getting names
    // This is because emails depend on founder names, so we should:
    // 1. First: Re-scrape to get all founder names (this script)
    // 2. Then: Run enrich_founder_emails.ts to discover emails in batch
    if (!skipEmailDiscovery && updates.founder_names && updates.website) {
      console.log(`   💡 Email discovery skipped (use enrich_founder_emails.ts after getting all names)`);
      // Uncomment below if you want to enable email discovery during re-scraping:
      /*
      try {
        const founders = pageData.founders.map((f: any) => ({
          name: `${f.firstName} ${f.lastName}`.trim(),
          linkedin: f.linkedIn,
        }));

        const domain = updates.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        
        if (domain) {
          console.log(`   📧 Discovering emails for founders @ ${domain}...`);
          const emailResult = await discoverFounderEmails(founders, domain, 2);

          if (emailResult.emailsFound > 0) {
            const emails = emailResult.founders
              .filter((f: any) => f.email)
              .map((f: any) => f.email)
              .join(', ');
            
            if (emails) {
              updates.founder_emails = emails;
              emailEnriched = true;
              console.log(`   ✅ Found ${emailResult.emailsFound} email(s)`);
            }
          }
        }
      } catch (emailError) {
        console.warn(`   ⚠️  Email discovery failed: ${emailError instanceof Error ? emailError.message : String(emailError)}`);
      }
      */
    }

    // Only update if we have something to update
    if (Object.keys(updates).length === 0) {
      return { updated: false, emailEnriched: false };
    }

    // Log what we're updating
    console.log(`   📝 Updating fields: ${Object.keys(updates).join(', ')}`);

    // Update the startup
    const { data, error: updateError } = await supabase
      .from('startups')
      .update(updates)
      .eq('id', startupId)
      .select(); // Select to verify update

    if (updateError) {
      console.error(`   ❌ Error updating startup: ${updateError.message}`);
      console.error(`   Details:`, updateError);
      return { updated: false, emailEnriched: false };
    }

    if (!data || data.length === 0) {
      console.error(`   ❌ No rows updated - startup may not exist`);
      return { updated: false, emailEnriched: false };
    }

    console.log(`   ✅ Successfully updated ${Object.keys(updates).length} field(s) in database`);

    return { updated: true, emailEnriched };
  } catch (error) {
    console.error(`   ❌ Error updating startup: ${error instanceof Error ? error.message : String(error)}`);
    return { updated: false, emailEnriched: false };
  }
}

/**
 * Main re-scraping function
 */
async function reScrapeMissingData() {
  console.log('🔄 Re-scraping Missing Data from YC Pages\n');

  // Get command line arguments
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='))?.split('=')[1];
  const fieldsArg = args.find(arg => arg.startsWith('--fields='))?.split('=')[1];
  
  // Email discovery is DISABLED by default - emails depend on founder names
  // Workflow: 1) Re-scrape to get names → 2) Run enrich_founder_emails.ts for emails
  // Use --enable-email-discovery to enable it (not recommended)
  const skipEmailDiscovery = !args.includes('--enable-email-discovery');

  const limit = limitArg ? parseInt(limitArg, 10) : undefined;
  const fieldFilter = fieldsArg ? fieldsArg.split(',').map(f => f.trim()) : undefined;

  // Test Supabase connection
  try {
    const { error } = await supabase.from('startups').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    console.log('✓ Connected to Supabase\n');
  } catch (error) {
    throw new Error(`Cannot connect to Supabase: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Get startups missing data
  const startups = await getStartupsMissingData(limit, fieldFilter);
  console.log(`📊 Found ${startups.length} startups missing critical data\n`);

  if (startups.length === 0) {
    console.log('✅ All startups have complete data!');
    return;
  }

   // Show summary of what's missing (focus on names and website, not emails)
   const missingCounts = {
     website: 0,
     founder_names: 0,
   };

   startups.forEach(startup => {
     const check = isMissingCriticalFields(startup);
     if (check.needsWebsite) missingCounts.website++;
     if (check.needsFounderNames) missingCounts.founder_names++;
   });

   console.log('📋 Missing data breakdown:');
   console.log(`   Missing website: ${missingCounts.website}`);
   console.log(`   Missing founder names: ${missingCounts.founder_names}`);
   console.log(`   Note: Emails will be discovered separately via enrich_founder_emails.ts\n`);

  // Email discovery is disabled by default - better to run enrich_founder_emails.ts separately
  // after getting all founder names first
  if (skipEmailDiscovery) {
    console.log('💡 Email discovery is disabled (emails depend on founder names)');
    console.log('   → Step 1: Run this script to get founder names');
    console.log('   → Step 2: Run "npx tsx yc_companies/enrich_founder_emails.ts" to discover emails\n');
  } else {
    console.log('⚠️  Email discovery is enabled (--enable-email-discovery)');
    console.log('   Note: It\'s better to run enrich_founder_emails.ts separately after getting all names\n');
  }

  // Launch browser
  console.log('🌐 Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let successCount = 0;
  let updatedCount = 0;
  let emailEnrichedCount = 0;
  let errorCount = 0;

  try {
    for (let i = 0; i < startups.length; i++) {
      const startup = startups[i];
      const check = isMissingCriticalFields(startup);

      console.log(`\n[${i + 1}/${startups.length}] 🏢 Processing: ${startup.name}`);
      console.log(`   Missing: ${check.missingFields.join(', ')}`);

      if (!startup.yc_link) {
        console.log('   ⚠️  No YC link, skipping...');
        errorCount++;
        continue;
      }

      try {
        // Check if page is still valid, recreate if needed
        if (page.isClosed()) {
          console.log('   ⚠️  Page was closed, creating new page...');
          page = await browser.newPage();
          await page.setViewport({ width: 1920, height: 1080 });
          await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        }
        
        // Scrape YC page
        console.log(`   🔍 Scraping: ${startup.yc_link}`);
        const pageData = await scrapeYCCompanyPage(page, startup.yc_link);

        if (!pageData) {
          console.log('   ❌ Failed to scrape page data');
          errorCount++;
          // Wait a bit before continuing to avoid overwhelming
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // Show what we found
        console.log(`   Found ${pageData.founders.length} founder(s)`);
        if (pageData.website) {
          console.log(`   Website: ${pageData.website}`);
        }

        // Update startup with scraped data (only fill in missing fields)
        const result = await updateStartupWithScrapedData(
          startup.id,
          pageData,
          startup,
          skipEmailDiscovery
        );

        if (result.updated) {
          updatedCount++;
          console.log('   ✅ Updated database');
          
          if (result.emailEnriched) {
            emailEnrichedCount++;
          }
        } else {
          console.log('   ℹ️  No new data to update');
        }

        successCount++;

        // Rate limiting
        if (i < startups.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        }

      } catch (error) {
        errorCount++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ Error: ${errorMsg}`);
        
        // If it's a detached frame error, recreate the page
        if (errorMsg.includes('detached') || errorMsg.includes('Target closed')) {
          try {
            console.log('   🔄 Recreating page due to detached frame...');
            page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
          } catch (recreateError) {
            console.warn(`   ⚠️  Failed to recreate page: ${recreateError instanceof Error ? recreateError.message : String(recreateError)}`);
          }
        }
        
        // Wait before continuing
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } finally {
    try {
      // Try to close browser gracefully
      await browser.close();
      console.log('\n🌐 Browser closed');
    } catch (closeError: any) {
      // Ignore lockfile errors - they're usually harmless
      if (closeError?.code === 'EBUSY') {
        console.warn('\n⚠️  Browser cleanup warning (lockfile busy - this is usually harmless)');
      } else {
        console.error(`\n⚠️  Browser cleanup error: ${closeError instanceof Error ? closeError.message : String(closeError)}`);
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Re-scraping Complete');
  console.log('='.repeat(60));
  console.log(`Total processed: ${startups.length}`);
  console.log(`Successfully scraped: ${successCount}`);
  console.log(`Updated in database: ${updatedCount}`);
  console.log(`Emails enriched: ${emailEnrichedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log('='.repeat(60));
}

// Run the script
if (require.main === module) {
  reScrapeMissingData()
    .then(() => {
      console.log('\n✅ Process completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Process failed:', error);
      process.exit(1);
    });
}

export { reScrapeMissingData, getStartupsMissingData, isMissingCriticalFields, updateStartupWithScrapedData };

