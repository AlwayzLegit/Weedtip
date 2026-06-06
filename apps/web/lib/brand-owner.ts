import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { Tables } from '@weedtip/supabase/types';
import { getAuth } from './auth';
import { createClient } from './supabase/server';

/**
 * Resolves the Brand Studio context: the signed-in user and every brand they
 * own. Any user can own a brand (via the claim flow), independent of the
 * dispensary-owner role — so this gates the studio on brand ownership, not role.
 * Redirects unauthenticated users to sign-in and brand-less users to /brands.
 *
 * As with the owner dashboard, this gates the UI while RLS enforces access at
 * the database for every read/write.
 */
export const getBrandOwnerContext = cache(
  async (): Promise<{ userId: string; brands: Tables<'brands'>[] }> => {
    const { user } = await getAuth();
    if (!user) redirect('/sign-in');

    const supabase = await createClient();
    const { data: brands } = await supabase
      .from('brands')
      .select('*')
      .eq('owner_id', user.id)
      .order('name');

    if (!brands || brands.length === 0) redirect('/brands');
    return { userId: user.id, brands };
  },
);

/** Lightweight check for nav/menu rendering — does this user own any brand? */
export async function ownsAnyBrand(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('brands')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId);
  return (count ?? 0) > 0;
}
