import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase configuration
// These environment variables should be set in .env.local
// NEXT_PUBLIC_ prefix is required for client-side access in Next.js
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Get the Supabase client instance
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

  return createClient(supabaseUrl, supabaseAnonKey);
}

// Initialize Supabase client
// This client can be used in both server and client components
// The client is created lazily to avoid errors during build time
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

