'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Saves a shopper's first-run choices: favorite categories onto their profile
 * (for feed personalization) and an optional deal-alert subscription. Everything
 * is optional — an empty submit is a valid "just continue". State/location is
 * persisted client-side via the market cookie, so it isn't handled here.
 */
export async function finishOnboarding(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  // Sanitize category slugs; cap to a sane number.
  const categories = formData
    .getAll('category')
    .map((c) => String(c))
    .filter((c) => /^[a-z0-9-]{1,60}$/.test(c))
    .slice(0, 20);

  await supabase.from('profiles').update({ preferred_categories: categories }).eq('id', user.id);

  // Opt-in deal alerts to the account email, scoped to the chosen state.
  if (formData.get('deal_alerts') && user.email) {
    const state = String(formData.get('state') ?? '').trim() || null;
    const { error } = await supabase
      .from('deal_alert_signups')
      .insert({ email: user.email.toLowerCase(), state, source: 'onboarding' });
    // 23505 = already subscribed — fine.
    if (error && error.code !== '23505') {
      console.warn('[onboarding] deal-alert insert failed:', error.message);
    }
  }

  revalidatePath('/', 'layout');
  redirect('/dispensaries');
}
