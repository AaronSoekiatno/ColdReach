import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';
import { Header } from '@/components/Header';

interface SentEmailRecord {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body: string;
  match_score: number | null;
  sent_at: string;
  startup: {
    id: string;
    name: string;
    industry: string;
    location: string;
    website: string;
  } | null;
}

export default async function HistoryPage() {
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
    redirect(`/login?redirect=/history`);
  }

  if (!supabaseAdmin) {
    throw new Error('Supabase service role key is not configured.');
  }

  // Get the candidate's UUID by email
  const { data: candidate } = await supabaseAdmin
    .from('candidates')
    .select('id')
    .eq('email', user.email ?? '')
    .single();

  if (!candidate) {
    // No candidate record found, redirect to upload page
    redirect('/?error=no_resume');
  }

  // Load sent emails for this candidate
  const { data: rawSentEmails, error: emailsError } = await supabaseAdmin
    .from('sent_emails')
    .select('id, recipient_email, recipient_name, subject, body, match_score, sent_at, startup_id')
    .eq('candidate_id', candidate.id)
    .order('sent_at', { ascending: false });

  if (emailsError) {
    throw new Error(`Failed to load email history: ${emailsError.message}`);
  }

  // Load all referenced startups
  const startupIds = Array.from(
    new Set(
      (rawSentEmails ?? [])
        .map((e) => e.startup_id)
        .filter((id): id is string => !!id)
    )
  );

  let startupsById: Record<string, {
    id: string;
    name: string;
    industry: string;
    location: string;
    website: string;
  }> = {};

  if (startupIds.length > 0) {
    const { data: startupRows, error: startupsError } = await supabaseAdmin
      .from('startups')
      .select('id, name, industry, location, website')
      .in('id', startupIds);

    if (startupsError) {
      throw new Error(`Failed to load startups: ${startupsError.message}`);
    }

    for (const s of startupRows ?? []) {
      startupsById[s.id] = {
        id: s.id,
        name: s.name,
        industry: s.industry,
        location: s.location,
        website: s.website,
      };
    }
  }

  // Join sent emails with startup data
  const sentEmails: SentEmailRecord[] = (rawSentEmails ?? []).map((email) => ({
    id: email.id,
    recipient_email: email.recipient_email,
    recipient_name: email.recipient_name,
    subject: email.subject,
    body: email.body,
    match_score: email.match_score,
    sent_at: email.sent_at,
    startup: startupsById[email.startup_id] ?? null,
  }));

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0E1422' }}>
      <Header initialUser={user} />
      
      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Email History</h1>
          <p className="text-white/70">
            View all emails you've sent to startup founders
          </p>
        </div>

        {sentEmails.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-12 text-center">
            <p className="text-white/70 text-lg">
              You haven't sent any emails yet. Start by viewing your matches and sending emails to founders!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sentEmails.map((email) => (
              <div
                key={email.id}
                className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 hover:bg-white/15 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-white">
                        {email.startup?.name || 'Unknown Startup'}
                      </h3>
                      {email.match_score !== null && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs font-medium rounded-lg">
                          {(email.match_score * 100).toFixed(0)}% match
                        </span>
                      )}
                    </div>
                    <p className="text-white/60 text-sm mb-1">
                      To: {email.recipient_name ? `${email.recipient_name} <${email.recipient_email}>` : email.recipient_email}
                    </p>
                    {email.startup && (
                      <p className="text-white/60 text-sm">
                        {email.startup.industry} • {email.startup.location}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-white/60 text-sm">
                      {new Date(email.sent_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-white/40 text-xs">
                      {new Date(email.sent_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 mt-4">
                  <p className="text-white/80 font-medium mb-2">Subject: {email.subject}</p>
                  <div className="bg-black/20 rounded-lg p-4 max-h-48 overflow-y-auto">
                    <p className="text-white/70 text-sm whitespace-pre-wrap">
                      {email.body}
                    </p>
                  </div>
                </div>

                {email.startup?.website && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <a
                      href={`https://${email.startup.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                    >
                      Visit {email.startup.name} →
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

