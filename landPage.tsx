"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Features } from "@/components/Features";
import { StartupsCarousel } from "@/components/StartupsCarousel";
import { Footer } from "@/components/Footer";
import { HowItWorksJourney } from "@/components/HowItWorksJourney";
import { SignInModal } from "@/components/SignInModal";
import { SignUpModal } from "@/components/SignUpModal";
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
import { useRouter } from "next/navigation";
import logo from "./images/logo.png";

const PENDING_RESUME_DATA_KEY = "pendingResumeData";
const PENDING_RESUME_FILE_KEY = "pendingResumeFile";

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const dataUrlToFile = async (
  dataUrl: string,
  fileName: string,
  mimeType: string
) => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: mimeType || blob.type });
};

const savePendingResumeToStorage = async (
  resumeData: any,
  resumeFile: File
) => {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      PENDING_RESUME_DATA_KEY,
      JSON.stringify(resumeData)
    );
    const dataUrl = await fileToDataUrl(resumeFile);
    sessionStorage.setItem(
      PENDING_RESUME_FILE_KEY,
      JSON.stringify({
        name: resumeFile.name,
        type: resumeFile.type,
        dataUrl,
      })
    );
  } catch (error) {
    console.error("Failed to persist pending resume data", error);
  }
};

const loadPendingResumeFromStorage = () => {
  if (typeof window === "undefined") {
    return {
      data: null as any,
      file: null as { name: string; type: string; dataUrl: string } | null,
    };
  }
  try {
    const storedData = sessionStorage.getItem(PENDING_RESUME_DATA_KEY);
    const storedFile = sessionStorage.getItem(PENDING_RESUME_FILE_KEY);
    return {
      data: storedData ? JSON.parse(storedData) : null,
      file: storedFile ? JSON.parse(storedFile) : null,
    };
  } catch (error) {
    console.error("Failed to load pending resume data", error);
    return {
      data: null as any,
      file: null as { name: string; type: string; dataUrl: string } | null,
    };
  }
};

const clearPendingResumeStorage = () => {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_RESUME_DATA_KEY);
  sessionStorage.removeItem(PENDING_RESUME_FILE_KEY);
};

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
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showSavingModal, setShowSavingModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [matchedStartups, setMatchedStartups] = useState<string[]>([]);
  const [matchCount, setMatchCount] = useState<number>(0);
  const [pendingResumeData, setPendingResumeData] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const { toast } = useToast();
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const reuploadInProgress = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const { data, file: storedFile } = loadPendingResumeFromStorage();
    if (data) {
      setPendingResumeData(data);
    }
    if (storedFile) {
      dataUrlToFile(storedFile.dataUrl, storedFile.name, storedFile.type)
        .then((restoredFile) => {
          setUploadedFile(restoredFile);
          setFile(restoredFile);
        })
        .catch((error) => {
          console.error("Failed to restore pending resume file", error);
          clearPendingResumeStorage();
        });
    }
  }, []);

  const reuploadPendingResume = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!uploadedFile || reuploadInProgress.current) {
        return false;
      }
      reuploadInProgress.current = true;
      try {
        const formData = new FormData();
        formData.append("resume", uploadedFile);
        const saveResponse = await fetch("/api/upload-resume", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!saveResponse.ok) {
          const errorData = await saveResponse.json().catch(() => null);
          throw new Error(errorData?.error || "Failed to save resume");
        }

        const data = await saveResponse.json();
        const matches = data.matches || [];
        setPendingResumeData({
          ...data,
          savedToDatabase: data.savedToDatabase ?? true,
        });
        setMatchCount(matches.length);
        if (!options?.silent) {
          setShowResultsModal(true);
        }

        clearPendingResumeStorage();
        setUploadedFile(null);
        setFile(null);

        if (!options?.silent) {
          toast({
            title: "Resume saved",
            description: "Your matches are ready to view.",
          });
        }

        return true;
      } catch (error) {
        console.error("Failed to save resume", error);
        if (!options?.silent) {
          toast({
            title: "Error",
            description: "Failed to save your resume. Please try uploading again.",
            variant: "destructive",
          });
        }
        return false;
      } finally {
        reuploadInProgress.current = false;
      }
    },
    [uploadedFile, toast]
  );

  useEffect(() => {
    if (
      user &&
      pendingResumeData &&
      !pendingResumeData.savedToDatabase &&
      uploadedFile &&
      !reuploadInProgress.current
    ) {
      setShowSavingModal(true);
      reuploadPendingResume({ silent: true }).then((success) => {
        if (success) {
          // Small delay to ensure state is updated
          setTimeout(() => {
            setShowSavingModal(false);
            router.push('/matches');
          }, 500);
        } else {
          setShowSavingModal(false);
        }
      });
    }
  }, [user, pendingResumeData, uploadedFile, reuploadPendingResume, router]);

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
      
      // Clean up URL if we came from auth callback
      if (isAuthCallback) {
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

      // If user just signed in and we have pending resume data, save it
      if (
        event === 'SIGNED_IN' &&
        newUser &&
        pendingResumeData &&
        !pendingResumeData.savedToDatabase &&
        uploadedFile &&
        !reuploadInProgress.current
      ) {
        setShowSavingModal(true);
        reuploadPendingResume({ silent: true }).then((success) => {
          if (success) {
            // Navigate to matches page after successful save
            setTimeout(() => {
              setShowSavingModal(false);
              router.push('/matches');
            }, 500);
          } else {
            setShowSavingModal(false);
          }
        });
      }
    });

    return () => {
      subscription.unsubscribe();
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [pendingResumeData, uploadedFile, toast, reuploadPendingResume, router]);

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
      
      const resumePayload = {
        ...data,
        savedToDatabase: data.savedToDatabase || false,
      };

      // Store resume data and file temporarily in case user needs to sign in
      setPendingResumeData(resumePayload);
      setUploadedFile(resume); // Store the file for potential re-upload

      if (resumePayload.savedToDatabase) {
        clearPendingResumeStorage();
      } else {
        await savePendingResumeToStorage(resumePayload, resume);
      }

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
      const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.endsWith('.pdf');
      const isDocx = selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                     selectedFile.name.endsWith('.docx');
      
      if (isPdf || isDocx) {
        // Allow uploads without sign-in
        setFile(selectedFile);
        void uploadResume(selectedFile);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF or DOCX file",
          variant: "destructive",
        });
      }
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFile(null);
    setUploadedFile(null);
    setPendingResumeData(null);
    clearPendingResumeStorage();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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

      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">

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
              <p className="text-md md:text-xl text-white/80 max-w-2xl mx-auto">
                Matches you with top startups, crafts personalized cold DMs, and saves you hours on professional outreach
              </p>
              <Button
                onClick={() => {
                  const uploadSection = document.getElementById('resume-upload-section');
                  uploadSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="mt-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-400 hover:to-blue-500 px-8 py-6 text-lg font-semibold rounded-xl transition-all hover:scale-105"
              >
                Get Your Internship
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Upload Progress Modal */}
      <Dialog open={showProgressModal} onOpenChange={() => {}}>
        <DialogContent className="bg-black border-white/20 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-white text-center">
              Creating YOUR Matches
            </DialogTitle>
            <DialogDescription className="text-white/60 text-center">
              Hang tight while we work our magic
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-6">
            {/* Journey Steps */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${uploadProgress > 10 ? 'bg-green-500 text-white' : 'bg-white/20 text-white/60'}`}>
                  {uploadProgress > 10 ? '✓' : '1'}
                </div>
                <span className={`text-sm ${uploadProgress > 10 ? 'text-white' : 'text-white/60'}`}>
                  Analyzing YOUR resume...
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${uploadProgress > 40 ? 'bg-green-500 text-white' : 'bg-white/20 text-white/60'}`}>
                  {uploadProgress > 40 ? '✓' : '2'}
                </div>
                <span className={`text-sm ${uploadProgress > 40 ? 'text-white' : 'text-white/60'}`}>
                  Finding aligned startups...
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${uploadProgress > 70 ? 'bg-green-500 text-white' : 'bg-white/20 text-white/60'}`}>
                  {uploadProgress > 70 ? '✓' : '3'}
                </div>
                <span className={`text-sm ${uploadProgress > 70 ? 'text-white' : 'text-white/60'}`}>
                  Preparing personalized messages...
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${uploadProgress >= 100 ? 'bg-green-500 text-white' : 'bg-white/20 text-white/60'}`}>
                  {uploadProgress >= 100 ? '✓' : '4'}
                </div>
                <span className={`text-sm ${uploadProgress >= 100 ? 'text-white' : 'text-white/60'}`}>
                  Ready to review YOUR matches!
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-200"
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
              YOUR Matches Are Ready!
            </DialogTitle>
            <DialogDescription className="text-lg text-white">
              We found {matchCount} startup{matchCount !== 1 ? 's' : ''} that align{matchCount === 1 ? 's' : ''} with YOUR background and crafted personalized messages for each one.
            </DialogDescription>
          </DialogHeader>

          {/* Journey Completion Checklist */}
          <div className="bg-white/5 rounded-2xl p-4 space-y-2 text-left">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-xs">✓</div>
              <span className="text-sm text-white">{matchCount} perfect-fit startup{matchCount !== 1 ? 's' : ''} matched</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-xs">✓</div>
              <span className="text-sm text-white">Personalized cold DMs ready to send</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-xs">→</div>
              <span className="text-sm text-white/80">Just connect Gmail to automate outreach</span>
            </div>
          </div>

          <div className="text-white/70 text-sm">
            Review YOUR personalized matches and send emails with one click.
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
                    return; // Don't navigate if save failed
                  }
                }
                // Navigate to the matches page
                window.location.href = '/matches';
              }
            }}
          >
            Review YOUR Matches
          </Button>
        </DialogContent>
      </Dialog>

      {/* Saving Resume Modal - Shows after sign-in while saving resume */}
      <Dialog open={showSavingModal} onOpenChange={() => {}}>
        <DialogContent className="bg-black border-white/20 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-white text-center">
              Saving your resume
            </DialogTitle>
            <DialogDescription className="text-white/60 text-center">
              Please wait while we save your matches...
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* How It Works Journey Section */}
      <HowItWorksJourney />

      {/* Startups Carousel Section */}
      <StartupsCarousel />

      {/* Features Section */}
      <Features />

      {/* Resume Upload Section */}
      <section className="py-20 bg-gradient-to-br from-black via-gray-900 to-gray-800">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto">
            <div id="resume-upload-section" className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
              <h2 className="text-white text-lg mb-4 text-center">Upload your resume here.</h2>
              <div className="relative">
                <input
                  id="resume"
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                  ref={fileInputRef}
                />
                <div className="flex items-center gap-3 bg-white/10 border border-white/20 rounded-lg p-3">
                  <label
                    htmlFor="resume"
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded cursor-pointer transition-colors text-sm font-medium"
                  >
                    Choose File
                  </label>
                  <span className="text-white/60 text-sm flex-1">
                    {file ? file.name : "No file chosen"}
                  </span>
                  {file && (
                    <button
                      onClick={handleRemoveFile}
                      className="text-white/60 hover:text-white transition-colors"
                      aria-label="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="text-white/60 text-xs mt-2 text-center">
                  .pdf and .docx only
                </p>
                <p className="text-white/70 text-sm mt-4 text-center font-medium">
                  One resume upload → Personalized outreach to dozens of startups
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <Footer />
    </div>
  );
};
