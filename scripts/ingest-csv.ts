import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { HelixDB } from 'helix-ts';

// Types for CSV row data
interface CSVRow {
  YC_Link: string;
  Company_Logo: string;
  Company_Name: string;
  company_description: string;
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

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Generates an embedding for text using Gemini
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

  const result = await model.embedContent({
    content: {
      role: 'user',
      parts: [{ text: text }],
    },
  });

  if (!result.embedding || !result.embedding.values || !Array.isArray(result.embedding.values)) {
    throw new Error('Failed to generate embedding: Invalid response structure');
  }

  return result.embedding.values;
}

/**
 * Parses the CSV file and returns rows as objects
 */
function parseCSV(filePath: string): CSVRow[] {
  const fileContent = readFileSync(filePath, 'utf-8');
  
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CSVRow[];

  return records;
}

/**
 * Creates tags from business_type and industry
 */
function createTags(businessType: string, industry: string): string {
  const tags: string[] = [];
  if (businessType) tags.push(businessType);
  if (industry) {
    // Split industry by comma if it contains multiple values
    const industries = industry.split(',').map(i => i.trim()).filter(Boolean);
    tags.push(...industries);
  }
  return tags.join(', ');
}

/**
 * Generates a unique funding round ID
 */
function generateFundingRoundId(startupName: string, dateRaised: string): string {
  return `${startupName.toLowerCase().replace(/\s+/g, '-')}-${dateRaised.toLowerCase().replace(/\s+/g, '-')}`;
}

/**
 * Main ingestion function
 */
async function ingestCSV() {
  console.log('Starting CSV ingestion...');

  // Check for embedding API key (optional - can use empty embeddings if not available)
  const useEmbeddings = !!process.env.GEMINI_API_KEY;
  
  if (!useEmbeddings) {
    console.warn('⚠️  GEMINI_API_KEY not set. Embeddings will be empty arrays.');
    console.warn('   Startup matching will be limited without embeddings.\n');
  } else {
    // Test the API key with a simple embedding request
    console.log('Validating Gemini API key...');
    try {
      await generateEmbedding('test');
      console.log('✓ API key is valid\n');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('403') || errorMessage.includes('leaked') || errorMessage.includes('Forbidden')) {
        console.warn('⚠️  Gemini API key is invalid or blocked. Continuing without embeddings.\n');
        console.warn('   To enable embeddings: Get a new key from https://aistudio.google.com/app/apikey\n');
      } else {
        throw error;
      }
    }
  }

  if (!process.env.HELIX_URL) {
    console.warn('HELIX_URL not set, defaulting to http://localhost:6969');
  }

  // Initialize Helix client
  const helixUrl = process.env.HELIX_URL || 'http://localhost:6969';
  const helixApiKey = process.env.HELIX_API_KEY || null;
  const client = new HelixDB(helixUrl, helixApiKey);

  // Test HelixDB connectivity and check available queries
  console.log(`Connecting to HelixDB at ${helixUrl}...`);
  try {
    const testResponse = await fetch(helixUrl);
    console.log(`✓ HelixDB is accessible`);
    
    // Try to check if AddStartup query is available
    console.log('Checking if queries are deployed...');
    try {
      const testQuery = await safeQuery('AddStartup', {
        name: '__TEST__',
        industry: '',
        description: '',
        funding_stage: '',
        funding_amount: '',
        location: '',
        website: '',
        tags: '',
        embedding: [],
      });
      console.log('✓ Queries appear to be deployed\n');
    } catch (queryTestError) {
      const errorMsg = queryTestError instanceof Error ? queryTestError.message : String(queryTestError);
      if (errorMsg.includes('404') || errorMsg.includes('Couldn\'t find')) {
        console.warn('\n⚠️  WARNING: Queries are not deployed to HelixDB!');
        console.warn('   The queries in db/queries.hx need to be loaded into HelixDB.');
        console.warn('   This might require restarting HelixDB or deploying queries.');
        console.warn('   Continuing anyway - queries may fail during ingestion.\n');
      } else {
        // If it's a different error (like validation), queries might be deployed
        console.log('✓ Queries appear to be deployed (test query responded)\n');
      }
    }
  } catch (error) {
    throw new Error(
      `Cannot connect to HelixDB at ${helixUrl}. ` +
      `Make sure HelixDB is running. Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Wrapper function to handle HelixDB query errors better
  async function safeQuery(queryName: string, params: any) {
    try {
      const response = await fetch(`${helixUrl}/${queryName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(helixApiKey ? { 'x-api-key': helixApiKey } : {}),
        },
        body: JSON.stringify(params),
      });

      // Check if response is OK
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HelixDB query "${queryName}" failed with status ${response.status}: ${errorText.substring(0, 200)}`
        );
      }

      // Try to parse as JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(
          `HelixDB returned non-JSON response for query "${queryName}". ` +
          `Content-Type: ${contentType}, Response: ${text.substring(0, 200)}`
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.message.includes('HelixDB')) {
        throw error;
      }
      throw new Error(`Failed to execute HelixDB query "${queryName}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Parse CSV
  const csvPath = join(process.cwd(), 'yc_companies', 'FINAL_DATASET - FINAL_DATASET.csv (1).csv');
  console.log(`Reading CSV from: ${csvPath}`);
  
  const rows = parseCSV(csvPath);
  console.log(`Found ${rows.length} rows to process`);

  // Process each row
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    try {
      console.log(`\n[${i + 1}/${rows.length}] Processing: ${row.Company_Name}`);

      // Skip rows with pattern data (data_quality = 🤖 PATTERN)
      if (row.data_quality?.includes('PATTERN')) {
        console.log(`  Skipping pattern-generated row`);
        continue;
      }

      // Prepare data
      const description = row.company_description || '';
      const tags = createTags(row.business_type || '', row.industry || '');
      const embeddingText = `${description}\nTags: ${tags}`;

      // Generate embedding (or use empty array if API key not available)
      let embedding: number[] = [];
      if (useEmbeddings) {
        console.log('  Generating embedding...');
        try {
          embedding = await generateEmbedding(embeddingText);
        } catch (error) {
          console.warn(`  Warning: Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`);
          console.warn('  Continuing with empty embedding...');
          embedding = []; // Use empty embedding if generation fails
        }
      } else {
        console.log('  Skipping embedding generation (no API key)...');
      }

      // Create startup node (skip duplicate check since GetStartupByName query may not be deployed)
      console.log('  Creating startup node...');
      let startup;
      try {
        const startupResult = await safeQuery('AddStartup', {
          name: row.Company_Name,
          industry: row.industry || '',
          description: description,
          funding_stage: row.funding_stage || '',
          funding_amount: row.amount_raised || '',
          location: row.location || '',
          website: row.website || '',
          tags: tags,
          embedding: embedding,
        });
        
        if (!startupResult) {
          throw new Error(`Failed to create startup node - no result returned. Response: ${JSON.stringify(startupResult)}`);
        }
        
        startup = startupResult;
      } catch (queryError) {
        const errorMessage = queryError instanceof Error ? queryError.message : String(queryError);
        // If it's a duplicate error, continue (HelixDB will handle it)
        if (errorMessage.includes('already exists') || errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
          console.log('  Startup already exists, skipping...');
          // Continue processing relationships - they might still work
        } else {
          throw new Error(`HelixDB query failed: ${errorMessage}`);
        }
      }

      // Create founder node (if founder info exists and email is valid)
      // Skip if startup creation failed
      if (startup && row.founder_email && 
          row.founder_email.trim() !== '' && 
          row.founder_email !== 'hello@' && 
          !row.founder_email.startsWith('hello@') &&
          row.founder_first_name && 
          row.founder_first_name.trim() !== '' &&
          row.founder_last_name && 
          row.founder_last_name.trim() !== '') {
        console.log('  Creating founder node...');
        
        // Try to create founder (skip existence check since query may not be deployed)
        try {
          const founderResult = await safeQuery('AddFounder', {
            email: row.founder_email,
            first_name: row.founder_first_name,
            last_name: row.founder_last_name,
            linkedin: row.founder_linkedin || '',
          });
          
          // Connect startup to founder
          if (founderResult) {
            console.log('  Connecting startup to founder...');
            await safeQuery('ConnectStartupToFounder', {
              startup_name: row.Company_Name,
              founder_email: row.founder_email,
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          // If query doesn't exist (404), warn but continue
          if (errorMessage.includes('404') || errorMessage.includes('Couldn\'t find')) {
            console.warn(`  Skipping founder (query not deployed): ${errorMessage.substring(0, 100)}`);
          } else {
            console.error(`  Error processing founder: ${errorMessage}`);
          }
          // Continue even if founder creation fails
        }
      }

      // Create funding round node (only if startup was created successfully)
      if (startup && row.funding_stage && row.date_raised) {
        console.log('  Creating funding round node...');
        
        const fundingRoundId = generateFundingRoundId(row.Company_Name, row.date_raised);
        
        try {
          const fundingRoundResult = await safeQuery('AddFundingRound', {
            round_id: fundingRoundId,
            stage: row.funding_stage,
            amount: row.amount_raised || '',
            date_raised: row.date_raised,
            batch: row.Batch || '',
          });
          
          // Connect startup to funding round
          if (fundingRoundResult) {
            console.log('  Connecting startup to funding round...');
            await safeQuery('ConnectStartupToFundingRound', {
              startup_name: row.Company_Name,
              funding_round_id: fundingRoundId,
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          // If query doesn't exist (404), warn but continue
          if (errorMessage.includes('404') || errorMessage.includes('Couldn\'t find')) {
            console.warn(`  Skipping funding round (query not deployed): ${errorMessage.substring(0, 100)}`);
          } else {
            console.error(`  Error processing funding round: ${errorMessage}`);
          }
          // Continue even if funding round creation fails
        }
      }

      successCount++;
      console.log(`  ✓ Successfully processed ${row.Company_Name}`);
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      errorCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error(`  ✗ Error processing ${row.Company_Name}:`);
      console.error(`    Error: ${errorMessage}`);
      if (errorStack) {
        console.error(`    Stack: ${errorStack}`);
      }
      // Continue processing other rows
    }
  }

  console.log(`\n=== Ingestion Complete ===`);
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Total: ${rows.length}`);
}

// Run the ingestion
if (require.main === module) {
  ingestCSV()
    .then(() => {
      console.log('\nIngestion completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nIngestion failed:', error);
      process.exit(1);
    });
}

export { ingestCSV };

