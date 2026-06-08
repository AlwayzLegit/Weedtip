import 'server-only';

/**
 * Reports which third-party integrations are wired in the CURRENT runtime
 * environment, by presence of their env vars only — never the values. Powers the
 * admin Integrations page so wiring can be verified per environment after deploy.
 */
export type IntegrationStatus = {
  name: string;
  configured: boolean;
  required: boolean;
  /** What works (or breaks) depending on this integration. */
  gates: string;
  /** Env var names this integration reads. */
  vars: string[];
  /** A misconfiguration note (e.g. partially set). */
  warning?: string;
};

const present = (key: string): boolean => {
  const v = process.env[key];
  return typeof v === 'string' && v.trim().length > 0;
};

export function integrationStatuses(): IntegrationStatus[] {
  const stripeSecret = present('STRIPE_SECRET_KEY');
  const stripePublishable = present('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
  const stripeWebhook = present('STRIPE_WEBHOOK_SECRET');

  let stripeWarning: string | undefined;
  if (stripeSecret && !stripeWebhook) {
    stripeWarning =
      'Secret key is set but STRIPE_WEBHOOK_SECRET is missing — checkouts will start but never confirm, so orders, placements, and bids won’t activate.';
  } else if (stripeSecret && !stripePublishable) {
    stripeWarning = 'Secret key is set but the publishable key is missing.';
  }

  return [
    {
      name: 'Supabase',
      required: true,
      configured:
        present('NEXT_PUBLIC_SUPABASE_URL') &&
        present('NEXT_PUBLIC_SUPABASE_ANON_KEY') &&
        present('SUPABASE_SERVICE_ROLE_KEY'),
      gates: 'Database, auth, and every read/write. Core — the app will not run without it.',
      vars: [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
      ],
    },
    {
      name: 'Site URL',
      required: true,
      configured: present('NEXT_PUBLIC_SITE_URL'),
      gates: 'Absolute URLs for Stripe redirects, the sitemap, and SEO canonicals.',
      vars: ['NEXT_PUBLIC_SITE_URL'],
    },
    {
      name: 'Stripe — payments',
      required: false,
      configured: stripeSecret && stripePublishable && stripeWebhook,
      gates:
        'Online payments: product orders, subscriptions, placements, and both featured auctions. Falls back to free / pay-at-shop when off.',
      vars: ['STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'],
      warning: stripeWarning,
    },
    {
      name: 'Mapbox — maps',
      required: false,
      configured: present('NEXT_PUBLIC_MAPBOX_TOKEN'),
      gates: 'Interactive maps on /map and dispensary pages. Shows a static preview when off.',
      vars: ['NEXT_PUBLIC_MAPBOX_TOKEN'],
    },
    {
      name: 'Upstash Redis — rate limiting',
      required: false,
      configured: present('UPSTASH_REDIS_REST_URL') && present('UPSTASH_REDIS_REST_TOKEN'),
      gates: 'Rate limiting on auth, checkout, and webhooks. Fail-open (no limiting) when off.',
      vars: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
    },
    {
      name: 'PostHog — analytics',
      required: false,
      configured: present('NEXT_PUBLIC_POSTHOG_KEY'),
      gates: 'Product analytics. Inert when off.',
      vars: ['NEXT_PUBLIC_POSTHOG_KEY', 'NEXT_PUBLIC_POSTHOG_HOST'],
    },
    {
      name: 'Sentry — monitoring',
      required: false,
      configured: present('NEXT_PUBLIC_SENTRY_DSN'),
      gates: 'Error + performance monitoring. Inert when off.',
      vars: ['NEXT_PUBLIC_SENTRY_DSN'],
    },
  ];
}
