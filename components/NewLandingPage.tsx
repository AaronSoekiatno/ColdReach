"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { NewHero } from "@/components/NewHero";
import { ProblemSection } from "@/components/ProblemSection";
import { TrustBadge } from "@/components/TrustBadge";
import { StartupsCarousel } from "@/components/StartupsCarousel";
import { AIAgentSection } from "@/components/AIAgentSection";
import { NewFeatures } from "@/components/NewFeatures";
import { FounderDataSection } from "@/components/FounderDataSection";
import { NewHowItWorks } from "@/components/NewHowItWorks";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";
import { SignInModal } from "@/components/SignInModal";
import { SignUpModal } from "@/components/SignUpModal";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function NewLandingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGetStarted = () => {
    if (user) {
      // If logged in, redirect to matches or upload
      router.push("/matches");
    } else {
      // If not logged in, show sign up modal
      setShowSignUp(true);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <Image src="/images/hermeslogo.png" alt="Hermes" width={32} height={32} />
            <span className="text-xl font-semibold">Hermes</span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  href="/matches"
                  className="text-sm text-secondary hover:text-white transition-colors"
                >
                  Your Matches
                </Link>
                <Link
                  href="/history"
                  className="text-sm text-secondary hover:text-white transition-colors"
                >
                  History
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="rounded-full h-9 px-4"
                    >
                      {user.email}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleSignOut}>
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => setShowSignIn(true)}
                  className="text-sm"
                >
                  Sign In
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSignUp(true)}
                  className="text-sm rounded-full"
                >
                  Sign Up
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-16">
        <NewHero onGetStarted={handleGetStarted} />
        <ProblemSection />
        <TrustBadge />
        <StartupsCarousel />
        <AIAgentSection />
        <NewFeatures />
        <FounderDataSection />
        <NewHowItWorks />
        <FinalCTA onGetStarted={handleGetStarted} />
      </main>

      {/* Footer */}
      <Footer />

      {/* Modals */}
      <SignInModal
        isOpen={showSignIn}
        onClose={() => setShowSignIn(false)}
        onSwitchToSignUp={() => {
          setShowSignIn(false);
          setShowSignUp(true);
        }}
      />
      <SignUpModal
        isOpen={showSignUp}
        onClose={() => setShowSignUp(false)}
        onSwitchToSignIn={() => {
          setShowSignUp(false);
          setShowSignIn(true);
        }}
      />
    </div>
  );
}
