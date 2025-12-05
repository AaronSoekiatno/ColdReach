"use client";

export function NewHowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Connect Profile",
      description:
        "Upload your resume and connect your LinkedIn. We analyze your experience, skills, and preferences to understand what makes you unique.",
    },
    {
      number: "02",
      title: "Find Matches",
      description:
        "Our AI scans 2000+ YC startups to find perfect matches based on your background, their hiring needs, and company culture fit.",
    },
    {
      number: "03",
      title: "Personalize Email",
      description:
        "We craft highly personalized outreach emails using real founder data, company insights, and your specific qualifications.",
    },
    {
      number: "04",
      title: "Land Interview",
      description:
        "Sit back while your AI agent sends emails, tracks responses, and follows up. Get interview invitations while you sleep.",
    },
  ];

  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          {steps.map((step, index) => (
            <div key={index} className="space-y-4">
              <div className="text-5xl font-light text-tertiary">
                {step.number}
              </div>
              <h3 className="text-2xl font-medium">{step.title}</h3>
              <p className="text-base text-secondary leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
