'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { formError, formSuccess, fromZodError, str, type FormState } from '@/lib/forms';
import { createClient } from '@/lib/supabase/server';

const claimSchema = z.object({
  dispensary_id: z.string().uuid(),
  slug: z.string().min(1).max(120),
  message: z.string().max(2000).nullable(),
  license_number: z.string().max(120).nullable(),
});

/**
 * A dispensary_owner requests to claim an unclaimed, active listing. The DB's RLS
 * insert policy is the real gate (owner role + listing unclaimed & active); this
 * action validates input and surfaces a friendly message. Owners can re-submit
 * after a rejection (prior non-approved request is cleared first).
 */
export async function requestOwnership(_prev: FormState, fd: FormData): Promise<FormState> {
  const { user, profile } = await getAuth();
  if (!user) return formError('Please sign in to claim a listing.');
  if (profile?.role !== 'dispensary_owner') {
    return formError('Only dispensary-owner accounts can claim a listing.');
  }

  const parsed = claimSchema.safeParse({
    dispensary_id: str(fd, 'dispensary_id') ?? '',
    slug: str(fd, 'slug') ?? '',
    message: str(fd, 'message') ?? null,
    license_number: str(fd, 'license_number') ?? null,
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();

  // Claims are verified against the license on file — listings imported without
  // a license number can't be claimed until it's backfilled. (RLS enforces this
  // too; checking here surfaces a clear message instead of a policy error.)
  const { data: target } = await supabase
    .from('dispensaries')
    .select('license_number')
    .eq('id', parsed.data.dispensary_id)
    .maybeSingle();
  if (!target?.license_number) {
    return formError(
      'This listing can’t be claimed yet — we don’t have its state license on file to verify against. Check back soon.',
    );
  }

  // Clear any prior non-approved request so a rejected owner can re-submit.
  await supabase
    .from('ownership_requests')
    .delete()
    .eq('dispensary_id', parsed.data.dispensary_id)
    .eq('user_id', user.id);

  const { error } = await supabase.from('ownership_requests').insert({
    dispensary_id: parsed.data.dispensary_id,
    user_id: user.id,
    message: parsed.data.message,
    license_number: parsed.data.license_number,
  });

  if (error) {
    return formError(
      error.code === '42501' || error.code === 'PGRST301'
        ? 'This listing can no longer be claimed.'
        : error.message,
    );
  }

  revalidatePath(`/dispensary/${parsed.data.slug}`);
  return formSuccess('Claim submitted — an admin will review it shortly.');
}

/** Owner withdraws their own (not-yet-approved) claim. RLS enforces author + status. */
export async function withdrawOwnership(dispensaryId: string, slug: string): Promise<void> {
  const { user } = await getAuth();
  if (!user) return;
  const supabase = await createClient();
  await supabase
    .from('ownership_requests')
    .delete()
    .eq('dispensary_id', dispensaryId)
    .eq('user_id', user.id);
  revalidatePath(`/dispensary/${slug}`);
}
