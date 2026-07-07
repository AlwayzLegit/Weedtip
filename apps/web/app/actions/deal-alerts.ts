'use server';

import { createClient } from '@/lib/supabase/server';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SubscribeResult = { ok: boolean; error?: string };

/**
 * Public deal-alert signup. Works for signed-out visitors (anon RLS insert
 * policy). A repeat email+state submit is treated as success — the unique
 * index makes it idempotent, so we swallow the duplicate rather than leak
 * "you're already subscribed" (which also confirms an address to strangers).
 */
export async function subscribeDealAlerts(formData: FormData): Promise<SubscribeResult> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const state = String(formData.get('state') ?? '').trim() || null;
  const source = String(formData.get('source') ?? '').trim() || null;

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: 'Enter a valid email address.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('deal_alert_signups').insert({ email, state, source });

  // 23505 = unique_violation → already subscribed; report success.
  if (error && error.code !== '23505') {
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
  return { ok: true };
}
