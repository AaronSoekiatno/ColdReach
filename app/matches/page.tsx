import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';

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

  return (
    <section className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 dark:from-zinc-900 dark:via-zinc-950 dark:to-black py-20">
      <div className="container mx-auto px-4 space-y-10">
        <div className="text-center space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-blue-300 font-semibold">Your Matches</p>
          <h1 className="text-4xl font-bold text-white">Startups excited to meet you</h1>
          <p className="text-blue-100">
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
              <article
                key={match.id}
                className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl p-6 shadow-2xl hover:bg-white/15 transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-white">
                      {match.startup?.name ?? 'Unknown Startup'}
                    </h2>
                    <p className="text-sm text-blue-200 mt-1">{match.startup?.industry}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-blue-200">Match score</p>
                    <p className="text-2xl font-bold text-blue-300">
                      {(match.score * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm text-blue-100">
                  {match.startup?.location && <p className="text-white/90">📍 Location: <span className="text-blue-200">{match.startup.location}</span></p>}
                  {match.startup?.funding_stage && (
                    <p className="text-white/90">
                      💰 Funding: <span className="text-blue-200">{match.startup.funding_stage}</span>
                      {match.startup.funding_amount && <span className="text-blue-200"> • {match.startup.funding_amount}</span>}
                    </p>
                  )}
                  {match.startup?.tags && (
                    <p className="text-xs uppercase tracking-widest text-blue-300 font-semibold mt-3">
                      {match.startup.tags}
                    </p>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  {match.startup?.website && (
                    <a
                      href={match.startup.website.startsWith('http')
                        ? match.startup.website
                        : `https://${match.startup.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-2xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 hover:border-white/40"
                    >
                      Visit website
                    </a>
                  )}
                  {match.startup?.founder_emails && (
                    <a
                      href={`mailto:${match.startup.founder_emails}`}
                      className="rounded-2xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400 shadow-lg hover:shadow-xl"
                    >
                      Email founder
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl p-12 text-center text-white">
            <p className="text-lg">No matches yet. Upload your resume to get started.</p>
          </div>
        )}
      </div>
    </section>
  );
}

