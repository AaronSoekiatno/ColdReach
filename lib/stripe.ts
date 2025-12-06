import Stripe from 'stripe';

/**
 * Initialize Stripe with secret key
 * This should only be used on the server side (API routes)
 */
export function getStripe(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    throw new Error(
      'Missing STRIPE_SECRET_KEY environment variable. ' +
      'Please add it to your .env.local file. ' +
      'Get your key from: https://dashboard.stripe.com/test/apikeys'
    );
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: '2025-11-17.clover',
    typescript: true,
  });
}

/**
 * Subscription tier configuration
 */
export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  PREMIUM: 'premium',
} as const;

/**
 * Price IDs for subscription plans
 * These will be created in the Stripe Dashboard and should be updated here
 */
export const STRIPE_PRICE_IDS = {
  PREMIUM_MONTHLY: process.env.STRIPE_PRICE_ID_PREMIUM_MONTHLY || '',
} as const;

/**
 * Product configuration
 */
export const PRODUCT_CONFIG = {
  PREMIUM: {
    name: 'ColdStart Premium',
    description: 'Unlimited matches, resume tailoring, cold DM generation, and automated outreach',
    price: 10.00, // $10/month
    currency: 'usd',
    interval: 'month' as const,
    trialPeriodDays: 7, // 7-day free trial
    features: [
      'Unlimited startup matches',
      'AI-powered resume tailoring',
      'Cold DM message generation',
      'Automated outreach to founder emails',
    ],
  },
  FREE: {
    name: 'ColdStart Free',
    description: 'Try out ColdStart with limited features',
    price: 0,
    features: [
      'Upload resume',
      'View 1 matched startup',
    ],
  },
} as const;
