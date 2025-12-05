"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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
  onSent,
  variant = "default",
  className,
}: SendEmailButtonProps) => {
  const [isSending, setIsSending] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [previewBody, setPreviewBody] = useState<string | null>(null);
  const { toast } = useToast();

  const handleOpenPreview = async () => {
    try {
      setIsPreviewLoading(true);
      setIsDialogOpen(true); // Open dialog immediately to show loading state

      const response = await fetch("/api/send-email/preview", {
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

      setPreviewSubject(data.subject);
      setPreviewBody(data.body);

      toast({
        title: "Email drafted",
        description: "Review your personalized email before sending.",
      });
    } catch (error) {
      console.error('Preview email error:', error);
      
      // Close dialog on error
      setIsDialogOpen(false);
      setPreviewSubject(null);
      setPreviewBody(null);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate email preview';
      
      // Provide helpful error messages
      if (errorMessage.includes('Unauthorized')) {
        toast({
          title: "Please sign in",
          description: "You need to be signed in to preview and send emails.",
          variant: "destructive",
        });
      } else if (errorMessage.includes('Candidate profile not found')) {
        toast({
          title: "No resume found",
          description: "Upload your resume first to generate personalized emails.",
          variant: "destructive",
        });
      } else if (errorMessage.includes('Founder email not available')) {
        toast({
          title: "No founder email",
          description: "Founder email is not available for this startup.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to generate email",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleSendEmail = async () => {
    try {
      setIsSending(true);

      const response = await fetch("/api/send-email", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          startupId,
          matchScore,
          // Include edited subject and body if user made changes
          subject: previewSubject,
          body: previewBody,
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

      // Close dialog and reset state
      setIsDialogOpen(false);
      setPreviewSubject(null);
      setPreviewBody(null);

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

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <Button
        onClick={handleOpenPreview}
        disabled={isPreviewLoading}
        variant={variant}
        className={className}
      >
        {isPreviewLoading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing...
          </span>
        ) : (
          "Preview & Send"
        )}
      </Button>

      <DialogContent className="bg-black border-white/20 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Preview your email
          </DialogTitle>
          <DialogDescription className="text-white/70">
            This is the email that will be sent from your Gmail account to the founder. You can review and edit it before sending.
          </DialogDescription>
        </DialogHeader>

        {isPreviewLoading && !previewSubject && !previewBody ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-white/70 text-sm">Generating your personalized email...</p>
          </div>
        ) : previewSubject && previewBody ? (
          <div className="space-y-4 text-sm">
            <div className="space-y-2">
              <label className="font-semibold text-white block">Subject:</label>
              <Input
                value={previewSubject}
                onChange={(e) => setPreviewSubject(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
                placeholder="Email subject"
              />
            </div>
            <div className="space-y-2">
              <label className="font-semibold text-white block">Body:</label>
              <Textarea
                value={previewBody}
                onChange={(e) => setPreviewBody(e.target.value)}
                className="min-h-[300px] max-h-[400px] bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40 resize-y"
                placeholder="Email body"
              />
            </div>
          </div>
        ) : null}

        <DialogFooter className="mt-6">
          <Button
            variant="ghost"
            onClick={() => setIsDialogOpen(false)}
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSendEmail}
            disabled={isSending || isPreviewLoading}
            className="bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </span>
            ) : (
              "Send Email"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

