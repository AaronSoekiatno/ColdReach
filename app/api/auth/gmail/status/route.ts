import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
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
        { connected: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Check if Gmail is connected
    const { data: emailConnection, error: connectionError } = await supabase
      .from('user_email_connections')
      .select('provider, expires_at')
      .eq('user_email', user.email)
      .eq('provider', 'gmail')
      .single();

    if (connectionError || !emailConnection) {
      return NextResponse.json({ connected: false });
    }

    // Check if token is expired
    const isExpired = emailConnection.expires_at 
      ? new Date(emailConnection.expires_at) < new Date()
      : false;

    return NextResponse.json({
      connected: true,
      expired: isExpired,
    });
  } catch (error) {
    console.error('Gmail status check error:', error);
    return NextResponse.json(
      { connected: false, error: 'Failed to check status' },
      { status: 500 }
    );
  }
}

