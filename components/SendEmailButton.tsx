"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface SendEmailButtonProps {
  startupId: string;
  matchScore: number;
  founderEmail?: string;
  onSent?: () => void;
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

export const SendEmailButton = ({
  startupId,
  matchScore,
  founderEmail,
  onSent,
  variant = "default",
  className,
}: SendEmailButtonProps) => {
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const handleSendEmail = async () => {
    if (!founderEmail) {
      toast({
        title: "No email available",
        description: "Founder email is not available for this startup.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSending(true);

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          startupId,
          matchScore,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      toast({
        title: "Email sent!",
        description: "Your email has been sent successfully to the founder.",
      });

      if (onSent) {
        onSent();
      }
    } catch (error) {
      console.error('Send email error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to send email';
      
      // Provide helpful error messages
      if (errorMessage.includes('not connected')) {
        toast({
          title: "Gmail not connected",
          description: "Please connect your Gmail account first to send emails.",
          variant: "destructive",
        });
      } else if (errorMessage.includes('expired')) {
        toast({
          title: "Connection expired",
          description: "Your Gmail connection has expired. Please reconnect.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to send email",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsSending(false);
    }
  };

  if (!founderEmail) {
    return (
      <Button
        disabled
        variant={variant}
        className={className}
      >
        Email unavailable
      </Button>
    );
  }

  return (
    <Button
      onClick={handleSendEmail}
      disabled={isSending}
      variant={variant}
      className={className}
    >
      {isSending ? "Sending..." : "Send Email"}
    </Button>
  );
};

