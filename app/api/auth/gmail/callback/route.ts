import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createServerClient } from '@supabase/ssr';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/gmail/callback`
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // user email

  if (!code || !state) {
    return NextResponse.redirect(new URL('/?error=gmail_connect_failed', request.url));
  }

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      throw new Error('No access token received');
    }
    
    // Verify user is authenticated
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
    
    if (authError || !user || user.email !== state) {
      return NextResponse.redirect(new URL('/?error=unauthorized', request.url));
    }

    // Store Gmail tokens in Supabase
    const { error: dbError } = await supabase
      .from('user_email_connections')
      .upsert({
        user_email: user.email,
        provider: 'gmail',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_email,provider'
      });

    if (dbError) {
      console.error('Failed to save Gmail tokens:', dbError);
      return NextResponse.redirect(new URL('/?error=token_save_failed', request.url));
    }

    return NextResponse.redirect(new URL('/?gmail_connected=true', request.url));
  } catch (error) {
    console.error('Gmail OAuth callback error:', error);
    return NextResponse.redirect(new URL('/?error=gmail_connect_failed', request.url));
  }
}

