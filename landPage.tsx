"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Features } from "@/components/Features";
import { StartupsCarousel } from "@/components/StartupsCarousel";
import { Footer } from "@/components/Footer";
import { HowItWorksJourney } from "@/components/HowItWorksJourney";
import { SignInModal } from "@/components/SignInModal";
import { SignUpModal } from "@/components/SignUpModal";
import { ConnectGmailButton } from "@/components/ConnectGmailButton";
import { WaitlistModal } from "@/components/WaitlistModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import logo from "./images/logo.png";

export const Hero = () => {
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showGmailConnectModal, setShowGmailConnectModal] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [hasCheckedGmail, setHasCheckedGmail] = useState(false);
  const { toast } = useToast();
  const checkingGmailRef = useRef(false);
  const gmailCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const modalScheduledRef = useRef(false);
  const lastCheckedUserRef = useRef<string | null>(null);

  useEffect(() => {
    // Initialize current user on mount
    const initializeAuth = async () => {
      // Check if we're coming from an auth callback (magic link or OAuth)
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const isAuthCallback = urlParams.has('code') || urlParams.has('token') || 
                             hashParams.has('access_token') || hashParams.has('type');
      
      // If coming from auth callback, wait a bit for session to be set
      if (isAuthCallback) {
        // Wait for session to be available (cookies need time to be set)
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      // Use session user if available, otherwise fall back to getUser
      setUser(session?.user ?? currentUser ?? null);
      
      // Check for Gmail connection success
      if (urlParams.get('gmail_connected') === 'true') {
        setGmailConnected(true);
        setShowGmailConnectModal(false);
        modalScheduledRef.current = false;
        if (gmailCheckTimeoutRef.current) {
          clearTimeout(gmailCheckTimeoutRef.current);
          gmailCheckTimeoutRef.current = null;
        }
        toast({
          title: "Gmail connected!",
          description: "You can now send emails directly from your account.",
        });
      }
      
      // Check if user needs to sign in to connect Gmail
      if (urlParams.get('error') === 'please_sign_in' && urlParams.get('action') === 'connect_gmail') {
        if (!currentUser) {
          setIsSignInModalOpen(true);
          toast({
            title: "Please sign in",
            description: "You need to sign in to connect your Gmail account.",
          });
        }
      }
      
      // Clean up URL if we came from auth callback
      if (isAuthCallback || urlParams.has('gmail_connected') || urlParams.has('error')) {
        // Remove query params and hash
        window.history.replaceState({}, '', window.location.pathname);
      }
    };
    void initializeAuth();

    // Listen for auth state changes (sign in / sign out)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);

      // Reset Gmail check state only when user actually changes (different email)
      if (event === 'SIGNED_IN' && newUser) {
        if (newUser.email && newUser.email !== lastCheckedUserRef.current) {
          // User changed - reset check state for new user
          setHasCheckedGmail(false);
          lastCheckedUserRef.current = newUser.email;
        }
        // If same user, keep hasCheckedGmail as is to prevent duplicate checks
      }

      // If user signed out, reset Gmail connection state
      if (event === 'SIGNED_OUT') {
        setGmailConnected(false);
        setHasCheckedGmail(false);
        setShowGmailConnectModal(false);
        checkingGmailRef.current = false;
        modalScheduledRef.current = false;
        lastCheckedUserRef.current = null; // Reset tracked user
        if (gmailCheckTimeoutRef.current) {
          clearTimeout(gmailCheckTimeoutRef.current);
          gmailCheckTimeoutRef.current = null;
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [toast]);

  // Check Gmail connection status
  // DISABLED: Gmail connect functionality temporarily hidden
  const checkGmailConnection = async (currentUser?: User | null) => {
    // Function disabled - Gmail connect functionality temporarily hidden
    return;
    
    // const activeUser = currentUser ?? user;

    // if (!activeUser) {
    //   setHasCheckedGmail(false);
    //   checkingGmailRef.current = false;
    //   return;
    // }

    // // Prevent duplicate checks
    // if (checkingGmailRef.current) {
    //   return;
    // }

    // // Don't check if modal is already showing or Gmail is already connected
    // if (showGmailConnectModal || gmailConnected) {
    //   setHasCheckedGmail(true);
    //   checkingGmailRef.current = false;
    //   return;
    // }

    // checkingGmailRef.current = true;

    // // Clear any existing timeout and reset scheduled flag
    // if (gmailCheckTimeoutRef.current) {
    //   clearTimeout(gmailCheckTimeoutRef.current);
    //   gmailCheckTimeoutRef.current = null;
    // }
    // modalScheduledRef.current = false;

    // try {
    //   const response = await fetch('/api/auth/gmail/status', {
    //     credentials: 'include',
    //   });

    //   console.log('[Gmail Status][client] Response status:', response.status);

    //   if (response.ok) {
    //     const data = await response.json();
    //     console.log('[Gmail Status][client] Response JSON:', data);

    //     // Treat any existing connection as "connected" even if the access token is expired.
    //     // Expiration is handled server-side by refreshing the token when sending emails.
    //     const connected = data.connected === true;
    //     setGmailConnected(connected);

    //     // Only prompt to connect if there is truly no connection row
    //     if (!connected && !modalScheduledRef.current) {
    //       modalScheduledRef.current = true;
    //       gmailCheckTimeoutRef.current = setTimeout(() => {
    //         setShowGmailConnectModal((prev) => {
    //           // Only show if not already showing
    //           if (!prev) {
    //             return true;
    //           }
    //           return prev;
    //         });
    //         gmailCheckTimeoutRef.current = null;
    //         modalScheduledRef.current = false;
    //       }, 1500);
    //     }
    //   } else {
    //     setGmailConnected(false);
    //     // Schedule modal if not already scheduled
    //     if (!modalScheduledRef.current) {
    //       modalScheduledRef.current = true;
    //       gmailCheckTimeoutRef.current = setTimeout(() => {
    //         setShowGmailConnectModal((prev) => {
    //           if (!prev) {
    //             return true;
    //           }
    //           return prev;
    //         });
    //         gmailCheckTimeoutRef.current = null;
    //         modalScheduledRef.current = false;
    //       }, 1500);
    //     }
    //   }
    // } catch (error) {
    //   console.error('Failed to check Gmail connection:', error);
    //   setGmailConnected(false);
    //   // Schedule modal if not already scheduled
    //   if (!modalScheduledRef.current) {
    //     modalScheduledRef.current = true;
    //     gmailCheckTimeoutRef.current = setTimeout(() => {
    //       setShowGmailConnectModal((prev) => {
    //         if (!prev) {
    //           return true;
    //         }
    //         return prev;
    //       });
    //       gmailCheckTimeoutRef.current = null;
    //       modalScheduledRef.current = false;
    //     }
    //   }
    // } finally {
    //   setHasCheckedGmail(true);
    //   checkingGmailRef.current = false;
    // }
  };

  // Check Gmail connection when user is available
  useEffect(() => {
    if (user && !hasCheckedGmail && !showGmailConnectModal && !gmailConnected && !checkingGmailRef.current) {
      void checkGmailConnection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, hasCheckedGmail]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (gmailCheckTimeoutRef.current) {
        clearTimeout(gmailCheckTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-white/10 border-b border-white/20">
        <div className="container mx-auto px-8 py-3 flex items-center justify-between">
          {/* Logo and Title */}
          <Link href="/" className="flex items-center gap-3">
            <Image
              src={logo}
              alt="ColdReach logo"
              className="h-9 w-auto rounded-lg"
              priority
            />
            <span className="text-white font-semibold text-2xl">ColdReach</span>
          </Link>

          {/* Sign In Button / Account Indicator */}
          <div className="flex items-center gap-1">
            {user ? (
              <>
                <Link
                  href="/matches"
                  className="text-md font-semibold text-white transition-all border border-transparent hover:border-white/30 hover:bg-white/10 hover:rounded-xl hover:px-3 hover:py-1.5 px-3 py-1.5 focus:outline-none"
                >
                  Your Matches
                </Link>
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
                    {/* Gmail connect functionality temporarily hidden */}
                    {/* {gmailConnected ? (
                      <div className="px-4 py-2 text-sm text-white/60 border-b border-white/10 flex items-center justify-center gap-2">
                        <span className="text-green-500">✓</span> Gmail Connected
                      </div>
                    ) : (
                      <DropdownMenuItem
                        className="cursor-pointer text-white w-full px-4 py-2 text-center hover:bg-white/20 focus:bg-white/20 border-0"
                        onSelect={() => {
                          setShowGmailConnectModal(true);
                        }}
                      >
                        Connect Gmail
                      </DropdownMenuItem>
                    )} */}
                    <DropdownMenuItem
                      className="cursor-pointer text-white w-full px-4 py-2 text-center hover:bg-white/20 focus:bg-white/20 border-0"
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
                <button
                  onClick={() => setIsSignInModalOpen(true)}
                  className="text-sm font-semibold text-white transition-all border border-transparent hover:border-white/30 hover:bg-white/10 hover:rounded-xl hover:px-3 hover:py-1.5 px-3 py-1.5 focus:outline-none"
                >
                  Sign In
                </button>
                <button
                  onClick={() => setIsSignUpModalOpen(true)}
                  className="text-sm font-semibold text-white transition-all border border-transparent hover:border-white/30 hover:bg-white/10 hover:rounded-xl hover:px-3 hover:py-1.5 px-3 py-1.5 focus:outline-none"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Gmail Connection Modal */}
      <Dialog open={showGmailConnectModal} onOpenChange={(open) => {
        setShowGmailConnectModal(open);
        if (!open) {
          // Reset scheduled flag when modal is closed
          modalScheduledRef.current = false;
          if (gmailCheckTimeoutRef.current) {
            clearTimeout(gmailCheckTimeoutRef.current);
            gmailCheckTimeoutRef.current = null;
          }
        }
      }}>
        <DialogContent className="bg-black border-white/20 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-white text-center">
              Connect Your Gmail Account
            </DialogTitle>
            <DialogDescription className="text-white/60 text-center">
              Send personalized emails to startup founders with a single click.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="bg-gray-900/50 border border-white/10 rounded-lg p-4">
              <p className="text-white/80 text-sm mb-2">
                <strong className="text-white">Why connect Gmail?</strong>
              </p>
              <ul className="text-white/60 text-sm space-y-1 list-disc list-inside">
                <li>Send emails directly from your Gmail account</li>
                <li>No need to copy and paste generated emails</li>
                <li>One-click email sending to matched startups</li>
              </ul>
            </div>
            <div className="[&_button]:!border-0 [&_button]:border-transparent">
              <ConnectGmailButton
                variant="ghost"
                onConnected={() => {
                  setGmailConnected(true);
                  setShowGmailConnectModal(false);
                  modalScheduledRef.current = false;
                  if (gmailCheckTimeoutRef.current) {
                    clearTimeout(gmailCheckTimeoutRef.current);
                    gmailCheckTimeoutRef.current = null;
                  }
                  toast({
                    title: "Gmail connected!",
                    description: "You can now send emails directly from your account.",
                  });
                }}
                className="w-full !border-0 !border-transparent outline-none ring-0 focus:ring-0 focus-visible:ring-0 hover:bg-white/10"
              />
            </div>
            <div className="[&_button]:!border-0 [&_button]:border-transparent">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowGmailConnectModal(false);
                  modalScheduledRef.current = false;
                  if (gmailCheckTimeoutRef.current) {
                    clearTimeout(gmailCheckTimeoutRef.current);
                    gmailCheckTimeoutRef.current = null;
                  }
                }}
                className="w-full !border-0 !border-transparent outline-none ring-0 focus:ring-0 focus-visible:ring-0 hover:bg-white/10"
                style={{ border: 'none', borderWidth: 0, borderColor: 'transparent', boxShadow: 'none', outline: 'none' }}
              >
                Maybe later
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">

        {/* Sign In Modal */}
        <SignInModal 
          open={isSignInModalOpen} 
          onOpenChange={setIsSignInModalOpen} 
        />

        {/* Sign Up Modal */}
        <SignUpModal 
          open={isSignUpModalOpen} 
          onOpenChange={setIsSignUpModalOpen}
          fromReview={false}
          onSwitchToSignIn={() => setIsSignInModalOpen(true)}
        />

        {/* Waitlist Modal */}
        <WaitlistModal 
          open={showWaitlistModal} 
          onOpenChange={setShowWaitlistModal} 
        />

      {/* Content */}
      <div className="container relative z-10 px-4 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight">
                Land Your Dream Internship
              </h1>
              <p className="text-md md:text-xl text-white/80 max-w-2xl mx-auto">
                Matches you with top startups, crafts personalized cold DMs, and saves you hours on professional outreach
              </p>
              <Button
                onClick={() => setShowWaitlistModal(true)}
                className="mt-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-400 hover:to-blue-500 px-8 py-6 text-lg font-semibold rounded-xl transition-all hover:scale-105"
              >
                Join the Waitlist
              </Button>
          </div>
        </div>
      </div>
    </section>

      {/* How It Works Journey Section */}
      <HowItWorksJourney />

      {/* Startups Carousel Section */}
      <StartupsCarousel />

      {/* Features Section */}
      <Features />

      {/* Footer Section */}
      <Footer />
    </div>
  );
};