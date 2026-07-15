import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { Tables } from '@weedtip/supabase/types';
import { getAuth } from './auth';
import { createClient } from './supabase/server';

export type MemberRole = 'owner' | 'manager' | 'staff';

/**
 * Resolves the dashboard context: the signed-in user and the dispensary they can
 * manage — either the one they OWN (owner_id) or one they're an ACTIVE team
 * member of. `memberRole` is 'owner' for the actual owner, else their team role.
 *
 * Content access is enforced at the database by RLS (owns_dispensary() now
 * counts active members); this gates the UI. Money/plan and team-management
 * actions additionally require memberRole === 'owner' (see requireDispensaryOwner).
 */
export const getOwnerContext = cache(
  async (): Promise<{
    userId: string;
    role: Tables<'profiles'>['role'];
    dispensary: Tables<'dispensaries'> | null;
    memberRole: MemberRole;
  }> => {
    const { user, profile } = await getAuth();
    if (!user) redirect('/sign-in');

    const supabase = await createClient();
    let dispensary: Tables<'dispensaries'> | null = null;
    let memberRole: MemberRole = 'owner';

    const { data: owned } = await supabase
      .from('dispensaries')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at')
      .limit(1)
      .maybeSingle();
    if (owned) {
      dispensary = owned;
    } else {
      // Fall back to an active team membership.
      const { data: member } = await supabase
        .from('dispensary_members')
        .select('role, dispensary:dispensaries(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at')
        .limit(1)
        .maybeSingle();
      const md = member?.dispensary as Tables<'dispensaries'> | null;
      if (md) {
        dispensary = md;
        memberRole = member?.role === 'manager' ? 'manager' : 'staff';
      }
    }

    // Owners/admins always reach the dashboard; others only if they resolved a
    // dispensary via membership.
    if (profile?.role !== 'dispensary_owner' && profile?.role !== 'admin' && !dispensary) {
      redirect('/');
    }

    return {
      userId: user.id,
      role: (profile?.role ?? 'consumer') as Tables<'profiles'>['role'],
      dispensary,
      memberRole,
    };
  },
);

/** Like getOwnerContext, but requires a dispensary to exist (redirects to create). */
export async function requireOwnerDispensary() {
  const ctx = await getOwnerContext();
  if (!ctx.dispensary) redirect('/dashboard/listing');
  return { ...ctx, dispensary: ctx.dispensary };
}

/**
 * For owner-only actions (billing/plan, team management, deletes): a team member
 * — even a manager — is NOT the owner. Redirects non-owners back to the dashboard.
 */
export async function requireDispensaryOwner() {
  const ctx = await requireOwnerDispensary();
  if (ctx.memberRole !== 'owner') redirect('/dashboard');
  return ctx;
}
