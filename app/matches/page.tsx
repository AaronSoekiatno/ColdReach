'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { MatchCard } from '@/components/MatchCard';
import { Header } from '@/components/Header';
import type { User } from '@supabase/supabase-js';

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

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export default function MatchesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [hasError, setHasError] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Load initial data
  useEffect(() => {
    const initialize = async () => {
      try {
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !currentUser) {
          router.push(`/?signup=true&redirect=/matches`);
          return;
        }

        setUser(currentUser);

        // Get candidate info
        const response = await fetch('/api/matches?page=1&limit=6', {
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 404) {
            router.push('/?error=no_resume');
            return;
          }
          throw new Error('Failed to load matches');
        }

        const data = await response.json();
        setMatches(data.matches || []);
        setPagination(data.pagination);
      } catch (error) {
        console.error('Error initializing matches page:', error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [router]);

  // Load more matches - memoized with stable dependencies
  const loadMoreMatches = useCallback(async () => {
    if (isLoadingMore) return;
    
    // Use functional update to get current pagination state
    setPagination((currentPagination) => {
      if (!currentPagination?.hasMore || isLoadingMore) return currentPagination;

      setIsLoadingMore(true);
      const nextPage = currentPagination.page + 1;
      
      // Fetch in background
      fetch(`/api/matches?page=${nextPage}&limit=6`, {
        credentials: 'include',
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Failed to load more matches');
          }
          return response.json();
        })
        .then((data) => {
          setMatches((prev) => {
            // Filter out duplicates by match ID
            const existingIds = new Set(prev.map((m: MatchRecord) => m.id));
            const newMatches = (data.matches || []).filter((m: MatchRecord) => !existingIds.has(m.id));
            return [...prev, ...newMatches];
          });
          setPagination(data.pagination);
        })
        .catch((error) => {
          console.error('Error loading more matches:', error);
        })
        .finally(() => {
          setIsLoadingMore(false);
        });

      return currentPagination;
    });
  }, [isLoadingMore]);

  // Intersection Observer for infinite scroll - stable observer
  useEffect(() => {
    if (!pagination?.hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && pagination.hasMore && !isLoadingMore) {
          loadMoreMatches();
        }
      },
      { threshold: 0.1, rootMargin: '100px' } // Trigger earlier for smoother UX
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [pagination?.hasMore, isLoadingMore, loadMoreMatches]);

  // Memoized values - must be called before any conditional returns
  const hasMatches = useMemo(() => matches.length > 0, [matches.length]);
  
  // Count only perfect-fit matches with score >= 50% (0.5)
  const perfectFitMatchCount = useMemo(() => {
    return matches.filter(match => match.score >= 0.5).length;
  }, [matches]);
  
  const matchCountText = useMemo(() => {
    if (!hasMatches) return 'Upload a resume to see personalized startup matches.';
    const count = perfectFitMatchCount;
    if (count > 0) {
      return `Congrats! You directly matched with ${count} startup${count === 1 ? '' : 's'}! Review these companies and send personalized emails.`;
    }
    return 'Review these companies and send personalized emails.';
  }, [hasMatches, perfectFitMatchCount]);

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#0E1422' }}>
        <Header initialUser={user} />
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center text-white">
              <p>Loading matches...</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (hasError || !user) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#0E1422' }}>
        <Header initialUser={user} />
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center text-white">
              <p>Failed to load matches. Please try again.</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0E1422' }}>
      <Header initialUser={user} />
      <section className="py-20">
        <div className="container mx-auto px-4 space-y-12">
          <div className="max-w-4xl mx-auto text-center space-y-12">
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight line-clamp-2">
                Startups excited to meet you
              </h1>
              <p className="text-md md:text-xl text-white/80 max-w-2xl mx-auto">
                {matchCountText}
              </p>
            </div>
          </div>

          {hasMatches ? (
            <div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {matches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>

              {/* Loading indicator for infinite scroll */}
              {pagination?.hasMore && (
                <div ref={observerTarget} className="py-8 text-center">
                  {isLoadingMore ? (
                    <p className="text-white/70">Loading more matches...</p>
                  ) : (
                    <div className="h-20" /> // Spacer for intersection observer
                  )}
                </div>
              )}

              {/* End of results */}
              {!pagination?.hasMore && matches.length > 0 && (
                <div className="py-8 text-center">
                  <p className="text-white/70">You've seen all your matches!</p>
                </div>
              )}
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
