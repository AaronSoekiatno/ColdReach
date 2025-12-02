"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface SignUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromReview?: boolean;
  onSwitchToSignIn?: () => void;
}

export const SignUpModal = ({ open, onOpenChange, fromReview = false, onSwitchToSignIn }: SignUpModalProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGoogleSignUp = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            prompt: 'select_account', // Force account picker to show every time
          },
        },
      });

      if (error) {
        throw error;
      }

      // If successful, the user will be redirected to Google OAuth
      // No need to set loading to false as the redirect will happen
    } catch (error) {
      console.error('Sign up error:', error);
      toast({
        title: "Sign up failed",
        description: error instanceof Error ? error.message : "Failed to sign up with Google. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    if (!password) {
      toast({
        title: "Password required",
        description: "Please enter a password.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      // Use signUp with email and password
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        // If the user already exists, prompt them to sign in instead.
        if (
          error.code === "user_already_exists" ||
          /already registered|already exists/i.test(error.message)
        ) {
          toast({
            title: "Account already exists",
            description:
              "That email is already on file. Please sign in instead.",
            variant: "destructive",
          });

          // If we have a handler to switch to sign-in, call it.
          if (onSwitchToSignIn) {
            onOpenChange(false);
            onSwitchToSignIn();
          }
          return;
        }
        throw error;
      }

      toast({
        title: "Account created",
        description: "Your account has been created successfully. You can now sign in.",
      });
      onOpenChange(false);
      
      // Clear form
      setEmail("");
      setPassword("");
      
      // If we have a handler to switch to sign-in, suggest signing in
      if (onSwitchToSignIn) {
        setTimeout(() => {
          onSwitchToSignIn();
        }, 500);
      }
    } catch (error) {
      console.error('Email sign up error:', error);
      toast({
        title: "Sign up failed",
        description: error instanceof Error ? error.message : "Failed to send magic link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black border-white/20 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-white text-center">
            Sign up
          </DialogTitle>
          <DialogDescription className="text-white/60 text-center">
            {fromReview ? "Sign up to continue to your results" : "Choose your preferred sign-up method"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Google Sign Up Button */}
          <Button
            onClick={handleGoogleSignUp}
            disabled={isLoading}
            className="w-full bg-white hover:bg-gray-100 text-gray-900 font-medium py-6 rounded-lg flex items-center justify-center gap-3 transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>

          {/* Divider */}
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-white/20"></div>
            <span className="px-4 text-sm text-white/60">OR</span>
            <div className="flex-grow border-t border-white/20"></div>
          </div>

          {/* Email Sign Up Form */}
          <form onSubmit={handleEmailSignUp} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="bg-gray-900 border-white/20 text-white placeholder:text-white/40 focus:border-white/40 h-12"
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Enter your password (min. 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="bg-gray-900 border-white/20 text-white placeholder:text-white/40 focus:border-white/40 h-12"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-6 rounded-lg transition-all"
            >
              {isLoading ? "Creating account..." : "Sign up"}
            </Button>
          </form>

          {/* Legal text */}
          <p className="text-xs text-white/40 text-center pt-2">
            By continuing, you acknowledge our{" "}
            <a href="/privacy" className="underline hover:text-white/60">
              Privacy Policy
            </a>{" "}
            and agree to get occasional product updates and promotional emails.
          </p>

          {/* Sign in link */}
          {onSwitchToSignIn && (
            <p className="text-sm text-white/60 text-center pt-2">
              Already have an account?{" "}
              <button
                onClick={() => {
                  onOpenChange(false);
                  onSwitchToSignIn();
                }}
                className="underline hover:text-white/80 text-white/70"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

