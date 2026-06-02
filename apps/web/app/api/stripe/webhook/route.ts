import type { NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { rateLimit } from '@/lib/rate-limit';
import { isStripeConfigured, stripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/service';

// Stripe signature verification needs the raw body + Node crypto.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Stripe webhook. Configure the endpoint URL `${SITE}/api/stripe/webhook` in the
 * Stripe dashboard (or `stripe listen --forward-to .../api/stripe/webhook` locally)
 * and set STRIPE_WEBHOOK_SECRET. On a completed Checkout session we mark the order
 * paid + confirmed using the service-role client (no user session here).
 */
export async function POST(req: NextRequest) {
  if (!isStripeConfigured || !stripe) {
    return new Response('Stripe is not configured.', { status: 503 });
  }

  // Throttle the public endpoint by source IP (generous — Stripe sends from many
  // IPs and retries, so this deters abuse without dropping legitimate events).
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'stripe-webhook';
  if (!(await rateLimit('stripe-webhook', { limit: 60, window: '60 s' }, ip)).success) {
    return new Response('Too many requests.', { status: 429 });
  }

  const signature = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return new Response('Missing Stripe signature or webhook secret.', { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid signature';
    return new Response(`Webhook signature verification failed: ${message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const orderId = session.metadata?.order_id ?? session.client_reference_id;
        if (orderId && session.payment_status === 'paid') {
          await createServiceClient()
            .from('orders')
            .update({
              payment_status: 'paid',
              status: 'confirmed',
              paid_at: new Date().toISOString(),
              stripe_payment_intent_id:
                typeof session.payment_intent === 'string' ? session.payment_intent : null,
            })
            .eq('id', orderId);
        }
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object;
        const orderId = charge.metadata?.order_id;
        if (orderId) {
          await createServiceClient()
            .from('orders')
            .update({ payment_status: 'refunded' })
            .eq('id', orderId);
        }
        break;
      }
      default:
        // Unhandled event types are acknowledged so Stripe doesn't retry them.
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'processing error';
    return new Response(`Webhook handler error: ${message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
