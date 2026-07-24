import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import type { Tables } from '@weedtip/supabase/types';
import { getAuth } from './auth';
import { manageableDispensaries } from './owner';
import { createClient } from './supabase/server';

/**
 * The owner onboarding wizard.
 *
 * The design rule here: the wizard NEVER stores its own progress. Every step is
 * derived from state that already exists — are you signed in, is your account a
 * business account, have you picked a business, is there a claim on it, do you
 * own a listing yet. That means it is resumable by construction: an owner who
 * closes the tab during the email-confirmation wait, or comes back three days
 * later from the approval email, lands exactly where they left off without a
 * half-finished wizard row to reconcile.
 *
 * The one thing that genuinely can't be derived is which business they picked
 * BEFORE they had an account, so that (and only that) rides in a cookie across
 * the sign-up round trip. Losing it costs one search, not the whole flow.
 */

/** Which business type the owner said they're here for. */
export type OwnerIntent = 'dispensary' | 'brand';

/** The pre-auth selection carried across the sign-up + email-confirm round trip. */
export type OnboardingSelection = {
  intent: OwnerIntent;
  /** Slug of the listing they chose to claim, if they picked one. */
  slug?: string;
  /** They looked and couldn't find their shop — they're creating a new listing. */
  createNew?: boolean;
};

export const ONBOARDING_COOKIE = 'wt_onboarding';

/** Steps in order. `done` is terminal; everything else renders a step screen. */
export const ONBOARDING_STEPS = [
  'intent',
  'business',
  'account',
  'verify',
  'plan',
  'done',
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Human labels for the progress rail. */
export const STEP_LABELS: Record<Exclude<OnboardingStep, 'done'>, string> = {
  intent: 'What you run',
  business: 'Find your business',
  account: 'Your account',
  verify: 'Verify ownership',
  plan: 'Choose a plan',
};

export type ClaimTarget = Pick<
  Tables<'dispensaries'>,
  | 'id'
  | 'slug'
  | 'name'
  | 'city'
  | 'state'
  | 'address'
  | 'logo_url'
  | 'cover_image_url'
  | 'owner_id'
  | 'license_number'
  | 'legal_name'
  | 'website'
  | 'phone'
>;

export type OnboardingState = {
  step: OnboardingStep;
  selection: OnboardingSelection | null;
  signedIn: boolean;
  /** True once the profile role can actually submit a claim. */
  isOwnerAccount: boolean;
  /** The listing they chose, resolved from the slug. */
  target: ClaimTarget | null;
  /** Their claim on that listing, if any. */
  claimStatus: 'pending' | 'approved' | 'rejected' | null;
  /** A listing they already own/manage — the flow is finished for them. */
  ownedSlug: string | null;
  ownedName: string | null;
  /** Whether they've already picked a plan preference on the submitted claim. */
  planPreference: 'free' | 'paid' | null;
};

const SELECT =
  'id,slug,name,city,state,address,logo_url,cover_image_url,owner_id,license_number,legal_name,website,phone';

/** Read the pre-auth selection cookie, tolerating anything malformed. */
export async function readSelection(): Promise<OnboardingSelection | null> {
  const raw = (await cookies()).get(ONBOARDING_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as OnboardingSelection;
    if (parsed.intent !== 'dispensary' && parsed.intent !== 'brand') return null;
    return {
      intent: parsed.intent,
      slug: typeof parsed.slug === 'string' ? parsed.slug.slice(0, 200) : undefined,
      createNew: parsed.createNew === true,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve where the owner is in the flow. Order matters: the earliest unmet
 * precondition wins, so a signed-in owner who never picked a shop still gets
 * the picker rather than an empty claim form.
 */
export const getOnboardingState = cache(
  async function getOnboardingState(): Promise<OnboardingState> {
    const selection = await readSelection();
    const { user, profile } = await getAuth();
    const signedIn = !!user;
    const isOwnerAccount = profile?.role === 'dispensary_owner' || profile?.role === 'admin';

    const supabase = await createClient();

    // Already managing a listing? Then onboarding is over — the dashboard is the
    // right home, and the wizard should say so rather than restart them.
    if (user) {
      const owned = await manageableDispensaries(supabase, user.id);
      const first = owned[0];
      if (first) {
        return {
          step: 'done',
          selection,
          signedIn,
          isOwnerAccount,
          target: null,
          claimStatus: null,
          ownedSlug: first.dispensary.slug,
          ownedName: first.dispensary.name,
          planPreference: null,
        };
      }
    }

    // Resolve the chosen listing, if they picked one.
    let target: ClaimTarget | null = null;
    if (selection?.slug) {
      const { data } = await supabase
        .from('dispensaries')
        .select(SELECT)
        .eq('slug', selection.slug)
        .eq('status', 'active')
        .maybeSingle();
      target = data ?? null;
    }

    // Their claim on it, if any — this is what turns the wizard into a status page.
    let claimStatus: OnboardingState['claimStatus'] = null;
    let planPreference: OnboardingState['planPreference'] = null;
    if (user && target) {
      const { data } = await supabase
        .from('ownership_requests')
        .select('status, plan_preference')
        .eq('dispensary_id', target.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        claimStatus = data.status as OnboardingState['claimStatus'];
        planPreference = (data.plan_preference as 'free' | 'paid' | null) ?? null;
      }
    }

    const base = {
      selection,
      signedIn,
      isOwnerAccount,
      target,
      claimStatus,
      ownedSlug: null,
      ownedName: null,
      planPreference,
    };

    // A submitted claim is the end of the self-serve road — everything after it
    // waits on a human, so show status rather than another form.
    if (claimStatus === 'pending' || claimStatus === 'approved') {
      return { ...base, step: 'plan' };
    }
    if (!selection) return { ...base, step: 'intent' };
    if (!selection.slug && !selection.createNew) return { ...base, step: 'business' };
    if (!signedIn || !isOwnerAccount) return { ...base, step: 'account' };
    return { ...base, step: 'verify' };
  },
);

/** Zero-based index for the progress rail; `done` sits past the end. */
export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}
