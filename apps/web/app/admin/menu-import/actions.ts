'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { EMPTY_FORM_STATE, formError, formSuccess, type FormState } from '@/lib/forms';
import {
  buildCategoryMap,
  parseBulkProductsCsv,
  type ProductInsert,
} from '@/lib/product-csv';
import { createServiceClient } from '@/lib/supabase/service';

export { EMPTY_FORM_STATE };

const CHUNK = 500;

/**
 * Bulk admin menu seeding: one CSV covering MANY shops, each row keyed by a
 * `license` (→ dispensaries.license_number) or `slug` column. Resolves keys to
 * ids, then upserts every product through the service client (RLS-exempt) so
 * unclaimed listings are populated too. Upserts by (dispensary_id, slug);
 * re-running updates in place. Reports matched shops, products written, and
 * any keys that didn't resolve.
 */
export async function adminBulkSeedMenu(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const csv = String(fd.get('csv') ?? '');

  const service = createServiceClient();
  const { data: categories } = await service.from('categories').select('id,slug,name');
  const parsed = parseBulkProductsCsv(csv, buildCategoryMap(categories));
  if (!parsed.ok) return formError(parsed.message);
  const { rows, errors, keyColumn } = parsed;
  if (rows.length === 0) {
    return formError(`No valid rows. ${errors.slice(0, 5).join('; ')}`);
  }

  // Resolve distinct shop keys → dispensary ids in one query.
  const keys = [...new Set(rows.map((r) => r.shopKey))];
  const col = keyColumn === 'license' ? 'license_number' : 'slug';
  const keyToId = new Map<string, string>();
  // Chunk the IN() list so a huge upload can't exceed the request cap.
  for (let i = 0; i < keys.length; i += 1000) {
    const { data: shops } = await service
      .from('dispensaries')
      .select(`id, ${col}`)
      .in(col, keys.slice(i, i + 1000));
    for (const s of shops ?? []) {
      const k = (s as Record<string, string | null>)[col];
      if (k) keyToId.set(k, s.id);
    }
  }

  const unresolved = new Set<string>();
  const inserts: ProductInsert[] = [];
  for (const r of rows) {
    const dispensaryId = keyToId.get(r.shopKey);
    if (!dispensaryId) {
      unresolved.add(r.shopKey);
      continue;
    }
    inserts.push({ dispensary_id: dispensaryId, ...r.fields });
  }
  if (inserts.length === 0) {
    return formError(
      `No rows matched a shop by ${keyColumn}. Check the ${keyColumn} values against your listings.`,
    );
  }

  const shopsTouched = new Set(inserts.map((r) => r.dispensary_id));
  const slugsToRevalidate = new Set<string>();
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const { error } = await service
      .from('products')
      .upsert(inserts.slice(i, i + CHUNK), { onConflict: 'dispensary_id,slug' });
    if (error) return formError(`Import failed after ${i} rows: ${error.message}`);
  }

  // Revalidate the touched storefronts (cap the fan-out so a giant import
  // doesn't trigger tens of thousands of revalidations).
  const touchedIds = [...shopsTouched].slice(0, 200);
  if (touchedIds.length) {
    const { data: touched } = await service
      .from('dispensaries')
      .select('slug')
      .in('id', touchedIds);
    for (const t of touched ?? []) slugsToRevalidate.add(t.slug);
  }
  for (const slug of slugsToRevalidate) revalidatePath(`/dispensary/${slug}`);
  revalidatePath('/admin/menu-import');

  const skips: string[] = [];
  if (unresolved.size) skips.push(`${unresolved.size} unmatched ${keyColumn}s`);
  if (errors.length) skips.push(`${errors.length} bad rows`);
  const detail = skips.length ? ` Skipped: ${skips.join(', ')}.` : '';
  return formSuccess(
    `Seeded ${inserts.length} products across ${shopsTouched.size} shops.${detail}`,
  );
}
