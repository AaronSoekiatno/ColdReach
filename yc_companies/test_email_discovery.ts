/**
 * Test Script for Phase 1: Enhanced Email Discovery
 *
 * This script tests the enhanced email discovery on real companies
 * from the database and measures success rates.
 */

import { resolve } from 'path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { discoverFounderEmails, FounderEmailDiscoveryResult } from './founder_email_discovery';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface TestResult {
  companyName: string;
  website: string;
  foundersFound: number;
  emailsFound: number;
  primaryFounder: string;
  primaryEmail: string;
  emailSources: string[];
  tier1Success: boolean;
  tier2Success: boolean;
  success: boolean;
  errorMessage?: string;
}

/**
 * Get test companies from database
 * Prioritize recently added companies from TechCrunch
 */
async function getTestCompanies(limit: number = 10): Promise<any[]> {
  console.log(`📊 Fetching ${limit} test companies from database...\n`);

  const { data, error } = await supabase
    .from('startups')
    .select('id, name, website, data_source, created_at')
    .eq('data_source', 'techcrunch')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    console.warn('⚠️  No TechCrunch companies found in database.');
    console.warn('   Run the TechCrunch scraper first: npm run scrape-techcrunch\n');
    throw new Error('No test companies available');
  }

  console.log(`✅ Found ${data.length} companies for testing:\n`);
  data.forEach((company, i) => {
    console.log(`   ${i + 1}. ${company.name} (${company.website || 'no website'})`);
  });
  console.log('');

  return data;
}

/**
 * Test email discovery on a single company
 */
async function testCompany(company: any): Promise<TestResult> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${company.name}`);
  console.log(`Website: ${company.website || 'N/A'}`);
  console.log(`${'='.repeat(80)}\n`);

  const result: TestResult = {
    companyName: company.name,
    website: company.website || '',
    foundersFound: 0,
    emailsFound: 0,
    primaryFounder: '',
    primaryEmail: '',
    emailSources: [],
    tier1Success: false,
    tier2Success: false,
    success: false,
  };

  try {
    // Run email discovery
    const discoveryResult: FounderEmailDiscoveryResult = await discoverFounderEmails(
      company.name,
      company.website,
      false // No Hunter.io
    );

    result.foundersFound = discoveryResult.totalFound;
    result.emailsFound = discoveryResult.emailsFound;

    if (discoveryResult.primaryFounder) {
      result.primaryFounder = discoveryResult.primaryFounder.name;
      result.primaryEmail = discoveryResult.primaryFounder.email || '';
    }

    // Track which sources found emails
    result.emailSources = discoveryResult.founders
      .filter(f => f.email && f.emailSource)
      .map(f => f.emailSource!)
      .filter((source, index, self) => self.indexOf(source) === index);

    // Determine which tier succeeded
    const tier1Sources = ['website', 'linkedin', 'github'];
    const tier2Sources = ['angellist', 'producthunt'];

    result.tier1Success = result.emailSources.some(s => tier1Sources.includes(s));
    result.tier2Success = result.emailSources.some(s => tier2Sources.includes(s));
    result.success = result.emailsFound > 0;

    // Log results
    console.log(`\n📊 Results:`);
    console.log(`   Founders found: ${result.foundersFound}`);
    console.log(`   Emails found: ${result.emailsFound}`);

    if (result.primaryFounder) {
      console.log(`   Primary founder: ${result.primaryFounder}`);
      console.log(`   Primary email: ${result.primaryEmail || 'N/A'}`);
    }

    if (result.emailSources.length > 0) {
      console.log(`   Email sources: ${result.emailSources.join(', ')}`);
      console.log(`   Tier 1 success: ${result.tier1Success ? '✅' : '❌'}`);
      console.log(`   Tier 2 success: ${result.tier2Success ? '✅' : '❌'}`);
    }

    // Show all founders
    if (discoveryResult.founders.length > 0) {
      console.log(`\n   All founders found:`);
      discoveryResult.founders.forEach((founder, i) => {
        const emailStatus = founder.email ? `✅ ${founder.email}` : '❌ No email';
        const source = founder.emailSource ? ` (${founder.emailSource})` : '';
        const confidence = founder.confidence ? ` [${(founder.confidence * 100).toFixed(0)}%]` : '';
        console.log(`      ${i + 1}. ${founder.name} - ${emailStatus}${source}${confidence}`);
        if (founder.linkedin) {
          console.log(`         LinkedIn: ${founder.linkedin}`);
        }
        if (founder.role) {
          console.log(`         Role: ${founder.role}`);
        }
      });
    }

    if (result.success) {
      console.log(`\n✅ SUCCESS: Found at least one founder email`);
    } else {
      console.log(`\n⚠️  NO EMAILS FOUND: Will need manual Hunter.io lookup`);
    }

  } catch (error) {
    result.errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ ERROR: ${result.errorMessage}`);
  }

  return result;
}

/**
 * Calculate and display statistics
 */
function displayStatistics(results: TestResult[]) {
  console.log(`\n\n${'='.repeat(80)}`);
  console.log(`TEST RESULTS SUMMARY`);
  console.log(`${'='.repeat(80)}\n`);

  const totalCompanies = results.length;
  const successfulCompanies = results.filter(r => r.success).length;
  const failedCompanies = results.filter(r => !r.success).length;
  const erroredCompanies = results.filter(r => r.errorMessage).length;

  const totalEmails = results.reduce((sum, r) => sum + r.emailsFound, 0);
  const tier1Successes = results.filter(r => r.tier1Success).length;
  const tier2Successes = results.filter(r => r.tier2Success).length;

  console.log(`📊 Overall Statistics:`);
  console.log(`   Total companies tested: ${totalCompanies}`);
  console.log(`   Companies with emails: ${successfulCompanies} (${(successfulCompanies / totalCompanies * 100).toFixed(1)}%)`);
  console.log(`   Companies without emails: ${failedCompanies} (${(failedCompanies / totalCompanies * 100).toFixed(1)}%)`);
  console.log(`   Errors encountered: ${erroredCompanies}`);
  console.log(`   Total emails found: ${totalEmails}`);
  console.log(`   Avg emails per company: ${(totalEmails / totalCompanies).toFixed(1)}`);

  console.log(`\n🎯 Success by Tier:`);
  console.log(`   Tier 1 (Website, LinkedIn, GitHub): ${tier1Successes} (${(tier1Successes / totalCompanies * 100).toFixed(1)}%)`);
  console.log(`   Tier 2 (AngelList, Product Hunt): ${tier2Successes} (${(tier2Successes / totalCompanies * 100).toFixed(1)}%)`);

  // Source breakdown
  const allSources = results.flatMap(r => r.emailSources);
  const sourceCounts: Record<string, number> = {};
  allSources.forEach(source => {
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
  });

  if (Object.keys(sourceCounts).length > 0) {
    console.log(`\n📍 Email Sources Breakdown:`);
    Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([source, count]) => {
        console.log(`   ${source}: ${count} (${(count / totalCompanies * 100).toFixed(1)}%)`);
      });
  }

  // Success criteria check
  console.log(`\n✅ Success Criteria:`);
  const targetSuccessRate = 60;
  const actualSuccessRate = (successfulCompanies / totalCompanies * 100);
  const meetsTarget = actualSuccessRate >= targetSuccessRate;

  console.log(`   Target: ${targetSuccessRate}% success rate`);
  console.log(`   Actual: ${actualSuccessRate.toFixed(1)}%`);
  console.log(`   Status: ${meetsTarget ? '✅ PASSED' : '❌ FAILED'}`);

  // List companies that need manual Hunter.io lookup
  const needsManualLookup = results.filter(r => !r.success && !r.errorMessage);
  if (needsManualLookup.length > 0) {
    console.log(`\n⚠️  Companies needing manual Hunter.io lookup (${needsManualLookup.length}):`);
    needsManualLookup.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.companyName} (${r.website || 'no website'})`);
    });
  }

  // List errors
  const errored = results.filter(r => r.errorMessage);
  if (errored.length > 0) {
    console.log(`\n❌ Companies with errors (${errored.length}):`);
    errored.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.companyName}: ${r.errorMessage}`);
    });
  }

  console.log(`\n${'='.repeat(80)}\n`);
}

/**
 * Export results to JSON for analysis
 */
async function exportResults(results: TestResult[]) {
  const fs = await import('fs/promises');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `test-results-${timestamp}.json`;
  const filepath = resolve(process.cwd(), 'yc_companies', filename);

  await fs.writeFile(filepath, JSON.stringify(results, null, 2));
  console.log(`📁 Results exported to: ${filename}\n`);
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 Phase 1: Enhanced Email Discovery Testing\n');
  console.log('This will test the email discovery on real companies from your database.\n');

  try {
    // Get test companies
    const testLimit = parseInt(process.env.TEST_LIMIT || '10');
    const companies = await getTestCompanies(testLimit);

    // Test each company
    const results: TestResult[] = [];
    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      const result = await testCompany(company);
      results.push(result);

      // Small delay between companies to avoid rate limiting
      if (i < companies.length - 1) {
        console.log(`\n⏳ Waiting 3 seconds before next company...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Display statistics
    displayStatistics(results);

    // Export results
    await exportResults(results);

    // Final summary
    const successRate = (results.filter(r => r.success).length / results.length * 100);
    if (successRate >= 60) {
      console.log('✅ Phase 1 testing PASSED! Ready to proceed with Phase 2.\n');
    } else {
      console.log('⚠️  Phase 1 testing shows lower than expected success rate.');
      console.log('   Consider tweaking search strategies or adding more sources.\n');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  runTests()
    .then(() => {
      console.log('✅ Testing complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Testing failed:', error);
      process.exit(1);
    });
}

export { runTests, testCompany, getTestCompanies };
