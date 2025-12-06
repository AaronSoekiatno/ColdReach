import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/stripe/webhook
 * Handles Stripe webhook events for subscription management
 *
 * Important: This endpoint must be configured in Stripe Dashboard
 * Events to listen for:
 * - checkout.session.completed (immediately updates tier after checkout)
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_succeeded
 * - invoice.payment_failed
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET environment variable');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Error handling webhook event:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout session completed - immediately update subscription tier
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  
  if (!customerId || session.mode !== 'subscription') {
    return; // Only handle subscription checkouts
  }

  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized');
  }

  // Get candidate by stripe_customer_id
  const { data: candidate, error: fetchError } = await supabaseAdmin
    .from('candidates')
    .select('email')
    .eq('stripe_customer_id', customerId)
    .single();

  if (fetchError || !candidate) {
    console.error('Could not find candidate for customer:', customerId);
    return;
  }

  // Get the subscription from Stripe to check its status
  const stripe = getStripe();
  const subscriptionId = typeof session.subscription === 'string' 
    ? session.subscription 
    : session.subscription?.id;

  if (!subscriptionId) {
    console.warn('No subscription ID found in checkout session:', session.id);
    return;
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const subscriptionStatus = subscription.status;
    // Safely handle current_period_end - it might be null/undefined
    const periodEnd = (subscription as any).current_period_end;
    const currentPeriodEnd = periodEnd && typeof periodEnd === 'number'
      ? new Date(periodEnd * 1000).toISOString()
      : null;

    // Map Stripe subscription status to our allowed database values
    let dbSubscriptionStatus: 'active' | 'inactive' | 'canceled' | 'past_due' | 'trialing';
    
    switch (subscriptionStatus) {
      case 'active':
        dbSubscriptionStatus = 'active';
        break;
      case 'trialing':
        dbSubscriptionStatus = 'trialing';
        break;
      case 'past_due':
        dbSubscriptionStatus = 'past_due';
        break;
      case 'canceled':
      case 'unpaid':
      case 'incomplete_expired':
        dbSubscriptionStatus = 'canceled';
        break;
      case 'incomplete':
      default:
        dbSubscriptionStatus = 'inactive';
        break;
    }

    // Update candidate subscription immediately
    const updateData: any = {
      stripe_subscription_id: subscriptionId,
      subscription_status: dbSubscriptionStatus,
    };
    
    // Only set current_period_end if it's valid
    if (currentPeriodEnd) {
      updateData.subscription_current_period_end = currentPeriodEnd;
    }

    // Set subscription tier based on status
    if (dbSubscriptionStatus === 'active' || dbSubscriptionStatus === 'trialing') {
      updateData.subscription_tier = 'premium';
    } else {
      updateData.subscription_tier = 'free';
    }

    const { error: updateError } = await supabaseAdmin
      .from('candidates')
      .update(updateData)
      .eq('email', candidate.email);

    if (updateError) {
      console.error('Error updating candidate subscription from checkout:', updateError);
      throw updateError;
    }

    console.log(`✅ Checkout completed - Updated subscription for ${candidate.email}: tier=${updateData.subscription_tier}, status=${dbSubscriptionStatus}`);
  } catch (error: any) {
    console.error('Error processing checkout completion:', error);
    throw error;
  }
}

/**
 * Handle subscription created or updated
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const subscriptionId = subscription.id;
  const stripeStatus = subscription.status;
  // Safely handle current_period_end - it might be null/undefined
  const periodEnd = (subscription as any).current_period_end;
  const currentPeriodEnd = periodEnd && typeof periodEnd === 'number'
    ? new Date(periodEnd * 1000).toISOString()
    : null;

  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized');
  }

  // Get candidate by stripe_customer_id
  const { data: candidate, error: fetchError } = await supabaseAdmin
    .from('candidates')
    .select('email')
    .eq('stripe_customer_id', customerId)
    .single();

  if (fetchError || !candidate) {
    console.error('Could not find candidate for customer:', customerId);
    return;
  }

  // Map Stripe subscription status to our allowed database values
  // Stripe can send: active, trialing, past_due, canceled, incomplete, incomplete_expired, unpaid, etc.
  // Our database only allows: active, inactive, canceled, past_due, trialing
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
      // Map unknown/incomplete statuses to 'inactive' to avoid constraint violations
      subscriptionStatus = 'inactive';
      console.warn(`Mapping unknown Stripe status "${stripeStatus}" to "inactive" for customer ${customerId}`);
      break;
  }

  // Update candidate subscription status
  const updateData: any = {
    stripe_subscription_id: subscriptionId,
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
    // Downgrade to free for canceled, past_due, or inactive subscriptions
    updateData.subscription_tier = 'free';
  }

  const { error: updateError } = await supabaseAdmin
    .from('candidates')
    .update(updateData)
    .eq('email', candidate.email);

  if (updateError) {
    console.error('Error updating candidate subscription:', updateError);
    throw updateError;
  }

  console.log(`✅ Updated subscription for ${candidate.email}: tier=${updateData.subscription_tier}, status=${subscriptionStatus} (Stripe: ${stripeStatus})`);
}

/**
 * Handle subscription deleted (cancellation)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized');
  }

  const { data: candidate, error: fetchError } = await supabaseAdmin
    .from('candidates')
    .select('email')
    .eq('stripe_customer_id', customerId)
    .single();

  if (fetchError || !candidate) {
    console.error('Could not find candidate for customer:', customerId);
    return;
  }

  // Downgrade to free tier
  const { error: updateError } = await supabaseAdmin
    .from('candidates')
    .update({
      subscription_tier: 'free',
      subscription_status: 'canceled',
      stripe_subscription_id: null,
    })
    .eq('email', candidate.email);

  if (updateError) {
    console.error('Error downgrading candidate:', updateError);
    throw updateError;
  }

  console.log(`✅ Downgraded ${candidate.email} to free tier`);
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  const subscriptionId = typeof (invoice as any).subscription === 'string' ? (invoice as any).subscription : (invoice as any).subscription?.id;

  if (!subscriptionId) {
    return; // Not a subscription payment
  }

  console.log(`✅ Payment succeeded for customer ${customerId}, subscription ${subscriptionId}`);

  // Ensure subscription tier and status are updated - retrieve subscription and update if needed
  if (!supabaseAdmin) {
    return;
  }

  try {
    const { data: candidate } = await supabaseAdmin
      .from('candidates')
      .select('email, subscription_tier, subscription_status')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!candidate) {
      return;
    }

    // Retrieve subscription from Stripe to get current status
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const stripeStatus = subscription.status;
    // Safely handle current_period_end - it might be null/undefined
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

    // Update both tier and status (subscription.updated should handle this, but this is a safety check)
    const updateData: any = {
      subscription_status: subscriptionStatus,
    };
    
    // Only set current_period_end if it's valid
    if (currentPeriodEnd) {
      updateData.subscription_current_period_end = currentPeriodEnd;
    }

    if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
      updateData.subscription_tier = 'premium';
    } else {
      updateData.subscription_tier = 'free';
    }

    await supabaseAdmin
      .from('candidates')
      .update(updateData)
      .eq('email', candidate.email);

    console.log(`✅ Updated ${candidate.email} subscription: tier=${updateData.subscription_tier}, status=${subscriptionStatus} after payment succeeded`);
  } catch (error: any) {
    console.error('Error updating subscription after payment succeeded:', error);
    // Don't throw - subscription.updated event will handle it
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized');
  }

  const { data: candidate, error: fetchError } = await supabaseAdmin
    .from('candidates')
    .select('email')
    .eq('stripe_customer_id', customerId)
    .single();

  if (fetchError || !candidate) {
    console.error('Could not find candidate for customer:', customerId);
    return;
  }

  // Update subscription status to past_due
  const { error: updateError } = await supabaseAdmin
    .from('candidates')
    .update({
      subscription_status: 'past_due',
    })
    .eq('email', candidate.email);

  if (updateError) {
    console.error('Error updating payment status:', updateError);
    throw updateError;
  }

  console.log(`⚠️ Payment failed for ${candidate.email}`);
}
