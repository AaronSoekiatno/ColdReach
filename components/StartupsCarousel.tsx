"use client";

import Image from "next/image";

interface Startup {
  name: string;
  logoUrl: string;
}

export const StartupsCarousel = () => {
  const startups: Startup[] = [
    { name: "UC Berkeley", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b4/Berkeley_College_of_Letters_%26_Science_logo.svg" },
    { name: "UCLA", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/6c/University_of_California%2C_Los_Angeles_logo.svg" },
    { name: "UC San Diego", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/cc/University_of_California%2C_San_Diego_logo.svg" },
    { name: "UC Santa Barbara", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d4/UC_Santa_Barbara_logo.svg" },
    { name: "UC Irvine", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/8f/University_of_California%2C_Irvine_logo.svg" },
    { name: "UC Riverside", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/21/UC_Riverside_Highlanders_logo.svg" },
    { name: "UC Merced", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/bb/UC_Merced_2022_Logo.svg" },
    { name: "San Diego State University", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/59/San_Diego_State_University_primary_logo.svg" },
    { name: "Cal Poly San Luis Obispo", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e0/Cal_Poly_Logo_2019.svg" },
    { name: "Cal Poly Pomona", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/cb/Cal_Poly_banner.svg" },
    { name: "CSU Long Beach", logoUrl: "https://upload.wikimedia.org/wikipedia/en/2/2c/CSU_Long_Beach_seal.svg" },
    { name: "Cal State Fullerton", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1a/California_State_University%2C_Fullerton_seal.svg" },
  ];

  return (
    <section className="py-10 sm:py-12 md:py-16 overflow-hidden w-full relative">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h3 className="text-center text-xl sm:text-2xl font-bold text-white mb-6 sm:mb-8 px-2">
          Trusted by UC & CSU campuses
        </h3>
        
        <div className="relative w-full">
          <div className="flex animate-scroll">
            {/* First set of startups */}
            {startups.map((startup, index) => (
              <div
                key={`first-${index}`}
                className="flex-shrink-0 mx-2 sm:mx-4 md:mx-6 px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg shadow-sm flex items-center justify-center"
              >
                <Image
                  src={startup.logoUrl}
                  alt={startup.name}
                  width={160}
                  height={160}
                  className="h-12 sm:h-14 md:h-16 w-auto object-contain"
                  unoptimized
                />
              </div>
            ))}
            {/* Duplicate set for seamless loop */}
            {startups.map((startup, index) => (
              <div
                key={`second-${index}`}
                className="flex-shrink-0 mx-2 sm:mx-4 md:mx-6 px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg shadow-sm flex items-center justify-center"
              >
                <Image
                  src={startup.logoUrl}
                  alt={startup.name}
                  width={160}
                  height={160}
                  className="h-12 sm:h-14 md:h-16 w-auto object-contain"
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

