'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { STRAIN_TYPES } from '@weedtip/shared';
import { z } from 'zod';
import { formError, fromZodError, numOpt, str, type FormState } from '@/lib/forms';
import { createClient } from '@/lib/supabase/server';

const catalogSchema = z.object({
  brand_id: z.string().uuid(),
  name: z.string().min(1).max(160),
  category_id: z.string().uuid().nullable(),
  strain_type: z.enum(STRAIN_TYPES).nullable(),
  description: z.string().max(2000).nullable(),
  image_url: z.string().url().nullable(),
  thc_percentage: z.number().min(0).max(100).nullable(),
  cbd_percentage: z.number().min(0).max(100).nullable(),
  sort_order: z.number().int().min(0).max(9999),
});

function emptyToNull(v: string | undefined): string | null {
  return v && v.trim() ? v.trim() : null;
}

export async function upsertBrandCatalogProduct(_prev: FormState, fd: FormData): Promise<FormState> {
  const strain = emptyToNull(str(fd, 'strain_type'));
  const parsed = catalogSchema.safeParse({
    brand_id: str(fd, 'brand_id'),
    name: str(fd, 'name') ?? '',
    category_id: emptyToNull(str(fd, 'category_id')),
    strain_type: strain,
    description: emptyToNull(str(fd, 'description')),
    image_url: emptyToNull(str(fd, 'image_url')),
    thc_percentage: numOpt(fd, 'thc_percentage') ?? null,
    cbd_percentage: numOpt(fd, 'cbd_percentage') ?? null,
    sort_order: numOpt(fd, 'sort_order') ?? 0,
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const id = str(fd, 'id');
  // RLS enforces that the caller owns the brand.
  const { error } = id
    ? await supabase.from('brand_products').update(parsed.data).eq('id', id)
    : await supabase.from('brand_products').insert(parsed.data);
  if (error) return formError(error.message);

  revalidatePath('/studio/catalog');
  redirect('/studio/catalog');
}

export async function deleteBrandCatalogProduct(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('brand_products').delete().eq('id', id);
  revalidatePath('/studio/catalog');
}
