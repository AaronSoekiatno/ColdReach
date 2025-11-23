import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

// Maximum file size: 10MB
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed MIME types and extensions
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];

/**
 * Validates the uploaded file for type and size
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided. Please upload a resume.' };
  }

  const fileName = file.name.toLowerCase();
  const isValidType =
    ALLOWED_MIME_TYPES.includes(file.type) ||
    ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));

  if (!isValidType) {
    return {
      valid: false,
      error: `Unsupported file type "${file.type || 'unknown'}". Please upload a PDF (.pdf) or Word document (.docx).`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size (${sizeMB}MB) exceeds the maximum allowed size of 10MB.`,
    };
  }

  if (file.size === 0) {
    return { valid: false, error: 'The uploaded file is empty.' };
  }

  return { valid: true };
}

/**
 * Determines if a file is a PDF based on MIME type or extension
 */
export function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  );
}

/**
 * Extracts text from a PDF buffer using pdf-parse
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text || '';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to parse PDF: ${message}`);
  }
}

/**
 * Extracts text from a DOCX buffer using mammoth
 */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to parse DOCX: ${message}`);
  }
}

/**
 * Extracts text from a file buffer based on file type
 */
export async function extractTextFromFile(
  file: File,
  buffer: Buffer
): Promise<string> {
  const text = isPdfFile(file)
    ? await extractPdfText(buffer)
    : await extractDocxText(buffer);

  if (!text || text.trim().length === 0) {
    throw new Error(
      'Could not extract any text from the file. Please ensure the document contains readable text content.'
    );
  }

  return text.trim();
}

/**
 * Cleans JSON response from Gemini by removing markdown code blocks
 */
export function cleanJsonResponse(response: string): string {
  let cleaned = response.trim();

  // Remove markdown code block markers
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
}

/**
 * Interface for the resume extraction response from Gemini
 */
export interface ResumeExtractionResult {
  name: string;
  email: string;
  skills: string[];
  summary: string;
}

/**
 * Interface for the final API response
 */
export interface ResumeProcessingResult {
  success: boolean;
  rawText: string;
  name: string;
  email: string;
  skills: string[];
  summary: string;
  embedding: number[];
}
