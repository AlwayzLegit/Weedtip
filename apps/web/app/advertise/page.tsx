import type { Metadata } from 'next';
import { Link } from 'next-view-transitions';
import { ArrowRight, Crown, MapPin, Sparkles } from 'lucide-react';
import { ViewTracker } from '@/components/analytics/view-tracker';
import { Badge } from '@/components/ui/badge';
import { getSlotAvailability } from '@/lib/ad-serving';
import { formatPrice } from '@/lib/format';
import { createStaticClient } from '@/lib/supabase/static';

export const metadata: Metadata = {
  title: 'Advertise on Weedtip',
  description:
    'Own your neighborhood. Fixed, scarce ad inventory per region: one exclusive sponsor, three featured positions, ten premium listings.',
};

// Availability drives urgency — keep it fresh.
export const revalidate = 60;

const TIER_LABEL: Record<string, string> = {
  A_PLUS: 'A+',
  A: 'A',
  B_PLUS: 'B+',
  B: 'B',
};

export default async function AdvertisePage() {
  const supabase = createStaticClient();
  const [{ data: markets }, { data: regions }, { data: zones }, { data: products }, availability] =
    await Promise.all([
      supabase.from('ad_markets').select('id, slug, name, state').order('name'),
      // ~500 regions nationwide — fine under the 1,000-row response cap.
      // (Paginate here before region count ever approaches 1,000.)
      supabase
        .from('ad_regions')
        .select('id, market_id, slug, name, tier, sort_order')
        .eq('is_active', true)
        .order('sort_order'),
      // Aggregated per region in the DB — the raw ad_zones table is past the
      // PostgREST row cap at nationwide scale.
      supabase.rpc('ad_region_zone_names'),
      supabase.from('ad_products').select('slot_type, tier, launch_price, list_price'),
      getSlotAvailability(),
    ]);

  const zonesByRegion = new Map<string, string[]>();
  for (const z of zones ?? []) {
    zonesByRegion.set(z.region_id, z.zone_names ?? []);
  }
  const price = (slotType: string, tier: string) =>
    (products ?? []).find((p) => p.slot_type === slotType && p.tier === tier);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <ViewTracker event="advertise_viewed" />
      <div className="max-w-3xl">
        <Badge tone="primary">
          <Sparkles className="h-3 w-3" /> Launch pricing — up to 70% off
        </Badge>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Own your neighborhood.</h1>
        <p className="text-muted mt-3 text-lg">
          Weedtip sells advertising by <span className="text-foreground font-medium">region</span> —
          real territories with fixed, scarce inventory. Each region has exactly{' '}
          <span className="text-foreground font-medium">1 exclusive sponsor</span>,{' '}
          <span className="text-foreground font-medium">3 featured positions</span>, and{' '}
          <span className="text-foreground font-medium">10 premium listings</span>. When they&apos;re
          gone, they&apos;re gone.
        </p>
      </div>

      {(markets ?? []).map((market) => {
        const marketRegions = (regions ?? []).filter((r) => r.market_id === market.id);
        if (marketRegions.length === 0) return null;
        return (
          <section key={market.id} className="mt-10">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <MapPin className="text-primary h-5 w-5" />
              {market.name}, {market.state}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {marketRegions.map((region) => {
                const avail = availability.get(region.id);
                const zoneNames = zonesByRegion.get(region.id) ?? [];
                const featured = price('featured', region.tier);
                const premium = price('premium', region.tier);
                return (
                  <Link
                    key={region.id}
                    href={`/advertise/${region.slug}`}
                    className="rounded-card border-border bg-surface shadow-card hover:border-primary/50 hover:shadow-card-hover group block border p-5 transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="group-hover:text-primary font-semibold">{region.name}</h3>
                      <Badge tone="outline">Tier {TIER_LABEL[region.tier] ?? region.tier}</Badge>
                    </div>
                    <p className="text-muted mt-1 line-clamp-2 text-xs">
                      {zoneNames.slice(0, 8).join(' · ')}
                      {zoneNames.length > 8 ? ` · +${zoneNames.length - 8} more` : ''}
                    </p>
                    <ul className="mt-3 space-y-1.5 text-sm">
                      <li className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Crown className="text-primary h-3.5 w-3.5" /> Exclusive sponsor
                        </span>
                        {avail?.exclusiveOpen ? (
                          <Badge tone="primary">Available</Badge>
                        ) : (
                          <Badge tone="muted">TAKEN</Badge>
                        )}
                      </li>
                      <li className="flex items-center justify-between">
                        <span>Featured</span>
                        <span className={avail?.featuredOpen ? 'text-primary font-medium' : 'text-muted'}>
                          {avail?.featuredOpen ?? 3} of 3 open
                        </span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span>Premium</span>
                        <span className={avail?.premiumOpen ? 'text-primary font-medium' : 'text-muted'}>
                          {avail?.premiumOpen ?? 10} of 10 open
                        </span>
                      </li>
                    </ul>
                    <p className="border-border text-muted mt-3 flex items-center justify-between border-t pt-3 text-xs">
                      <span>
                        Premium from{' '}
                        <span className="text-foreground font-semibold">
                          {formatPrice(premium?.launch_price ?? 0)}/mo
                        </span>
                        {featured && (
                          <> · Featured {formatPrice(featured.launch_price)}/mo</>
                        )}
                      </span>
                      <ArrowRight className="group-hover:text-primary h-4 w-4" />
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="border-border bg-surface-2 rounded-card mt-12 border p-6 text-sm">
        <h2 className="font-semibold">How it works</h2>
        <ul className="text-muted mt-2 list-disc space-y-1 pl-5">
          <li>Shoppers search neighborhoods; your placement covers the whole region — every zone in it.</li>
          <li>Inventory is fixed per region and enforced at the database. No auctions, no getting outbid.</li>
          <li>Reserve with one click — no card needed. Our team sets up monthly invoicing within 1 business day; launch pricing locks in. Cancel anytime and the slot re-opens instantly.</li>
          <li>All sponsored placements are clearly labeled.</li>
        </ul>
      </section>
    </main>
  );
}
