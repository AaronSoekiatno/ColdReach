import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { supabase, supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/stripe/create-portal-session
 * Creates a Stripe Customer Portal session for managing subscriptions
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.email !== email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get candidate's Stripe customer ID
    const { data: candidate } = await supabase
      .from('candidates')
      .select('stripe_customer_id')
      .eq('email', email)
      .single();

    if (!candidate?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    const stripe = getStripe();

    // Verify customer exists in Stripe
    let customerId = candidate.stripe_customer_id;
    try {
      await stripe.customers.retrieve(customerId);
    } catch (error: any) {
      // Customer doesn't exist (deleted or invalid) - clear it from database
      console.warn(`Stripe customer ${customerId} not found, clearing from database`);
      if (supabaseAdmin) {
        await supabaseAdmin
          .from('candidates')
          .update({ stripe_customer_id: null })
          .eq('email', email);
      }
      
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${request.headers.get('origin')}/matches`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
