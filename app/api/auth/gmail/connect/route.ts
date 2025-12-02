import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createServerClient } from '@supabase/ssr';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/gmail/callback`
);

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url);
    const tokenParam = requestUrl.searchParams.get('token');
    
    const response = NextResponse.next();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    let user: any = null;
    let sessionToken: string | null = null;
    
    // If token is provided as query param, use it to get user
    if (tokenParam) {
      try {
        const { data: { user: userData }, error: tokenError } = await supabase.auth.getUser(tokenParam);
        if (!tokenError && userData) {
          user = userData;
          sessionToken = tokenParam; // Store the token for passing in state
        }
      } catch (tokenErr) {
        console.error('Token validation error:', tokenErr);
      }
    }
    
    // If no user from token, try cookies
    if (!user) {
      // Try getSession first (reads from cookies)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      user = session?.user;
      sessionToken = session?.access_token || null;
      
      // If no session, try getUser (makes API call)
      if (!user) {
        const { data: { user: userData }, error: authError } = await supabase.auth.getUser();
        user = userData;
        
        if (authError) {
          console.error('Gmail connect auth error:', authError);
          console.error('Session error:', sessionError);
          // Log cookies for debugging
          const cookies = request.cookies.getAll();
          console.log('Available cookies:', cookies.map(c => c.name).filter(name => name.includes('supabase') || name.includes('sb-')));
        }
      }
    }
    
    if (!user || !user.email) {
      // Redirect to home page - user should sign in via modal
      return NextResponse.redirect(new URL('/?error=please_sign_in&action=connect_gmail', request.url));
    }

    if (!sessionToken) {
      console.error('No session token available');
      return NextResponse.redirect(new URL('/?error=session_missing', request.url));
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('Missing Google OAuth credentials');
      return NextResponse.redirect(new URL('/?error=gmail_config_missing', request.url));
    }

    // Request Gmail send permission
    // Pass both email and session token in state: "email:token"
    const scopes = ['https://www.googleapis.com/auth/gmail.send'];
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force consent to get refresh token
      state: `${user.email}:${sessionToken}`, // Pass email and token to identify and authenticate in callback
    });

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Gmail connect error:', error);
    return NextResponse.redirect(new URL('/?error=gmail_connect_failed', request.url));
  }
}

