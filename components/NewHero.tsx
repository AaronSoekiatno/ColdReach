"use client";

import { Button } from "@/components/ui/button";

interface NewHeroProps {
  onGetStarted: () => void;
}

export function NewHero({ onGetStarted }: NewHeroProps) {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 py-20">
      <div className="max-w-5xl mx-auto text-center">
        {/* Main Headline */}
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-normal tracking-tight mb-4 leading-tight">
          Land Jobs at Top Startups
          <br />
          <span className="font-ivy text-secondary">while you sleep</span>
        </h1>

        {/* CTA Button */}
        <div className="mt-12">
          <Button
            onClick={onGetStarted}
            variant="outline"
            size="lg"
            className="rounded-full px-8 py-6 text-base font-medium border-2 border-white/80 hover:bg-white hover:text-black transition-all duration-300"
          >
            Start Applying Now
          </Button>
        </div>

        {/* Value Proposition */}
        <div className="mt-24 space-y-2">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-normal tracking-tight leading-tight">
            Your AI agent networks
            <br />
            with 2000+ YC founders
          </h2>
          <p className="text-xl md:text-2xl text-secondary mt-4">
            Personalized outreach. Land Interviews. Get Actual Offers.
          </p>
        </div>
      </div>
    </section>
  );
}
