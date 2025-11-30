import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';
import { MatchCard } from '@/components/MatchCard';

interface MatchRecord {
  id: string;
  score: number;
  matched_at: string;
  startup: {
    name: string;
    industry: string;
    location: string;
    funding_stage: string;
    funding_amount: string;
    tags: string;
    website: string;
    founder_emails?: string;
  } | null;
}

export default async function MatchesPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not configured.');
  }

  const cookieStore = (await cookies()) as Awaited<ReturnType<typeof cookies>>;
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/matches`);
  }

  if (!supabaseAdmin) {
    throw new Error('Supabase service role key is not configured.');
  }

  const { data: matches, error } = await supabaseAdmin
    .from('matches')
    .select(
      `
        id,
        score,
        matched_at,
        startup:startups (
          id,
          name,
          industry,
          location,
          funding_stage,
          funding_amount,
          tags,
          website,
          founder_emails
        )
      `
    )
    .eq('candidate_email', user.email ?? '')
    .order('score', { ascending: false });

  if (error) {
    throw new Error(`Failed to load matches: ${error.message}`);
  }

  const typedMatches = ((matches ?? []) as unknown) as MatchRecord[];

  return (
    <section className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-white dark:from-zinc-900 dark:via-zinc-950 dark:to-black py-20">
      <div className="container mx-auto px-4 space-y-10">
        <div className="text-center space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-blue-500">Your Matches</p>
          <h1 className="text-4xl font-bold text-foreground">Startups excited to meet you</h1>
          <p className="text-muted-foreground">
            {typedMatches.length > 0
              ? `Showing ${typedMatches.length} matched startup${
                  typedMatches.length === 1 ? '' : 's'
                }.`
              : 'Upload a resume to see personalized startup matches.'}
          </p>
        </div>

        {typedMatches.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {typedMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-border/40 bg-background/80 backdrop-blur-xl p-12 text-center text-muted-foreground">
            No matches yet. Upload your resume to get started.
          </div>
        )}
      </div>
    </section>
  );
}

