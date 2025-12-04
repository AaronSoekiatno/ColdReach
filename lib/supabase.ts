import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

// Supabase configuration
// These environment variables should be set in .env.local
// NEXT_PUBLIC_ prefix is required for client-side access in Next.js
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Get the Supabase client instance for browser use
 * Uses createBrowserClient to properly handle cookies for SSR
 * Validates environment variables and throws helpful errors if missing
 */
function getSupabaseClient(): SupabaseClient {
  if (!supabaseUrl) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL environment variable. ' +
      'Please add it to your .env.local file.'
    );
  }

  if (!supabaseAnonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. ' +
      'Please add it to your .env.local file.'
    );
  }

  // Use createBrowserClient for proper cookie-based session management
  // This ensures sessions are shared between client and server in Next.js
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Initialize Supabase client for browser/client components
// This client properly handles cookies so sessions work across client/server
export const supabase = getSupabaseClient();

// For server-side operations that require elevated permissions,
// you can create a service role client (if needed)
// Note: Service role key should NEVER be exposed to the client
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl!, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// ==================== CANDIDATE FUNCTIONS ====================

export interface CandidateRow {
  id?: string; // UUID primary key (auto-generated)
  email: string; // Unique email
  name: string;
  summary: string;
  skills: string; // Comma-separated string
  location?: string;
  education_level?: string;
  university?: string;
  past_internships?: string; // Comma-separated string
  technical_projects?: string; // Comma-separated string
  resume_path?: string; // Path to resume file in Supabase Storage
  created_at?: string;
}

/**
 * Save or update a candidate in Supabase
 * @param candidate - Candidate data
 * @returns The saved candidate record with UUID id
 */
export async function saveCandidate(candidate: CandidateRow): Promise<{ id: string; email: string; [key: string]: any }> {
  const client = supabaseAdmin || supabase;

  const { data, error } = await client
    .from('candidates')
    .upsert(
      {
        email: candidate.email,
        name: candidate.name,
        summary: candidate.summary,
        skills: candidate.skills,
        location: candidate.location,
        education_level: candidate.education_level,
        university: candidate.university,
        past_internships: candidate.past_internships,
        technical_projects: candidate.technical_projects,
        resume_path: candidate.resume_path,
        created_at: candidate.created_at || new Date().toISOString(),
      },
      {
        onConflict: 'email',
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save candidate: ${error.message}`);
  }

  return data;
}

/**
 * Get a candidate by email
 */
export async function getCandidate(email: string) {
  const client = supabaseAdmin || supabase;
  
  const { data, error } = await client
    .from('candidates')
    .select('*')
    .eq('email', email)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get candidate: ${error.message}`);
  }

  return data;
}

// ==================== STARTUP FUNCTIONS ====================

export interface StartupRow {
  id: string; // Primary key (generated from name: lowercase, spaces -> dashes)
  name: string;
  industry: string;
  description: string;
  funding_stage: string;
  funding_amount: string;
  location: string;
  website: string;
  tags: string;
  founder_first_name?: string;
  founder_last_name?: string;
  founder_emails?: string;
  founder_linkedin?: string;
  batch?: string;
  job_openings?: string;
  date_raised?: string;
  created_at?: string;
}

/**
 * Save or update a startup in Supabase
 * @param startup - Startup data
 */
export async function saveStartup(startup: StartupRow) {
  const client = supabaseAdmin || supabase;
  
  // Build the data object, only including fields that are defined
  // This prevents errors if columns don't exist yet
  const dataToInsert: any = {
    id: startup.id,
    name: startup.name,
    industry: startup.industry,
    description: startup.description,
    funding_stage: startup.funding_stage,
    funding_amount: startup.funding_amount,
    location: startup.location,
    website: startup.website,
    tags: startup.tags,
    created_at: startup.created_at || new Date().toISOString(),
  };

  // Only add founder fields if they're defined (and columns exist)
  if (startup.founder_first_name !== undefined) {
    dataToInsert.founder_first_name = startup.founder_first_name || null;
  }
  if (startup.founder_last_name !== undefined) {
    dataToInsert.founder_last_name = startup.founder_last_name || null;
  }
  if (startup.founder_emails !== undefined) {
    dataToInsert.founder_emails = startup.founder_emails || null;
  }
  if (startup.founder_linkedin !== undefined) {
    dataToInsert.founder_linkedin = startup.founder_linkedin || null;
  }
  if (startup.batch !== undefined) {
    dataToInsert.batch = startup.batch || null;
  }
  if (startup.job_openings !== undefined) {
    dataToInsert.job_openings = startup.job_openings || null;
  }
  if (startup.date_raised !== undefined) {
    dataToInsert.date_raised = startup.date_raised || null;
  }
  
  const { data, error } = await client
    .from('startups')
    .upsert(dataToInsert, {
      onConflict: 'id',
    })
    .select()
    .single();

  if (error) {
    // If error is about missing column, provide helpful message
    if (error.message.includes('does not exist')) {
      throw new Error(
        `Column missing in Supabase. Please run migration: supabase/migrations/002_add_founder_columns.sql\n` +
        `Original error: ${error.message}`
      );
    }
    throw new Error(`Failed to save startup: ${error.message}`);
  }

  return data;
}

/**
 * Get a startup by ID
 */
export async function getStartup(id: string) {
  const client = supabaseAdmin || supabase;
  
  const { data, error } = await client
    .from('startups')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get startup: ${error.message}`);
  }

  return data;
}

/**
 * Get a startup by name
 */
export async function getStartupByName(name: string) {
  const client = supabaseAdmin || supabase;
  
  const { data, error } = await client
    .from('startups')
    .select('*')
    .eq('name', name)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get startup: ${error.message}`);
  }

  return data;
}

// ==================== MATCH FUNCTIONS ====================

export interface MatchRow {
  candidate_id: string; // Foreign key to candidates (email or id)
  startup_id: string; // Foreign key to startups.id
  score: number; // Similarity score (0-1)
  matched_at?: string;
}

/**
 * Save a match between a candidate and startup
 * @param match - Match data
 */
export async function saveMatch(match: MatchRow) {
  const client = supabaseAdmin || supabase;

  const { data, error } = await client
    .from('matches')
    .insert({
      candidate_id: match.candidate_id,
      startup_id: match.startup_id,
      score: match.score,
      matched_at: match.matched_at || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save match: ${error.message}`);
  }

  return data;
}

/**
 * Save multiple matches for a candidate
 * @param candidateId - Candidate's identifier (email)
 * @param matches - Array of matches with startup_id and score
 */
export async function saveMatches(
  candidateId: string,
  matches: Array<{ startup_id: string; score: number }>
) {
  const client = supabaseAdmin || supabase;

  // Delete all existing matches for this candidate first
  // This ensures we only show the most recent matches from the latest resume upload
  const { error: deleteError } = await client
    .from('matches')
    .delete()
    .eq('candidate_id', candidateId);

  if (deleteError) {
    throw new Error(`Failed to clear old matches: ${deleteError.message}`);
  }

  // Now insert the new matches
  const matchRows = matches.map((match) => ({
    candidate_id: candidateId,
    startup_id: match.startup_id,
    score: match.score,
    matched_at: new Date().toISOString(),
  }));

  const { data, error } = await client
    .from('matches')
    .insert(matchRows)
    .select();

  if (error) {
    throw new Error(`Failed to save matches: ${error.message}`);
  }

  return data;
}

/**
 * Get all matches for a candidate
 */
export async function getCandidateMatches(candidateId: string) {
  const client = supabaseAdmin || supabase;

  const { data, error } = await client
    .from('matches')
    .select(`
      *,
      startup:startups(*)
    `)
    .eq('candidate_id', candidateId)
    .order('score', { ascending: false });

  if (error) {
    throw new Error(`Failed to get matches: ${error.message}`);
  }

  return data;
}

