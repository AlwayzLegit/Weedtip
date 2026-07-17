import 'server-only';
import { redirect } from 'next/navigation';
import { getAuth } from './auth';
import { createClient } from './supabase/server';

export interface AdvertiserAccess {
  userId: string;
  isAdmin: boolean;
  ownsBrand: boolean;
  /** Distinct states of the user's own listings (claimed shops). */
  shopStates: string[];
  /**
   * States the ad catalog should be scoped to, or null for no scoping
   * (admins see everything; brand owners run state/nationwide campaigns; an
   * owner with no claimed shop yet has nothing to scope by).
   */
  applicableStates: string[] | null;
}

/**
 * Gate ad-sales surfaces (rate cards, region pricing) to accounts that can
 * actually buy: dispensary owners, brand owners, and admins. Consumers have no
 * use for CPM sheets — signed-out visitors go to sign-in (and back), signed-in
 * consumers go to the listing funnel. Returns the buyer's applicable states so
 * catalogs can show only the areas relevant to their listings.
 */
export async function requireAdvertiserAccess(next: string): Promise<AdvertiserAccess> {
  const { user, profile } = await getAuth();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  const supabase = await createClient();
  const [{ data: shops }, { data: brand }] = await Promise.all([
    supabase.from('dispensaries').select('state').eq('owner_id', user.id),
    supabase.from('brands').select('id').eq('owner_id', user.id).limit(1).maybeSingle(),
  ]);
  const isAdmin = profile?.role === 'admin';
  const ownsBrand = !!brand;
  const shopStates = [...new Set((shops ?? []).map((s) => s.state))].sort();
  if (!isAdmin && !ownsBrand && profile?.role !== 'dispensary_owner') redirect('/claim');
  return {
    userId: user.id,
    isAdmin,
    ownsBrand,
    shopStates,
    applicableStates: isAdmin || ownsBrand || shopStates.length === 0 ? null : shopStates,
  };
}
