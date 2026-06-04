'use server';

import { revalidatePath } from 'next/cache';
import { type FormState, formError, formSuccess, str } from '@/lib/forms';
import { createClient } from '@/lib/supabase/server';

/** Owner posts an update; the RPC fans it out to followers as notifications. */
export async function postDispensaryUpdate(_prev: FormState, fd: FormData): Promise<FormState> {
  const dispensaryId = str(fd, 'dispensary_id');
  const title = str(fd, 'title');
  if (!dispensaryId) return formError('Missing dispensary.');
  if (!title) return formError('An update needs a title.');

  const supabase = await createClient();
  const { error } = await supabase.rpc('post_dispensary_update', {
    p_dispensary_id: dispensaryId,
    p_title: title,
    p_body: str(fd, 'body') ?? '',
  });
  if (error) return formError(error.message);

  revalidatePath('/dashboard/updates');
  return formSuccess('Update posted to your followers.');
}

export async function deleteDispensaryUpdate(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('dispensary_updates').delete().eq('id', id);
  revalidatePath('/dashboard/updates');
}
