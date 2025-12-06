import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const token = requestUrl.searchParams.get('token');
  const type = requestUrl.searchParams.get('type');
  const origin = requestUrl.origin;

  // Import cookies dynamically
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
          } catch (error) {
            // Cookie setting might fail in route handlers - this is okay
            console.warn('Failed to set cookies:', error);
          }
        },
      },
    }
  );

  // Handle OAuth callback (Google, etc.)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Auth callback error:', error);
      return NextResponse.redirect(new URL('/?error=auth_failed', origin));
    }

    // Check if this is a new user by checking if they have a candidate record
    const { data: { user } } = await supabase.auth.getUser();
    let isNewSignUp = false;
    
    if (user?.email) {
      // Check if user has a candidate record
      const { data: candidate } = await supabase
        .from('candidates')
        .select('id')
        .eq('email', user.email)
        .single();
      
      // If no candidate record exists, this is likely a new sign-up
      isNewSignUp = !candidate;
    }

    // Check for redirect parameter
    const redirectTo = requestUrl.searchParams.get('redirect');
    
    // Redirect to specified URL or home page after successful authentication
    // Add new_signup parameter to trigger Gmail connection modal
    const redirectUrl = new URL(redirectTo || '/', origin);
    if (isNewSignUp && !redirectTo) {
      redirectUrl.searchParams.set('new_signup', 'true');
    }
    return NextResponse.redirect(redirectUrl);
  }

  // Handle magic link callback (email sign-in/sign-up)
  if (token && type) {
    // If it's a recovery (password reset) type, redirect to reset password page
    if (type === 'recovery') {
      // The token will be in the hash fragment, redirect to reset password page
      return NextResponse.redirect(new URL('/auth/reset-password', origin));
    }

    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: type as any,
    });

    if (error) {
      console.error('Magic link verification error:', error);
      return NextResponse.redirect(new URL('/?error=auth_failed', origin));
    }

    // Check for redirect parameter
    const redirectTo = requestUrl.searchParams.get('redirect');
    
    // Redirect to specified URL or home page after successful authentication
    return NextResponse.redirect(new URL(redirectTo || '/', origin));
  }

  // Check for hash fragments (password reset links use hash fragments)
  const hash = requestUrl.hash;
  if (hash && hash.includes('type=recovery')) {
    return NextResponse.redirect(new URL('/auth/reset-password' + hash, origin));
  }

  // If no code or token, redirect to home
  return NextResponse.redirect(new URL('/', origin));
}

