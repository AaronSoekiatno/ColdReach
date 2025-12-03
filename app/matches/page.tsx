import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';
import { MatchCard } from '@/components/MatchCard';
import { Header } from '@/components/Header';

interface MatchRecord {
  id: string;
  score: number;
  matched_at: string;
  startup: {
    id?: string;
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

  // First, get the candidate's UUID by email
  const { data: candidate } = await supabaseAdmin
    .from('candidates')
    .select('id')
    .eq('email', user.email ?? '')
    .single();

  if (!candidate) {
    // No candidate record found, redirect to upload page
    redirect('/?error=no_resume');
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
    .eq('candidate_id', candidate.id)
    .order('score', { ascending: false });

  if (error) {
    throw new Error(`Failed to load matches: ${error.message}`);
  }

  const typedMatches = ((matches ?? []) as unknown) as MatchRecord[];
  const hasMatches = typedMatches.length > 0;

  // Feature flag: when true, keep the blurred "coming soon" overlay;
  // when false, show the real, interactive matches with SendEmailButton.
  const showWaitlistOverlay = true;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 dark:from-zinc-900 dark:via-zinc-950 dark:to-black">
      <Header initialUser={user} />
      <section className="py-20">
        <div className="container mx-auto px-4 space-y-10">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-blue-300">Startups excited to meet you</h1>
          <p className="text-white/90 text-lg">
            {hasMatches
              ? `Congrats! You matched with ${typedMatches.length} startup${
                  typedMatches.length === 1 ? '' : 's'
                }! Review your matches and send personalized emails.`
              : 'Upload a resume to see personalized startup matches.'}
          </p>
        </div>

        {hasMatches ? (
          showWaitlistOverlay ? (
            <div className="relative">
              {/* All matches blurred for waitlist */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 blur-md pointer-events-none select-none">
                {typedMatches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>

              {/* Overlay message */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-black/80 backdrop-blur-sm border border-white/30 rounded-3xl px-8 py-6 text-center shadow-2xl">
                  <h3 className="text-2xl font-bold text-white mb-2">Thanks for joining the waitlist! More coming soon shortly</h3>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {typedMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          )
        ) : (
          <div className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl p-12 text-center text-white">
            <p className="text-lg text-white">No matches yet. Upload your resume to get started.</p>
          </div>
        )}
        </div>
      </section>
    </div>
  );
}

