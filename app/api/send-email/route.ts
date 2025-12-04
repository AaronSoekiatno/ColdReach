import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { generateColdEmail } from '@/lib/email-generation';
import { getCandidate, getStartup } from '@/lib/supabase';
import { guessFounderEmailFromStartup } from '@/lib/founder-email';

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

    const { startupId, matchScore, subject: customSubject, body: customBody } = await request.json();

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

    // Decide which email address to use (real or guessed)
    const { email: targetEmail, isGuessed } = guessFounderEmailFromStartup(startup);

    if (!targetEmail) {
      return NextResponse.json(
        {
          error:
            'Founder email not available for this startup and could not be guessed from first name + website.',
        },
        { status: 400 }
      );
    }

    // Use custom subject/body if provided, otherwise generate email
    let emailSubject: string;
    let emailBody: string;
    
    if (customSubject && customBody) {
      // User edited the email - use their custom version
      emailSubject = customSubject;
      emailBody = customBody;
    } else {
      // Generate email as before
      const generatedEmail = await generateColdEmail(
        {
          name: candidate.name,
          email: candidate.email,
          summary: candidate.summary,
          // Split skills string into non-empty, trimmed values
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
          // Split tags string into non-empty, trimmed values
          tags: startup.tags
            ?.split(', ')
            .map((t: string) => t.trim())
            .filter((t: string) => t.length > 0),
        },
        { score: matchScore }
      );
      emailSubject = generatedEmail.subject;
      emailBody = generatedEmail.body;
    }

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

    // Download resume from Supabase Storage if available
    let resumeAttachment: { data: Buffer; filename: string; mimeType: string } | null = null;
    if (candidate.resume_path) {
      try {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceRoleKey) {
          const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey
          );

          const { data: resumeData, error: downloadError } = await supabaseAdmin.storage
            .from('resumes')
            .download(candidate.resume_path);

          if (!downloadError && resumeData) {
            const arrayBuffer = await resumeData.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            // Determine filename and MIME type from path
            const pathParts = candidate.resume_path.split('/');
            const filename = pathParts[pathParts.length - 1] || 'resume.pdf';
            const mimeType = filename.endsWith('.pdf') 
              ? 'application/pdf' 
              : filename.endsWith('.docx')
              ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              : 'application/octet-stream';

            resumeAttachment = {
              data: buffer,
              filename,
              mimeType,
            };
            console.log(`Resume attachment prepared: ${filename} (${buffer.length} bytes)`);
          } else {
            console.warn('Failed to download resume from Storage:', downloadError);
          }
        }
      } catch (error) {
        console.warn('Error downloading resume for attachment:', error);
        // Continue without attachment if download fails
      }
    }

    // Create email message with optional attachment
    let message: string;
    
    if (resumeAttachment) {
      // Multipart message with attachment
      const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const attachmentBase64 = resumeAttachment.data.toString('base64');
      const attachmentEncoded = attachmentBase64.match(/.{1,76}/g)?.join('\n') || attachmentBase64;

      message = [
        `To: ${targetEmail}`,
        `Subject: ${emailSubject}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        `Content-Type: text/plain; charset=utf-8`,
        `Content-Transfer-Encoding: 7bit`,
        '',
        emailBody,
        '',
        `--${boundary}`,
        `Content-Type: ${resumeAttachment.mimeType}; name="${resumeAttachment.filename}"`,
        `Content-Disposition: attachment; filename="${resumeAttachment.filename}"`,
        `Content-Transfer-Encoding: base64`,
        '',
        attachmentEncoded,
        `--${boundary}--`,
      ].join('\n');
    } else {
      // Simple text message without attachment
      message = [
        `To: ${targetEmail}`,
        `Subject: ${emailSubject}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        emailBody,
      ].join('\n');
    }

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

    // Save email history to database
    try {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceRoleKey && candidate.id) {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey
        );

        // Get recipient name (founder name if available)
        const recipientName = startup.founder_first_name && startup.founder_last_name
          ? `${startup.founder_first_name} ${startup.founder_last_name}`
          : startup.founder_first_name || startup.founder_last_name || null;

        await supabaseAdmin
          .from('sent_emails')
          .insert({
            candidate_id: candidate.id,
            startup_id: startup.id,
            recipient_email: targetEmail,
            recipient_name: recipientName,
            subject: emailSubject,
            body: emailBody,
            match_score: matchScore,
            sent_at: new Date().toISOString(),
          });

        console.log('Email history saved successfully');
      }
    } catch (historyError) {
      // Log error but don't fail the request - email was already sent
      console.error('Failed to save email history:', historyError);
    }

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

      // If we used a guessed founder email and Gmail reports it invalid,
      // clear the stored founder_emails back to NULL so we don't reuse a bad guess.
      if (
        (error.message.toLowerCase().includes('invalid') ||
          error.message.toLowerCase().includes('address not found')) &&
        typeof request !== 'undefined'
      ) {
        try {
          const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (serviceRoleKey) {
            const { createClient } = await import('@supabase/supabase-js');
            const supabaseAdmin = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              serviceRoleKey
            );
            const { startupId } = await request.json();
            await supabaseAdmin
              .from('startups')
              .update({ founder_emails: null })
              .eq('id', startupId);
          }
        } catch (clearError) {
          console.error('Failed to clear invalid founder email:', clearError);
        }
      }
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    );
  }
}

