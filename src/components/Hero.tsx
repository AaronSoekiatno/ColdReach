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
          title: "Resume uploaded",
          description: `${selectedFile.name} is ready to send`,
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast({
      title: "Success!",
      description: "Your resume is being sent to top startups. We'll notify you when responses come in.",
    });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-blue-50 to-white" />

      {/* Sign In Button */}
      <div className="absolute top-8 left-8 z-20">
        <Button 
          variant="outline" 
          className="backdrop-blur-sm bg-background/50 hover:bg-background/80 transition-all hover:-translate-y-1 duration-300"
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

          {/* Liquid Glass Resume Upload Block */}
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            <form onSubmit={handleSubmit}>
              <div className="relative backdrop-blur-xl bg-background/30 border border-border/50 rounded-3xl p-8 shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 rounded-3xl" />
                <div className="relative space-y-6">
                  <h2 className="text-2xl font-bold text-foreground">Send Resume</h2>
                  
                  <div className="space-y-2">
                    <input
                      id="resume"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      required
                    />
                    <label
                      htmlFor="resume"
                      className="flex items-center justify-center gap-3 w-full p-10 border-2 border-dashed border-border/50 rounded-2xl cursor-pointer hover:bg-muted/30 transition-all hover:-translate-y-1 duration-300 bg-background/20 backdrop-blur-sm"
                    >
                      {file ? (
                        <>
                          <FileText className="h-8 w-8 text-primary" />
                          <span className="text-base font-medium text-foreground">{file.name}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <span className="text-base text-muted-foreground">
                            Click to upload your resume (PDF)
                          </span>
                        </>
                      )}
                    </label>
                  </div>

                  <Button 
                    type="submit" 
                    size="lg" 
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground transition-all hover:-translate-y-1 duration-300"
                  >
                    Get Started
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};
