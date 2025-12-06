import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

interface ResumeSuggestion {
  id: string;
  section: string;
  original: string;
  suggested: string;
  reason: string;
  keywords: string[];
}

/**
 * Generates ATS-optimized resume suggestions using Gemini
 */
async function generateResumeSuggestionsWithGemini(
  resumeBuffer: Buffer,
  resumeMimeType: string,
  resumeFileName: string,
  startupInfo: {
    name: string;
    industry: string;
    tags: string;
  }
): Promise<ResumeSuggestion[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const fileManager = new GoogleAIFileManager(apiKey);

  const prompt = `You are an expert ATS (Applicant Tracking System) resume optimizer.

STARTUP CONTEXT:
- Company: ${startupInfo.name}
- Industry: ${startupInfo.industry}
- Tags/Focus Areas: ${startupInfo.tags}

TASK:
Analyze this resume and suggest 3-5 specific improvements to help this candidate pass ATS screening and stand out for THIS startup. Focus on:

1. **Technical ATS Keywords**: Add industry-standard keywords that ATS systems scan for (e.g., "React.js", "microservices", "CI/CD", "Agile")
2. **Quantifiable Achievements**: Convert vague statements into specific, measurable results
3. **Startup-Relevant Skills**: Highlight experience that matches the startup's industry and tech stack
4. **Action Verbs**: Use strong action verbs (Led, Implemented, Architected, Scaled, etc.)

IMPORTANT RULES:
- Each suggestion MUST include the exact original text from the resume
- Each suggestion MUST be a direct improvement (more specific, quantified, or keyword-rich)
- Focus on real ATS improvements, not minor wording changes
- Only suggest changes that significantly improve ATS score or relevance

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "suggestions": [
    {
      "section": "Experience | Skills | Projects | Education",
      "original": "exact text from the resume that needs improvement",
      "suggested": "improved version with ATS keywords and quantifiable metrics",
      "reason": "brief explanation of why this helps (mention specific keywords added)",
      "keywords": ["keyword1", "keyword2"]
    }
  ]
}

If the resume is already well-optimized, return fewer suggestions or an empty array.`;

  try {
    // Upload file to Gemini File API
    const uploadResult = await fileManager.uploadFile(resumeBuffer, {
      mimeType: resumeMimeType,
      displayName: resumeFileName,
    });

    // Wait for processing
    let fileMetadata = uploadResult.file;
    let attempts = 0;
    while (fileMetadata.state === 'PROCESSING' && attempts < 10) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      fileMetadata = await fileManager.getFile(uploadResult.file.name);
      attempts++;
    }

    if (fileMetadata.state === 'FAILED') {
      throw new Error('File processing failed');
    }

    // Generate suggestions with Gemini 2.0 Flash (latest stable model)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
      },
    });

    // Retry logic with exponential backoff for rate limits
    let result;
    let retries = 5; // Increased from 3 to 5 attempts
    let delay = 2000; // Start with 2 seconds (increased from 1s)

    for (let i = 0; i < retries; i++) {
      try {
        result = await model.generateContent([
          { text: prompt },
          {
            fileData: {
              fileUri: fileMetadata.uri,
              mimeType: fileMetadata.mimeType,
            },
          },
        ]);
        break; // Success, exit loop
      } catch (error: any) {
        if (error?.status === 429 && i < retries - 1) {
          console.log(`Rate limited, retrying in ${delay}ms... (attempt ${i + 1}/${retries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          throw error; // Re-throw if not rate limit or out of retries
        }
      }
    }

    if (!result) {
      throw new Error('Failed to generate content after retries');
    }

    // Clean up
    try {
      await fileManager.deleteFile(uploadResult.file.name);
    } catch (error) {
      console.warn('Failed to delete uploaded file:', error);
    }

    // Parse response
    const responseText = result.response.text();
    console.log('Gemini response:', responseText);

    // Clean markdown code blocks if present
    let cleanedResponse = responseText.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    const parsed = JSON.parse(cleanedResponse);

    if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
      throw new Error('Invalid response format: missing suggestions array');
    }

    // Add unique IDs and validate
    return parsed.suggestions.map((suggestion: any, index: number) => ({
      id: `suggestion-${Date.now()}-${index}`,
      section: suggestion.section || 'General',
      original: suggestion.original || '',
      suggested: suggestion.suggested || '',
      reason: suggestion.reason || '',
      keywords: Array.isArray(suggestion.keywords) ? suggestion.keywords : [],
    }));
  } catch (error) {
    console.error('Error generating resume suggestions:', error);
    throw error;
  }
}

// Simple in-memory cache for suggestions (resets on server restart)
const suggestionCache = new Map<string, { suggestions: ResumeSuggestion[], timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

export async function POST(request: NextRequest) {
  try {
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
              // Cookie setting might fail in route handlers
            }
          },
        },
      }
    );

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { startupId } = body;

    if (!startupId) {
      return NextResponse.json(
        { error: 'Missing startupId in request body' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = `${user.email}-${startupId}`;
    const cached = suggestionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('Returning cached suggestions for', cacheKey);
      return NextResponse.json({
        success: true,
        suggestions: cached.suggestions,
        cached: true,
      });
    }

    // Get service role client for storage access
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // Fetch candidate info to get resume_path
    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from('candidates')
      .select('id, resume_path')
      .eq('email', user.email)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json(
        { error: 'Candidate profile not found. Please upload your resume first.' },
        { status: 404 }
      );
    }

    if (!candidate.resume_path) {
      return NextResponse.json(
        { error: 'No resume file found. Please upload your resume again.' },
        { status: 404 }
      );
    }

    // Fetch startup info
    const { data: startup, error: startupError } = await supabaseAdmin
      .from('startups')
      .select('name, industry, tags')
      .eq('id', startupId)
      .single();

    if (startupError || !startup) {
      return NextResponse.json(
        { error: 'Startup not found' },
        { status: 404 }
      );
    }

    // Download resume from Supabase Storage
    const { data: resumeData, error: downloadError } = await supabaseAdmin.storage
      .from('resumes')
      .download(candidate.resume_path);

    if (downloadError || !resumeData) {
      console.error('Failed to download resume:', downloadError);
      return NextResponse.json(
        { error: 'Failed to retrieve resume file' },
        { status: 500 }
      );
    }

    // Convert blob to buffer
    const arrayBuffer = await resumeData.arrayBuffer();
    const resumeBuffer = Buffer.from(arrayBuffer);

    // Determine MIME type from file extension
    const fileExt = candidate.resume_path.split('.').pop()?.toLowerCase();
    const mimeType = fileExt === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // Generate suggestions using Gemini
    const suggestions = await generateResumeSuggestionsWithGemini(
      resumeBuffer,
      mimeType,
      candidate.resume_path,
      {
        name: startup.name,
        industry: startup.industry,
        tags: startup.tags,
      }
    );

    // Cache the suggestions
    suggestionCache.set(cacheKey, {
      suggestions,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error('Error in resume-suggestions API:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate resume suggestions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
