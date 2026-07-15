'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { FEATURES, type FeatureKey } from '@/lib/features';
import { createClient } from '@/lib/supabase/server';

const VALID = new Set<string>(FEATURES.map((f) => f.key));

/**
 * Super-admin per-account feature control. `mode`:
 *  - 'default' → remove the override (feature follows the plan)
 *  - 'on'      → force the feature ON regardless of plan
 *  - 'off'     → force the feature OFF regardless of plan
 */
export async function setFeatureOverride(
  dispensaryId: string,
  key: string,
  mode: 'default' | 'on' | 'off',
): Promise<void> {
  await requireAdmin();
  if (!VALID.has(key)) return;
  const supabase = await createClient();
  const featureKey = key as FeatureKey;

  if (mode === 'default') {
    await supabase
      .from('dispensary_feature_overrides')
      .delete()
      .eq('dispensary_id', dispensaryId)
      .eq('feature_key', featureKey);
  } else {
    await supabase.from('dispensary_feature_overrides').upsert(
      {
        dispensary_id: dispensaryId,
        feature_key: featureKey,
        enabled: mode === 'on',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'dispensary_id,feature_key' },
    );
  }

  revalidatePath(`/admin/dispensaries/${dispensaryId}`);
}
