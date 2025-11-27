'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, X } from 'lucide-react';

interface FilePreview {
  file: File;
  preview: string;
}

export default function ResumeUpload() {
  const [file, setFile] = useState<FilePreview | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const allowedExtensions = ['.pdf', '.docx'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type) && !allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
      return 'Please upload a PDF or DOCX file.';
    }

    if (file.size > maxSize) {
      return 'File size must be less than 10MB.';
    }

    return null;
  };

  const handleFile = useCallback((selectedFile: File) => {
    const error = validateFile(selectedFile);
    if (error) {
      setErrorMessage(error);
      setUploadStatus('error');
      return;
    }

    setErrorMessage('');
    setUploadStatus('idle');

    // Create preview for PDF
    if (selectedFile.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFile({
          file: selectedFile,
          preview: e.target?.result as string,
        });
      };
      reader.readAsDataURL(selectedFile);
    } else {
      // For DOCX, just set the file without preview
      setFile({
        file: selectedFile,
        preview: '',
      });
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  }, [handleFile]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  }, [handleFile]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRemove = useCallback(() => {
    setFile(null);
    setUploadStatus('idle');
    setErrorMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('idle');
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('resume', file.file);

      const response = await fetch('/api/upload-resume', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();
      setUploadStatus('success');
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred during upload');
    } finally {
      setIsUploading(false);
    }
  }, [file]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="w-full">

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {!file ? (
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-2xl p-12 md:p-16 text-center cursor-pointer
            transition-all duration-300 group
            ${isDragging
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 scale-[1.02]'
              : 'border-foreground/20 hover:border-foreground/40 hover:bg-background/20'
            }
          `}
        >
          <div className="flex flex-col items-center gap-6">
            <div className={`
              w-16 h-16 rounded-full flex items-center justify-center
              transition-all duration-300
              ${isDragging
                ? 'bg-blue-500/10 scale-110'
                : 'bg-foreground/5 group-hover:bg-foreground/10 group-hover:scale-110'
              }
            `}>
              <Upload className={`
                h-8 w-8 transition-all duration-300
                ${isDragging
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-foreground/60 group-hover:text-foreground'
                }
              `} />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-semibold text-foreground mb-2">
                {isDragging ? 'Drop your file here' : 'Send Resume'}
              </p>
              <p className="text-sm text-muted-foreground">
                PDF or DOCX format (max 10MB)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="border border-foreground/10 rounded-2xl p-6 bg-background/30 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 flex-1">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold text-foreground truncate">
                    {file.file.name}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatFileSize(file.file.size)}
                  </p>
                </div>
              </div>
              <button
                onClick={handleRemove}
                className="p-2 rounded-lg hover:bg-foreground/10 transition-colors"
                aria-label="Remove file"
              >
                <X className="w-5 h-5 text-foreground/60" />
              </button>
            </div>
          </div>

          {file.file.type === 'application/pdf' && file.preview && (
            <div className="border border-foreground/10 rounded-2xl overflow-hidden bg-background/20">
              <iframe
                src={file.preview}
                className="w-full h-96"
                title="PDF Preview"
              />
            </div>
          )}

          {file.file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && (
            <div className="border border-foreground/10 rounded-2xl p-12 text-center bg-background/20">
              <p className="text-sm text-muted-foreground">
                DOCX files cannot be previewed in the browser
              </p>
            </div>
          )}
        </div>
      )}

      {uploadStatus === 'error' && errorMessage && (
        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
        </div>
      )}

      {uploadStatus === 'success' && (
        <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
          <p className="text-sm text-green-600 dark:text-green-400">
            Resume uploaded successfully!
          </p>
        </div>
      )}

      {file && (
        <div className="mt-6">
          <button
            onClick={handleSubmit}
            disabled={isUploading}
            className={`
              w-full px-8 py-4 rounded-2xl font-semibold text-white
              transition-all duration-300 transform
              ${isUploading
                ? 'bg-foreground/40 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl'
              }
            `}
          >
            {isUploading ? (
              <span className="flex items-center justify-center gap-3">
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Uploading...
              </span>
            ) : (
              'Upload Resume'
            )}
          </button>
        </div>
      )}
    </div>
  );
}

