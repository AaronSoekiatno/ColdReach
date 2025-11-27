"use client";

import Image from "next/image";

interface Startup {
  name: string;
  logoUrl: string;
}

export const StartupsCarousel = () => {
  const startups: Startup[] = [
    { name: "Stripe", logoUrl: "https://cdn.simpleicons.org/stripe/635BFF" },
    { name: "Figma", logoUrl: "https://cdn.simpleicons.org/figma/F24E1E" },
    { name: "Notion", logoUrl: "https://cdn.simpleicons.org/notion/000000" },
    { name: "Vercel", logoUrl: "https://cdn.simpleicons.org/vercel/000000" },
    { name: "OpenAI", logoUrl: "https://cdn.simpleicons.org/openai/412991" },
    { name: "Anthropic", logoUrl: "https://cdn.simpleicons.org/anthropic/000000" },
    { name: "Perplexity", logoUrl: "https://cdn.simpleicons.org/perplexity/000000" },
    { name: "Linear", logoUrl: "https://cdn.simpleicons.org/linear/5E6AD2" },
    { name: "Supabase", logoUrl: "https://cdn.simpleicons.org/supabase/3ECF8E" },
    { name: "Railway", logoUrl: "https://cdn.simpleicons.org/railway/0B0D0E" },
    { name: "Replicate", logoUrl: "https://cdn.simpleicons.org/replicate/000000" },
    { name: "Resend", logoUrl: "https://cdn.simpleicons.org/resend/000000" },
    { name: "Cal.com", logoUrl: "https://cdn.simpleicons.org/caldotcom/000000" },
    { name: "Loom", logoUrl: "https://cdn.simpleicons.org/loom/625DF5" },
    { name: "Miro", logoUrl: "https://cdn.simpleicons.org/miro/050038" },
  ];

  return (
    <section className="py-16 overflow-hidden w-full relative">
      <div className="w-full max-w-7xl mx-auto px-4">
        <h3 className="text-center text-2xl font-bold text-white mb-8">
          Startups Our Users Got Into
        </h3>
        
        <div className="relative w-full">
          <div className="flex animate-scroll">
            {/* First set of startups */}
            {startups.map((startup, index) => (
              <div
                key={`first-${index}`}
                className="flex-shrink-0 mx-6 px-8 py-6 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg shadow-sm flex items-center justify-center"
              >
                <Image
                  src={startup.logoUrl}
                  alt={startup.name}
                  width={120}
                  height={40}
                  className="h-8 w-auto object-contain filter brightness-0 invert"
                  unoptimized
                />
              </div>
            ))}
            {/* Duplicate set for seamless loop */}
            {startups.map((startup, index) => (
              <div
                key={`second-${index}`}
                className="flex-shrink-0 mx-6 px-8 py-6 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg shadow-sm flex items-center justify-center"
              >
                <Image
                  src={startup.logoUrl}
                  alt={startup.name}
                  width={120}
                  height={40}
                  className="h-8 w-auto object-contain filter brightness-0 invert"
                  unoptimized
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

