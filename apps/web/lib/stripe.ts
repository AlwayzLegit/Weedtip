import 'server-only';
import Stripe from 'stripe';

const secret = process.env.STRIPE_SECRET_KEY;

/**
 * Whether a real Stripe secret key is configured. Gates the entire online-payment
 * path — when false, checkout falls back to pay-at-the-dispensary, so the app
 * works end-to-end without Stripe credentials (mirrors the Mapbox-token pattern).
 */
export const isStripeConfigured = !!secret && secret.startsWith('sk_');

/** Server-side Stripe client, or null when not configured. Never import in client code. */
export const stripe: Stripe | null = isStripeConfigured ? new Stripe(secret as string) : null;

/** Publishable key for client-side use (safe to expose); empty string when unset. */
export const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
