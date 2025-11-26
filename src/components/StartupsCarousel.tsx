export const StartupsCarousel = () => {
  const startups = [
    "Stripe", "Figma", "Notion", "Vercel", "OpenAI", 
    "Anthropic", "Perplexity", "Linear", "Supabase", "Railway",
    "Replicate", "Resend", "Cal.com", "Loom", "Miro"
  ];

  return (
    <section className="py-16 bg-muted/30 overflow-hidden">
      <div className="container px-4">
        <h3 className="text-center text-2xl font-bold text-foreground mb-8">
          Startups Our Users Got Into
        </h3>
        
        <div className="relative">
          <div className="flex animate-scroll">
            {/* First set of startups */}
            {startups.map((startup, index) => (
              <div
                key={`first-${index}`}
                className="flex-shrink-0 mx-6 px-8 py-4 bg-card border border-border rounded-lg shadow-sm"
              >
                <span className="text-lg font-semibold text-foreground whitespace-nowrap">
                  {startup}
                </span>
              </div>
            ))}
            {/* Duplicate set for seamless loop */}
            {startups.map((startup, index) => (
              <div
                key={`second-${index}`}
                className="flex-shrink-0 mx-6 px-8 py-4 bg-card border border-border rounded-lg shadow-sm"
              >
                <span className="text-lg font-semibold text-foreground whitespace-nowrap">
                  {startup}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
