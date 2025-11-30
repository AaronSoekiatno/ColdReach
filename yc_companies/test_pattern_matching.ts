/**
 * Simple test for email pattern matching + verification
 *
 * This tests ONLY the pattern matching functionality, using hardcoded founder names.
 * We skip the web search part entirely to avoid rate limiting.
 */

import { resolve } from 'path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });

import {
  generateEmailPatterns,
  verifyEmailWithRapid,
  findFounderEmailByPattern
} from './email_pattern_matcher';

interface TestCase {
  companyName: string;
  founderName: string;
  domain: string;
}

// Test cases with known founders (from TechCrunch/public data)
const testCases: TestCase[] = [
  {
    companyName: 'Revolut',
    founderName: 'Nikolay Storonsky',
    domain: 'revolut.com',
  },
  {
    companyName: 'Revolut',
    founderName: 'Vlad Yatsenko',
    domain: 'revolut.com',
  },
  {
    companyName: 'Sierra',
    founderName: 'Bret Taylor',
    domain: 'sierra.ai',
  },
  {
    companyName: 'Find Your Grind',
    founderName: 'Nick Gross',
    domain: 'findyourgrind.com',
  },
];

async function testPatternMatching() {
  console.log('🧪 Testing Email Pattern Matching + Verification\n');
  console.log(`Testing ${testCases.length} founder names...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Company: ${testCase.companyName}`);
    console.log(`Founder: ${testCase.founderName}`);
    console.log(`Domain: ${testCase.domain}`);
    console.log(`${'='.repeat(80)}\n`);

    // Generate patterns
    const patterns = generateEmailPatterns(testCase.founderName, testCase.domain);
    console.log(`Generated ${patterns.length} email patterns:\n`);

    patterns.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.email.padEnd(40)} (${p.pattern}, ${(p.confidence * 100).toFixed(0)}% common)`);
    });

    console.log(`\nTesting verification (trying first 3 patterns)...\n`);

    // Test first 3 patterns only (to save API calls)
    let foundEmail = false;
    for (let i = 0; i < Math.min(3, patterns.length); i++) {
      const pattern = patterns[i];
      console.log(`  ${i + 1}/3 Testing: ${pattern.email}`);

      const result = await verifyEmailWithRapid(pattern.email);

      if (result.isDeliverable) {
        console.log(`    ✅ FOUND: ${result.email} (confidence: ${(result.confidence * 100).toFixed(0)}%)`);
        foundEmail = true;
        successCount++;
        break;
      } else {
        console.log(`    ❌ Invalid: ${result.reason}`);
      }

      // Delay to avoid hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!foundEmail) {
      console.log(`\n  ⚠️  No valid email found from first 3 patterns`);
      failCount++;
    }
  }

  // Summary
  console.log(`\n\n${'='.repeat(80)}`);
  console.log(`TEST SUMMARY`);
  console.log(`${'='.repeat(80)}\n`);
  console.log(`  Total founders tested: ${testCases.length}`);
  console.log(`  Emails found: ${successCount} (${(successCount / testCases.length * 100).toFixed(1)}%)`);
  console.log(`  Failed: ${failCount} (${(failCount / testCases.length * 100).toFixed(1)}%)`);
  console.log(``);

  if (successCount > 0) {
    console.log(`✅ Pattern matching is working! Found ${successCount} valid email(s).\n`);
  } else {
    console.log(`⚠️  No emails found. This could mean:`);
    console.log(`   1. Rapid Email Verifier API is having issues`);
    console.log(`   2. These companies don't use standard email patterns`);
    console.log(`   3. The verification is too strict\n`);
  }
}

// Run test
if (require.main === module) {
  testPatternMatching()
    .then(() => {
      console.log('✅ Testing complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Testing failed:', error);
      process.exit(1);
    });
}

export { testPatternMatching };
