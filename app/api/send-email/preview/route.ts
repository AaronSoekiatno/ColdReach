import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { generateColdEmail } from '@/lib/email-generation';
import { getCandidate, getStartup } from '@/lib/supabase';
import { guessFounderEmailFromStartup } from '@/lib/founder-email';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    const { startupId, matchScore } = await request.json();

    if (!startupId || matchScore === undefined) {
      return NextResponse.json(
        { error: 'Missing startupId or matchScore' },
        { status: 400 }
      );
    }

    // Get candidate and startup data
    const candidate = await getCandidate(user.email);
    const startup = await getStartup(startupId);

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate profile not found. Please upload your resume first.' },
        { status: 404 }
      );
    }

    if (!startup) {
      return NextResponse.json(
        { error: 'Startup not found' },
        { status: 404 }
      );
    }

    // Decide which email address to use (real or guessed)
    const { email: targetEmail } = guessFounderEmailFromStartup(startup);

    if (!targetEmail) {
      return NextResponse.json(
        {
          error:
            'Founder email not available for this startup and could not be guessed from first name + website.',
        },
        { status: 400 }
      );
    }

    // Generate email (but do NOT send it)
    const generatedEmail = await generateColdEmail(
      {
        name: candidate.name,
        email: candidate.email,
        summary: candidate.summary,
        skills: candidate.skills
          .split(', ')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0),
      },
      {
        name: startup.name,
        industry: startup.industry,
        description: startup.description,
        fundingStage: startup.funding_stage,
        fundingAmount: startup.funding_amount,
        location: startup.location,
        website: startup.website,
        tags: startup.tags
          ?.split(', ')
          .map((t: string) => t.trim())
          .filter((t: string) => t.length > 0),
      },
      { score: matchScore }
    );

    // Generate signed URL for resume preview
    let resumeUrl = null;
    if (candidate.resume_path) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceRoleKey) {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey
        );

        const { data } = await supabaseAdmin.storage
          .from('resumes')
          .createSignedUrl(candidate.resume_path, 3600); // 1 hour expiry

        if (data?.signedUrl) {
          resumeUrl = data.signedUrl;
        }
      }
    }

    return NextResponse.json({
      success: true,
      subject: generatedEmail.subject,
      body: generatedEmail.body,
      to: targetEmail,
      resumeUrl,
    });
  } catch (error) {
    console.error('Preview email error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate email preview' },
      { status: 500 }
    );
  }
}


