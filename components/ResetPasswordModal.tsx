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

interface ResetPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ResetPasswordModal = ({ open, onOpenChange }: ResetPasswordModalProps) => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        throw error;
      }

      // Success - show confirmation
      setEmailSent(true);
      toast({
        title: "Reset link sent",
        description: "Check your email for a password reset link.",
      });
    } catch (error) {
      console.error('Password reset error:', error);
      toast({
        title: "Failed to send reset link",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      // Reset state when closing
      setEmail("");
      setEmailSent(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-black border-white/20 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-white text-center">
            Reset password
          </DialogTitle>
          <DialogDescription className="text-white/60 text-center">
            {emailSent
              ? "We've sent you a password reset link"
              : "Enter your email address and we'll send you a link to reset your password"}
          </DialogDescription>
        </DialogHeader>

        {emailSent ? (
          <div className="space-y-4 mt-4">
            <div className="bg-gray-900/50 border border-white/10 rounded-lg p-4 text-center">
              <p className="text-white/80 text-sm">
                We've sent a password reset link to <strong className="text-white">{email}</strong>
              </p>
              <p className="text-white/60 text-xs mt-2">
                Please check your email and click the link to reset your password.
              </p>
            </div>
            <Button
              onClick={() => handleClose(false)}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-6 rounded-lg transition-all"
            >
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4 mt-4">
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
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-6 rounded-lg transition-all"
            >
              {isLoading ? "Sending..." : "Send reset link"}
            </Button>
            <Button
              type="button"
              onClick={() => handleClose(false)}
              variant="ghost"
              className="w-full text-white/60 hover:text-white hover:bg-gray-900"
            >
              Cancel
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

