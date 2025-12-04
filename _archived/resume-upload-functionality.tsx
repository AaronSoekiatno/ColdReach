/**
 * ARCHIVED: Resume Upload Functionality
 * 
 * This file contains the resume upload functionality that was removed
 * from the landing page when converting it to a waitlist screen.
 * 
 * To restore this functionality:
 * 1. Copy the relevant sections back into landPage.tsx
 * 2. Restore the resume upload section in the JSX
 * 3. Restore the related state and handlers
 * 
 * Last archived: [Current Date]
 */

// ============================================================================
// RESUME UPLOAD STATE (to be added back to Hero component)
// ============================================================================

/*
const [file, setFile] = useState<File | null>(null);
const [uploadedFile, setUploadedFile] = useState<File | null>(null);
const [showProgressModal, setShowProgressModal] = useState(false);
const [showResultsModal, setShowResultsModal] = useState(false);
const [showSavingModal, setShowSavingModal] = useState(false);
const [isUploading, setIsUploading] = useState(false);
const [uploadProgress, setUploadProgress] = useState(0);
const [matchedStartups, setMatchedStartups] = useState<string[]>([]);
const [matchCount, setMatchCount] = useState<number>(0);
const [pendingResumeData, setPendingResumeData] = useState<any>(null);
const [isDragging, setIsDragging] = useState(false);
const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
const fileInputRef = useRef<HTMLInputElement | null>(null);
const reuploadInProgress = useRef(false);
*/

// ============================================================================
// RESUME UPLOAD HANDLERS (to be added back to Hero component)
// ============================================================================

export const uploadResumeHandler = `
  const uploadResume = async (resume: File) => {
    setIsUploading(true);
    setShowProgressModal(true);
    setUploadProgress(5);
    startProgressSimulation();

    const formData = new FormData();
    formData.append("resume", resume);

    try {
      const response = await fetch("/api/upload-resume", {
        method: "POST",
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to process your resume");
      }

      stopProgressSimulation();
      setUploadProgress(100);
      
      const data = await response.json();
      const matches = data.matches || [];
      const count = matches.length;
      setMatchCount(count);
      setMatchedStartups(simulateMatches());
      
      const resumePayload = {
        ...data,
        savedToDatabase: data.savedToDatabase || false,
      };

      // Store resume data and file temporarily in case user needs to sign in
      setPendingResumeData(resumePayload);
      setUploadedFile(resume); // Store the file for potential re-upload

      if (resumePayload.savedToDatabase) {
        clearPendingResumeStorage();
      } else {
        await savePendingResumeToStorage(resumePayload, resume);
      }

      setTimeout(() => {
        setShowProgressModal(false);
        setShowResultsModal(true);
        toast({
          title: "Resume processed",
          description: \`We found \${count} startup\${count !== 1 ? 's' : ''} that look like a great fit.\`,
        });
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }, 500);
    } catch (error) {
      stopProgressSimulation();
      setShowProgressModal(false);
      toast({
        title: "Upload failed",
        description:
          error instanceof Error
            ? error.message
            : "We couldn't process your resume. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };
`;

export const fileValidationHandler = `
  const validateAndProcessFile = (selectedFile: File) => {
    const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.endsWith('.pdf');
    const isDocx = selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                   selectedFile.name.endsWith('.docx');
    
    if (isPdf || isDocx) {
      // Allow uploads without sign-in
      setFile(selectedFile);
      void uploadResume(selectedFile);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF or DOCX file",
        variant: "destructive",
      });
    }
  };
`;

export const fileHandlers = `
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndProcessFile(selectedFile);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      validateAndProcessFile(droppedFile);
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFile(null);
    setUploadedFile(null);
    setPendingResumeData(null);
    clearPendingResumeStorage();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
`;

export const progressHandlers = `
  const startProgressSimulation = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    setUploadProgress(0);
    progressIntervalRef.current = setInterval(() => {
      setUploadProgress((prev) => {
        const next = prev + Math.random() * 10;
        return next >= 95 ? 95 : next;
      });
    }, 60);
  };

  const stopProgressSimulation = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const simulateMatches = () => {
    const shuffled = [...SAMPLE_MATCHED_STARTUPS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  };
`;

// ============================================================================
// RESUME UPLOAD JSX SECTION (to be added back to Hero component return)
// ============================================================================

export const resumeUploadSectionJSX = `
      {/* Resume Upload Section */}
      <section className="py-20 bg-gradient-to-br from-black via-gray-900 to-gray-800">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto">
            <div id="resume-upload-section" className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
              <div className="relative">
                <input
                  id="resume"
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                  ref={fileInputRef}
                />
                <div
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={\`flex flex-col items-center justify-center gap-3 bg-white/10 border-2 border-dashed rounded-lg p-8 cursor-pointer transition-all \${
                    isDragging 
                      ? 'border-blue-500 bg-blue-500/20 scale-105' 
                      : 'border-white/20 hover:border-white/40 hover:bg-white/15'
                  }\`}
                >
                  {file ? (
                    <>
                      <div className="flex items-center gap-3 w-full">
                        <FileText className="h-8 w-8 text-white/60" />
                        <span className="text-white text-sm flex-1 truncate">
                          {file.name}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(e);
                          }}
                          className="text-white/60 hover:text-white transition-colors flex-shrink-0"
                          aria-label="Remove file"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="h-12 w-12 text-white/60" />
                      <div className="text-center">
                        <p className="text-white text-sm font-medium mb-1">
                          {isDragging ? 'Drop your resume here' : 'Upload your resume here'}
                        </p>
                        <p className="text-white/60 text-xs">
                          PDF or DOCX files only
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <p className="text-white/70 text-sm mt-4 text-center font-medium">
                  One resume upload → Personalized outreach to dozens of startups
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
`;

// ============================================================================
// PROGRESS MODAL JSX (to be added back to Hero component return)
// ============================================================================

export const progressModalJSX = `
      {/* Upload Progress Modal */}
      <Dialog open={showProgressModal} onOpenChange={() => {}}>
        <DialogContent className="bg-black border-white/20 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-white text-center">
              Creating Your Matches
            </DialogTitle>
            <DialogDescription className="text-white/60 text-center">
              Hang tight while we work our magic
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-6">
            {/* Journey Steps */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={\`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold \${uploadProgress > 10 ? 'bg-green-500 text-white' : 'bg-white/20 text-white/60'}\`}>
                  {uploadProgress > 10 ? '✓' : '1'}
                </div>
                <span className={\`text-sm \${uploadProgress > 10 ? 'text-white' : 'text-white/60'}\`}>
                  Analyzing your resume...
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className={\`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold \${uploadProgress > 40 ? 'bg-green-500 text-white' : 'bg-white/20 text-white/60'}\`}>
                  {uploadProgress > 40 ? '✓' : '2'}
                </div>
                <span className={\`text-sm \${uploadProgress > 40 ? 'text-white' : 'text-white/60'}\`}>
                  Finding aligned startups...
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className={\`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold \${uploadProgress > 70 ? 'bg-green-500 text-white' : 'bg-white/20 text-white/60'}\`}>
                  {uploadProgress > 70 ? '✓' : '3'}
                </div>
                <span className={\`text-sm \${uploadProgress > 70 ? 'text-white' : 'text-white/60'}\`}>
                  Preparing personalized messages...
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className={\`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold \${uploadProgress >= 100 ? 'bg-green-500 text-white' : 'bg-white/20 text-white/60'}\`}>
                  {uploadProgress >= 100 ? '✓' : '4'}
                </div>
                <span className={\`text-sm \${uploadProgress >= 100 ? 'text-white' : 'text-white/60'}\`}>
                  Ready to review your matches!
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-200"
                style={{ width: \`\${uploadProgress}%\` }}
              />
            </div>
            <p className="text-center text-white/70 text-sm">
              {Math.round(uploadProgress)}% complete
            </p>
          </div>
        </DialogContent>
      </Dialog>
`;

// ============================================================================
// RESULTS MODAL JSX (to be added back to Hero component return)
// ============================================================================

export const resultsModalJSX = `
      {/* Results Modal */}
      <Dialog open={showResultsModal} onOpenChange={setShowResultsModal}>
        <DialogContent className="bg-black border-white/20 text-white sm:max-w-md text-center space-y-6">
          <DialogHeader>
            <DialogTitle className="text-3xl font-semibold text-white">
              Your Matches Are Ready!
            </DialogTitle>
            <DialogDescription className="text-lg text-white">
              Congrats! We found {matchCount} startup{matchCount !== 1 ? 's' : ''} for you and have crafted personalized messages for each of them.
            </DialogDescription>
          </DialogHeader>

          {/* Journey Completion Checklist */}
          <div className="bg-white/5 rounded-2xl p-4 space-y-2 text-left">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-xs">✓</div>
              <span className="text-sm text-white">{matchCount} perfect-fit startup{matchCount !== 1 ? 's' : ''} matched</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-xs">✓</div>
              <span className="text-sm text-white">Personalized cold DMs ready to send</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-xs">→</div>
              <span className="text-sm text-white/80">Connect Gmail to automate outreach</span>
            </div>
          </div>

          
          <Button
            className="w-full bg-white text-black hover:bg-white/90"
            onClick={async () => {
              setShowResultsModal(false);
              
              // Check if user is signed in
              const { data: { user: currentUser } } = await supabase.auth.getUser();
              
              if (!currentUser) {
                // User not signed in - prompt to sign up
                // Close results modal and show sign-up modal
                setShowResultsModal(false);
                setIsSignUpModalOpen(true);
              } else {
                // User is signed in - save resume if not already saved and show results
                if (pendingResumeData && !pendingResumeData.savedToDatabase && uploadedFile) {
                  // Re-upload to save to database now that user is authenticated
                  try {
                    const formData = new FormData();
                    formData.append("resume", uploadedFile);
                    
                    const saveResponse = await fetch("/api/upload-resume", {
                      method: "POST",
                      body: formData,
                      credentials: 'include',
                    });
                    
                    if (saveResponse.ok) {
                      toast({
                        title: "Resume saved",
                        description: "Your matches are ready to view.",
                      });
                      setPendingResumeData(null);
                      setUploadedFile(null);
                    } else {
                      throw new Error("Failed to save resume");
                    }
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to save your resume. Please try uploading again.",
                      variant: "destructive",
                    });
                    return; // Don't navigate if save failed
                  }
                }
                // Navigate to the matches page
                window.location.href = '/matches';
              }
            }}
          >
            Review Your Matches
          </Button>
        </DialogContent>
      </Dialog>
`;

// ============================================================================
// SAVING MODAL JSX (to be added back to Hero component return)
// ============================================================================

export const savingModalJSX = `
      {/* Saving Resume Modal - Shows after sign-in while saving resume */}
      <Dialog open={showSavingModal} onOpenChange={() => {}}>
        <DialogContent className="bg-black border-white/20 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-white text-center">
              Saving your resume
            </DialogTitle>
            <DialogDescription className="text-white/60 text-center">
              Please wait while we save your matches...
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
`;

// ============================================================================
// BUTTON FUNCTIONALITY (to be changed back)
// ============================================================================

export const originalButtonJSX = `
              <Button
                onClick={() => {
                  const uploadSection = document.getElementById('resume-upload-section');
                  uploadSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="mt-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-400 hover:to-blue-500 px-8 py-6 text-lg font-semibold rounded-xl transition-all hover:scale-105"
              >
                Get Your Internship
              </Button>
`;

// ============================================================================
// IMPORTS (to be added back if restoring)
// ============================================================================

export const requiredImports = `
import { Upload, FileText, X } from "lucide-react";
`;

// ============================================================================
// UTILITY FUNCTIONS (already in file, but keep for reference)
// ============================================================================

export const utilityFunctions = `
// These are already in the file:
// - fileToDataUrl
// - dataUrlToFile
// - savePendingResumeToStorage
// - loadPendingResumeFromStorage
// - clearPendingResumeStorage
// - reuploadPendingResume
`;

