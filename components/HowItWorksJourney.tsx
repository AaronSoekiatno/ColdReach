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
    <section className="py-20 w-full relative bg-gradient-to-b from-transparent via-black/20 to-transparent">
      <div className="w-full max-w-7xl mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Three ways we help your job search
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {/* Step Card */}
              <div className="relative border-white/20 bg-white/10 backdrop-blur-sm rounded-3xl p-8 h-full hover:bg-white/15 hover:border-white/30 transition-all duration-300 border">
                {/* Icon */}
                <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center mb-6">
                  <step.icon className="h-8 w-8 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-2xl font-bold text-white mb-4">
                  {step.title}
                </h3>
                <p className="text-base text-white/80 leading-relaxed">
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
