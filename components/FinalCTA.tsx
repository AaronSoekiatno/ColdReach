"use client";

import { Button } from "@/components/ui/button";

interface FinalCTAProps {
  onGetStarted: () => void;
}

export function FinalCTA({ onGetStarted }: FinalCTAProps) {
  return (
    <section className="py-32 px-6">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight leading-tight">
          Start Your Free Trial
        </h2>
        <p className="text-xl md:text-2xl text-secondary">
          Join 500+ students landing more interviews
          <br />
          with AI-powered networking.
        </p>
        <div className="mt-12">
          <Button
            onClick={onGetStarted}
            variant="default"
            size="lg"
            className="rounded-full px-12 py-6 text-lg font-medium bg-white text-black hover:bg-white/90 transition-all duration-300"
          >
            Start Applying Now
          </Button>
        </div>
      </div>
    </section>
  );
}
