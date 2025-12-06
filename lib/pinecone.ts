import { Pinecone } from '@pinecone-database/pinecone';

// Lazy-load Pinecone client to allow env vars to be loaded first
let pc: Pinecone | null = null;
let indexName: string | null = null;

function getPineconeClient(): Pinecone {
  if (!pc) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error(
        'PINECONE_API_KEY is not set. Please add it to your .env.local file. ' +
        'Get your API key from https://app.pinecone.io'
      );
    }
    pc = new Pinecone({ apiKey });
  }
  return pc;
}

function getIndexName(): string {
  if (!indexName) {
    indexName = process.env.PINECONE_INDEX_NAME || 'startups';
  }
  return indexName;
}

// Types
export interface CandidateMetadata {
  name: string;
  email: string;
  summary: string;
  skills: string; // Comma-separated string
  location: string;
  education_level: string;
  university: string;
  past_internships: string; // Comma-separated string
  technical_projects: string; // Comma-separated string
  createdAt: string;
}

export interface StartupMetadata {
  name: string;
  industry: string;
  description: string;
  funding_stage: string;
  funding_amount: string;
  location: string;
  website: string;
  tags: string;
  createdAt: string;
}

export interface MatchResult {
  id: string;
  score: number;
  metadata: StartupMetadata;
}

/**
 * Upsert a candidate to Pinecone
 * @param id - Unique identifier (typically email)
 * @param embedding - 768-dimensional vector from Gemini
 * @param metadata - Candidate information
 */
export async function upsertCandidate(
  id: string,
  embedding: number[],
  metadata: Omit<CandidateMetadata, 'createdAt'>
) {
  const index = getPineconeClient().index(getIndexName());

  await index.namespace('candidates').upsert([
    {
      id,
      values: embedding,
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
      },
    },
  ]);

  return { success: true, id };
}

/**
 * Upsert a startup to Pinecone
 * @param id - Unique identifier (typically startup name or UUID)
 * @param embedding - 768-dimensional vector from Gemini
 * @param metadata - Startup information
 */
export async function upsertStartup(
  id: string,
  embedding: number[],
  metadata: Omit<StartupMetadata, 'createdAt'>
) {
  const index = getPineconeClient().index(getIndexName());

  await index.namespace('startups').upsert([
    {
      id,
      values: embedding,
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
      },
    },
  ]);

  return { success: true, id };
}

/**
 * Find matching startups for a candidate's embedding
 * @param embedding - Candidate's 768-dimensional vector
 * @param topK - Number of top matches to return (default: 10)
 * @param minScore - Minimum similarity score threshold (0-1, default: 0.30)
 * @returns Array of matching startups with similarity scores above threshold
 *
 * Score interpretation:
 * - 0.70-1.0: Excellent match (70-100%)
 * - 0.50-0.70: Good match (50-70%)
 * - 0.30-0.50: Moderate match (30-50%)
 * - Below 0.30: Filtered out by default
 */
export async function findMatchingStartups(
  embedding: number[],
  topK: number = 1000
): Promise<MatchResult[]> {
  const index = getPineconeClient().index(getIndexName());

  const queryResponse = await index.namespace('startups').query({
    vector: embedding,
    topK,
    includeMetadata: true,
  });

  return queryResponse.matches
    .filter((match) => match.metadata) // Filter out matches without metadata
    .map((match) => ({
      id: match.id,
      score: match.score || 0,
      metadata: match.metadata as unknown as StartupMetadata,
    }));
}

/**
 * Get a candidate by ID (email)
 * @param id - Candidate's email
 */
export async function getCandidateById(id: string) {
  const index = getPineconeClient().index(getIndexName());

  const fetchResponse = await index.namespace('candidates').fetch([id]);

  if (!fetchResponse.records[id]) {
    return null;
  }

  const record = fetchResponse.records[id];
  if (!record.metadata) {
    return null;
  }

  return {
    id: record.id,
    metadata: record.metadata as unknown as CandidateMetadata,
  };
}

/**
 * Get a startup by ID
 * @param id - Startup's identifier
 */
export async function getStartupById(id: string) {
  const index = getPineconeClient().index(getIndexName());

  const fetchResponse = await index.namespace('startups').fetch([id]);

  if (!fetchResponse.records[id]) {
    return null;
  }

  const record = fetchResponse.records[id];
  if (!record.metadata) {
    return null;
  }

  return {
    id: record.id,
    metadata: record.metadata as unknown as StartupMetadata,
  };
}

/**
 * Delete a candidate by ID
 * @param id - Candidate's email
 */
export async function deleteCandidate(id: string) {
  const index = getPineconeClient().index(getIndexName());
  await index.namespace('candidates').deleteOne(id);
  return { success: true };
}

/**
 * Delete a startup by ID
 * @param id - Startup's identifier
 */
export async function deleteStartup(id: string) {
  const index = getPineconeClient().index(getIndexName());
  await index.namespace('startups').deleteOne(id);
  return { success: true };
}

export default getPineconeClient;
