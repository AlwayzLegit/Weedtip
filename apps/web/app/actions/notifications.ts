'use server';

import { revalidatePath } from 'next/cache';
import { getAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function markNotificationRead(id: string): Promise<void> {
  const { user } = await getAuth();
  if (!user) return;
  const supabase = await createClient();
  await supabase.from('notifications').update({ read: true }).eq('id', id).eq('user_id', user.id);
  revalidatePath('/notifications');
  revalidatePath('/', 'layout');
}

export async function markAllNotificationsRead(): Promise<void> {
  const { user } = await getAuth();
  if (!user) return;
  const supabase = await createClient();
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false);
  revalidatePath('/notifications');
  revalidatePath('/', 'layout');
}

export async function deleteNotification(id: string): Promise<void> {
  const { user } = await getAuth();
  if (!user) return;
  const supabase = await createClient();
  await supabase.from('notifications').delete().eq('id', id).eq('user_id', user.id);
  revalidatePath('/notifications');
  revalidatePath('/', 'layout');
}
