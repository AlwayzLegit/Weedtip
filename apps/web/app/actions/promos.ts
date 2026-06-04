'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { type FormState, bool, formError, fromZodError, numOpt, str } from '@/lib/forms';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

const MAX_PROMOS = 10;

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(120),
  description: z.string().max(1000).nullable(),
  image_url: z.string().url('Enter a valid URL').nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date').nullable(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date').nullable(),
  sort_order: z.number().int().min(0).max(999),
  is_active: z.boolean(),
});

export async function upsertPromo(_prev: FormState, fd: FormData): Promise<FormState> {
  const { dispensary } = await requireOwnerDispensary();
  const parsed = schema.safeParse({
    title: str(fd, 'title') ?? '',
    description: str(fd, 'description') ?? null,
    image_url: str(fd, 'image_url') ?? null,
    start_date: str(fd, 'start_date') ?? null,
    end_date: str(fd, 'end_date') ?? null,
    sort_order: numOpt(fd, 'sort_order') ?? 0,
    is_active: bool(fd, 'is_active'),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const id = str(fd, 'id');

  if (!id) {
    const { count } = await supabase
      .from('dispensary_promos')
      .select('id', { count: 'exact', head: true })
      .eq('dispensary_id', dispensary.id);
    if ((count ?? 0) >= MAX_PROMOS) {
      return formError(`You can have at most ${MAX_PROMOS} in-store promos.`);
    }
  }

  const payload = { ...parsed.data, dispensary_id: dispensary.id };
  const { error } = id
    ? await supabase
        .from('dispensary_promos')
        .update(payload)
        .eq('id', id)
        .eq('dispensary_id', dispensary.id)
    : await supabase.from('dispensary_promos').insert(payload);
  if (error) return formError(error.message);

  revalidatePath('/dashboard/promos');
  revalidatePath(`/dispensary/${dispensary.slug}`);
  redirect('/dashboard/promos');
}

export async function deletePromo(id: string): Promise<void> {
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();
  await supabase
    .from('dispensary_promos')
    .delete()
    .eq('id', id)
    .eq('dispensary_id', dispensary.id);
  revalidatePath('/dashboard/promos');
  revalidatePath(`/dispensary/${dispensary.slug}`);
}
