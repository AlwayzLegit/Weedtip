import 'server-only';
import { tierFromRank, type PlanTier } from './plan';
import { createClient } from './supabase/server';
import { createServiceClient } from './supabase/service';

/**
 * The admin ownership roster: every user who owns at least one dispensary or
 * brand, with the assets they own and each shop's effective plan tier.
 *
 * Ownership was previously scattered — the dispensary detail page only said
 * "claimed/unclaimed", brands showed no owner at all, and nothing correlated a
 * user to ALL of their assets. This is the single source for that view.
 *
 * Owner emails live in auth.users (not `profiles`, and not exposed to PostgREST),
 * so they're resolved with the service client. Admin-gated callers only.
 */
export type OwnedDispensary = {
  id: string;
  name: string;
  slug: string;
  status: string;
  city: string | null;
  state: string | null;
  grandfathered: boolean;
  tier: PlanTier;
  planName: string | null;
};

export type OwnedBrand = {
  id: string;
  name: string;
  slug: string;
  status: string | null;
  grandfathered: boolean;
  tier: PlanTier;
};

export type OwnerRow = {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: string;
  dispensaries: OwnedDispensary[];
  brands: OwnedBrand[];
};

export type OwnershipRoster = {
  owners: OwnerRow[];
  claimedDispensaries: number;
  unclaimedDispensaries: number;
  ownedBrands: number;
  unownedBrands: number;
};

export async function getOwnershipRoster(): Promise<OwnershipRoster> {
  const supabase = await createClient();

  const [{ data: disps }, { data: brands }, { count: unclaimed }, { count: unownedBrands }] =
    await Promise.all([
      supabase
        .from('dispensaries')
        .select('id,name,slug,status,city,state,grandfathered,owner_id')
        .not('owner_id', 'is', null)
        .order('name'),
      supabase
        .from('brands')
        .select('id,name,slug,status,owner_id,grandfathered')
        .not('owner_id', 'is', null)
        .order('name'),
      supabase.from('dispensaries').select('id', { count: 'exact', head: true }).is('owner_id', null),
      supabase.from('brands').select('id', { count: 'exact', head: true }).is('owner_id', null),
    ]);

  const dispRows = disps ?? [];
  const brandRows = brands ?? [];
  const dispIds = dispRows.map((d) => d.id);

  // Effective tier = best of active subscription and the grandfathered floor —
  // mirrors the dispensary_tier() RPC, batched here to avoid N round-trips.
  const subMap = new Map<string, { tier: number; name: string }>();
  if (dispIds.length > 0) {
    const { data: subs } = await supabase
      .from('dispensary_subscriptions')
      .select('dispensary_id,status,current_period_end,plan:plans(tier,name)')
      .in('dispensary_id', dispIds);
    for (const s of subs ?? []) {
      const plan = s.plan as { tier: number; name: string } | null;
      const live =
        s.status === 'active' &&
        (!s.current_period_end || new Date(s.current_period_end) >= new Date());
      if (plan && live) subMap.set(s.dispensary_id, { tier: plan.tier, name: plan.name });
    }
  }

  // Same shape for brands — mirrors brand_tier(), batched.
  const brandSubMap = new Map<string, number>();
  const brandIds = brandRows.map((b) => b.id);
  if (brandIds.length > 0) {
    const { data: bsubs } = await supabase
      .from('brand_subscriptions')
      .select('brand_id,status,current_period_end,plan:plans(tier)')
      .in('brand_id', brandIds);
    for (const s of bsubs ?? []) {
      const plan = s.plan as { tier: number } | null;
      const live =
        s.status === 'active' &&
        (!s.current_period_end || new Date(s.current_period_end) >= new Date());
      if (plan && live) brandSubMap.set(s.brand_id, plan.tier);
    }
  }

  const ownerIds = [
    ...new Set([
      ...dispRows.map((d) => d.owner_id).filter((v): v is string => !!v),
      ...brandRows.map((b) => b.owner_id).filter((v): v is string => !!v),
    ]),
  ];

  const profMap = new Map<string, { display_name: string | null; role: string }>();
  if (ownerIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id,display_name,role')
      .in('id', ownerIds);
    for (const p of profs ?? []) profMap.set(p.id, { display_name: p.display_name, role: p.role });
  }

  const emails = new Map<string, string>();
  if (ownerIds.length > 0) {
    const service = createServiceClient();
    await Promise.all(
      ownerIds.map(async (id) => {
        try {
          const { data } = await service.auth.admin.getUserById(id);
          if (data?.user?.email) emails.set(id, data.user.email);
        } catch {
          /* email is best-effort — the roster still renders without it */
        }
      }),
    );
  }

  const owners: OwnerRow[] = ownerIds
    .map((id) => {
      const p = profMap.get(id);
      return {
        userId: id,
        email: emails.get(id) ?? null,
        displayName: p?.display_name ?? null,
        role: p?.role ?? 'consumer',
        dispensaries: dispRows
          .filter((d) => d.owner_id === id)
          .map((d) => {
            const sub = subMap.get(d.id);
            const rank = Math.max(sub?.tier ?? 0, d.grandfathered ? 1 : 0);
            return {
              id: d.id,
              name: d.name,
              slug: d.slug,
              status: d.status,
              city: d.city,
              state: d.state,
              grandfathered: d.grandfathered,
              tier: tierFromRank(rank),
              planName: sub?.name ?? null,
            };
          }),
        brands: brandRows
          .filter((b) => b.owner_id === id)
          .map((b) => {
            const rank = Math.max(brandSubMap.get(b.id) ?? 0, b.grandfathered ? 1 : 0);
            return {
              id: b.id,
              name: b.name,
              slug: b.slug,
              status: b.status,
              grandfathered: b.grandfathered,
              tier: tierFromRank(rank),
            };
          }),
      };
    })
    .sort(
      (a, b) =>
        b.dispensaries.length + b.brands.length - (a.dispensaries.length + a.brands.length) ||
        (a.email ?? '').localeCompare(b.email ?? ''),
    );

  return {
    owners,
    claimedDispensaries: dispRows.length,
    unclaimedDispensaries: unclaimed ?? 0,
    ownedBrands: brandRows.length,
    unownedBrands: unownedBrands ?? 0,
  };
}
