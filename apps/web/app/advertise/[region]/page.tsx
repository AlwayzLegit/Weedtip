import type { Metadata } from 'next';
import { Link } from 'next-view-transitions';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Crown, Mail, MapPin, Star } from 'lucide-react';
import { ViewTracker } from '@/components/analytics/view-tracker';
import { Badge } from '@/components/ui/badge';
import { SlotCheckoutButton } from '@/components/ads/slot-checkout-button';
import { getSlotAvailability } from '@/lib/ad-serving';
import { formatPrice } from '@/lib/format';
import { createStaticClient } from '@/lib/supabase/static';

export const revalidate = 60;

const TIER_LABEL: Record<string, string> = {
  A_PLUS: 'A+',
  A: 'A',
  B_PLUS: 'B+',
  B: 'B',
};

async function loadRegion(slug: string) {
  const supabase = createStaticClient();
  const { data: region } = await supabase
    .from('ad_regions')
    .select('id, slug, name, tier, exclusive_price_min, exclusive_price_max, is_active, market:ad_markets(name, state)')
    .eq('slug', slug)
    .maybeSingle();
  if (!region || !region.is_active) return null;
  const [{ data: zones }, { data: products }] = await Promise.all([
    supabase.from('ad_zones').select('slug, name').eq('region_id', region.id).order('name'),
    supabase
      .from('ad_products')
      .select('slot_type, launch_price, list_price')
      .eq('tier', region.tier),
  ]);
  return { region, zones: zones ?? [], products: products ?? [] };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region } = await params;
  const found = await loadRegion(region);
  if (!found) return { title: 'Advertise' };
  return {
    title: `Advertise in ${found.region.name}`,
    description: `Sponsor the ${found.region.name} region on Weedtip: 1 exclusive sponsorship, 3 featured positions, 10 premium listings. Fixed inventory, launch pricing.`,
  };
}

export default async function AdvertiseRegionPage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region: slug } = await params;
  const found = await loadRegion(slug);
  if (!found) notFound();
  const { region, zones, products } = found;
  const availability = (await getSlotAvailability()).get(region.id);
  const market = region.market as { name: string; state: string } | null;

  const product = (slotType: string) => products.find((p) => p.slot_type === slotType);
  const featured = product('featured');
  const premium = product('premium');

  const contactHref = `mailto:ads@weedtip.com?subject=${encodeURIComponent(
    `Exclusive sponsorship — ${region.name}`,
  )}`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <ViewTracker event="advertise_region_viewed" properties={{ region_slug: region.slug, tier: region.tier }} />
      <Link
        href="/advertise"
        className="text-muted hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> All regions
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{region.name}</h1>
        <Badge tone="outline">Tier {TIER_LABEL[region.tier] ?? region.tier}</Badge>
        {market && (
          <span className="text-muted flex items-center gap-1 text-sm">
            <MapPin className="h-4 w-4" />
            {market.name}, {market.state}
          </span>
        )}
      </div>

      <p className="text-muted mt-2 max-w-2xl">
        Your placement serves in <span className="text-foreground font-medium">every zone</span> of
        this region — {zones.map((z) => z.name).join(', ')}.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {/* Exclusive — negotiated within the band, sold by hand. */}
        <div className="rounded-card border-primary/40 bg-surface shadow-card border-2 p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 font-semibold">
              <Crown className="text-primary h-4 w-4" /> Exclusive Sponsor
            </h2>
            {availability?.exclusiveOpen ? (
              <Badge tone="primary">1 available</Badge>
            ) : (
              <Badge tone="muted">TAKEN</Badge>
            )}
          </div>
          <p className="mt-2 text-2xl font-bold">
            {region.exclusive_price_min ? formatPrice(region.exclusive_price_min) : '—'}
            <span className="text-muted text-sm font-normal">
              –{region.exclusive_price_max ? formatPrice(region.exclusive_price_max) : ''}/mo
            </span>
          </p>
          <ul className="text-muted mt-3 space-y-1 text-sm">
            <li>· Pinned above ALL results in every zone</li>
            <li>· “Regional Sponsor” hero unit</li>
            <li>· Only one per region — total ownership</li>
          </ul>
          <a href={contactHref} className="mt-4 block">
            <span className="border-primary text-primary hover:bg-primary-muted inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors">
              <Mail className="h-4 w-4" /> Contact to reserve
            </span>
          </a>
        </div>

        {/* Featured — self-serve. */}
        <div className="rounded-card border-border bg-surface shadow-card border p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 font-semibold">
              <Star className="text-primary h-4 w-4" /> Featured
            </h2>
            <Badge tone={availability?.featuredOpen ? 'primary' : 'muted'}>
              {availability?.featuredOpen ?? 3} of 3 available
            </Badge>
          </div>
          <p className="mt-2 text-2xl font-bold">
            {featured ? formatPrice(featured.launch_price) : '—'}
            <span className="text-muted text-sm font-normal">/mo</span>
          </p>
          {featured && featured.list_price > featured.launch_price && (
            <p className="text-muted text-xs">
              Launch price — regularly <s>{formatPrice(featured.list_price)}/mo</s>
            </p>
          )}
          <ul className="text-muted mt-3 space-y-1 text-sm">
            <li>· Rotating top position under the sponsor</li>
            <li>· Pinned above organic results, region-wide</li>
            <li>· “Featured” label</li>
          </ul>
          <div className="mt-4">
            <SlotCheckoutButton
              regionId={region.id}
              slotType="featured"
              label="Claim a Featured slot"
              disabled={!availability?.featuredOpen}
            />
          </div>
        </div>

        {/* Premium — self-serve. */}
        <div className="rounded-card border-border bg-surface shadow-card border p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 font-semibold">
              <BadgeCheck className="text-primary h-4 w-4" /> Premium Listing
            </h2>
            <Badge tone={availability?.premiumOpen ? 'primary' : 'muted'}>
              {availability?.premiumOpen ?? 10} of 10 available
            </Badge>
          </div>
          <p className="mt-2 text-2xl font-bold">
            {premium ? formatPrice(premium.launch_price) : '—'}
            <span className="text-muted text-sm font-normal">/mo</span>
          </p>
          {premium && premium.list_price > premium.launch_price && (
            <p className="text-muted text-xs">
              Launch price — regularly <s>{formatPrice(premium.list_price)}/mo</s>
            </p>
          )}
          <ul className="text-muted mt-3 space-y-1 text-sm">
            <li>· Boosted rank above standard listings</li>
            <li>· “Sponsored” badge on your card</li>
            <li>· 10 per region, first come first served</li>
          </ul>
          <div className="mt-4">
            <SlotCheckoutButton
              regionId={region.id}
              slotType="premium"
              label="Claim a Premium slot"
              disabled={!availability?.premiumOpen}
            />
          </div>
        </div>
      </div>

      <section className="border-border bg-surface-2 rounded-card mt-8 border p-5 text-sm">
        <h2 className="font-semibold">Standard listing</h2>
        <p className="text-muted mt-1">
          Every licensed dispensary gets a full listing free, forever — menu, orders, deals, and
          reviews with 0% commission. Claim yours, then add a paid placement any time from your
          dashboard.
        </p>
        <Link href="/dispensaries" className="text-primary mt-2 inline-block hover:underline">
          Find your listing →
        </Link>
      </section>

      <p className="text-muted mt-6 text-xs">
        Reserve with one click — no card needed; our team sets up monthly invoicing within 1
        business day. Cancel anytime — your slot re-opens for the next buyer. All
        sponsored placements are clearly labeled. Advertising services are provided to licensed
        retailers only.
      </p>
    </main>
  );
}
