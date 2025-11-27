import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Initialize Pinecone
const pineconeApiKey = process.env.PINECONE_API_KEY;
const pineconeIndexName = process.env.PINECONE_INDEX_NAME || 'startups';

let pinecone: Pinecone | null = null;
let pineconeIndex: any = null;

if (pineconeApiKey) {
  pinecone = new Pinecone({ apiKey: pineconeApiKey });
} else {
  console.warn('⚠️  PINECONE_API_KEY not set. Embeddings will not be stored in Pinecone.');
}

// Initialize Gemini for embeddings
const genAI = process.env.GEMINI_API_KEY 
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

/**
 * Generates an embedding using Gemini
 */
async function generateEmbedding(text: string): Promise<number[]> {
  if (!genAI) {
    return [];
  }

  try {
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
  } catch (error) {
    console.warn(`Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Store embedding in Pinecone
 */
async function storeEmbeddingInPinecone(id: string, embedding: number[], metadata: Record<string, any>): Promise<void> {
  if (!pinecone || !pineconeIndex) {
    return;
  }

  try {
    // Validate embedding dimension
    if (embedding.length === 0) {
      console.warn('  Skipping Pinecone storage: empty embedding');
      return;
    }

    // Check if we can get index stats to validate dimensions
    try {
      const indexStats = await pineconeIndex.describeIndexStats();
      const expectedDimension = indexStats.dimension;
      
      if (embedding.length !== expectedDimension) {
        throw new Error(
          `Embedding dimension mismatch: Got ${embedding.length} dimensions, but Pinecone index expects ${expectedDimension}. ` +
          `Please recreate your Pinecone index with ${embedding.length} dimensions (for Gemini text-embedding-004) or use a different embedding model.`
        );
      }
    } catch (statsError) {
      // If we can't get stats, just try to insert and let Pinecone error if dimension is wrong
      console.warn('  Could not validate index dimensions, proceeding with insert...');
    }

    await pineconeIndex.upsert([{
      id: id,
      values: embedding,
      metadata: metadata,
    }]);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('dimension')) {
      console.error(`  ❌ Dimension mismatch error: ${errorMessage}`);
      console.error(`     Your Pinecone index was created with the wrong dimensions.`);
      console.error(`     Gemini text-embedding-004 returns 768 dimensions.`);
      console.error(`     Please recreate your Pinecone index with 768 dimensions.`);
    } else {
      console.warn(`  ⚠️  Failed to store embedding in Pinecone: ${errorMessage}`);
    }
  }
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
 * Main ingestion function
 */
async function ingestCSV() {
  console.log('Starting CSV ingestion to Supabase + Pinecone...\n');

  // Check for embedding API key
  const useEmbeddings = !!process.env.GEMINI_API_KEY;
  
  if (!useEmbeddings) {
    console.warn('⚠️  GEMINI_API_KEY not set. Embeddings will be empty arrays.');
    console.warn('   Startup matching will be limited without embeddings.\n');
  } else {
    console.log('Validating Gemini API key...');
    try {
      await generateEmbedding('test');
      console.log('✓ API key is valid\n');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('403') || errorMessage.includes('leaked') || errorMessage.includes('Forbidden')) {
        console.warn('⚠️  Gemini API key is invalid or blocked. Continuing without embeddings.\n');
      } else {
        throw error;
      }
    }
  }

  // Initialize Pinecone index if available
  if (pinecone) {
    try {
      pineconeIndex = pinecone.index(pineconeIndexName);
      console.log(`✓ Connected to Pinecone index: ${pineconeIndexName}\n`);
    } catch (error) {
      console.warn(`⚠️  Could not connect to Pinecone index: ${error instanceof Error ? error.message : String(error)}`);
      console.warn('   Continuing without Pinecone...\n');
      pinecone = null;
    }
  }

  // Test Supabase connection
  try {
    const { data, error } = await supabase.from('startups').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    console.log('✓ Connected to Supabase\n');
  } catch (error) {
    throw new Error(
      `Cannot connect to Supabase. Make sure your database is set up and migrations are run. ` +
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Parse CSV - using the FINAL_DATASET file
  const csvPath = join(process.cwd(), 'yc_companies', 'FINAL_DATASET - FINAL_DATASET.csv (1).csv');
  console.log(`Reading CSV from: ${csvPath}`);
  
  // Check if file exists
  const fs = require('fs');
  if (!fs.existsSync(csvPath)) {
    throw new Error(
      `CSV file not found at: ${csvPath}\n` +
      `Please make sure the file exists in the yc_companies directory.`
    );
  }
  
  const rows = parseCSV(csvPath);
  console.log(`Found ${rows.length} rows to process\n`);

  // Process each row
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    try {
      console.log(`[${i + 1}/${rows.length}] Processing: ${row.Company_Name}`);

      // Skip rows with pattern data (data_quality = 🤖 PATTERN) if desired
      // Uncomment the next lines if you want to skip pattern data
      // if (row.data_quality?.includes('PATTERN')) {
      //   console.log(`  Skipping pattern-generated row`);
      //   skippedCount++;
      //   continue;
      // }

      // Prepare data
      const description = row.company_description || '';
      
      // Combine founder names and emails (comma-separated if multiple)
      const founderNames = [row.founder_first_name, row.founder_last_name]
        .filter(Boolean)
        .join(' ')
        .trim();
      const founderEmails = row.founder_email || '';
      
      // Combine business_type and industry into keywords
      const keywords = [row.business_type, row.industry]
        .filter(Boolean)
        .join(', ');

      const embeddingText = `${description}\nKeywords: ${keywords}`;

      // Generate embedding
      let embedding: number[] = [];
      if (useEmbeddings) {
        console.log('  Generating embedding...');
        try {
          embedding = await generateEmbedding(embeddingText);
        } catch (error) {
          console.warn(`  Warning: Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`);
          console.warn('  Continuing with empty embedding...');
          embedding = [];
        }
      }

      // Create startup in Supabase
      console.log('  Creating startup in Supabase...');
      const pineconeId = `startup-${row.Company_Name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      
      // Prepare insert data with validation
      // Only include columns that exist in the schema to avoid errors
      const insertData: any = {
        name: row.Company_Name?.trim() || null,
        funding_amount: row.amount_raised?.trim() || null,
        job_openings: row.job_openings?.trim() || null,
        round_type: row.funding_stage?.trim() || null,
        date: row.date_raised?.trim() || null,
        location: row.location?.trim() || null,
        website: row.website?.trim() || null,
        industry: row.industry?.trim() || null,
        keywords: keywords?.trim() || null,
        description: description?.trim() || null,
        pinecone_id: pineconeId,
      };

      // Conditionally add founder columns (they might not exist in older schemas)
      // We'll try to add them, and if they fail, we'll retry without them
      const founderColumns: any = {};
      if (founderNames) founderColumns.founder_names = founderNames.trim();
      if (founderEmails) founderColumns.founder_emails = founderEmails.trim();
      if (row.founder_linkedin) founderColumns.founder_linkedin = row.founder_linkedin.trim();

      // Remove null/undefined/empty values to avoid issues
      Object.keys(insertData).forEach(key => {
        if (insertData[key] === undefined || insertData[key] === '') {
          insertData[key] = null;
        }
      });
      
      // Combine all data
      const finalInsertData = { ...insertData, ...founderColumns };

      // Try inserting with all columns first
      let { data: startupData, error: startupError } = await supabase
        .from('startups')
        .insert(finalInsertData)
        .select()
        .single();

      // If error is about missing columns, try with only required columns
      if (startupError && (
        startupError.message?.includes('Could not find') || 
        startupError.message?.includes('column') ||
        startupError.message?.includes('schema cache')
      )) {
        console.log('  Column missing in schema, retrying with minimal columns...');
        // Only include name (required) and columns that definitely exist
        const minimalData: any = {
          name: finalInsertData.name,
        };
        
        // Try to add other columns one by one, but only if they're not the problematic one
        const problematicColumn = startupError.message?.match(/column '(\w+)'/)?.[1];
        
        Object.keys(finalInsertData).forEach(key => {
          if (key !== 'name' && key !== problematicColumn && finalInsertData[key] !== null) {
            minimalData[key] = finalInsertData[key];
          }
        });
        
        const retryResult = await supabase
          .from('startups')
          .insert(minimalData)
          .select()
          .single();
        
        startupData = retryResult.data;
        startupError = retryResult.error;
        
        if (problematicColumn) {
          console.warn(`  ⚠️  Skipped column '${problematicColumn}' - it doesn't exist in your schema. Please run migration 004_add_all_missing_columns.sql`);
        }
      }

      if (startupError) {
        // Handle unique constraint violation
        if (startupError.code === '23505' || startupError.code === 'PGRST116' || startupError.message?.includes('duplicate') || startupError.message?.includes('unique')) {
          console.log('  Startup already exists, skipping...');
          skippedCount++;
          continue;
        }
        // Better error logging for Supabase errors
        const errorDetails = {
          message: startupError.message,
          details: startupError.details,
          hint: startupError.hint,
          code: startupError.code,
        };
        const errorMessage = startupError.message || 
                            startupError.details || 
                            JSON.stringify(errorDetails, null, 2);
        throw new Error(`Supabase error: ${errorMessage}`);
      }

      // Store embedding in Pinecone
      if (embedding.length > 0 && pineconeIndex) {
        console.log('  Storing embedding in Pinecone...');
        await storeEmbeddingInPinecone(pineconeId, embedding, {
          name: row.Company_Name,
          industry: row.industry || '',
          description: description,
          keywords: keywords,
        });
      }

      successCount++;
      console.log(`  ✓ Successfully processed ${row.Company_Name}\n`);
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      errorCount++;
      // Better error message extraction
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        // Handle Supabase errors and other objects
        const err = error as any;
        errorMessage = err.message || err.details || err.error || JSON.stringify(error);
      } else {
        errorMessage = String(error);
      }
      
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error(`  ✗ Error processing ${row.Company_Name}:`);
      console.error(`    Error: ${errorMessage}`);
      
      // Log additional error details if available
      if (error && typeof error === 'object' && 'code' in error) {
        console.error(`    Code: ${(error as any).code}`);
      }
      if (error && typeof error === 'object' && 'hint' in error) {
        console.error(`    Hint: ${(error as any).hint}`);
      }
      console.error('');
      
      if (errorStack && process.env.DEBUG) {
        console.error(`    Stack: ${errorStack}\n`);
      }
    }
  }

  console.log(`\n=== Ingestion Complete ===`);
  console.log(`Total rows: ${rows.length}`);
  console.log(`Successfully ingested: ${successCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
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

