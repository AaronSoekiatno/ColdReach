import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin, isSubscribed } from '@/lib/supabase';
import { MatchCard } from '@/components/MatchCard';
import { Header } from '@/components/Header';
import { ManageSubscriptionButton } from '@/components/ManageSubscriptionButton';
import { UpgradeModalWrapper } from '@/components/UpgradeModalWrapper';

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

  // First, get the candidate's UUID by email and subscription info
  const { data: candidate } = await supabaseAdmin
    .from('candidates')
    .select('id, subscription_tier, subscription_status, stripe_customer_id')
    .eq('email', user.email ?? '')
    .single();

  if (!candidate) {
    // No candidate record found, redirect to upload page
    redirect('/?error=no_resume');
  }

  // STEP 1: Load raw matches (without relying on Supabase FK relationships)
  const { data: rawMatches, error: matchError } = await supabaseAdmin
    .from('matches')
    .select('id, score, matched_at, startup_id')
    .eq('candidate_id', candidate.id)
    .order('score', { ascending: false });

  if (matchError) {
    throw new Error(`Failed to load matches: ${matchError.message}`);
  }

  type RawMatch = {
    id: string;
    score: number;
    matched_at: string;
    startup_id: string;
  };

  const typedRawMatches = ((rawMatches ?? []) as unknown) as RawMatch[];

  // STEP 2: Load all referenced startups in a separate query
  const startupIds = Array.from(
    new Set(
      typedRawMatches
        .map((m) => m.startup_id)
        .filter((id): id is string => !!id)
    )
  );

  let startupsById: Record<
    string,
    {
      id: string;
      name: string;
      industry: string;
      location: string;
      funding_stage: string;
      funding_amount: string;
      tags: string;
      website: string;
      founder_emails?: string;
    }
  > = {};

  if (startupIds.length > 0) {
    const { data: startupRows, error: startupsError } = await supabaseAdmin
      .from('startups')
      .select(
        'id, name, industry, location, funding_stage, funding_amount, tags, website, founder_emails'
      )
      .in('id', startupIds);

    if (startupsError) {
      throw new Error(`Failed to load startups: ${startupsError.message}`);
    }

    for (const s of startupRows ?? []) {
      startupsById[s.id] = {
        ...s,
        // Normalize null to undefined so types align with MatchCard expectations
        founder_emails: s.founder_emails ?? undefined,
      };
    }
  }

  // STEP 3: Manually join matches with their startup data
  const typedMatches: MatchRecord[] = typedRawMatches.map((m) => ({
    id: m.id,
    score: m.score,
    matched_at: m.matched_at,
    startup: startupsById[m.startup_id] ?? null,
  }));

  const hasMatches = typedMatches.length > 0;

  // Check subscription status
  const isPremium = isSubscribed(candidate);
  const isFree = !isPremium;

  // For free users, limit to 1 match
  const displayedMatches = isFree ? typedMatches.slice(0, 1) : typedMatches;
  const hiddenMatchCount = isFree ? Math.max(0, typedMatches.length - 1) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 dark:from-zinc-900 dark:via-zinc-950 dark:to-black">
      <Header initialUser={user} />
      <section className="py-20">
        <div className="container mx-auto px-4 space-y-10">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <h1 className="text-4xl md:text-5xl font-bold text-blue-300">Startups excited to meet you</h1>
            {isPremium && (
              <span className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-full text-sm">
                ✨ Premium
              </span>
            )}
          </div>
          <p className="text-white/90 text-lg">
            {hasMatches
              ? isPremium
                ? `Congrats! You matched with ${typedMatches.length} startup${
                    typedMatches.length === 1 ? '' : 's'
                  }! Review your matches and send personalized emails.`
                : `You matched with ${typedMatches.length} startup${
                    typedMatches.length === 1 ? '' : 's'
                  }! Upgrade to Premium to see all matches and unlock premium features.`
              : 'Upload a resume to see personalized startup matches.'}
          </p>
          {isPremium && candidate.stripe_customer_id && (
            <ManageSubscriptionButton email={user.email ?? ''} />
          )}
        </div>

        {/* Free tier upgrade modal - doesn't affect layout */}
        <UpgradeModalWrapper
          shouldShow={hasMatches && isFree}
          hiddenMatchCount={hiddenMatchCount}
          email={user.email ?? ''}
        />

        {hasMatches ? (
          <div>
            {/* All matches in the same grid (shown + blurred) */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Displayed matches (free users see only 1) */}
              {displayedMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
              
              {/* Blurred preview of additional matches (free tier only) */}
              {isFree && hiddenMatchCount > 0 && (
                <>
                  {typedMatches.slice(1, Math.min(4, typedMatches.length)).map((match) => (
                    <div key={match.id} className="blur-md pointer-events-none select-none opacity-60">
                      <MatchCard match={match} />
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
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

