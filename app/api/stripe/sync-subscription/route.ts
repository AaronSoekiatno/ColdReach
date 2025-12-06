import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { getStripe } from '@/lib/stripe';

/**
 * POST /api/stripe/sync-subscription
 * Manually sync subscription status from Stripe to database
 * Useful if webhook didn't fire or there was a delay
 */
export async function POST(request: NextRequest) {
  try {
    // Import cookies at runtime (Next.js 15+ requirement)
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
            } catch {
              // Cookie setting might fail in route handlers - this is okay
            }
          },
        },
      }
    );

    // Verify user is authenticated
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

    // Get candidate data
    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from('candidates')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('email', user.email)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    if (!candidate.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer ID found' },
        { status: 404 }
      );
    }

    // Get subscription from Stripe
    const stripe = getStripe();
    
    // Always check for active subscriptions, even if we have a subscription_id
    // This handles cases where a new subscription was created but webhook hasn't fired yet
    const subscriptions = await stripe.subscriptions.list({
      customer: candidate.stripe_customer_id,
      status: 'all',
      limit: 10, // Get more subscriptions to find the most recent active one
    });

    // Find the most recent active or trialing subscription
    const activeSubscription = subscriptions.data.find(
      sub => sub.status === 'active' || sub.status === 'trialing'
    ) || subscriptions.data.find(
      sub => sub.status !== 'canceled' && sub.status !== 'incomplete_expired'
    );

    if (!activeSubscription) {
      // No active subscription found, ensure tier is free
      await supabaseAdmin
        .from('candidates')
        .update({
          subscription_tier: 'free',
          subscription_status: 'inactive',
          stripe_subscription_id: null,
        })
        .eq('email', user.email);

      return NextResponse.json({
        success: true,
        message: 'No active subscription found, set to free tier',
        subscription_tier: 'free',
        subscription_status: 'inactive',
      });
    }

    // Sync the found subscription
    await syncSubscriptionFromStripe(activeSubscription, user.email);
    
    const isPremium = activeSubscription.status === 'active' || activeSubscription.status === 'trialing';
    
    return NextResponse.json({
      success: true,
      message: 'Subscription synced successfully',
      subscription_tier: isPremium ? 'premium' : 'free',
      subscription_status: activeSubscription.status,
      subscription_id: activeSubscription.id,
    });
  } catch (error: any) {
    console.error('Error syncing subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync subscription' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to sync subscription data from Stripe to database
 */
async function syncSubscriptionFromStripe(subscription: Stripe.Subscription, email: string) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized');
  }

  const stripeStatus = subscription.status;
  // Safely handle current_period_end - it might be null/undefined
  // Using bracket notation to access property that TypeScript may not recognize
  const periodEnd = (subscription as any).current_period_end;
  const currentPeriodEnd = periodEnd && typeof periodEnd === 'number'
    ? new Date(periodEnd * 1000).toISOString()
    : null;

  // Map Stripe subscription status to our allowed database values
  let subscriptionStatus: 'active' | 'inactive' | 'canceled' | 'past_due' | 'trialing';
  
  switch (stripeStatus) {
    case 'active':
      subscriptionStatus = 'active';
      break;
    case 'trialing':
      subscriptionStatus = 'trialing';
      break;
    case 'past_due':
      subscriptionStatus = 'past_due';
      break;
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      subscriptionStatus = 'canceled';
      break;
    case 'incomplete':
    default:
      subscriptionStatus = 'inactive';
      break;
  }

  // Update candidate subscription status
  const updateData: any = {
    stripe_subscription_id: subscription.id,
    subscription_status: subscriptionStatus,
  };
  
  // Only set current_period_end if it's valid
  if (currentPeriodEnd) {
    updateData.subscription_current_period_end = currentPeriodEnd;
  }

  // Set subscription tier based on status
  if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
    updateData.subscription_tier = 'premium';
  } else {
    updateData.subscription_tier = 'free';
  }

  const { error: updateError } = await supabaseAdmin
    .from('candidates')
    .update(updateData)
    .eq('email', email);

  if (updateError) {
    console.error('Error updating candidate subscription:', updateError);
    throw updateError;
  }

  console.log(`✅ Synced subscription for ${email}: tier=${updateData.subscription_tier}, status=${subscriptionStatus}`);
}

