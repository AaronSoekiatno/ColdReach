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
    <article className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl p-6 shadow-2xl hover:bg-white/15 hover:border-white/30 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <h2 className="text-2xl font-semibold text-white mb-1">
            {match.startup.name}
          </h2>
          <p className="text-sm text-white/70">{match.startup.industry}</p>
        </div>
        <div className="text-right ml-4">
          <p className="text-xs text-white/60 mb-1">Match score</p>
          <p className="text-2xl font-bold text-blue-300">
            {(match.score * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm text-white/90">
        {match.startup.location && (
          <p className="flex items-center gap-2">
            <span className="text-white/60">📍</span>
            <span className="text-white/90">{match.startup.location}</span>
          </p>
        )}
        {match.startup.funding_stage && (
          <p className="flex items-center gap-2">
            <span className="text-white/60">💰</span>
            <span className="text-white/90">
              {match.startup.funding_stage}
              {match.startup.funding_amount && ` • ${match.startup.funding_amount}`}
            </span>
          </p>
        )}
        {match.startup.tags && (
          <p className="text-xs uppercase tracking-widest text-blue-300 font-semibold mt-3">
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
            className="rounded-2xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 hover:border-white/40"
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
            className="rounded-2xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400 shadow-lg hover:shadow-xl"
          />
        )}
        {match.startup.founder_emails && !match.startup.id && (
          <a
            href={`mailto:${match.startup.founder_emails}`}
            className="rounded-2xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400 shadow-lg hover:shadow-xl"
          >
            Email founder
          </a>
        )}
      </div>
    </article>
  );
};

