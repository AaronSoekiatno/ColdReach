import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const token = requestUrl.searchParams.get('token');
  const type = requestUrl.searchParams.get('type');
  const origin = requestUrl.origin;

  const supabaseResponse = NextResponse.next();

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
            supabaseResponse.cookies.set(name, value, options);
          });
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

    // Redirect to home page after successful authentication
    return supabaseResponse.redirect(new URL('/', origin));
  }

  // Handle magic link callback (email sign-in/sign-up)
  if (token && type) {
    // If it's a recovery (password reset) type, redirect to reset password page
    if (type === 'recovery') {
      // The token will be in the hash fragment, redirect to reset password page
      return supabaseResponse.redirect(new URL('/auth/reset-password', origin));
    }
    
    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: type as any,
    });
    
    if (error) {
      console.error('Magic link verification error:', error);
      return NextResponse.redirect(new URL('/?error=auth_failed', origin));
    }

    // Redirect to home page after successful authentication
    return supabaseResponse.redirect(new URL('/', origin));
  }
  
  // Check for hash fragments (password reset links use hash fragments)
  const hash = requestUrl.hash;
  if (hash && hash.includes('type=recovery')) {
    return supabaseResponse.redirect(new URL('/auth/reset-password' + hash, origin));
  }

  // If no code or token, redirect to home
  return NextResponse.redirect(new URL('/', origin));
}

