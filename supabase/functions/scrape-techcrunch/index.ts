/// <reference path="../deno.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Pinecone } from 'https://esm.sh/@pinecone-database/pinecone@1.1.2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.24.1';

// Note: This is a simplified version for Edge Functions
// The techcrunch-api package uses Puppeteer which won't work in Deno
// You'll need to either:
// 1. Use a different scraping approach (like fetch + HTML parsing)
// 2. Call an external API/service that does the scraping
// 3. Use this as a wrapper that calls your Node.js scraper

interface StartupData {
  Company_Name: string;
  company_description: string;
  business_type: string;
  industry: string;
  location: string;
  website: string;
  funding_stage: string;
  amount_raised: string;
  date_raised: string;
}

serve(async (req) => {
  try {
    // Get environment variables from Supabase secrets
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const pineconeApiKey = Deno.env.get('PINECONE_API_KEY');
    const pineconeIndexName = Deno.env.get('PINECONE_INDEX_NAME') || 'startups';
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize Pinecone if available
    let pinecone: Pinecone | null = null;
    let pineconeIndex: any = null;
    if (pineconeApiKey) {
      pinecone = new Pinecone({ apiKey: pineconeApiKey });
      pineconeIndex = pinecone.index(pineconeIndexName);
    }

    // Initialize Gemini if available
    const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

    /**
     * Generate embedding using Gemini
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
        console.warn(`Failed to generate embedding: ${error}`);
        return [];
      }
    }

    /**
     * Store embedding in Pinecone
     */
    async function storeEmbeddingInPinecone(id: string, embedding: number[], metadata: Record<string, any>): Promise<void> {
      if (!pineconeIndex) {
        return;
      }

      try {
        await pineconeIndex.upsert([{
          id: id,
          values: embedding,
          metadata: metadata,
        }]);
      } catch (error) {
        console.warn(`Failed to store embedding in Pinecone: ${error}`);
      }
    }

    /**
     * Process a startup and store it
     */
    async function processStartup(startup: StartupData) {
      const description = startup.company_description || '';
      const tags = startup.business_type && startup.industry 
        ? `${startup.business_type}, ${startup.industry}` 
        : startup.business_type || startup.industry || '';
      const embeddingText = `${description}\nTags: ${tags}`;

      // Generate embedding
      const embedding = await generateEmbedding(embeddingText);

      // Create startup in Supabase
      const pineconeId = `startup-${startup.Company_Name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      
      const { data: startupData, error: startupError } = await supabase
        .from('startups')
        .insert({
          name: startup.Company_Name,
          industry: startup.industry || null,
          description: description,
          round_type: startup.funding_stage || null,
          funding_amount: startup.amount_raised || null,
          date: startup.date_raised || null,
          location: startup.location || null,
          website: startup.website || null,
          keywords: tags || null,
          pinecone_id: pineconeId,
        })
        .select()
        .single();

      if (startupError) {
        if (startupError.code === '23505') { // Unique violation
          return { success: false, reason: 'already_exists' };
        }
        throw startupError;
      }

      // Store embedding in Pinecone
      if (embedding.length > 0 && pineconeIndex) {
        await storeEmbeddingInPinecone(pineconeId, embedding, {
          name: startup.Company_Name,
          industry: startup.industry || '',
          description: description,
          tags: tags,
        });
      }

      return { success: true, startup: startupData };
    }

    // For now, this function expects startup data to be passed in the request body
    // In a real implementation, you'd either:
    // 1. Call an external scraping service
    // 2. Use a different scraping library that works in Deno
    // 3. Trigger this from a cron job that calls your Node.js scraper first

    const body = await req.json();
    const startups: StartupData[] = body.startups || [];

    if (startups.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No startups provided. This Edge Function expects startup data in the request body.',
          message: 'Consider calling your Node.js scraper first, then passing the results here.'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const startup of startups) {
      try {
        const result = await processStartup(startup);
        if (result.success) {
          successCount++;
          results.push({ startup: startup.Company_Name, status: 'success' });
        } else if (result.reason === 'already_exists') {
          results.push({ startup: startup.Company_Name, status: 'skipped', reason: 'already_exists' });
        }
      } catch (error) {
        errorCount++;
        results.push({ 
          startup: startup.Company_Name, 
          status: 'error', 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: startups.length,
        successful: successCount,
        errors: errorCount,
        results: results,
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
});

