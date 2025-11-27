import { Button } from "@/components/ui/button";
import { Upload, FileText } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export const Hero = () => {
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/pdf' || selectedFile.name.endsWith('.pdf')) {
        setFile(selectedFile);
        toast({
          title: "Success!",
          description: "Your resume is being sent to top startups. We'll notify you when responses come in.",
        });
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF file",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-blue-50 to-white" />

      {/* Sign In Button */}
      <div className="absolute top-8 right-8 z-20">
        <Button 
          variant="outline" 
          className="backdrop-blur-3xl bg-background/40 hover:bg-background/60 transition-all hover:-translate-y-1 duration-300 border-border/30 rounded-2xl"
        >
          Sign In
        </Button>
      </div>

      {/* Content */}
      <div className="container relative z-10 px-4 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <h1 className="text-5xl md:text-7xl font-bold text-foreground leading-tight">
              Land Your Dream Internship
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              AI-powered resume distribution to top startups with personalized messages
            </p>
          </div>

          {/* Apple-style Liquid Glass Resume Upload Block */}
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            <div className="relative backdrop-blur-3xl bg-background/40 border border-border/30 rounded-[2.5rem] p-12 shadow-[0_8px_32px_0_rgba(31,38,135,0.15)]">
              <div className="absolute inset-0 bg-gradient-to-br from-background/50 via-background/30 to-background/20 rounded-[2.5rem]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(120,119,198,0.1),transparent_50%)] rounded-[2.5rem]" />
              
              <div className="relative">
                <input
                  id="resume"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="resume"
                  className="flex flex-col items-center justify-center gap-4 w-full min-h-[200px] cursor-pointer group"
                >
                  {file ? (
                    <>
                      <FileText className="h-12 w-12 text-primary transition-transform group-hover:scale-110 duration-300" />
                      <span className="text-xl font-semibold text-foreground">{file.name}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-12 w-12 text-foreground/60 transition-all group-hover:text-foreground group-hover:scale-110 duration-300" />
                      <span className="text-2xl font-semibold text-foreground">Send Resume</span>
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
