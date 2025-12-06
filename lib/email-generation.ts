import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Shared Gemini email generation utilities.
 *
 * This module is intentionally standalone so it can be reused from:
 * - API routes (e.g. /api/generate-email)
 * - background jobs / scripts
 *
 * It assumes GEMINI_API_KEY is configured in the environment.
 */

// Default model - use Flash for speed and to avoid rate limits, but allow override for Pro if needed
// Flash is sufficient for email generation and helps distribute API load
const DEFAULT_EMAIL_MODEL = process.env.GEMINI_EMAIL_MODEL || 'gemini-2.5-flash';

// ---------- Types ----------

export interface CandidateProfile {
  name: string;
  email: string;
  summary: string;
  skills: string[]; // normalized list of skills/keywords
}

export interface StartupInfo {
  name: string;
  industry?: string;
  description?: string;
  fundingStage?: string;
  fundingAmount?: string;
  location?: string;
  website?: string;
  tags?: string[];
}

export interface MatchContext {
  score: number; // cosine similarity 0‑1
  rank?: number; // 1‑based rank among matches
  totalMatches?: number;
}

export type EmailTone =
  | 'professional_casual'
  | 'enthusiastic'
  | 'conversational';

export interface EmailGenerationOptions {
  tone?: EmailTone;
  maxWords?: number; // soft limit; prompt hint only
  includeSubjectPrefix?: string; // e.g. "[ResumeSender]"
}

export interface GeneratedEmail {
  subject: string;
  body: string;
  rawText: string; // full raw Gemini text (for debugging / logging)
}

// ---------- Internal helpers ----------

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY environment variable is not set. ' +
        'Add it to your .env.local file to enable email generation.'
    );
  }

  return new GoogleGenerativeAI(apiKey);
}

/**
 * Strips Markdown code fences from a JSON‑ish response so we can parse it.
 * (Duplicated from the upload‑resume utils to keep this file self‑contained.)
 */
function cleanJsonResponse(response: string): string {
  let cleaned = response.trim();

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

function toneToPromptSnippet(tone: EmailTone | undefined): string {
  switch (tone) {
    case 'enthusiastic':
      return 'Use an enthusiastic but still professional tone, showing real excitement without sounding salesy.';
    case 'conversational':
      return 'Use a conversational, human tone, like a thoughtful college student reaching out to a founder.';
    case 'professional_casual':
    default:
      return 'Use a professional but casual tone, like a strong student writing a thoughtful cold email.';
  }
}

// ---------- Public API ----------

/**
 * Generates a human‑sounding cold email for a candidate → startup match.
 *
 * This does NOT send any email. It only returns subject/body text which
 * the caller can review, surface in the UI, or send via another service.
 */
export async function generateColdEmail(
  candidate: CandidateProfile,
  startup: StartupInfo,
  match: MatchContext,
  options: EmailGenerationOptions = {}
): Promise<GeneratedEmail> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: DEFAULT_EMAIL_MODEL });

  const toneSnippet = toneToPromptSnippet(options.tone);
  const maxWords = options.maxWords ?? 100;
  const subjectPrefix = options.includeSubjectPrefix
    ? `[${options.includeSubjectPrefix}] `
    : '';

  const tagsText =
    startup.tags && startup.tags.length > 0
      ? startup.tags.join(', ')
      : undefined;

  const matchScorePct = Math.round(match.score * 100);

  const prompt = `
You are a college student writing a genuinely human cold email to a startup founder or hiring manager.

Write from the first‑person perspective of the candidate. The email should feel like a real person wrote it and MUST follow these high‑level rules:
- Keep it short (aim for around ${maxWords} words).
- Get straight to the point in the first 1–2 sentences (why you are reaching out and what you want).
- Infer the most appropriate role or position for this candidate (for example "software engineer", "product designer", "data scientist") from their skills and summary, and clearly state in the opening what role they want (e.g. "I’d love to intern as a software engineer on your team").
- Clearly highlight what you are capable of and how those skills are useful to this specific startup.
- Show real eagerness and commitment without sounding desperate.
- Keep it casual and friendly, almost like you already know the founder.
- Avoid generic, over‑formal phrases like "I hope this email finds you well" or "To whom it may concern".
- Reference specific details about the startup (industry, product, tags, description) so every startup gets a different, tailored email.
- The subject line must write in this format: "Startup Name (Desired Role)"

Use a consistent structure across emails so they feel like they follow the same format:
1) A short, direct opening that says who you are, the role you’d like (based on your background), and why you’re reaching out. Keep this concise
2) 2–4 short bullet points or numbered points that call out your most relevant skills, experiences, or projects for THIS startup.
3) keep each bullet point to a maximum of around 10-20 words. Be very concise.
4) if the user sending out the email has any technical links, try to include them at the end of the email (github, portfolio, personal website)
5) use a professional sign off at the end of the email (e.g. "Best regards, [Your Name]"), try to include contact information if they have it on their resume
6) start the email with "Hi [Founder Name]," or an introduction that includes the founder's name

Even when the candidate and startup profiles look similar, vary the exact wording, phrasing, and examples so that two different startups never receive the same email text.

${toneSnippet}

Return ONLY JSON in this exact shape:
{
  "subject": "Concise, specific email subject line",
  "body": "Plain text email body with line breaks, no markdown, no signatures beyond the candidate's name"
}

--------------------
CANDIDATE PROFILE
Name: ${candidate.name}
Email: ${candidate.email}
Summary: ${candidate.summary}
Skills: ${candidate.skills.join(', ')}

--------------------
STARTUP INFORMATION
Name: ${startup.name}
Industry: ${startup.industry || 'N/A'}
Description: ${startup.description || 'N/A'}
Funding stage: ${startup.fundingStage || 'N/A'}
Funding amount: ${startup.fundingAmount || 'N/A'}
Location: ${startup.location || 'N/A'}
Website: ${startup.website || 'N/A'}
Tags: ${tagsText || 'N/A'}

--------------------
MATCH CONTEXT
Similarity score (0‑1): ${match.score.toFixed(3)}
Approximate match strength: ${matchScorePct}/100
Rank: ${
    match.rank != null && match.totalMatches
      ? `${match.rank} of ${match.totalMatches}`
      : match.rank != null
        ? `${match.rank}`
        : 'N/A'
  }

Use this context, but do NOT mention the numeric similarity score or the fact that an algorithm matched them. Talk like a human who has done their homework on the startup and is reaching out because the connection genuinely makes sense.
`.trim();

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  const rawText = responseText;

  let subject = '';
  let body = '';

  try {
    const cleaned = cleanJsonResponse(responseText);
    const parsed = JSON.parse(cleaned) as { subject?: string; body?: string };

    if (typeof parsed.subject === 'string') {
      subject = parsed.subject.trim();
    }
    if (typeof parsed.body === 'string') {
      body = parsed.body.trim();
    }
  } catch (error) {
    // Fallback: treat the whole response as the body, and construct a subject.
    body = responseText.trim();
    subject =
      subjectPrefix +
      `Intro: ${candidate.name} → ${startup.name} (internship interest)`;
  }

  // Ensure subject has the requested prefix if provided.
  if (subjectPrefix && !subject.startsWith(subjectPrefix)) {
    subject = subjectPrefix + subject;
  }

  if (!subject) {
    subject =
      subjectPrefix +
      `Intro: ${candidate.name} → ${startup.name} (internship interest)`;
  }

  if (!body) {
    body = `Hi ${startup.name} team,\n\nMy name is ${candidate.name} and I'm interested in internship opportunities that align with my background in ${candidate.skills.join(
      ', '
    )}.\n\nBest,\n${candidate.name}`;
  }

  return {
    subject,
    body,
    rawText,
  };
}


