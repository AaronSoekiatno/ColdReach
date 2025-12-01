"use client";

import { Target, Zap, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Target,
    title: "Only Startups That Want YOU",
    description: "We only show matches above 45% similarity. No spam, no wasted effort—just companies excited about YOUR profile."
  },
  {
    icon: Sparkles,
    title: "Cold DMs That Actually Get Replies",
    description: "Our AI researches each startup and crafts genuine conversation starters, expresses interest with specific details, and highlights why YOU're the perfect fit."
  },
  {
    icon: Zap,
    title: "40 Hours → 5 Minutes",
    description: "Upload once, connect Gmail, and we handle everything. No more copying resumes, no more tracking spreadsheets, no more manual follow-ups."
  }
];

export const Features = () => {
  return (
    <section className="py-20 w-full relative">
      <div className="w-full max-w-7xl mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Why Choose ColdReach?
          </h2>
          <p className="text-lg text-white/80">
            To effortlessly land the job before everyone else
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="border-white/20 bg-white/10 backdrop-blur-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-2"
            >
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl text-white">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-white/80">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

