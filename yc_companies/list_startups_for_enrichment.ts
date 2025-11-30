/**
 * Helper script to list startups that need enrichment
 * Useful for finding a startup ID to test enrichment
 */

import { resolve } from 'path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listStartupsNeedingEnrichment(limit: number = 10, showAll: boolean = false) {
  let query = supabase
    .from('startups')
    .select('id, name, description, needs_enrichment, enrichment_status, enrichment_quality_score, enrichment_quality_status, data_source, founder_names, website')
    .limit(limit);

  if (showAll) {
    // Show all startups for diagnostics
    console.log('🔍 Diagnostic mode: Showing all startups...\n');
  } else {
    // Try multiple query strategies to find startups needing enrichment
    // Strategy 1: Explicitly marked as needing enrichment
    query = query.or('needs_enrichment.eq.true,enrichment_status.in.(pending,failed,needs_review),enrichment_status.is.null');
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    console.log('✅ No startups found!');
    console.log('\n💡 Try running with --all flag to see all startups:');
    console.log('   npm run list-startups -- --all');
    return;
  }

  // Filter to only show those that actually need enrichment
  const needingEnrichment = data.filter(startup => {
    if (showAll) return true;
    
    // Needs enrichment if:
    // 1. Explicitly marked
    // 2. Status is pending/failed/needs_review/null
    // 3. Missing critical fields (founder_names or website)
    const needsEnrichmentFlag = startup.needs_enrichment === true;
    const hasBadStatus = !startup.enrichment_status || 
                        ['pending', 'failed', 'needs_review'].includes(startup.enrichment_status);
    const missingCriticalFields = !startup.founder_names || !startup.website;
    
    return needsEnrichmentFlag || hasBadStatus || missingCriticalFields;
  });

  if (needingEnrichment.length === 0 && !showAll) {
    console.log('✅ No startups need enrichment!');
    console.log(`\n📊 Found ${data.length} total startups in database`);
    console.log('\n💡 To see all startups, run:');
    console.log('   npm run list-startups -- --all');
    return;
  }

  const displayData = showAll ? data : needingEnrichment;
  console.log(`\n📋 Found ${displayData.length} startup${displayData.length === 1 ? '' : 's'} ${showAll ? 'in database' : 'needing enrichment'}:\n`);
  
  displayData.forEach((startup, index) => {
    console.log(`${index + 1}. ${startup.name}`);
    console.log(`   ID: ${startup.id}`);
    console.log(`   Needs Enrichment: ${startup.needs_enrichment ? '✅ YES' : '❌ NO'}`);
    console.log(`   Status: ${startup.enrichment_status || 'NULL (not set)'}`);
    if (startup.enrichment_quality_status) {
      const score = startup.enrichment_quality_score 
        ? `${(startup.enrichment_quality_score * 100).toFixed(0)}%` 
        : 'N/A';
      console.log(`   Quality: ${startup.enrichment_quality_status} (${score})`);
    }
    console.log(`   Has Founder Names: ${startup.founder_names ? '✅' : '❌'}`);
    console.log(`   Has Website: ${startup.website ? '✅' : '❌'}`);
    console.log(`   Source: ${startup.data_source || 'unknown'}`);
    console.log(`   Description: ${startup.description?.substring(0, 80) || 'N/A'}...`);
    console.log(`   Command: npm run enrich-startup -- --id=${startup.id}`);
    console.log('');
  });

  if (displayData.length > 0) {
    console.log(`\n💡 To enrich the first startup, run:`);
    console.log(`   npm run enrich-startup -- --id=${displayData[0].id}`);
    console.log(`\n🤖 Or use agentic enrichment:`);
    console.log(`   npm run enrich-agentic -- --id=${displayData[0].id}`);
    
    if (!showAll) {
      console.log(`\n📊 Summary:`);
      const withFlag = displayData.filter(s => s.needs_enrichment).length;
      const withBadStatus = displayData.filter(s => !s.enrichment_status || ['pending', 'failed', 'needs_review'].includes(s.enrichment_status)).length;
      const missingFields = displayData.filter(s => !s.founder_names || !s.website).length;
      console.log(`   Marked needs_enrichment=true: ${withFlag}`);
      console.log(`   Bad status: ${withBadStatus}`);
      console.log(`   Missing critical fields: ${missingFields}`);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const showAll = args.includes('--all') || args.includes('-a');
  const limitArg = args.find(arg => !arg.startsWith('--') && !isNaN(parseInt(arg)));
  const limit = limitArg ? parseInt(limitArg) : 10;
  
  listStartupsNeedingEnrichment(limit, showAll)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { listStartupsNeedingEnrichment };

