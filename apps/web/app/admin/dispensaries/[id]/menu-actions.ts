'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { EMPTY_FORM_STATE, formError, formSuccess, type FormState } from '@/lib/forms';
import { buildCategoryMap, parseProductsCsv } from '@/lib/product-csv';
import { createServiceClient } from '@/lib/supabase/service';

export { EMPTY_FORM_STATE };

/**
 * Admin menu seeding: import a product CSV onto ANY dispensary — including
 * unclaimed listings, which the owner-gated import can never reach. Uses the
 * service client so RLS doesn't block writing to a shop the admin doesn't own,
 * and the shared parser so the format matches the owner import exactly. Rows
 * upsert by (dispensary_id, slug), so re-seeding updates in place.
 */
export async function adminSeedMenu(
  dispensaryId: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  await requireAdmin();
  const csv = String(fd.get('csv') ?? '');

  const service = createServiceClient();
  const { data: shop } = await service
    .from('dispensaries')
    .select('id, slug')
    .eq('id', dispensaryId)
    .maybeSingle();
  if (!shop) return formError('Dispensary not found.');

  const { data: categories } = await service.from('categories').select('id,slug,name');
  const parsed = parseProductsCsv(csv, dispensaryId, buildCategoryMap(categories));
  if (!parsed.ok) return formError(parsed.message);
  const { rows, errors } = parsed;
  if (rows.length === 0) {
    return formError(`No valid rows. ${errors.slice(0, 5).join('; ')}`);
  }

  const { error } = await service
    .from('products')
    .upsert(rows, { onConflict: 'dispensary_id,slug' });
  if (error) return formError(error.message);

  revalidatePath(`/admin/dispensaries/${dispensaryId}`);
  revalidatePath(`/dispensary/${shop.slug}`);
  const skipped = errors.length
    ? ` Skipped ${errors.length}: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '…' : ''}`
    : '';
  return formSuccess(`Seeded ${rows.length} product${rows.length === 1 ? '' : 's'}.${skipped}`);
}
