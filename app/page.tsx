import ResumeUpload from './components/ResumeUpload';

export default function Home() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-blue-50 to-white dark:from-zinc-900 dark:via-zinc-950 dark:to-black" />

      {/* Content */}
      <div className="container relative z-10 px-4 py-20 w-full">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          {/* Hero Text */}
          <div className="space-y-4 animate-fade-in">
            <h1 className="text-5xl md:text-7xl font-bold text-foreground leading-tight">
              Land Your Dream Internship
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              AI-powered resume distribution to top startups with personalized messages
            </p>
          </div>

          {/* Glassmorphic Resume Upload Container */}
          <div className="animate-fade-in-delay">
            <div className="relative backdrop-blur-3xl bg-background/40 border border-border/30 rounded-[2.5rem] p-8 md:p-12 shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
              <div className="absolute inset-0 bg-gradient-to-br from-background/50 via-background/30 to-background/20 rounded-[2.5rem]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(120,119,198,0.1),transparent_50%)] rounded-[2.5rem]" />
              
              <div className="relative">
                <ResumeUpload />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
