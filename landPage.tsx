"use client";

import { Button } from "@/components/ui/button";
import { Upload, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Features } from "@/components/Features";
import { StartupsCarousel } from "@/components/StartupsCarousel";
import { Footer } from "@/components/Footer";
import { SignInModal } from "@/components/SignInModal";
import { SignUpModal } from "@/components/SignUpModal";
import { ConnectGmailButton } from "@/components/ConnectGmailButton";
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

const SAMPLE_MATCHED_STARTUPS = [
  "Anthropic",
  "Perplexity",
  "Loom",
  "Vercel",
  "Linear",
  "Superhuman",
  "OpenAI",
];

export const Hero = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [matchedStartups, setMatchedStartups] = useState<string[]>([]);
  const [matchCount, setMatchCount] = useState<number>(0);
  const [pendingResumeData, setPendingResumeData] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [showGmailConnectModal, setShowGmailConnectModal] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [hasCheckedGmail, setHasCheckedGmail] = useState(false);
  const { toast } = useToast();
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

      // If user just signed in, check Gmail connection status
      if (event === 'SIGNED_IN' && newUser) {
        // Reset check state so we check again
        setHasCheckedGmail(false);
        // checkGmailConnection will be called by the useEffect
      }

      // If user just signed in and we have pending resume data, save it
      if (
        event === 'SIGNED_IN' &&
        newUser &&
        pendingResumeData &&
        !pendingResumeData.savedToDatabase &&
        uploadedFile
      ) {
        try {
          const formData = new FormData();
          formData.append('resume', uploadedFile);

          const saveResponse = await fetch('/api/upload-resume', {
            method: 'POST',
            body: formData,
            credentials: 'include',
          });

          if (saveResponse.ok) {
            toast({
              title: 'Resume saved',
              description: 'Your matches have been saved. You can now view them.',
            });
            setPendingResumeData({
              ...pendingResumeData,
              savedToDatabase: true,
            });
          }
        } catch (error) {
          console.error('Failed to save resume after sign-in:', error);
        }
      }

      // If user signed out, reset Gmail connection state
      if (event === 'SIGNED_OUT') {
        setGmailConnected(false);
        setHasCheckedGmail(false);
        setShowGmailConnectModal(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [pendingResumeData, uploadedFile, toast]);

  // Check Gmail connection status
  const checkGmailConnection = async () => {
    if (!user) {
      setHasCheckedGmail(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/gmail/status', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const connected = data.connected && !data.expired;
        setGmailConnected(connected);
        
        // If not connected and we've checked, show modal after a delay
        if (!connected) {
          setTimeout(() => {
            setShowGmailConnectModal(true);
          }, 1500);
        }
      } else {
        setGmailConnected(false);
        setTimeout(() => {
          setShowGmailConnectModal(true);
        }, 1500);
      }
    } catch (error) {
      console.error('Failed to check Gmail connection:', error);
      setGmailConnected(false);
      setTimeout(() => {
        setShowGmailConnectModal(true);
      }, 1500);
    } finally {
      setHasCheckedGmail(true);
    }
  };

  // Check Gmail connection when user is available
  useEffect(() => {
    if (user && !hasCheckedGmail) {
      void checkGmailConnection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const startProgressSimulation = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    setUploadProgress(0);
    progressIntervalRef.current = setInterval(() => {
      setUploadProgress((prev) => {
        const next = prev + Math.random() * 10;
        return next >= 95 ? 95 : next;
      });
    }, 60);
  };

  const stopProgressSimulation = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const simulateMatches = () => {
    const shuffled = [...SAMPLE_MATCHED_STARTUPS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  };

  const uploadResume = async (resume: File) => {
    setIsUploading(true);
    setShowProgressModal(true);
    setUploadProgress(5);
    startProgressSimulation();

    const formData = new FormData();
    formData.append("resume", resume);

    try {
      const response = await fetch("/api/upload-resume", {
        method: "POST",
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to process your resume");
      }

      stopProgressSimulation();
      setUploadProgress(100);
      
      const data = await response.json();
      const matches = data.matches || [];
      const count = matches.length;
      setMatchCount(count);
      setMatchedStartups(simulateMatches());
      
      // Store resume data and file temporarily in case user needs to sign in
      setPendingResumeData({ ...data, savedToDatabase: data.savedToDatabase || false });
      setUploadedFile(resume); // Store the file for potential re-upload

      setTimeout(() => {
        setShowProgressModal(false);
        setShowResultsModal(true);
        toast({
          title: "Resume processed",
          description: `We found ${count} startup${count !== 1 ? 's' : ''} that look like a great fit.`,
        });
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }, 500);
    } catch (error) {
      stopProgressSimulation();
      setShowProgressModal(false);
      toast({
        title: "Upload failed",
        description:
          error instanceof Error
            ? error.message
            : "We couldn't process your resume. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/pdf' || selectedFile.name.endsWith('.pdf')) {
        // Allow uploads without sign-in
        setFile(selectedFile);
        void uploadResume(selectedFile);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF file",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800">
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">

        {/* Sign In Button / Account Indicator */}
        <div className="absolute top-8 right-8 z-20">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-2xl border border-white/30 bg-white/10 px-4 py-2 text-white transition hover:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/40">
                  <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center font-semibold">
                    {user.email?.[0]?.toUpperCase() ?? "U"}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">{user.email}</p>
                    <p className="text-xs text-white/60">Signed in</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-white/30 bg-white/10 text-white px-0 py-0 rounded-2xl overflow-hidden min-w-[250px]">
                <DropdownMenuItem
                  className="cursor-pointer text-white w-full px-4 py-2 text-center hover:bg-white/20 focus:bg-white/20"
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
          ) : (
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={() => setIsSignInModalOpen(true)}
                className="backdrop-blur-3xl bg-background/40 hover:bg-background/60 transition-all hover:-translate-y-1 duration-300 border-white/30 rounded-2xl text-white hover:text-white"
              >
                Sign In
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsSignUpModalOpen(true)}
                className="backdrop-blur-3xl bg-background/40 hover:bg-background/60 transition-all hover:-translate-y-1 duration-300 border-white/30 rounded-2xl text-white hover:text-white"
              >
                Sign Up
              </Button>
            </div>
          )}
        </div>

        {/* Gmail Connection Modal */}
        <Dialog open={showGmailConnectModal} onOpenChange={setShowGmailConnectModal}>
          <DialogContent className="bg-black border-white/20 text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold text-white text-center">
                Connect Gmail to Send Emails
              </DialogTitle>
              <DialogDescription className="text-white/60 text-center">
                Connect your Gmail account to send personalized emails to startup founders with one click.
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
              <ConnectGmailButton
                onConnected={() => {
                  setGmailConnected(true);
                  setShowGmailConnectModal(false);
                  toast({
                    title: "Gmail connected!",
                    description: "You can now send emails directly from your account.",
                  });
                }}
                className="w-full"
              />
              <Button
                variant="ghost"
                onClick={() => setShowGmailConnectModal(false)}
                className="w-full text-white/60 hover:text-white hover:bg-gray-900"
              >
                Maybe later
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Sign In Modal */}
        <SignInModal 
          open={isSignInModalOpen} 
          onOpenChange={(open) => {
            setIsSignInModalOpen(open);
            // If closing sign-in modal and user is now signed in, reopen results modal
            if (!open && user && pendingResumeData) {
              setTimeout(() => {
                setShowResultsModal(true);
              }, 100);
            }
          }} 
        />

        {/* Sign Up Modal */}
        <SignUpModal 
          open={isSignUpModalOpen} 
          onOpenChange={(open) => {
            setIsSignUpModalOpen(open);
            // If closing sign-up modal and user is now signed in, reopen results modal
            if (!open && user && pendingResumeData) {
              setTimeout(() => {
                setShowResultsModal(true);
              }, 100);
            }
          }}
          fromReview={pendingResumeData !== null && !user}
          onSwitchToSignIn={() => setIsSignInModalOpen(true)}
        />

        {/* Content */}
        <div className="container relative z-10 px-4 py-20">
          <div className="max-w-4xl mx-auto text-center space-y-12">
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight">
                Land Your Dream Internship
              </h1>
              <p className="text-xl md:text-2xl text-white/80 max-w-2xl mx-auto">
                AI-powered resume distribution to top startups with personalized messages
              </p>
            </div>

            {/* Apple-style Liquid Glass Resume Upload Block */}
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
          <div className="relative backdrop-blur-3xl bg-background/40 border border-border/30 rounded-[2.5rem] p-12 shadow-[0_8px_32px_0_rgba(31,38,135,0.15)]">
                <div className="absolute inset-0 bg-gradient-to-br from-background/50 via-background/30 to-background/20 rounded-[2.5rem]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(120,119,198,0.1),transparent_50%)] rounded-[2.5rem]" />
                
                <div className="relative">
                  <input
                    id="resume"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    ref={fileInputRef}
                  />
                  <label
                    htmlFor="resume"
                    className="flex flex-col items-center justify-center gap-4 w-full min-h-[200px] cursor-pointer group"
                  >
                    {file ? (
                      <>
                        <FileText className="h-12 w-12 text-white transition-transform group-hover:scale-110 duration-300" />
                        <span className="text-xl font-semibold text-white">{file.name}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-12 w-12 text-white/60 transition-all group-hover:text-white group-hover:scale-110 duration-300" />
                        <span className="text-2xl font-semibold text-white">Send Resume</span>
                      </>
                    )}
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Upload Progress Modal */}
      <Dialog open={showProgressModal} onOpenChange={() => {}}>
        <DialogContent className="bg-black border-white/20 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-white text-center">
              Matching you with startups
            </DialogTitle>
            <DialogDescription className="text-white/60 text-center">
              Hang tight while we analyze your resume
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-center text-white/70 text-sm">
              {Math.round(uploadProgress)}% complete
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Results Modal */}
      <Dialog open={showResultsModal} onOpenChange={setShowResultsModal}>
        <DialogContent className="bg-black border-white/20 text-white sm:max-w-md text-center space-y-6">
          <DialogHeader>
            <DialogTitle className="text-3xl font-semibold text-white">
              We've matched you!
            </DialogTitle>
            <DialogDescription className="text-lg text-white">
              You've matched with {matchCount} startup{matchCount !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="text-white/70 text-sm">
            Preview your tailored startup matches and follow up with the teams that excite you.
          </div>
          <Button
            className="w-full bg-white text-black hover:bg-white/90"
            onClick={async () => {
              setShowResultsModal(false);
              
              // Check if user is signed in
              const { data: { user: currentUser } } = await supabase.auth.getUser();
              
              if (!currentUser) {
                // User not signed in - prompt to sign up
                // Close results modal and show sign-up modal
                setShowResultsModal(false);
                setIsSignUpModalOpen(true);
              } else {
                // User is signed in - save resume if not already saved and show results
                if (pendingResumeData && !pendingResumeData.savedToDatabase && uploadedFile) {
                  // Re-upload to save to database now that user is authenticated
                  try {
                    const formData = new FormData();
                    formData.append("resume", uploadedFile);
                    
                    const saveResponse = await fetch("/api/upload-resume", {
                      method: "POST",
                      body: formData,
                      credentials: 'include',
                    });
                    
                    if (saveResponse.ok) {
                      toast({
                        title: "Resume saved",
                        description: "Your matches are ready to view.",
                      });
                      setPendingResumeData(null);
                      setUploadedFile(null);
                    } else {
                      throw new Error("Failed to save resume");
                    }
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to save your resume. Please try uploading again.",
                      variant: "destructive",
                    });
                  }
                }
                // TODO: Navigate to results page or show results component
                // For now, just close the modal
              }
            }}
          >
            Continue to review
          </Button>
        </DialogContent>
      </Dialog>

      {/* Startups Carousel Section */}
      <StartupsCarousel />

      {/* Features Section */}
      <Features />

      {/* Footer Section */}
      <Footer />
    </div>
  );
};
