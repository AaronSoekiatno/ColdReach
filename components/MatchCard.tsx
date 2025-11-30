"use client";

import { SendEmailButton } from "./SendEmailButton";

interface MatchCardProps {
  match: {
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
  };
}

export const MatchCard = ({ match }: MatchCardProps) => {
  if (!match.startup) {
    return null;
  }

  return (
    <article className="rounded-3xl border border-border/40 bg-background/80 backdrop-blur-xl p-6 shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            {match.startup.name}
          </h2>
          <p className="text-sm text-muted-foreground">{match.startup.industry}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Match score</p>
          <p className="text-2xl font-bold text-blue-600">
            {(match.score * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
        {match.startup.location && <p>Location: {match.startup.location}</p>}
        {match.startup.funding_stage && (
          <p>
            Funding: {match.startup.funding_stage}{' '}
            {match.startup.funding_amount && `• ${match.startup.funding_amount}`}
          </p>
        )}
        {match.startup.tags && (
          <p className="text-xs uppercase tracking-widest text-foreground/60">
            {match.startup.tags}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {match.startup.website && (
          <a
            href={match.startup.website.startsWith('http')
              ? match.startup.website
              : `https://${match.startup.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-foreground/5"
          >
            Visit website
          </a>
        )}
        {match.startup.founder_emails && match.startup.id && (
          <SendEmailButton
            startupId={match.startup.id}
            matchScore={match.score}
            founderEmail={match.startup.founder_emails}
            variant="default"
            className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          />
        )}
        {match.startup.founder_emails && !match.startup.id && (
          <a
            href={`mailto:${match.startup.founder_emails}`}
            className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Email founder
          </a>
        )}
      </div>
    </article>
  );
};

