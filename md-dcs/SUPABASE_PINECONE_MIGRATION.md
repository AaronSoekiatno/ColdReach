# Supabase + Pinecone Migration Guide

This guide explains how to migrate from HelixDB to Supabase (PostgreSQL) + Pinecone (vector database).

## Overview

- **Supabase**: Stores relational data (startups, founders, funding rounds, candidates, matches)
- **Pinecone**: Stores vector embeddings for semantic search and matching

## Setup Steps

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and service role key

### 2. Run Database Migrations

Apply the migration to create all tables:

```bash
# Using Supabase CLI
supabase db push

# Or manually in Supabase SQL Editor
# Copy and paste the contents of supabase/migrations/001_initial_schema.sql
```

### 3. Set Up Pinecone

1. Go to [pinecone.io](https://pinecone.io) and create an account
2. Create a new index:
   - Name: `startups` (or your preferred name)
   - **Dimensions: `768`** (for Gemini text-embedding-004) ⚠️ **IMPORTANT: Must be 768, not 1024**
   - Metric: `cosine`
3. Note your API key

**⚠️ Important:** If you already created an index with 1024 dimensions, you need to:
- Delete the old index
- Create a new index with 768 dimensions
- Or use a different embedding model that returns 1024 dimensions

### 4. Configure Environment Variables

Add to your `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Pinecone
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=startups

# Gemini (for embeddings)
GEMINI_API_KEY=your-gemini-api-key
```

### 5. Run the TechCrunch Scraper

Use the Supabase + Pinecone version:

```bash
npm run scrape-techcrunch-supabase
```

This will:
- Scrape TechCrunch articles
- Extract startup data
- Store relational data in Supabase
- Generate embeddings with Gemini
- Store embeddings in Pinecone

## Database Schema

### Tables

- **startups**: Company information
- **founders**: Founder details
- **funding_rounds**: Funding information
- **startup_founders**: Many-to-many relationship
- **startup_funding_rounds**: Many-to-many relationship
- **candidates**: Resume uploads
- **matches**: Candidate-startup matches

### Vector Storage

- Embeddings are stored in Pinecone with metadata linking back to Supabase records
- Each startup has a `pinecone_id` field that references the Pinecone vector ID

## Migration from HelixDB

If you have existing data in HelixDB:

1. Export data from HelixDB (if possible)
2. Transform to match Supabase schema
3. Import into Supabase
4. Generate embeddings and upload to Pinecone

## Using the Scraper

### Local Development

```bash
npm run scrape-techcrunch-supabase
```

### Production (Supabase Edge Function)

1. Deploy the Edge Function:
   ```bash
   supabase functions deploy scrape-techcrunch
   ```

2. Set secrets:
   ```bash
   supabase secrets set PINECONE_API_KEY=your-key
   supabase secrets set GEMINI_API_KEY=your-key
   ```

3. Schedule with cron or call from your Node.js scraper

## Querying Data

### From Supabase

```typescript
import { supabase } from '@/lib/supabase';

// Get all startups
const { data: startups } = await supabase
  .from('startups')
  .select('*');

// Get startup with funding rounds
const { data } = await supabase
  .from('startups')
  .select(`
    *,
    startup_funding_rounds (
      funding_rounds (*)
    )
  `)
  .eq('name', 'Company Name');
```

### From Pinecone (Vector Search)

```typescript
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pinecone.index('startups');

// Search for similar startups
const results = await index.query({
  vector: candidateEmbedding,
  topK: 10,
  includeMetadata: true,
});
```

## Benefits of This Architecture

1. **Scalability**: Supabase handles relational queries, Pinecone handles vector search
2. **Performance**: Optimized for each use case
3. **Managed Services**: No infrastructure to maintain
4. **Cost**: Pay for what you use
5. **Flexibility**: Easy to add new features

## Next Steps

1. Update your application code to use Supabase instead of HelixDB
2. Implement vector search using Pinecone
3. Set up scheduled scraping jobs
4. Monitor and optimize queries

