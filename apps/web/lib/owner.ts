import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@weedtip/supabase/types';
import { getAuth } from './auth';
import { createClient } from './supabase/server';

export type MemberRole = 'owner' | 'manager' | 'staff';

/** Cookie holding the id of the dispensary the owner is currently managing. */
export const ACTIVE_DISPENSARY_COOKIE = 'wt_dispensary';

export type ManageableDispensary = { dispensary: Tables<'dispensaries'>; role: MemberRole };

/**
 * Every dispensary the user can manage: the ones they OWN (owner_id), plus any
 * they're an ACTIVE team member of. Owned listings come first, each ordered by
 * creation. A user can own more than one listing (e.g. a small chain), so this
 * is a list, not a single row.
 */
export async function manageableDispensaries(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ManageableDispensary[]> {
  const [{ data: owned }, { data: members }] = await Promise.all([
    supabase.from('dispensaries').select('*').eq('owner_id', userId).order('created_at'),
    supabase
      .from('dispensary_members')
      .select('role, dispensary:dispensaries(*)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at'),
  ]);

  const ownedList: ManageableDispensary[] = (owned ?? []).map((d) => ({
    dispensary: d,
    role: 'owner',
  }));
  const ownedIds = new Set(ownedList.map((o) => o.dispensary.id));

  const memberList: ManageableDispensary[] = (members ?? [])
    .map((m) => ({
      dispensary: m.dispensary as Tables<'dispensaries'> | null,
      role: (m.role === 'manager' ? 'manager' : 'staff') as MemberRole,
    }))
    .filter((m): m is ManageableDispensary => !!m.dispensary && !ownedIds.has(m.dispensary.id));

  return [...ownedList, ...memberList];
}

/** Pick the active dispensary from the cookie, falling back to the first. */
function pickActive(list: ManageableDispensary[], cookieId: string | undefined): ManageableDispensary | null {
  if (list.length === 0) return null;
  return list.find((x) => x.dispensary.id === cookieId) ?? list[0]!;
}

/**
 * Resolves the dashboard context: the signed-in user and the dispensary they're
 * currently managing (the cookie-selected one, else their first). `dispensaries`
 * lists everything they can switch between. Content access is enforced at the DB
 * by RLS; this gates the UI. Memoized per request.
 */
export const getOwnerContext = cache(
  async (): Promise<{
    userId: string;
    role: Tables<'profiles'>['role'];
    dispensary: Tables<'dispensaries'> | null;
    memberRole: MemberRole;
    dispensaries: { id: string; name: string; slug: string; role: MemberRole }[];
  }> => {
    const { user, profile } = await getAuth();
    if (!user) redirect('/sign-in');

    const supabase = await createClient();
    const list = await manageableDispensaries(supabase, user.id);
    const cookieId = (await cookies()).get(ACTIVE_DISPENSARY_COOKIE)?.value;
    const active = pickActive(list, cookieId);

    // Owners/admins always reach the dashboard; others only via a membership.
    if (profile?.role !== 'dispensary_owner' && profile?.role !== 'admin' && !active) {
      redirect('/');
    }

    return {
      userId: user.id,
      role: (profile?.role ?? 'consumer') as Tables<'profiles'>['role'],
      dispensary: active?.dispensary ?? null,
      memberRole: active?.role ?? 'owner',
      dispensaries: list.map((x) => ({
        id: x.dispensary.id,
        name: x.dispensary.name,
        slug: x.dispensary.slug,
        role: x.role,
      })),
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
