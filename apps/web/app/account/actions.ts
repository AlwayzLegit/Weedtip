'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { profileUpdateSchema } from '@weedtip/shared';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { formError, formSuccess, fromZodError, str, type FormState } from '@/lib/forms';

export async function updateProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = profileUpdateSchema.safeParse({
    display_name: str(fd, 'display_name') ?? null,
    avatar_url: str(fd, 'avatar_url') ?? null,
    date_of_birth: str(fd, 'date_of_birth') ?? null,
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return formError('You must be signed in.');

  const { error } = await supabase.from('profiles').update(parsed.data).eq('id', user.id);
  if (error) return formError(error.message);

  revalidatePath('/account');
  return formSuccess('Profile saved.');
}

/**
 * Permanently delete the signed-in user's account. Cascades remove their profile,
 * reviews, favorites, and notifications; owned dispensaries are unlinked. Blocked
 * if the user has order history (orders FK is ON DELETE RESTRICT) — those require
 * support to handle. Uses the service-role Auth admin API.
 */
export async function deleteAccount(): Promise<{ error?: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be signed in.' };

  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  if ((count ?? 0) > 0) {
    return {
      error:
        'Your account has order history and can’t be deleted automatically. Please contact support to remove it.',
    };
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return { error: 'Account deletion is temporarily unavailable. Please contact support.' };
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { error: error.message };

  await supabase.auth.signOut();
  redirect('/');
}
