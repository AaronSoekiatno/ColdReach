"use client";

import { Button } from "@/components/ui/button";
import { Upload, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Features } from "@/components/Features";
import { StartupsCarousel } from "@/components/StartupsCarousel";
import { Footer } from "@/components/Footer";
import { SignInModal } from "@/components/SignInModal";
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
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [matchedStartups, setMatchedStartups] = useState<string[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const { toast } = useToast();
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
    };
    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

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
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to process your resume");
      }

      stopProgressSimulation();
      setUploadProgress(100);
      setMatchedStartups(simulateMatches());

      setTimeout(() => {
        setShowProgressModal(false);
        setShowResultsModal(true);
        toast({
          title: "Resume processed",
          description: "We found a few startups that look like a great fit.",
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
        if (!user) {
          toast({
            title: "Please sign in",
            description: "Sign in to upload your resume and get matched with startups.",
          });
          setIsSignInModalOpen(true);
          return;
        }
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
            <Button 
              variant="outline" 
              onClick={() => setIsSignInModalOpen(true)}
              className="backdrop-blur-3xl bg-background/40 hover:bg-background/60 transition-all hover:-translate-y-1 duration-300 border-white/30 rounded-2xl text-white hover:text-white"
            >
              Sign In
            </Button>
          )}
        </div>

        {/* Sign In Modal */}
        <SignInModal 
          open={isSignInModalOpen} 
          onOpenChange={setIsSignInModalOpen} 
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
              We’ve matched you!
            </DialogTitle>
            <DialogDescription className="text-lg text-white">
              You’ve matched with 10+ startups
            </DialogDescription>
          </DialogHeader>
          <div className="text-white/70 text-sm">
            Preview your tailored startup matches and follow up with the teams that excite you.
          </div>
          <Button
            className="w-full bg-white text-black hover:bg-white/90"
            onClick={() => setShowResultsModal(false)}
          >
            See results
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
