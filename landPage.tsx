"use client";

import { Button } from "@/components/ui/button";
import { Upload, FileText } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Features } from "@/components/Features";
import { StartupsCarousel } from "@/components/StartupsCarousel";
import { Footer } from "@/components/Footer";

export const Hero = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const { toast } = useToast();

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Sign in error:', error);
      toast({
        title: "Sign in failed",
        description: error instanceof Error ? error.message : "Failed to sign in with Google. Please try again.",
        variant: "destructive",
      });
      setIsSigningIn(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/pdf' || selectedFile.name.endsWith('.pdf')) {
        setFile(selectedFile);
        toast({
          title: "Please sign in",
          description: "Sign in with Google to upload your resume and get matched with startups.",
        });
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

        {/* Sign In Button */}
        <div className="absolute top-8 right-8 z-20">
          <Button 
            variant="outline" 
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="backdrop-blur-3xl bg-background/40 hover:bg-background/60 transition-all hover:-translate-y-1 duration-300 border-white/30 rounded-2xl text-white hover:text-white"
          >
            {isSigningIn ? "Signing in..." : "Sign In"}
          </Button>
        </div>

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
                  />
                  <label
                    htmlFor="resume"
                    className="flex flex-col items-center justify-center gap-4 w-full min-h-[200px] cursor-pointer group"
                  >
                    {file ? (
                      <>
                        <FileText className="h-12 w-12 text-primary transition-transform group-hover:scale-110 duration-300" />
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

      {/* Startups Carousel Section */}
      <StartupsCarousel />

      {/* Features Section */}
      <Features />

      {/* Footer Section */}
      <Footer />
    </div>
  );
};
