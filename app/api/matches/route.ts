import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '6', 10);
    const offset = (page - 1) * limit;

    // Import cookies at runtime (Next.js 15+ requirement)
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Get candidate ID
    const { data: candidate } = await supabaseAdmin
      .from('candidates')
      .select('id')
      .eq('email', user.email)
      .single();

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    // Get total count
    const { count: totalCount } = await supabaseAdmin
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_id', candidate.id);

    // Get paginated matches ordered by score descending
    const { data: rawMatches, error: matchError } = await supabaseAdmin
      .from('matches')
      .select('id, score, matched_at, startup_id')
      .eq('candidate_id', candidate.id)
      .order('score', { ascending: false })
      .range(offset, offset + limit - 1);

    if (matchError) {
      return NextResponse.json(
        { error: `Failed to load matches: ${matchError.message}` },
        { status: 500 }
      );
    }

    if (!rawMatches || rawMatches.length === 0) {
      return NextResponse.json({
        matches: [],
        pagination: {
          page,
          limit,
          total: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / limit),
          hasMore: false,
        },
      });
    }

    // Get startup IDs
    const startupIds = Array.from(
      new Set(
        rawMatches
          .map((m) => m.startup_id)
          .filter((id): id is string => !!id)
      )
    );

    // Load startup data
    let startupsById: Record<
      string,
      {
        id: string;
        name: string;
        industry: string;
        location: string;
        funding_stage: string;
        funding_amount: string;
        tags: string;
        website: string;
        founder_emails?: string;
      }
    > = {};

    if (startupIds.length > 0) {
      const { data: startupRows, error: startupsError } = await supabaseAdmin
        .from('startups')
        .select(
          'id, name, industry, location, funding_stage, funding_amount, tags, website, founder_emails'
        )
        .in('id', startupIds);

      if (!startupsError && startupRows) {
        for (const s of startupRows) {
          startupsById[s.id] = {
            ...s,
            founder_emails: s.founder_emails ?? undefined,
          };
        }
      }
    }

    // Join matches with startup data
    const matches = rawMatches.map((m) => ({
      id: m.id,
      score: m.score,
      matched_at: m.matched_at,
      startup: startupsById[m.startup_id] ?? null,
    }));

    const totalPages = Math.ceil((totalCount || 0) / limit);
    const hasMore = page < totalPages;

    return NextResponse.json({
      matches,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages,
        hasMore,
      },
    });
  } catch (error) {
    console.error('Error fetching matches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matches' },
      { status: 500 }
    );
  }
}

