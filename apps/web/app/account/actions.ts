'use server';

import { revalidatePath } from 'next/cache';
import { profileUpdateSchema } from '@weedtip/shared';
import { createClient } from '@/lib/supabase/server';
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
