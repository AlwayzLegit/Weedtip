import 'server-only';
import { redirect } from 'next/navigation';
import { getAuth } from './auth';
import { createClient } from './supabase/server';

/**
 * Gate ad-sales surfaces (rate cards, region pricing) to accounts that can
 * actually buy: dispensary owners, brand owners, and admins. Consumers have no
 * use for CPM sheets — signed-out visitors go to sign-in (and back), signed-in
 * consumers go to the listing funnel.
 */
export async function requireAdvertiserAccess(next: string): Promise<void> {
  const { user, profile } = await getAuth();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if (profile?.role === 'dispensary_owner' || profile?.role === 'admin') return;
  const supabase = await createClient();
  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle();
  if (brand) return;
  redirect('/claim');
}
