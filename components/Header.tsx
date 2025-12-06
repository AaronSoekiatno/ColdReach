"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, isSubscribed } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { UpgradeModal } from "@/components/UpgradeModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logo from "../images/hermeslogo.png";

interface HeaderProps {
  initialUser?: User | null;
}

export const Header = ({ initialUser }: HeaderProps) => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(initialUser ?? null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [isCheckingPremium, setIsCheckingPremium] = useState(false);
  const { toast } = useToast();
  const fetchingRef = useRef(false);
  const lastFetchedEmailRef = useRef<string | null>(null);

  // Memoize user email to prevent unnecessary re-fetches
  const userEmail = useMemo(() => user?.email, [user?.email]);

  // Fetch candidate info to check premium status - only when email changes
  useEffect(() => {
    const fetchCandidateInfo = async () => {
      if (!userEmail) {
        setIsPremium(false);
        lastFetchedEmailRef.current = null;
        return;
      }

      // Prevent duplicate requests - check if we're already fetching or if we just fetched this email
      if (fetchingRef.current || lastFetchedEmailRef.current === userEmail) {
        return;
      }
      
      fetchingRef.current = true;
      setIsCheckingPremium(true);
      try {
        const response = await fetch('/api/candidate-info', {
          credentials: 'include',
        });
        if (response.ok) {
          const candidateInfo = await response.json();
          setIsPremium(isSubscribed(candidateInfo));
          lastFetchedEmailRef.current = userEmail;
        } else {
          setIsPremium(false);
        }
      } catch (error) {
        console.error('Error fetching candidate info:', error);
        setIsPremium(false);
      } finally {
        setIsCheckingPremium(false);
        fetchingRef.current = false;
      }
    };

    fetchCandidateInfo();
  }, [userEmail]);

  useEffect(() => {
    // Sync with auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handle Premium button click - memoized callback
  const handlePremiumClick = useCallback(async () => {
    // Open modal immediately for better UX
    setShowPremiumModal(true);
    
    // Sync subscription status in background (non-blocking)
    if (userEmail && !isCheckingPremium) {
      setIsCheckingPremium(true);
      try {
        const syncResponse = await fetch('/api/stripe/sync-subscription', {
          method: 'POST',
          credentials: 'include',
        });
        
        if (syncResponse.ok) {
          // Refresh premium status after sync
          const response = await fetch('/api/candidate-info', {
            credentials: 'include',
            cache: 'no-store',
          });
          if (response.ok) {
            const candidateInfo = await response.json();
            setIsPremium(isSubscribed(candidateInfo));
          }
        }
      } catch (error) {
        console.error('Error syncing subscription:', error);
      } finally {
        setIsCheckingPremium(false);
      }
    }
  }, [userEmail, isCheckingPremium]);

  return (
    <header className="sticky top-0 z-50 w-full pt-2" style={{ backgroundColor: '#0E1422' }}>
      <div className="container mx-auto px-16 py-4 flex items-center justify-between">
        {/* Logo and Title */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src={logo}
            alt="Hermes logo"
            className="h-9 w-auto rounded-lg"
            priority
          />
          <span className="text-white font-semibold text-2xl">Hermes</span>
        </Link>

        {/* Sign In Button / Account Indicator */}
        <div className="flex items-center gap-1">
          {user ? (
            <>
              <button
                onClick={() => {
                  console.log('Matches link clicked, navigating to /matches');
                  router.push('/matches');
                }}
                className="text-md font-semibold text-white transition-all border border-transparent hover:border-white/30 hover:bg-white/10 hover:rounded-xl hover:px-3 hover:py-1.5 px-3 py-1.5 focus:outline-none"
              >
                Your Matches
              </button>
              <Link
                href="/history"
                className="text-md font-semibold text-white transition-all border border-transparent hover:border-white/30 hover:bg-white/10 hover:rounded-xl hover:px-3 hover:py-1.5 px-3 py-1.5 focus:outline-none"
              >
                History
              </Link>
              <button
                onClick={handlePremiumClick}
                className="text-md font-semibold text-white transition-all border border-transparent hover:border-white/30 hover:bg-white/10 hover:rounded-xl hover:px-3 hover:py-1.5 px-3 py-1.5 focus:outline-none"
              >
                Premium
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 text-white transition-all border border-transparent hover:border-white/30 hover:bg-white/10 hover:rounded-xl hover:px-3 hover:py-1.5 px-3 py-1.5 focus:outline-none">
                    <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center font-semibold text-xs">
                      {user.email?.[0]?.toUpperCase() ?? "U"}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="border-white/30 bg-white/10 text-white px-0 py-0 rounded-2xl overflow-hidden min-w-[200px]">
                  <div className="px-4 py-2 text-sm text-white/80 border-b border-white/10">
                    {user.email}
                  </div>
                  {isPremium && (
                    <DropdownMenuItem
                      className="cursor-pointer font-bold text-white w-full px-4 py-2 text-center hover:bg-white/20 focus:bg-white/20 border-b border-white/10"
                      onSelect={async () => {
                        try {
                          const response = await fetch('/api/stripe/create-portal-session', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ email: user.email ?? '' }),
                          });

                          const data = await response.json();

                          if (!response.ok) {
                            throw new Error(data.error || 'Failed to create portal session');
                          }

                          // Redirect to Stripe Customer Portal
                          if (data.url) {
                            window.location.href = data.url;
                          }
                        } catch (error: any) {
                          console.error('Error opening portal:', error);
                          toast({
                            title: "Error",
                            description: error.message || 'Failed to open subscription management',
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      Manage Subscription
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="cursor-pointer font-bold text-white w-full px-4 py-2 text-center hover:bg-white/20 focus:bg-white/20"
                    onSelect={async () => {
                      await supabase.auth.signOut();
                      setUser(null);
                      toast({
                        title: "Signed out",
                        description: "You have been signed out successfully.",
                      });
                    }}
                  >
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-sm font-semibold text-white transition-all border border-transparent hover:border-white/30 hover:bg-white/10 hover:rounded-xl hover:px-3 hover:py-1.5 px-3 py-1.5 focus:outline-none"
              >
                Sign In
              </Link>
              <Link
                href="/"
                className="text-sm font-semibold text-white transition-all border border-transparent hover:border-white/30 hover:bg-white/10 hover:rounded-xl hover:px-3 hover:py-1.5 px-3 py-1.5 focus:outline-none"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Premium Modal */}
      <UpgradeModal
        open={showPremiumModal}
        onOpenChange={setShowPremiumModal}
        hiddenMatchCount={0}
        email={user?.email || ''}
        onDismiss={() => setShowPremiumModal(false)}
        customTitle="Our Premium Plan"
        isPremium={isPremium}
      />
    </header>
  );
};

