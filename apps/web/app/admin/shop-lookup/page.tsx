import type { Metadata } from 'next';
import Link from 'next/link';
import { Crown, MapPin, Megaphone, Search, Sparkles, Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  getSlotAvailability,
  resolveGeo,
  type RegionAvailability,
  type ResolvedGeo,
} from '@/lib/ad-serving';
import { formatPrice } from '@/lib/format';
import { getDispensaryTier } from '@/lib/plan';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Shop lookup · Admin' };

const REGION_TIER_LABEL: Record<string, string> = {
  A_PLUS: 'A+',
  A: 'A',
  B_PLUS: 'B+',
  B: 'B',
};

/**
 * "Type a shop name and tell me everything that applies to it."
 *
 * One admin answer for: which ad region the listing falls in, which zones that
 * region covers on the map, what advertising is live/available for it, and what
 * merchandising is running in that region. Previously this meant cross-checking
 * the ad desk, the merch desk, and the region console by hand.
 */
export default async function AdminShopLookup({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; id?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? '').trim();
  const supabase = await createClient();

  // Candidate shops for the typed name (or the explicitly selected one).
  const matches = query
    ? ((
        await supabase
          .from('dispensaries')
          .select('id,name,slug,city,state,status,latitude,longitude')
          .or(`name.ilike.%${query}%,city.ilike.%${query}%,slug.ilike.%${query}%`)
          .order('name')
          .limit(25)
      ).data ?? [])
    : [];
  const selectedId = sp.id ?? (matches.length === 1 ? matches[0]!.id : undefined);
  const shop = selectedId ? (matches.find((m) => m.id === selectedId) ?? null) : null;

  type RegionRow = {
    id: string;
    slug: string;
    name: string;
    tier: string;
    market: { name: string; state: string } | null;
  };

  // Everything that applies to the selected shop.
  let geo: ResolvedGeo | null = null;
  let zoneNames: string[] = [];
  let region: RegionRow | null = null;
  let availability: RegionAvailability | null = null;
  let ownSlots: {
    id: string;
    status: string;
    isHouse: boolean;
    priceCents: number;
    slotType: string;
    regionName: string;
  }[] = [];
  let merch: {
    id: string;
    slotType: string;
    status: string;
    isHouse: boolean;
    label: string;
    owner: string | null;
  }[] = [];
  let tier: Awaited<ReturnType<typeof getDispensaryTier>> = 'free';
  let planName: string | null = null;

  if (shop) {
    tier = await getDispensaryTier(shop.id);
    const { data: sub } = await supabase
      .from('dispensary_subscriptions')
      .select('status, plan:plans(name, price_cents)')
      .eq('dispensary_id', shop.id)
      .maybeSingle();
    const p = sub?.plan as { name: string; price_cents: number } | null;
    planName = p
      ? `${p.name}${p.price_cents > 0 ? ` · ${formatPrice(p.price_cents)}/mo` : ''}`
      : null;

    if (typeof shop.latitude === 'number' && typeof shop.longitude === 'number') {
      geo = await resolveGeo(shop.longitude, shop.latitude);
    }

    if (geo) {
      const [{ data: regionRow }, { data: zoneRows }, avail] = await Promise.all([
        supabase
          .from('ad_regions')
          .select('id, slug, name, tier, market:ad_markets(name, state)')
          .eq('id', geo.regionId)
          .maybeSingle(),
        supabase.rpc('ad_region_zone_names'),
        getSlotAvailability(),
      ]);
      region = (regionRow as RegionRow | null) ?? null;
      zoneNames =
        (zoneRows ?? []).find((z: { region_id: string }) => z.region_id === geo!.regionId)
          ?.zone_names ?? [];
      availability = avail.get(geo.regionId) ?? null;

      // Merchandising running in this region (brand / product / hero slots).
      const { data: merchRows } = await supabase
        .from('ad_subscriptions')
        .select(
          'id,status,is_house,slot:ad_slots!inner(slot_type,region_id),brand:brands(name),product:products(name),dispensary:dispensaries(name)',
        )
        .eq('slot.region_id', geo.regionId)
        .in('slot.slot_type', ['brand', 'product', 'hero'])
        .in('status', ['pending', 'active']);
      merch = (merchRows ?? []).flatMap((r) => {
        const slot = r.slot as { slot_type: string } | null;
        if (!slot) return [];
        const brand = r.brand as { name: string } | null;
        const product = r.product as { name: string } | null;
        const disp = r.dispensary as { name: string } | null;
        return [
          {
            id: r.id,
            slotType: slot.slot_type,
            status: r.status,
            isHouse: r.is_house,
            label: brand?.name ?? product?.name ?? disp?.name ?? '—',
            owner: disp?.name ?? null,
          },
        ];
      });
    }

    // This shop's own ad slots, wherever they are.
    const { data: slotRows } = await supabase
      .from('ad_subscriptions')
      .select('id,status,price_paid,is_house,slot:ad_slots(slot_type,region:ad_regions(name))')
      .eq('dispensary_id', shop.id)
      .in('status', ['pending', 'active', 'past_due']);
    ownSlots = (slotRows ?? []).flatMap((r) => {
      const slot = r.slot as { slot_type: string; region: { name: string } | null } | null;
      if (!slot) return [];
      return [
        {
          id: r.id,
          status: r.status,
          isHouse: r.is_house,
          priceCents: r.price_paid,
          slotType: slot.slot_type,
          regionName: slot.region?.name ?? '—',
        },
      ];
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shop lookup</h1>
        <p className="text-muted mt-1 text-sm">
          Type a shop name to see its ad region, the zones that region covers on the map, and every
          advertising and merchandising placement that applies to it.
        </p>
      </div>

      <form className="relative max-w-md">
        <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          name="q"
          defaultValue={query}
          placeholder="Shop name, city, or slug…"
          className="pl-9"
          aria-label="Search shops"
        />
      </form>

      {query && matches.length === 0 && (
        <div className="rounded-card border-border bg-surface text-muted border border-dashed p-8 text-center text-sm">
          <p className="text-foreground font-medium">No shops match “{query}”</p>
          <p className="mt-1">Try a different name, city, or slug.</p>
        </div>
      )}

      {/* Disambiguate when the name matches several listings (chains). */}
      {matches.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {matches.map((m) => (
            <Link
              key={m.id}
              href={`/admin/shop-lookup?q=${encodeURIComponent(query)}&id=${m.id}`}
              className={
                'focus-visible:ring-primary rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 ' +
                (shop?.id === m.id
                  ? 'border-primary bg-primary-muted text-primary'
                  : 'border-border bg-surface text-muted hover:text-foreground')
              }
            >
              {m.name}
              <span className="text-muted ml-1 text-xs">
                {m.city ? `${m.city}, ` : ''}
                {m.state}
              </span>
            </Link>
          ))}
        </div>
      )}

      {shop && (
        <div className="space-y-5">
          {/* Identity + plan */}
          <section className="rounded-card border-border bg-surface border p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Store className="text-primary h-5 w-5" />
                  <Link href={`/admin/dispensaries/${shop.id}`} className="hover:text-primary">
                    {shop.name}
                  </Link>
                </h2>
                <p className="text-muted mt-1 text-sm">
                  {shop.city ? `${shop.city}, ` : ''}
                  {shop.state} ·{' '}
                  <Link href={`/dispensary/${shop.slug}`} className="hover:text-primary underline">
                    public listing
                  </Link>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={shop.status === 'active' ? 'primary' : 'muted'}>{shop.status}</Badge>
                <Badge tone={tier === 'paid' ? 'primary' : 'muted'}>
                  {planName ?? (tier === 'paid' ? 'Paid' : 'Free')}
                </Badge>
              </div>
            </div>
          </section>

          {/* Region + what's on the map for it */}
          <section className="rounded-card border-border bg-surface border p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
              <MapPin className="text-primary h-4 w-4" /> Ad region
            </h2>
            {!geo || !region ? (
              <p className="text-muted mt-2 text-sm">
                {shop.latitude == null || shop.longitude == null
                  ? 'No coordinates on this listing — it can’t be resolved to a region.'
                  : 'This listing’s location doesn’t fall in any active ad region.'}
              </p>
            ) : (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{region.name}</p>
                  <Badge tone="outline">Tier {REGION_TIER_LABEL[region.tier] ?? region.tier}</Badge>
                  {region.market && (
                    <span className="text-muted text-sm">
                      {region.market.name}, {region.market.state}
                    </span>
                  )}
                  <span className="text-muted text-sm">· zone: {geo.zoneName}</span>
                </div>
                <p className="text-muted mt-2 text-xs leading-relaxed">
                  <span className="font-medium">On the map ({zoneNames.length} zones):</span>{' '}
                  {zoneNames.length > 0 ? zoneNames.join(' · ') : '—'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <Link
                    href={`/admin/ad-regions/${region.id}`}
                    className="border-border bg-surface hover:border-primary/50 rounded-full border px-3 py-1.5 text-xs font-medium"
                  >
                    Region console →
                  </Link>
                  <Link
                    href={`/advertise/${region.slug}`}
                    className="border-border bg-surface hover:border-primary/50 rounded-full border px-3 py-1.5 text-xs font-medium"
                  >
                    Rate card →
                  </Link>
                </div>
              </>
            )}
          </section>

          {/* Advertising that applies */}
          <section className="rounded-card border-border bg-surface border p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
              <Megaphone className="text-primary h-4 w-4" /> Advertising
            </h2>
            {availability && (
              <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                <li className="border-border rounded-lg border p-3">
                  <span className="flex items-center gap-1.5 text-xs">
                    <Crown className="text-primary h-3.5 w-3.5" /> Exclusive
                  </span>
                  <p className="mt-0.5 font-semibold">
                    {availability.exclusiveOpen ? 'Available' : 'Taken'}
                  </p>
                </li>
                <li className="border-border rounded-lg border p-3">
                  <span className="text-xs">Featured</span>
                  <p className="mt-0.5 font-semibold">{availability.featuredOpen} of 3 open</p>
                </li>
                <li className="border-border rounded-lg border p-3">
                  <span className="text-xs">Premium</span>
                  <p className="mt-0.5 font-semibold">{availability.premiumOpen} of 10 open</p>
                </li>
              </ul>
            )}
            <p className="text-muted mt-3 text-xs font-semibold uppercase tracking-wide">
              This shop’s slots
            </p>
            {ownSlots.length === 0 ? (
              <p className="text-muted mt-1 text-sm">
                No ad slots held. {tier === 'paid' ? 'Their plan includes a Featured spot.' : ''}
              </p>
            ) : (
              <ul className="mt-1 space-y-1.5 text-sm">
                {ownSlots.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium capitalize">{s.slotType}</span>
                    <span className="text-muted">— {s.regionName}</span>
                    <Badge tone={s.status === 'active' ? 'primary' : 'muted'}>{s.status}</Badge>
                    {s.isHouse ? (
                      <Badge tone="outline">House</Badge>
                    ) : (
                      <span className="text-muted text-xs">{formatPrice(s.priceCents)}/mo</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Merchandising running in their region */}
          <section className="rounded-card border-border bg-surface border p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
              <Sparkles className="text-primary h-4 w-4" /> Merchandising in this region
            </h2>
            {!geo ? (
              <p className="text-muted mt-2 text-sm">No region — nothing to merchandise against.</p>
            ) : merch.length === 0 ? (
              <p className="text-muted mt-2 text-sm">
                No brand, product, or hero slots running in {region?.name ?? 'this region'}.{' '}
                <Link href="/admin/merch" className="text-primary hover:underline">
                  Merch desk →
                </Link>
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm">
                {merch.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-2">
                    <Badge tone="outline">{m.slotType}</Badge>
                    <span className="font-medium">{m.label}</span>
                    <Badge tone={m.status === 'active' ? 'primary' : 'muted'}>{m.status}</Badge>
                    {m.isHouse && <Badge tone="outline">House</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
