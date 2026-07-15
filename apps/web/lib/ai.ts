import 'server-only';

/**
 * Optional AI features, gated on ANTHROPIC_API_KEY (same graceful-fallback
 * pattern as Mapbox/Stripe): when the key is unset every helper no-ops and the
 * UI hides the feature. Calls the Anthropic Messages API directly via fetch so
 * there's no SDK dependency. Server-only — the key never reaches the client.
 */
export const isAiEnabled = !!process.env.ANTHROPIC_API_KEY;

const MODEL = 'claude-haiku-4-5-20251001'; // fast + cheap; summaries are short

export async function summarizeReviews(
  reviews: { rating: number; body: string }[],
): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
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
