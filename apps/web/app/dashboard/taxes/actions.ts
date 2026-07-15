'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { formError, formSuccess, fromZodError, str, type FormState } from '@/lib/forms';
import { canUseFeature } from '@/lib/features';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  // Percent with up to 2 decimals; stored as basis points.
  rate_percent: z
    .number({ invalid_type_error: 'Enter a rate' })
    .min(0, 'Rate must be 0 or more')
    .max(100, 'Rate can’t exceed 100%'),
  tax_type: z.enum(['sales', 'excise']),
  use_type: z.enum(['adult', 'medical', 'both']),
  enabled: z.boolean(),
});

/** Create or update a tax row for the owner's dispensary. Growth-gated. */
export async function upsertTax(_prev: FormState, fd: FormData): Promise<FormState> {
  const { dispensary } = await requireOwnerDispensary();
  if (!(await canUseFeature(dispensary.id, 'taxes'))) {
    return formError('Tax configuration is part of the Growth plan. Upgrade to set up taxes.');
  }

  const rawPercent = str(fd, 'rate_percent');
  const parsed = schema.safeParse({
    name: str(fd, 'name') ?? '',
    rate_percent: rawPercent ? Number(rawPercent) : NaN,
    tax_type: str(fd, 'tax_type') ?? 'sales',
    use_type: str(fd, 'use_type') ?? 'both',
    enabled: (str(fd, 'enabled') ?? 'true') !== 'false',
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const id = str(fd, 'id');
  const payload = {
    dispensary_id: dispensary.id,
    name: parsed.data.name,
    rate_bps: Math.round(parsed.data.rate_percent * 100),
    tax_type: parsed.data.tax_type,
    use_type: parsed.data.use_type,
    enabled: parsed.data.enabled,
  };

  const { error } = id
    ? await supabase
        .from('dispensary_taxes')
        .update(payload)
        .eq('id', id)
        .eq('dispensary_id', dispensary.id)
    : await supabase.from('dispensary_taxes').insert(payload);
  if (error) return formError(error.message);

  revalidatePath('/dashboard/taxes');
  return formSuccess(id ? 'Tax updated.' : 'Tax added.');
}

export async function deleteTax(id: string): Promise<void> {
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();
  await supabase.from('dispensary_taxes').delete().eq('id', id).eq('dispensary_id', dispensary.id);
  revalidatePath('/dashboard/taxes');
}
