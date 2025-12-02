/**
 * Test Single Startup Update
 * 
 * Tests scraping and updating a single startup to debug why data isn't populating
 * 
 * Usage:
 *   npx tsx yc_companies/test_single_update.ts --name="mlop"
 *   npx tsx yc_companies/test_single_update.ts --id="<startup-id>"
 */

import { resolve } from 'path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });

import puppeteer from 'puppeteer';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { scrapeYCCompanyPage } from './scrape_yc_companies';
import { updateStartupWithScrapedData } from './re_scrape_missing_data';

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

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

async function testSingleUpdate() {
  const args = process.argv.slice(2);
  const nameArg = args.find(arg => arg.startsWith('--name='))?.split('=')[1];
  const idArg = args.find(arg => arg.startsWith('--id='))?.split('=')[1];

  if (!nameArg && !idArg) {
    console.error('❌ Please provide --name="Company Name" or --id="startup-id"');
    process.exit(1);
  }

  console.log('🔍 Finding startup in database...\n');

  // Fetch startup
  let query = supabase
    .from('startups')
    .select('id, name, yc_link, website, founder_names, founder_first_name, founder_emails, founder_linkedin, location, data_source')
    .eq('data_source', 'yc')
    .limit(1);

  if (nameArg) {
    query = query.ilike('name', `%${nameArg}%`);
  } else if (idArg) {
    query = query.eq('id', idArg);
  }

  const { data: startups, error: fetchError } = await query;

  if (fetchError) {
    console.error('❌ Error fetching startup:', fetchError);
    process.exit(1);
  }

  if (!startups || startups.length === 0) {
    console.error(`❌ No startup found with ${nameArg ? `name "${nameArg}"` : `id "${idArg}"`}`);
    process.exit(1);
  }

  const startup = startups[0];

  console.log('📊 Current Startup Data:');
  console.log(`   ID: ${startup.id}`);
  console.log(`   Name: ${startup.name}`);
  console.log(`   YC Link: ${startup.yc_link || 'N/A'}`);
  console.log(`   Website: ${startup.website || 'NULL'}`);
  console.log(`   Founder Names: ${startup.founder_names || 'NULL'}`);
  console.log(`   Founder First Name: ${startup.founder_first_name || 'NULL'}`);
  console.log(`   Founder Emails: ${startup.founder_emails || 'NULL'}`);
  console.log(`   Founder LinkedIn: ${startup.founder_linkedin || 'NULL'}`);
  console.log('');

  if (!startup.yc_link) {
    console.error('❌ No YC link found. Cannot scrape.');
    process.exit(1);
  }

  console.log('🌐 Launching browser...');
  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    console.log(`\n🔍 Scraping: ${startup.yc_link}`);
    const pageData = await scrapeYCCompanyPage(page, startup.yc_link);

    if (!pageData) {
      console.error('❌ Failed to scrape page data');
      await browser.close();
      process.exit(1);
    }

    console.log('\n📋 Scraped Data:');
    console.log(`   Founders: ${pageData.founders.length}`);
    pageData.founders.forEach((f: any, i: number) => {
      console.log(`      ${i + 1}. ${f.firstName} ${f.lastName}`);
      if (f.linkedIn) console.log(`         LinkedIn: ${f.linkedIn}`);
      if (f.description) console.log(`         Description: ${f.description.substring(0, 100)}...`);
    });
    console.log(`   Website: ${pageData.website || 'N/A'}`);
    console.log(`   Location: ${pageData.location || 'N/A'}`);

    console.log('\n💾 Updating database...');
    const result = await updateStartupWithScrapedData(
      startup.id,
      pageData,
      startup as any,
      false // Don't skip email discovery
    );

    console.log('\n📊 Update Result:');
    console.log(`   Updated: ${result.updated ? '✅ YES' : '❌ NO'}`);
    console.log(`   Email Enriched: ${result.emailEnriched ? '✅ YES' : '❌ NO'}`);

    if (result.updated) {
      // Verify the update
      console.log('\n🔍 Verifying update in database...');
      const { data: updatedStartup, error: verifyError } = await supabase
        .from('startups')
        .select('website, founder_names, founder_first_name, founder_emails, founder_linkedin')
        .eq('id', startup.id)
        .single();

      if (verifyError) {
        console.error('❌ Error verifying update:', verifyError);
      } else {
        console.log('✅ Verified Updated Data:');
        console.log(`   Website: ${updatedStartup.website || 'NULL'}`);
        console.log(`   Founder Names: ${updatedStartup.founder_names || 'NULL'}`);
        console.log(`   Founder First Name: ${updatedStartup.founder_first_name || 'NULL'}`);
        console.log(`   Founder Emails: ${updatedStartup.founder_emails || 'NULL'}`);
        console.log(`   Founder LinkedIn: ${updatedStartup.founder_linkedin || 'NULL'}`);
      }
    }

    console.log('\n✅ Test complete!');
    console.log('   Browser will stay open for 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await browser.close();
  }
}

testSingleUpdate()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });

