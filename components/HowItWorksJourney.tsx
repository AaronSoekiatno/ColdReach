"use client";

import { Target, Bot, Zap } from "lucide-react";

const steps = [
  {
    number: "1",
    icon: Target,
    title: "We Match YOU with Perfect-Fit Startups",
    description:
      "Our AI analyzes YOUR skills, education, and experience to find companies that directly align with YOUR background. No more wasting time on irrelevant applications.",
  },
  {
    number: "2",
    icon: Bot,
    title: "We Craft Compelling Messages FOR YOU",
    description:
      "Each startup gets a unique, professional cold DM that highlights YOUR relevant experience and why YOU're a great fit. No generic templates—every message is tailored.",
  },
  {
    number: "3",
    icon: Zap,
    title: "We Send Everything FOR YOU",
    description:
      "Connect your Gmail once, and we handle the rest. YOUR resume and personalized DMs reach founder inboxes automatically. What takes 40+ hours manually takes 5 minutes with ColdReach.",
  },
];

export const HowItWorksJourney = () => {
  return (
    <section className="py-12 sm:py-16 md:py-20 w-full relative bg-gradient-to-b from-transparent via-black/20 to-transparent">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12 md:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 sm:mb-4 px-2">
            Three ways we help your job search
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 relative">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {/* Step Card */}
              <div className="relative border-white/20 bg-white/10 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 h-full hover:bg-white/15 hover:border-white/30 transition-all duration-300 border">
                {/* Icon */}
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl bg-white/20 flex items-center justify-center mb-4 sm:mb-5 md:mb-6">
                  <step.icon className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-3 sm:mb-4">
                  {step.title}
                </h3>
                <p className="text-sm sm:text-base text-white/80 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        
      </div>
    </section>
  );
};
