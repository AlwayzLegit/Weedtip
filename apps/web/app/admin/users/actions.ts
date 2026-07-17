'use server';

import { revalidatePath } from 'next/cache';
import { USER_ROLES } from '@weedtip/shared';
import { requireAdmin } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/service';

/** Admin-only role change. Admins can't demote themselves (lock-out guard). */
export async function setUserRole(userId: string, role: string): Promise<void> {
  const { userId: adminId } = await requireAdmin();
  if (!(USER_ROLES as readonly string[]).includes(role)) return;
  if (userId === adminId && role !== 'admin') return;
  const service = createServiceClient();
  await service.from('profiles').update({ role: role as never }).eq('id', userId);
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath('/admin/users');
}
