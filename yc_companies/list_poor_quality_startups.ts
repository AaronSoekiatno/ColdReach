/**
 * Helper script to list startups with poor enrichment quality
 * These startups need manual review/enrichment
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

interface StartupRecord {
  id: string;
  name: string;
  description?: string;
  enrichment_status?: string;
  enrichment_quality_score?: number;
  enrichment_quality_status?: string;
  founder_names?: string;
  website?: string;
  data_source?: string;
}

async function listPoorQualityStartups(limit: number = 20) {
  // Find startups with poor or failed quality
  const { data, error } = await supabase
    .from('startups')
    .select('id, name, description, enrichment_status, enrichment_quality_score, enrichment_quality_status, founder_names, website, data_source')
    .in('enrichment_quality_status', ['poor', 'failed'])
    .order('enrichment_quality_score', { ascending: true }) // Worst quality first
    .limit(limit);

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    console.log('✅ No startups with poor quality found!');
    return;
  }

  console.log(`\n📋 Found ${data.length} startups needing manual enrichment:\n`);
  
  // Group by quality status
  const poor = data.filter(s => s.enrichment_quality_status === 'poor');
  const failed = data.filter(s => s.enrichment_quality_status === 'failed');

  if (failed.length > 0) {
    console.log(`❌ FAILED (${failed.length} startups):\n`);
    failed.forEach((startup, index) => {
      const score = startup.enrichment_quality_score 
        ? `${(startup.enrichment_quality_score * 100).toFixed(0)}%` 
        : 'N/A';
      console.log(`${index + 1}. ${startup.name}`);
      console.log(`   ID: ${startup.id}`);
      console.log(`   Quality Score: ${score}`);
      console.log(`   Status: ${startup.enrichment_status || 'unknown'}`);
      console.log(`   Has Founder Names: ${startup.founder_names ? '✅' : '❌'}`);
      console.log(`   Has Website: ${startup.website ? '✅' : '❌'}`);
      console.log(`   Description: ${startup.description?.substring(0, 80) || 'N/A'}...`);
      console.log('');
    });
  }

  if (poor.length > 0) {
    console.log(`\n⚠️  POOR QUALITY (${poor.length} startups):\n`);
    poor.forEach((startup, index) => {
      const score = startup.enrichment_quality_score 
        ? `${(startup.enrichment_quality_score * 100).toFixed(0)}%` 
        : 'N/A';
      console.log(`${index + 1}. ${startup.name}`);
      console.log(`   ID: ${startup.id}`);
      console.log(`   Quality Score: ${score}`);
      console.log(`   Status: ${startup.enrichment_status || 'unknown'}`);
      console.log(`   Has Founder Names: ${startup.founder_names ? '✅' : '❌'}`);
      console.log(`   Has Website: ${startup.website ? '✅' : '❌'}`);
      console.log(`   Description: ${startup.description?.substring(0, 80) || 'N/A'}...`);
      console.log('');
    });
  }

  // Summary
  console.log(`\n📊 Summary:`);
  console.log(`   Failed: ${failed.length}`);
  console.log(`   Poor Quality: ${poor.length}`);
  console.log(`   Total: ${data.length}`);
  
  if (data.length > 0) {
    console.log(`\n💡 To manually enrich a startup, update it in the database:`);
    console.log(`   UPDATE startups SET ... WHERE id = '${data[0].id}';`);
    console.log(`\n   Or use the Supabase dashboard to edit the record.`);
  }
}

// Run if called directly
if (require.main === module) {
  const limit = process.argv[2] ? parseInt(process.argv[2]) : 20;
  listPoorQualityStartups(limit)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { listPoorQualityStartups };

