"use client";

import { Sparkles, Bot, Zap } from "lucide-react";

export function NewFeatures() {
  const features = [
    {
      icon: Sparkles,
      label: "Feature",
      title: "Intelligent Matching",
      description:
        "Advanced AI analyzes your skills, experience, and preferences to find perfect startup matches from our database of 2000+ YC companies.",
    },
    {
      icon: Bot,
      label: "Feature",
      title: "Hyper-Personalized Outreach",
      description:
        "Each email is custom-crafted using real company data, founder backgrounds, and your unique qualifications. No templates, no generic messages.",
    },
    {
      icon: Zap,
      label: "Feature",
      title: "Lightning Fast",
      description:
        "What takes 50+ hours of manual research and writing happens in 5 minutes. Apply to hundreds of startups while others are still on their first email.",
    },
  ];

  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="space-y-4">
                <div className="flex items-center gap-2 text-tertiary text-sm">
                  <Icon className="w-4 h-4" />
                  <span>{feature.label}</span>
                </div>
                <h3 className="text-2xl font-medium">{feature.title}</h3>
                <p className="text-lg text-secondary leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
