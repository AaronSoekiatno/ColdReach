"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState, useCallback } from "react";
import { Upload, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Features } from "@/components/Features";
import { StartupsCarousel } from "@/components/StartupsCarousel";
import { Footer } from "@/components/Footer";
import { HowItWorksJourney } from "@/components/HowItWorksJourney";
import { SignInModal } from "@/components/SignInModal";
import { SignUpModal } from "@/components/SignUpModal";
import { ConnectGmailButton } from "@/components/ConnectGmailButton";
import { UpgradeModal } from "@/components/UpgradeModal";
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
import logo from "./images/hermeslogo.png";

const PENDING_RESUME_DATA_KEY = "pendingResumeData";
const PENDING_RESUME_FILE_KEY = "pendingResumeFile";

const SAMPLE_MATCHED_STARTUPS = [
  "Anthropic",
  "Perplexity",
  "Loom",
  "Vercel",
  "Linear",
  "Superhuman",
  "OpenAI",
];

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


export const Hero = () => {
  const router = useRouter();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showSavingModal, setShowSavingModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [matchedStartups, setMatchedStartups] = useState<string[]>([]);
  const [matchCount, setMatchCount] = useState<number>(0);
  const [pendingResumeData, setPendingResumeData] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reuploadInProgress = useRef(false);

  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showGmailConnectModal, setShowGmailConnectModal] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [hasCheckedGmail, setHasCheckedGmail] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [hiddenMatchCount, setHiddenMatchCount] = useState(0);
  const { toast } = useToast();
  const checkingGmailRef = useRef(false);
  const gmailCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const modalScheduledRef = useRef(false);
  const lastCheckedUserRef = useRef<string | null>(null); // Track which user email was last checked

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

        clearPendingResumeStorage();
        setUploadedFile(null);

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

      // Check if this is a new sign-up and trigger Gmail connection check
      if (urlParams.get('new_signup') === 'true' && currentUser) {
        // Small delay to ensure state is ready
        setTimeout(() => {
          void checkGmailConnection(currentUser, true);
        }, 1000);
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
          
          // Check if this is a new sign-up by checking URL params or checking if user has candidate record
          const urlParams = new URLSearchParams(window.location.search);
          const isNewSignUp = urlParams.get('new_signup') === 'true' || urlParams.get('code') !== null;
          
          // Check Gmail connection immediately for new sign-ups, with a small delay to ensure state is ready
          setTimeout(() => {
            void checkGmailConnection(newUser, isNewSignUp);
          }, 500);
        }
        // If same user, keep hasCheckedGmail as is to prevent duplicate checks
      }

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
  }, [toast, router, reuploadPendingResume]);

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
        credentials: "include",
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

      setPendingResumeData(resumePayload);
      setUploadedFile(resume);

      if (resumePayload.savedToDatabase) {
        clearPendingResumeStorage();
      } else {
        await savePendingResumeToStorage(resumePayload, resume);
      }

      // Check if user is authenticated
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      setTimeout(() => {
        setShowProgressModal(false);
        if (currentUser) {
          // User is authenticated - show results modal
          setShowResultsModal(true);
          toast({
            title: "Resume processed",
            description: `We found ${count} startup${count !== 1 ? "s" : ""} that look like a great fit.`,
          });
        } else {
          // User is not authenticated - show sign-up modal directly
          setIsSignUpModalOpen(true);
          toast({
            title: "Resume processed",
            description: `We found ${count} startup${count !== 1 ? "s" : ""} that look like a great fit. Sign up to view them!`,
          });
        }
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

  const validateAndProcessFile = (selectedFile: File) => {
    const isPdf =
      selectedFile.type === "application/pdf" || selectedFile.name.toLowerCase().endsWith(".pdf");
    const isDocx =
      selectedFile.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      selectedFile.name.toLowerCase().endsWith(".docx");

    if (isPdf || isDocx) {
      setFile(selectedFile);
      setUploadedFile(selectedFile);
      void uploadResume(selectedFile);
      } else {
        toast({
          title: "Invalid file type",
        description: "Please upload a PDF or DOCX file",
          variant: "destructive",
        });
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndProcessFile(selectedFile);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      validateAndProcessFile(droppedFile);
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

  // Check Gmail connection status
  const checkGmailConnection = async (currentUser?: User | null, showImmediately = false) => {
    const activeUser = currentUser ?? user;

    if (!activeUser) {
      setHasCheckedGmail(false);
      checkingGmailRef.current = false;
      return;
    }

    // Prevent duplicate checks
    if (checkingGmailRef.current) {
      return;
    }

    // Don't check if modal is already showing or Gmail is already connected
    if (showGmailConnectModal || gmailConnected) {
      setHasCheckedGmail(true);
      checkingGmailRef.current = false;
      return;
    }

    checkingGmailRef.current = true;

    // Clear any existing timeout and reset scheduled flag
    if (gmailCheckTimeoutRef.current) {
      clearTimeout(gmailCheckTimeoutRef.current);
      gmailCheckTimeoutRef.current = null;
    }
    modalScheduledRef.current = false;

    try {
      const response = await fetch('/api/auth/gmail/status', {
        credentials: 'include',
      });

      console.log('[Gmail Status][client] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[Gmail Status][client] Response JSON:', data);

        // Treat any existing connection as "connected" even if the access token is expired.
        // Expiration is handled server-side by refreshing the token when sending emails.
        const connected = data.connected === true;
        setGmailConnected(connected);

        // Only prompt to connect if there is truly no connection row
        if (!connected && !modalScheduledRef.current) {
          modalScheduledRef.current = true;
          if (showImmediately) {
            // Show immediately for new sign-ups
            setShowGmailConnectModal(true);
            modalScheduledRef.current = false;
          } else {
            // Delay for existing users
            gmailCheckTimeoutRef.current = setTimeout(() => {
              setShowGmailConnectModal((prev) => {
                // Only show if not already showing
                if (!prev) {
                  return true;
                }
                return prev;
              });
              gmailCheckTimeoutRef.current = null;
              modalScheduledRef.current = false;
            }, 1500);
          }
        }
      } else {
        setGmailConnected(false);
        // Schedule modal if not already scheduled
        if (!modalScheduledRef.current) {
          modalScheduledRef.current = true;
          if (showImmediately) {
            setShowGmailConnectModal(true);
            modalScheduledRef.current = false;
          } else {
            gmailCheckTimeoutRef.current = setTimeout(() => {
              setShowGmailConnectModal((prev) => {
                if (!prev) {
                  return true;
                }
                return prev;
              });
              gmailCheckTimeoutRef.current = null;
              modalScheduledRef.current = false;
            }, 1500);
          }
        }
      }
    } catch (error) {
      console.error('Failed to check Gmail connection:', error);
      setGmailConnected(false);
      // Schedule modal if not already scheduled
      if (!modalScheduledRef.current) {
        modalScheduledRef.current = true;
        if (showImmediately) {
          setShowGmailConnectModal(true);
          modalScheduledRef.current = false;
        } else {
          gmailCheckTimeoutRef.current = setTimeout(() => {
            setShowGmailConnectModal((prev) => {
              if (!prev) {
                return true;
              }
              return prev;
            });
            gmailCheckTimeoutRef.current = null;
            modalScheduledRef.current = false;
          }, 1500);
        }
      }
    } finally {
      setHasCheckedGmail(true);
      checkingGmailRef.current = false;
    }
  };

  // Check Gmail connection when user is available (only if not already checked via auth state change)
  useEffect(() => {
    // Only auto-check if user exists, hasn't been checked, modal isn't showing, Gmail isn't connected, and we're not currently checking
    // This is a fallback for cases where auth state change didn't trigger the check
    if (user && !hasCheckedGmail && !showGmailConnectModal && !gmailConnected && !checkingGmailRef.current) {
      // Check URL params first to see if this is a new sign-up
      const urlParams = new URLSearchParams(window.location.search);
      const isNewSignUp = urlParams.get('new_signup') === 'true';
      void checkGmailConnection(user, isNewSignUp);
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

  // Reset hidden match count when premium modal is opened
  // For landing page, we'll show premium features regardless of match count
  useEffect(() => {
    if (showPremiumModal) {
      // Default to 0 for landing page - modal will still show all premium features
      setHiddenMatchCount(0);
    }
  }, [showPremiumModal]);


  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0E1422' }}>
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 w-full pt-2" style={{ backgroundColor: '#0E1422' }}>
        <div className="container mx-auto px-16 py-4 flex items-center justify-between">
          {/* Logo and Title */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src={logo}
              alt="Hermes logo"
              className="h-9 w-auto rounded-lg"
              priority
            />
            <span className="text-white font-semibold text-2xl">Hermes</span>
          </Link>

          {/* Sign In Button / Account Indicator */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  href="/matches"
                  className="text-md font-semibold text-white transition-all border border-transparent hover:border-white/30 hover:bg-white/10 hover:rounded-xl hover:px-3 hover:py-1.5 px-3 py-1.5 focus:outline-none"
                >
                  Your Matches
                </Link>
                <Link
                  href="/history"
                  className="text-md font-semibold text-white transition-all border border-transparent hover:border-white/30 hover:bg-white/10 hover:rounded-xl hover:px-3 hover:py-1.5 px-3 py-1.5 focus:outline-none"
                >
                  History
                </Link>
                <button
                  onClick={() => setShowPremiumModal(true)}
                  className="text-md font-semibold text-white transition-all border border-transparent hover:border-white/30 hover:bg-white/10 hover:rounded-xl hover:px-3 hover:py-1.5 px-3 py-1.5 focus:outline-none"
                >
                  Premium
                </button>
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
              <div className="flex items-center gap-5">
                <button
                  onClick={() => setIsSignUpModalOpen(true)}
                  className="text-sm font-semibold text-white transition-all border border-transparent bg-white/10 rounded-2xl px-5 py-2 hover:bg-white/20 focus:outline-none"
                >
                  Sign up
                </button>
                <button
                  onClick={() => setIsSignInModalOpen(true)}
                  className="text-sm font-semibold text-white transition-opacity hover:opacity-70 focus:outline-none"
                >
                  Log in
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
          fromReview={pendingResumeData !== null && !pendingResumeData.savedToDatabase}
          onSwitchToSignIn={() => setIsSignInModalOpen(true)}
        />

      {/* Content */}
      <div className="container relative z-10 px-4 pb-36">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight">
                Land Your Dream Job
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


      {/* Saving Resume Modal */}
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
              <div className="relative">
                <input
                  id="resume"
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                  ref={fileInputRef}
                />
                <div
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-3 bg-white/10 border-2 border-dashed rounded-lg p-8 cursor-pointer transition-all ${
                    isDragging 
                      ? 'border-blue-500 bg-blue-500/20 scale-105' 
                      : 'border-white/20 hover:border-white/40 hover:bg-white/15'
                  }`}
                >
                  {file ? (
                    <>
                      <div className="flex items-center gap-3 w-full">
                        <FileText className="h-8 w-8 text-white/60" />
                        <span className="text-white text-sm flex-1 truncate">
                          {file.name}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(e);
                          }}
                          className="text-white/60 hover:text-white transition-colors flex-shrink-0"
                          aria-label="Remove file"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="h-12 w-12 text-white/60" />
                      <div className="text-center">
                        <p className="text-white text-sm font-medium mb-1">
                          {isDragging ? 'Drop your resume here' : 'Upload your resume here'}
                        </p>
                        <p className="text-white/60 text-xs">
                          PDF or DOCX files only
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <p className="text-white/70 text-sm mt-4 text-center font-medium">
                  One resume upload → Personalized outreach to dozens of startups
                </p>
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
              Creating Your Matches
            </DialogTitle>
            <DialogDescription className="text-white/60 text-center">
              Hang tight while we work our magic
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${uploadProgress > 10 ? 'bg-green-500 text-white' : 'bg-white/20 text-white/60'}`}>
                  {uploadProgress > 10 ? '✓' : '1'}
                </div>
                <span className={`text-sm ${uploadProgress > 10 ? 'text-white' : 'text-white/60'}`}>
                  Analyzing your resume...
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
                    Ready to review your matches!
                  </span>
              </div>
            </div>
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
              Your Matches Are Ready!
            </DialogTitle>
            <DialogDescription className="text-lg text-white">
              Congrats! We found {matchCount} startup{matchCount !== 1 ? 's' : ''} for you and have crafted personalized messages for each of them.
            </DialogDescription>
          </DialogHeader>
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
              <span className="text-sm text-white/80">Connect Gmail to automate outreach</span>
            </div>
          </div>
          <Button
            className="w-full bg-white text-black hover:bg-white/90"
            onClick={async () => {
              setShowResultsModal(false);
              const { data: { user: currentUser } } = await supabase.auth.getUser();
              if (!currentUser) {
                // This shouldn't happen since we check auth before showing this modal,
                // but handle it just in case
                setIsSignUpModalOpen(true);
                return;
              }
              
              // User is authenticated - save resume if needed and redirect
              if (pendingResumeData && !pendingResumeData.savedToDatabase && uploadedFile) {
                try {
                  const formData = new FormData();
                  formData.append("resume", uploadedFile);
                  const saveResponse = await fetch("/api/upload-resume", {
                    method: "POST",
                    body: formData,
                    credentials: "include",
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
                  return;
                }
              }
              window.location.href = '/matches';
            }}
          >
            Review Your Matches
          </Button>
        </DialogContent>
      </Dialog>

      {/* Footer Section */}
      <Footer />

      {/* Premium Modal */}
      <UpgradeModal
        open={showPremiumModal}
        onOpenChange={setShowPremiumModal}
        hiddenMatchCount={hiddenMatchCount}
        email={user?.email || ''}
        onDismiss={() => setShowPremiumModal(false)}
        customTitle="Our Premium Plan"
      />
      </div>
  );
};