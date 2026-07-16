'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { formError, formSuccess, str, type FormState } from '@/lib/forms';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Admin ownership controls. Ownership could previously only change by approving
 * a claim; these let an admin transfer or release it directly.
 *
 * Writes go through the authed admin client so RLS + the
 * enforce_dispensary_admin_fields trigger still apply (is_admin() is true).
 */

/** Resolve an email to a Weedtip user id (auth.users isn't queryable via PostgREST). */
async function findUserIdByEmail(email: string): Promise<string | null> {
  const service = createServiceClient();
  const target = email.trim().toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) return null;
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < perPage) return null; // last page
  }
  return null;
}

/** Toggle the grandfather flag (free tier-1 access for pre-Basic claims). */
export async function setGrandfathered(dispensaryId: string, enabled: boolean): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from('dispensaries').update({ grandfathered: enabled }).eq('id', dispensaryId);
  revalidatePath('/admin/ownership');
  revalidatePath(`/admin/dispensaries/${dispensaryId}`);
}

/** Unclaim a listing — it returns to the unowned pool. */
export async function releaseDispensaryOwner(dispensaryId: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from('dispensaries').update({ owner_id: null }).eq('id', dispensaryId);
  revalidatePath('/admin/ownership');
}

/** Release a brand back to unowned. */
export async function releaseBrandOwner(brandId: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from('brands').update({ owner_id: null }).eq('id', brandId);
  revalidatePath('/admin/ownership');
}

/** Transfer a dispensary or brand to the account with the given email. */
export async function transferOwnership(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const kind = str(fd, 'kind');
  const id = str(fd, 'id');
  const email = str(fd, 'email');
  if (!id || !email) return formError('Enter the new owner’s email.');
  if (kind !== 'dispensary' && kind !== 'brand') return formError('Unknown record type.');

  const userId = await findUserIdByEmail(email);
  if (!userId) return formError(`No Weedtip account found for ${email}.`);

  const supabase = await createClient();
  const { error } =
    kind === 'dispensary'
      ? await supabase.from('dispensaries').update({ owner_id: userId }).eq('id', id)
      : await supabase.from('brands').update({ owner_id: userId }).eq('id', id);
  if (error) return formError(error.message);

  revalidatePath('/admin/ownership');
  return formSuccess(`Transferred to ${email}.`);
}
