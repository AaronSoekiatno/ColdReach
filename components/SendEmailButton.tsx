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
import { DiffBlock } from "@/components/DiffBlock";

interface ResumeSuggestion {
  id: string;
  section: string;
  original: string;
  suggested: string;
  reason: string;
  keywords: string[];
}

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
  const [resumeSuggestions, setResumeSuggestions] = useState<ResumeSuggestion[]>([]);
  const [suggestionStatuses, setSuggestionStatuses] = useState<Record<string, 'pending' | 'accepted' | 'rejected'>>({});
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionsRequested, setSuggestionsRequested] = useState(false);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handleOpenPreview = async () => {
    try {
      setIsPreviewLoading(true);
      setIsDialogOpen(true); // Open dialog immediately to show loading state

      // Only fetch email preview initially (not suggestions)
      const emailResponse = await fetch("/api/send-email/preview", {
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

      const emailData = await emailResponse.json();

      if (!emailResponse.ok) {
        throw new Error(emailData.error || 'Failed to generate email preview');
      }

      setPreviewSubject(emailData.subject);
      setPreviewBody(emailData.body);

      // Fetch resume URL for preview
      if (emailData.resumeUrl) {
        setResumeUrl(emailData.resumeUrl);
      }

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

  const handleLoadSuggestions = async () => {
    try {
      setIsLoadingSuggestions(true);
      setSuggestionsRequested(true);

      const suggestionsResponse = await fetch("/api/resume-suggestions", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          startupId,
        }),
      });

      const suggestionsData = await suggestionsResponse.json();

      if (suggestionsResponse.ok && suggestionsData.suggestions) {
        setResumeSuggestions(suggestionsData.suggestions);
        // Initialize all suggestions as pending
        const initialStatuses: Record<string, 'pending' | 'accepted' | 'rejected'> = {};
        suggestionsData.suggestions.forEach((s: ResumeSuggestion) => {
          initialStatuses[s.id] = 'pending';
        });
        setSuggestionStatuses(initialStatuses);

        toast({
          title: "Suggestions loaded",
          description: `Found ${suggestionsData.suggestions.length} ways to improve your resume.`,
        });
      } else {
        // Show user-friendly message for errors
        if (suggestionsResponse.status === 429 || suggestionsData.error?.includes('Too Many Requests')) {
          toast({
            title: "Rate limit reached",
            description: "Please try again in a few moments.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Failed to load suggestions",
            description: suggestionsData.error || "Please try again.",
            variant: "destructive",
          });
        }
        setResumeSuggestions([]);
      }
    } catch (error) {
      console.error('Error loading suggestions:', error);
      toast({
        title: "Failed to load suggestions",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSuggestions(false);
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

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      // Reset state when dialog closes
      setResumeSuggestions([]);
      setSuggestionStatuses({});
      setSuggestionsRequested(false);
      setResumeUrl(null);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
      <Button
        onClick={handleOpenPreview}
        disabled={isPreviewLoading}
        variant={variant}
        className={`bg-gray-50 hover:bg-gray-100 text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed ${className || ''}`}
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

      <DialogContent className="bg-black border-white/20 text-white sm:max-w-[90vw] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold">
            Review, Optimize, and Send
          </DialogTitle>
        </DialogHeader>

        {isPreviewLoading && !previewSubject && !previewBody ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-white/70 text-sm">Loading your email and resume...</p>
          </div>
        ) : previewSubject && previewBody ? (
          <>
            {/* Two-column layout */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-4 px-6 min-h-0">
              {/* LEFT: Email Preview */}
              <div className="flex-1 flex flex-col min-h-0">
                <h3 className="text-sm font-semibold mb-3 text-white/90">Email</h3>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  <div className="space-y-2">
                    <label className="text-xs text-white/70 block">Subject:</label>
                    <Input
                      value={previewSubject}
                      onChange={(e) => setPreviewSubject(e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
                      placeholder="Email subject"
                    />
                  </div>
                  <div className="space-y-2 flex-1 flex flex-col">
                    <label className="text-xs text-white/70 block">Body:</label>
                    <Textarea
                      value={previewBody}
                      onChange={(e) => setPreviewBody(e.target.value)}
                      className="flex-1 min-h-[300px] bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40 resize-none"
                      placeholder="Email body"
                    />
                  </div>
                </div>
              </div>

              {/* DIVIDER */}
              <div className="hidden lg:block w-px bg-white/20" />

              {/* RIGHT: Resume Preview & Suggestions */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white/90">Your Resume</h3>
                  {!suggestionsRequested && resumeUrl && (
                    <Button
                      onClick={handleLoadSuggestions}
                      disabled={isLoadingSuggestions}
                      size="sm"
                      className="bg-blue-500 hover:bg-blue-600 text-white h-8 text-xs"
                    >
                      {isLoadingSuggestions ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Tailoring...
                        </span>
                      ) : (
                        "Tailor Resume"
                      )}
                    </Button>
                  )}
                  {resumeSuggestions.length > 0 && (
                    <span className="text-xs text-white/60">
                      {Object.values(suggestionStatuses).filter(s => s === 'accepted').length} of {resumeSuggestions.length} accepted
                    </span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto pr-2">
                  {resumeSuggestions.length > 0 ? (
                    // Show suggestions
                    resumeSuggestions.map((suggestion) => (
                      <DiffBlock
                        key={suggestion.id}
                        suggestion={suggestion}
                        status={suggestionStatuses[suggestion.id] || 'pending'}
                        onAccept={() => setSuggestionStatuses(prev => ({ ...prev, [suggestion.id]: 'accepted' }))}
                        onReject={() => setSuggestionStatuses(prev => ({ ...prev, [suggestion.id]: 'rejected' }))}
                      />
                    ))
                  ) : resumeUrl ? (
                    // Show resume PDF
                    <div className="h-full rounded-lg overflow-hidden border border-white/10">
                      <iframe
                        src={resumeUrl}
                        className="w-full h-full bg-white"
                        title="Resume Preview"
                      />
                    </div>
                  ) : (
                    // No resume found
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-white/60 text-sm">No resume found</p>
                      <p className="text-white/40 text-xs mt-2">Please upload your resume first</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t border-white/10">
              <div className="flex items-center justify-between w-full">
                <div className="text-xs text-white/50">
                  {resumeSuggestions.length > 0 && (
                    <>Note: Resume improvements are for your reference only</>
                  )}
                </div>
                <div className="flex gap-2">
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
                    className="bg-gray-50 hover:bg-gray-100 text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
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
                </div>
              </div>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

