"use client";

export function FounderDataSection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="space-y-6">
          <h2 className="text-4xl md:text-5xl font-normal tracking-tight leading-tight">
            Real Founder Data & Smart Follow-Ups
          </h2>
          <p className="text-xl text-secondary leading-relaxed">
            99 verified YC founders with real emails and LinkedIn. No scraped
            junk—actual decision makers. Automatically tracks responses for
            contextual follow-ups so no opportunity slips through.
          </p>
        </div>

        {/* Optional: Testimonial-style quote */}
        <div className="mt-12 p-8 border border-white/10 rounded-2xl bg-white/5">
          <p className="text-lg text-secondary leading-relaxed italic">
            "I love turning complex problems into simple, beautiful, and
            user-friendly experiences. With a strong focus on UX/UI, I design
            products that not only look great but also feel effortless to use."
          </p>
        </div>
      </div>
    </section>
  );
}
