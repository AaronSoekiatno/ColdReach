import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createServerClient } from '@supabase/ssr';
import { generateColdEmail } from '@/lib/email-generation';
import { getCandidate, getStartup } from '@/lib/supabase';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/gmail/callback`
);

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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
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

    // Get user's email connection (OAuth tokens)
    const { data: emailConnection, error: connectionError } = await supabase
      .from('user_email_connections')
      .select('*')
      .eq('user_email', user.email)
      .eq('provider', 'gmail')
      .single();

    if (connectionError || !emailConnection) {
      return NextResponse.json(
        { error: 'Gmail not connected. Please connect your Gmail account first.' },
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

    if (!startup.founder_emails) {
      return NextResponse.json(
        { error: 'Founder email not available for this startup' },
        { status: 400 }
      );
    }

    // Generate email
    const generatedEmail = await generateColdEmail(
      {
        name: candidate.name,
        email: candidate.email,
        summary: candidate.summary,
        skills: candidate.skills.split(', ').filter(s => s.trim()),
      },
      {
        name: startup.name,
        industry: startup.industry,
        description: startup.description,
        fundingStage: startup.funding_stage,
        fundingAmount: startup.funding_amount,
        location: startup.location,
        website: startup.website,
        tags: startup.tags?.split(', ').filter(t => t.trim()),
      },
      { score: matchScore }
    );

    // Set up OAuth client with stored tokens
    oauth2Client.setCredentials({
      access_token: emailConnection.access_token,
      refresh_token: emailConnection.refresh_token,
    });

    // Refresh token if expired
    if (emailConnection.expires_at && new Date(emailConnection.expires_at) < new Date()) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        
        // Update stored token
        await supabase
          .from('user_email_connections')
          .update({
            access_token: credentials.access_token,
            expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_email', user.email)
          .eq('provider', 'gmail');
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        return NextResponse.json(
          { error: 'Gmail connection expired. Please reconnect your Gmail account.' },
          { status: 401 }
        );
      }
    }

    // Send email via Gmail API
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Create email message
    const message = [
      `To: ${startup.founder_emails}`,
      `Subject: ${generatedEmail.subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      generatedEmail.body,
    ].join('\n');

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
    });
  } catch (error) {
    console.error('Send email error:', error);
    
    if (error instanceof Error) {
      // Handle specific Gmail API errors
      if (error.message.includes('invalid_grant') || error.message.includes('Token has been expired')) {
        return NextResponse.json(
          { error: 'Gmail connection expired. Please reconnect your Gmail account.' },
          { status: 401 }
        );
      }
      
      if (error.message.includes('insufficient permission')) {
        return NextResponse.json(
          { error: 'Insufficient Gmail permissions. Please reconnect your Gmail account.' },
          { status: 403 }
        );
      }
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    );
  }
}

