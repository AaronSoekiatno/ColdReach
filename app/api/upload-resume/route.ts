import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import {
  validateFile,
  extractDocxText,
  isPdfFile,
  cleanJsonResponse,
  type ResumeExtractionResult,
  type ResumeProcessingResult,
} from './utils';
import { upsertCandidate, findMatchingStartups } from '@/lib/pinecone';
import { saveCandidate, saveMatches, saveStartup } from '@/lib/supabase';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Get Gemini clients - initialized lazily to ensure env vars are loaded
function getGeminiClients() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  return {
    genAI: new GoogleGenerativeAI(apiKey),
    fileManager: new GoogleAIFileManager(apiKey),
  };
}

/**
 * Extracts name, email, skills, and summary from resume using Gemini
 * Supports both PDF (sent directly as base64) and DOCX (text extracted first)
 */
async function extractResumeDataWithGemini(
  file: File,
  buffer: Buffer,
  arrayBuffer: ArrayBuffer
): Promise<ResumeExtractionResult> {
  const { genAI, fileManager } = getGeminiClients();

  const prompt = `Extract the following from this resume and return JSON only in this exact form:
{
  "name": "Full name of the candidate",
  "email": "Email address (or empty string if not found)",
  "skills": ["Array of 6-12 relevant technical and professional skills"],
  "summary": "A 2-3 sentence professional overview of the candidate",
  "location": "Current location or preferred location (city, state/country format, or empty string if not found)",
  "education_level": "Highest degree (e.g., 'Bachelor's', 'Master's', 'PhD', 'High School', or empty string if not found)",
  "university": "Name of the university/college for highest degree (or empty string if not found)",
  "past_internships": ["Array of past internship experiences with company names, or empty array if none found"],
  "technical_projects": ["Array of notable technical/personal projects with brief descriptions, or empty array if none found"]
}`;

  // Try different model names in order of preference
  // Using newer Gemini 2.x models as 1.5 models are deprecated
  const modelNames = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'];
  let lastError: any = null;

  for (const modelName of modelNames) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      let result;

      if (isPdfFile(file)) {
        // For PDFs: Upload to Gemini File API first, then use the file reference
        // This is the recommended approach for PDFs
        console.log(`[${modelName}] Uploading PDF to Gemini File API...`);
        const uploadResult = await fileManager.uploadFile(buffer, {
          mimeType: 'application/pdf',
          displayName: file!.name,
        });

        const uploadedFile = uploadResult.file;
        console.log(`[${modelName}] PDF uploaded, state: ${uploadedFile.state}, name: ${uploadedFile.name}`);

        // Wait for the file to be processed
        let fileMetadata = uploadedFile;
        while (fileMetadata.state === 'PROCESSING') {
          console.log(`[${modelName}] Waiting for PDF processing...`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          fileMetadata = await fileManager.getFile(uploadedFile.name);
        }

        if (fileMetadata.state === 'FAILED') {
          throw new Error('PDF processing failed');
        }

        console.log(`[${modelName}] PDF ready, generating content with fileUri: ${fileMetadata.uri}`);

        // Now use the uploaded file in the request
        result = await model.generateContent([
          { text: prompt },
          {
            fileData: {
              fileUri: fileMetadata.uri,
              mimeType: fileMetadata.mimeType,
            },
          },
        ]);

        // Clean up: delete the uploaded file after processing
        try {
          await fileManager.deleteFile(uploadedFile.name);
          console.log(`[${modelName}] Deleted uploaded file`);
        } catch (error) {
          console.warn('Failed to delete uploaded file:', error);
          // Continue even if deletion fails
        }
      } else {
        // For DOCX: Extract text first, then send to Gemini
        const resumeText = await extractDocxText(buffer);
        
        if (!resumeText || resumeText.trim().length === 0) {
          throw new Error('Could not extract text from DOCX file. The file may be corrupted or empty.');
        }
        
        result = await model.generateContent(`${prompt}\n\nHere is the resume text:\n\n${resumeText}`);
      }

      // If we get here, the model worked - process the response
      const response = result.response;
      const responseText = response.text();
      const cleanedResponse = cleanJsonResponse(responseText);
      const parsed = JSON.parse(cleanedResponse) as ResumeExtractionResult;

      // Validate the response structure
      if (typeof parsed.name !== 'string') {
        throw new Error('Invalid response: name must be a string');
      }
      if (typeof parsed.email !== 'string') {
        throw new Error('Invalid response: email must be a string');
      }
      if (!Array.isArray(parsed.skills)) {
        throw new Error('Invalid response: skills must be an array');
      }
      if (typeof parsed.summary !== 'string') {
        throw new Error('Invalid response: summary must be a string');
      }
      if (typeof parsed.location !== 'string') {
        throw new Error('Invalid response: location must be a string');
      }
      if (typeof parsed.education_level !== 'string') {
        throw new Error('Invalid response: education_level must be a string');
      }
      if (typeof parsed.university !== 'string') {
        throw new Error('Invalid response: university must be a string');
      }
      if (!Array.isArray(parsed.past_internships)) {
        throw new Error('Invalid response: past_internships must be an array');
      }
      if (!Array.isArray(parsed.technical_projects)) {
        throw new Error('Invalid response: technical_projects must be an array');
      }

      // Ensure skills count is between 6-12
      if (parsed.skills.length < 6) {
        console.warn(
          `Gemini returned fewer than 6 skills (${parsed.skills.length})`
        );
      }
      if (parsed.skills.length > 12) {
        parsed.skills = parsed.skills.slice(0, 12);
      }

      return parsed;
    } catch (error: any) {
      // If it's a model not found error (404), try the next model
      if (error?.message?.includes('not found') || error?.message?.includes('404')) {
        lastError = error;
        console.warn(`Model ${modelName} not available, trying next model...`);
        continue;
      }
      // If it's a 400 error with inline_data issue, the model doesn't support native PDF
      // Try the next model (should be a 1.5 model that supports it)
      if (
        error?.message?.includes('400') ||
        error?.message?.includes('Bad Request') ||
        error?.message?.includes('inline_data') ||
        error?.message?.includes('scalar field')
      ) {
        lastError = error;
        console.warn(`Model ${modelName} doesn't support native PDF processing (${error?.message}), trying next model...`);
        continue;
      }
      // For other errors (parsing, validation, etc.), re-throw immediately
      throw error;
    }
  }

  // If all models failed, throw the last error with helpful message
  throw new Error(
    `All Gemini models failed. Last error: ${lastError?.message || 'Unknown error'}. ` +
    `Please check your API key and ensure you have access to Gemini models.`
  );
}

/**
 * Generates an embedding for the candidate profile using Gemini
 * Combines summary, skills, and additional context for richer matching
 */
async function generateEmbedding(
  extractionResult: ResumeExtractionResult
): Promise<number[]> {
  const { genAI } = getGeminiClients();
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

  // Build a comprehensive text representation for better embedding quality
  const combinedText = `
Professional Summary: ${extractionResult.summary}
Technical Skills: ${extractionResult.skills.join(', ')}
Location: ${extractionResult.location || 'Not specified'}
Education: ${extractionResult.education_level || 'Not specified'} from ${extractionResult.university || 'Not specified'}
Past Internships: ${extractionResult.past_internships.length > 0 ? extractionResult.past_internships.join('; ') : 'None listed'}
Technical Projects: ${extractionResult.technical_projects.length > 0 ? extractionResult.technical_projects.join('; ') : 'None listed'}
  `.trim();

  const result = await model.embedContent({
    content: {
      role: 'user',
      parts: [{ text: combinedText }],
    },
  });

  if (!result.embedding || !result.embedding.values || !Array.isArray(result.embedding.values)) {
    throw new Error('Failed to generate embedding: Invalid response structure');
  }

  return result.embedding.values;
}

export async function POST(request: NextRequest) {
  try {
    // Import cookies at runtime (Next.js 15+ requirement)
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Cookie setting might fail in route handlers - this is okay
            }
          },
        },
      }
    );

    // Authentication is optional - allow uploads without sign-in
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // Debug authentication
    console.log('\n=== AUTHENTICATION DEBUG ===');
    console.log('Auth Error:', authError);
    console.log('User Object:', user ? {
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
    } : 'No user');
    console.log('Cookies:', request.cookies.getAll());
    console.log('============================\n');

    const isAuthenticated = !authError && user && user.email;
    const accountEmail = isAuthenticated ? user.email : null;
    const accountName = isAuthenticated
      ? ((user.user_metadata?.full_name as string | undefined) ?? undefined)
      : undefined;

    console.log('Is Authenticated:', isAuthenticated);
    console.log('Account Email:', accountEmail);

    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY;
    console.log('GEMINI_API_KEY exists:', !!apiKey);
    console.log('GEMINI_API_KEY length:', apiKey?.length);
    console.log('GEMINI_API_KEY first 10 chars:', apiKey?.substring(0, 10));

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Server configuration error: Gemini API key not configured',
        },
        { status: 500 }
      );
    }

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid request format. Please submit as multipart/form-data with a file field named "resume".',
        },
        { status: 400 }
      );
    }

    const file = formData.get('resume') as File | null;

    // Validate the uploaded file
    const validation = validateFile(file!);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Read file as buffer and also get ArrayBuffer for base64 encoding
    let buffer: Buffer;
    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await file!.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to read the uploaded file. Please try again.',
        },
        { status: 400 }
      );
    }

    // Extract name, email, skills, and summary using Gemini
    // For PDFs: Gemini processes the file directly (no parsing needed!)
    // For DOCX: Text is extracted first, then sent to Gemini
    let extractionResult: ResumeExtractionResult;
    let rawText: string = '';
    
    try {
      extractionResult = await extractResumeDataWithGemini(file!, buffer, arrayBuffer);
      
      // Extract raw text for response (only needed for DOCX, PDF is processed directly)
      if (!isPdfFile(file!)) {
        rawText = await extractDocxText(buffer);
      } else {
        // For PDFs, Gemini processed it directly - no text extraction needed
        rawText = 'PDF processed directly by Gemini (no text extraction required)';
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error('Gemini skills extraction error:', {
        message: errorMessage,
        stack: errorStack,
        fileType: file!.type,
        fileName: file!.name,
        fileSize: file!.size,
      });
      
      // Return more helpful error messages based on the error type
      let userMessage = 'Failed to analyze resume content.';
      let statusCode = 500;
      
      if (errorMessage.includes('API key')) {
        userMessage = 'Server configuration error: Invalid or missing Gemini API key.';
        statusCode = 500;
      } else if (errorMessage.includes('quota')) {
        userMessage = 'API quota exceeded. Please try again later.';
        statusCode = 429;
      } else if (errorMessage.includes('safety')) {
        userMessage = 'Content was blocked by safety filters. Please try a different resume.';
        statusCode = 400;
      } else if (errorMessage.includes('too large')) {
        userMessage = 'File is too large. Maximum file size is 10MB.';
        statusCode = 400;
      } else if (errorMessage.includes('extract text')) {
        userMessage = 'Could not read the file. Please ensure it is a valid PDF or DOCX file.';
        statusCode = 400;
      } else {
        userMessage = `Failed to analyze resume: ${errorMessage}`;
      }
      
      return NextResponse.json(
        {
          success: false,
          error: userMessage,
          details: errorMessage,
        },
        { status: statusCode }
      );
    }

    // Generate embedding for the candidate profile (includes all extracted fields)
    let embedding: number[];
    try {
      embedding = await generateEmbedding(extractionResult);
    } catch (error) {
      console.error('Embedding generation error:', error);
      return NextResponse.json(
        {
          success: false,
          error:
            'Failed to generate embedding. Please try again or contact support.',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Save candidate to Pinecone (for vector search) and Supabase (for queries) - only if authenticated
    let savedToDatabase = false;
    let databaseError: string | undefined;
    let candidateId: string | null = null; // Declare at this scope level

    if (isAuthenticated && accountEmail) {
      // Upload raw resume file to Supabase Storage (resumes bucket)
      let resumePath: string | undefined;
      try {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceRoleKey) {
          const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey
          );

          const objectPath = `resumes/${user!.id}/${Date.now()}-${file!.name}`;

          const { error: uploadError } = await supabaseAdmin.storage
            .from('resumes')
            .upload(objectPath, buffer, {
              contentType: file!.type,
              upsert: true,
            });

          if (uploadError) {
            console.error('Failed to upload resume file to Storage:', uploadError);
          } else {
            console.log('Uploaded resume file to Storage at path:', objectPath);
            resumePath = objectPath; // Store the path to attach when saving candidate
          }
        } else {
          console.warn('SUPABASE_SERVICE_ROLE_KEY is not set; skipping resume file upload.');
        }
      } catch (error) {
        console.error('Unexpected error uploading resume to Storage:', error);
      }

      try {
        await upsertCandidate(
          accountEmail,
          embedding,
          {
            name: accountName ?? extractionResult.name,
            email: accountEmail,
            summary: extractionResult.summary,
            skills: extractionResult.skills.join(', '),
            location: extractionResult.location,
            education_level: extractionResult.education_level,
            university: extractionResult.university,
            past_internships: extractionResult.past_internships.join(', '),
            technical_projects: extractionResult.technical_projects.join(', '),
          }
        );
        savedToDatabase = true;
        console.log('Successfully saved candidate to Pinecone:', {
          name: extractionResult.name,
          email: accountEmail,
        });
      } catch (error) {
        databaseError = error instanceof Error ? error.message : 'Unknown database error';
        console.error('Failed to save candidate to Pinecone:', {
          error: databaseError,
          candidate: {
            name: extractionResult.name,
            email: accountEmail,
          },
          fullError: error,
        });
        // Continue even if DB save fails - we still want to return the extracted data
      }

      // Save candidate to Supabase (for detailed queries) and get the UUID
      try {
        const savedCandidate = await saveCandidate({
          email: accountEmail,
          name: accountName ?? extractionResult.name,
          summary: extractionResult.summary,
          skills: extractionResult.skills.join(', '),
          location: extractionResult.location,
          education_level: extractionResult.education_level,
          university: extractionResult.university,
          past_internships: extractionResult.past_internships.join(', '),
          technical_projects: extractionResult.technical_projects.join(', '),
          resume_path: resumePath, // Attach the resume file path from Storage
        });
        candidateId = savedCandidate.id; // Get the UUID
        console.log('Successfully saved candidate to Supabase:', {
          name: extractionResult.name,
          email: accountEmail,
          id: candidateId,
        });
      } catch (error) {
        console.error('Failed to save candidate to Supabase:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          candidate: {
            name: extractionResult.name,
            email: accountEmail,
          },
        });
        // Continue even if Supabase save fails
      }
    } else {
      console.log('User not authenticated - skipping database save. Results will be returned for preview.');
    }

    // Find matching startups with quality threshold
    // minScore = 0.45 (45%) - filters out very weak matches
    let matches: Array<{ id: string; score: number; metadata: any }> = [];
    let matchingError: string | undefined;
    try {
      const MIN_MATCH_SCORE = 0.45; // Only show matches above 45% similarity
      matches = await findMatchingStartups(embedding, 10, MIN_MATCH_SCORE);

      console.log(`\n${'='.repeat(80)}`);
      console.log(`FOUND ${matches.length} QUALITY MATCHES (>${(MIN_MATCH_SCORE * 100).toFixed(0)}% similarity)`);
      console.log('='.repeat(80));

      // Categorize match quality with adjusted thresholds
      const excellent = matches.filter(m => m.score >= 0.70);
      const good = matches.filter(m => m.score >= 0.50 && m.score < 0.70);
      const moderate = matches.filter(m => m.score >= 0.30 && m.score < 0.50);

      console.log(`\nMatch Quality Breakdown:`);
      console.log(`  🟢 Excellent (70-100%): ${excellent.length}`);
      console.log(`  🟡 Good (50-70%): ${good.length}`);
      console.log(`  🟠 Moderate (30-50%): ${moderate.length}`);

      // Log each match with details and quality indicator
      matches.forEach((match, index) => {
        const scorePercent = match.score * 100;
        let quality = '🔴 Weak';
        if (match.score >= 0.70) quality = '🟢 Excellent';
        else if (match.score >= 0.50) quality = '🟡 Good';
        else if (match.score >= 0.30) quality = '🟠 Moderate';

        console.log(`\n--- Match #${index + 1} [${quality}] ---`);
        console.log(`Startup ID: ${match.id}`);
        console.log(`Match Score: ${scorePercent.toFixed(2)}%`);
        console.log(`Name: ${match.metadata?.name || 'N/A'}`);
        console.log(`Industry: ${match.metadata?.industry || 'N/A'}`);
        console.log(`Location: ${match.metadata?.location || 'N/A'}`);
        console.log(`Funding Stage: ${match.metadata?.funding_stage || 'N/A'}`);
        console.log(`Website: ${match.metadata?.website || 'N/A'}`);
        console.log(`Full Metadata:`, JSON.stringify(match.metadata, null, 2));
      });

      console.log(`\n${'='.repeat(80)}\n`);

      // Save matches to Supabase - only if authenticated and we have a candidate ID
      if (matches.length > 0 && isAuthenticated && candidateId) {
        try {
          // First, ensure all matched startups exist in Supabase
          // This prevents foreign key constraint violations
          console.log(`Syncing ${matches.length} matched startups to Supabase...`);
          for (const match of matches) {
            try {
              await saveStartup({
                id: match.id,
                name: match.metadata.name || 'Unknown',
                industry: match.metadata.industry || '',
                description: match.metadata.description || '',
                funding_stage: match.metadata.funding_stage || '',
                funding_amount: match.metadata.funding_amount || '',
                location: match.metadata.location || '',
                website: match.metadata.website || '',
                tags: match.metadata.tags || '',
              });
            } catch (error) {
              console.warn(`Failed to sync startup ${match.id} to Supabase:`, error instanceof Error ? error.message : 'Unknown error');
              // Continue with other startups even if one fails
            }
          }

          // Now save the matches (foreign keys should be valid now)
          await saveMatches(
            candidateId, // Use UUID instead of email
            matches.map((match) => ({
              startup_id: match.id,
              score: match.score,
            }))
          );
          console.log(`✓ Successfully saved ${matches.length} matches to Supabase for candidate ${candidateId}`);
        } catch (error) {
          console.error('✗ Failed to save matches to Supabase:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            candidateId,
          });
          // Continue even if Supabase save fails
        }
      } else if (!isAuthenticated) {
        console.log('⚠ User not authenticated - matches will not be saved to database (preview only)');
      } else if (!candidateId) {
        console.log('⚠ Candidate ID not available - matches will not be saved to database');
      }
    } catch (error) {
      matchingError = error instanceof Error ? error.message : 'Unknown matching error';
      console.error('Failed to find matching startups:', {
        error: matchingError,
        fullError: error,
      });
      // Continue even if matching fails
    }

    // Build the successful response
    const result: ResumeProcessingResult = {
      success: true,
      rawText,
      name: extractionResult.name,
      email: extractionResult.email,
      skills: extractionResult.skills,
      summary: extractionResult.summary,
      location: extractionResult.location,
      education_level: extractionResult.education_level,
      university: extractionResult.university,
      past_internships: extractionResult.past_internships,
      technical_projects: extractionResult.technical_projects,
      embedding,
      savedToDatabase,
      matches: matches.map((match) => ({
        startup: match.metadata,
        score: match.score,
        id: match.id,
      })),
      ...(databaseError && { databaseError }),
      ...(matchingError && { matchingError }),
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Unexpected error processing resume:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while processing the resume.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
