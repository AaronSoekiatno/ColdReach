"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Check if we have the necessary tokens in the URL
    // Supabase password reset links come with hash fragments
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get("access_token");
    const type = hashParams.get("type");
    const refreshToken = hashParams.get("refresh_token");

    // If we have the token and it's a recovery type, set the session
    if (accessToken && type === "recovery" && refreshToken) {
      // Set the session using the tokens from the hash
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      }).then(() => {
        setIsValidating(false);
        // Clear the hash from URL for security
        window.history.replaceState({}, '', window.location.pathname);
      }).catch((error) => {
        console.error('Error setting session:', error);
        toast({
          title: "Invalid reset link",
          description: "This password reset link is invalid or has expired.",
          variant: "destructive",
        });
        router.push("/");
      });
    } else {
      // Check if user is already authenticated (might have been set by callback)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setIsValidating(false);
        } else {
          // No valid token, redirect to home
          toast({
            title: "Invalid reset link",
            description: "This password reset link is invalid or has expired.",
            variant: "destructive",
          });
          router.push("/");
        }
      });
    }
  }, [router, toast]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      toast({
        title: "Password required",
        description: "Please enter a new password.",
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

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords match.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Password updated",
        description: "Your password has been successfully updated. You can now sign in.",
      });

      // Redirect to home page after a short delay
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (error) {
      console.error("Password reset error:", error);
      toast({
        title: "Failed to update password",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
        <div className="bg-black border border-white/20 rounded-lg p-8 max-w-md w-full text-center">
          <p className="text-white/60">Validating reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
      <div className="bg-black border border-white/20 rounded-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-semibold text-white text-center mb-2">
          Reset your password
        </h1>
        <p className="text-white/60 text-center text-sm mb-6">
          Enter your new password below
        </p>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <Input
              type="password"
              placeholder="New password (min. 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="bg-gray-900 border-white/20 text-white placeholder:text-white/40 focus:border-white/40 h-12"
            />
          </div>
          <div>
            <Input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              className="bg-gray-900 border-white/20 text-white placeholder:text-white/40 focus:border-white/40 h-12"
            />
          </div>
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-6 rounded-lg transition-all"
          >
            {isLoading ? "Updating..." : "Update password"}
          </Button>
        </form>
      </div>
    </div>
  );
}

