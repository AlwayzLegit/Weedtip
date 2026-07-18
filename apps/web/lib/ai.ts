import 'server-only';
import { cache } from 'react';
import { createServiceClient } from './supabase/service';

/**
 * Optional AI features, switched on by an Anthropic API key from either the
 * ANTHROPIC_API_KEY env var or the super-admin console (platform_secrets,
 * admin-only RLS). While no key is configured every helper no-ops and ALL
 * AI surfaces stay hidden. Calls the Anthropic Messages API directly via
 * fetch so there's no SDK dependency. Server-only — the key never reaches
 * the client.
 */
const SECRET_NAME = 'anthropic_api_key';

/** Resolve the key: env var wins; else the super-admin secret. Per-request cached. */
export const getAnthropicKey = cache(async (): Promise<string | null> => {
  const env = process.env.ANTHROPIC_API_KEY?.trim();
  if (env) return env;
  try {
    const service = createServiceClient();
    const { data } = await service
      .from('platform_secrets')
      .select('value')
      .eq('name', SECRET_NAME)
      .maybeSingle();
    const v = data?.value?.trim();
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
});

/** The switch every AI surface gates on (dashboard card, storefront blurb, action). */
export const aiEnabled = cache(async (): Promise<boolean> => !!(await getAnthropicKey()));

const MODEL = 'claude-haiku-4-5-20251001'; // fast + cheap; summaries are short

export async function summarizeReviews(
  reviews: { rating: number; body: string }[],
): Promise<string | null> {
  const key = await getAnthropicKey();
  if (!key) return null;

  const usable = reviews.filter((r) => r.body && r.body.trim().length > 0).slice(0, 40);
  if (usable.length < 3) return null;

  const sample = usable
    .map((r, i) => `${i + 1}. [${r.rating}/5] ${r.body.replace(/\s+/g, ' ').slice(0, 400)}`)
    .join('\n');

  const prompt =
    'Summarize these customer reviews for a cannabis dispensary listing. Write a neutral, ' +
    '2–3 sentence summary (about 50 words) of the recurring themes shoppers mention — product ' +
    'quality, selection, service, value, and atmosphere. Only use what the reviews say; do not ' +
    'invent details. Do not include names or any personal information. Plain text, no markdown, ' +
    'no preamble.\n\nReviews:\n' +
    sample;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 220,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const content = (data as { content?: { type: string; text?: string }[] }).content;
    if (!Array.isArray(content)) return null;
    const text = content
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text)
      .join(' ')
      .trim();
    return text.length ? text.slice(0, 800) : null;
  } catch {
    return null;
  }
}
