"use client";

import { Bot, Mail, Target, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Bot,
    title: "AI-Powered Personalization",
    description: "Our AI crafts unique, compelling messages for each startup based on your profile and their culture."
  },
  {
    icon: Target,
    title: "Targeted Distribution",
    description: "We connect you with top startups actively seeking interns in your field of interest."
  },
  {
    icon: Mail,
    title: "Professional Outreach",
    description: "Automated email campaigns that maintain professionalism while maximizing your reach."
  },
  {
    icon: Zap,
    title: "Save 95% of Your Time",
    description: "Send your resume to hundreds of startups in minutes instead of spending weeks manually applying. What takes 40+ hours normally takes just 5 minutes with Resume Sender."
  }
];

export const Features = () => {
  return (
    <section className="py-20 w-full relative">
      <div className="w-full max-w-7xl mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Why Choose Resume Sender?
          </h2>
          <p className="text-lg text-white/80">
            Leverage cutting-edge AI technology to stand out from the crowd
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
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

