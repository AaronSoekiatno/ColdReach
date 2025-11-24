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

  // Check for required environment variables
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  if (!process.env.HELIX_URL) {
    console.warn('HELIX_URL not set, defaulting to http://localhost:6969');
  }

  // Initialize Helix client
  const helixUrl = process.env.HELIX_URL || 'http://localhost:6969';
  const helixApiKey = process.env.HELIX_API_KEY || null;
  const client = new HelixDB(helixUrl, helixApiKey);

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

      // Generate embedding
      console.log('  Generating embedding...');
      const embedding = await generateEmbedding(embeddingText);

      // Create startup node
      console.log('  Creating startup node...');
      const startupResult = await client.query('AddStartup', {
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

      // HelixDB query returns a response object, the result is typically in a property
      // Adjust based on actual response structure
      if (!startupResult) {
        throw new Error('Failed to create startup node');
      }

      const startup = startupResult;

      // Create founder node (if founder info exists)
      if (row.founder_email && row.founder_first_name && row.founder_last_name) {
        console.log('  Creating founder node...');
        
        // Check if founder already exists
        let founder;
        try {
          const existingFounder = await client.query('GetFounderByEmail', {
            email: row.founder_email,
          });
          
          if (existingFounder) {
            founder = existingFounder;
            console.log('  Founder already exists, reusing...');
          } else {
            const founderResult = await client.query('AddFounder', {
              email: row.founder_email,
              first_name: row.founder_first_name,
              last_name: row.founder_last_name,
              linkedin: row.founder_linkedin || '',
            });
            
            if (!founderResult) {
              throw new Error('Failed to create founder node');
            }
            founder = founderResult;
          }

          // Connect startup to founder
          console.log('  Connecting startup to founder...');
          await client.query('ConnectStartupToFounder', {
            startup_name: row.Company_Name,
            founder_email: row.founder_email,
          });
        } catch (error) {
          console.error(`  Error processing founder: ${error}`);
          // Continue even if founder creation fails
        }
      }

      // Create funding round node
      if (row.funding_stage && row.date_raised) {
        console.log('  Creating funding round node...');
        
        const fundingRoundId = generateFundingRoundId(row.Company_Name, row.date_raised);
        
        // Check if funding round already exists
        let fundingRound;
        try {
          const existingFundingRound = await client.query('GetFundingRoundById', {
            id: fundingRoundId,
          });
          
          if (existingFundingRound) {
            fundingRound = existingFundingRound;
            console.log('  Funding round already exists, reusing...');
          } else {
            const fundingRoundResult = await client.query('AddFundingRound', {
              id: fundingRoundId,
              stage: row.funding_stage,
              amount: row.amount_raised || '',
              date_raised: row.date_raised,
              batch: row.Batch || '',
            });
            
            if (!fundingRoundResult) {
              throw new Error('Failed to create funding round node');
            }
            fundingRound = fundingRoundResult;
          }

          // Connect startup to funding round
          console.log('  Connecting startup to funding round...');
          await client.query('ConnectStartupToFundingRound', {
            startup_name: row.Company_Name,
            funding_round_id: fundingRoundId,
          });
        } catch (error) {
          console.error(`  Error processing funding round: ${error}`);
          // Continue even if funding round creation fails
        }
      }

      successCount++;
      console.log(`  ✓ Successfully processed ${row.Company_Name}`);
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      errorCount++;
      console.error(`  ✗ Error processing ${row.Company_Name}:`, error);
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

