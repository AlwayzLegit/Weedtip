'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { ONBOARDING_COOKIE, type OnboardingSelection } from '@/lib/onboarding-flow';
import { createClient } from '@/lib/supabase/server';

/**
 * Wizard navigation actions.
 *
 * The selection cookie is the only thing the wizard persists, and only because
 * the business is chosen BEFORE the account exists. It's short-lived, holds no
 * secrets (a public slug and a word), and is lax-scoped so it survives the
 * click back in from the confirmation email.
 */

const MAX_AGE = 60 * 60 * 24 * 14; // two weeks — long enough to confirm an email

async function writeSelection(next: OnboardingSelection): Promise<void> {
  (await cookies()).set(ONBOARDING_COOKIE, encodeURIComponent(JSON.stringify(next)), {
    path: '/',
    maxAge: MAX_AGE,
    sameSite: 'lax',
    httpOnly: false,
  });
}

async function currentSelection(): Promise<OnboardingSelection | null> {
  const raw = (await cookies()).get(ONBOARDING_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as OnboardingSelection;
  } catch {
    return null;
  }
}

/** Step 1 → 2: they told us what kind of business they run. */
export async function chooseIntent(fd: FormData): Promise<void> {
  const intent = fd.get('intent') === 'brand' ? 'brand' : 'dispensary';
  // Brands have their own (much lighter) surface today; send them there rather
  // than walking them through a dispensary claim they can't complete.
  if (intent === 'brand') {
    await writeSelection({ intent: 'brand' });
    redirect('/get-started/brand');
  }
  await writeSelection({ intent: 'dispensary' });
  redirect('/get-started');
}

/** Step 2 → 3: they picked their shop out of the directory. */
export async function chooseBusiness(fd: FormData): Promise<void> {
  const slug = String(fd.get('slug') ?? '').slice(0, 200);
  if (!slug) redirect('/get-started');
  const cur = await currentSelection();
  await writeSelection({ intent: cur?.intent ?? 'dispensary', slug });
  redirect('/get-started');
}

/** Step 2 → 3, the other branch: their shop isn't listed, so they'll add it. */
export async function chooseCreateNew(): Promise<void> {
  const cur = await currentSelection();
  await writeSelection({ intent: cur?.intent ?? 'dispensary', createNew: true });
  redirect('/get-started');
}

/** Any step → back. Clearing the narrower field re-derives the earlier step. */
export async function goBack(fd: FormData): Promise<void> {
  const to = String(fd.get('to') ?? '');
  const cur = await currentSelection();
  if (to === 'intent') {
    (await cookies()).delete(ONBOARDING_COOKIE);
  } else if (to === 'business') {
    await writeSelection({ intent: cur?.intent ?? 'dispensary' });
  }
  redirect('/get-started');
}

/** Leave the wizard entirely (e.g. "I'm just shopping"). */
export async function exitOnboarding(): Promise<void> {
  (await cookies()).delete(ONBOARDING_COOKIE);
  redirect('/');
}

/**
 * Step 3, for someone already signed in as a shopper: turn this into a business
 * account. Without it the funnel dead-ends — the claim action rejects consumer
 * accounts and the dashboard bounces them, with no offered way forward.
 *
 * The DB trigger allows only consumer -> dispensary_owner on your own row (see
 * 20260724230000_self_serve_business_account.sql), so this can't escalate.
 */
export async function becomeBusinessAccount(): Promise<void> {
  const { user, profile } = await getAuth();
  if (!user) redirect('/sign-in?next=/get-started');
  if (profile?.role === 'consumer') {
    const supabase = await createClient();
    await supabase.from('profiles').update({ role: 'dispensary_owner' }).eq('id', user.id);
  }
  redirect('/get-started');
}
