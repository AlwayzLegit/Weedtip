'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { canUseFeature } from '@/lib/features';
import { EMPTY_FORM_STATE, formError, formSuccess, type FormState } from '@/lib/forms';
import { runMenuSync } from '@/lib/menu-sync';
import { requireOwnerDispensary } from '@/lib/owner';
import { BASIC_UPGRADE_MESSAGE } from '@/lib/plan';
import { createClient } from '@/lib/supabase/server';

export { EMPTY_FORM_STATE };

const sourceSchema = z.object({
  provider: z.enum(['generic_json', 'csv_url']),
  feed_url: z
    .string()
    .url('Enter a valid URL.')
    .startsWith('https://', 'The feed must be served over https.')
    .max(2000),
  auto_sync: z.boolean(),
});

/** Create or update the shop's single menu feed connection. */
export async function saveMenuSource(_prev: FormState, fd: FormData): Promise<FormState> {
  const { dispensary } = await requireOwnerDispensary();
  // Syncing an existing store/POS menu is a Basic-tier feature; adding products
  // by hand stays free.
  if (!(await canUseFeature(dispensary.id, 'bulk_import'))) return formError(BASIC_UPGRADE_MESSAGE);
  const parsed = sourceSchema.safeParse({
    provider: fd.get('provider'),
    feed_url: String(fd.get('feed_url') ?? '').trim(),
    auto_sync: fd.get('auto_sync') === 'on',
  });
  if (!parsed.success) {
    return formError(parsed.error.errors[0]?.message ?? 'Check the feed settings.');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('menu_sources').upsert(
    {
      dispensary_id: dispensary.id,
      provider: parsed.data.provider,
      feed_url: parsed.data.feed_url,
      auto_sync: parsed.data.auto_sync,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'dispensary_id' },
  );
  if (error) return formError(error.message);

  revalidatePath('/dashboard/products/sync');
  return formSuccess('Feed saved. Run a sync to import your menu.');
}

/** Remove the feed connection (imported products stay). */
export async function deleteMenuSource(): Promise<void> {
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();
  await supabase.from('menu_sources').delete().eq('dispensary_id', dispensary.id);
  revalidatePath('/dashboard/products/sync');
}

/** Run the sync now with the owner's own session (RLS enforces scope). */
export async function syncMenuNow(_prev: FormState, _fd: FormData): Promise<FormState> {
  const { dispensary } = await requireOwnerDispensary();
  if (!(await canUseFeature(dispensary.id, 'bulk_import'))) return formError(BASIC_UPGRADE_MESSAGE);
  const supabase = await createClient();

  const { data: source } = await supabase
    .from('menu_sources')
    .select('id,dispensary_id,provider,feed_url,status')
    .eq('dispensary_id', dispensary.id)
    .maybeSingle();
  if (!source) return formError('Connect a feed first.');
  if (source.status === 'syncing') return formError('A sync is already running.');

  const result = await runMenuSync(supabase, source);
  revalidatePath('/dashboard/products/sync');
  revalidatePath('/dashboard/products');
  if (!result.ok) return formError(result.error ?? 'Sync failed.');
  const skipped = result.skipped.length
    ? ` Skipped ${result.skipped.length}: ${result.skipped.slice(0, 3).join('; ')}${result.skipped.length > 3 ? '…' : ''}`
    : '';
  return formSuccess(
    `Imported ${result.imported} product${result.imported === 1 ? '' : 's'}.${skipped}`,
  );
}
