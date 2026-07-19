import type { Metadata } from 'next';
import { Link } from 'next-view-transitions';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeCheck, CheckCircle2, Crown, Mail, MapPin, Star } from 'lucide-react';
import { ViewTracker } from '@/components/analytics/view-tracker';
import { Badge } from '@/components/ui/badge';
import { RequestAvailabilityButton } from '@/components/ads/request-availability-button';
import { SlotCheckoutButton } from '@/components/ads/slot-checkout-button';
import { getSlotAvailability } from '@/lib/ad-serving';
import { formatPrice } from '@/lib/format';
import { requireAdvertiserAccess } from '@/lib/advertiser-access';
import { getPlatformSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';
import { createStaticClient } from '@/lib/supabase/static';

// Auth-gated (advertiser accounts only) — always rendered per-request.
export const dynamic = 'force-dynamic';

/** Persistent "you hold this spot" state on the rate card. */
function HeldSpotNote({ status }: { status: string }) {
  return (
    <p className="text-primary flex items-start gap-1.5 text-xs font-medium">
      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {status === 'active'
        ? 'You hold this spot — your placement is live.'
        : 'You hold this spot — reserved; our team is setting up billing.'}
    </p>
  );
}

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
  await requireAdvertiserAccess(`/advertise/${slug}`);
  const found = await loadRegion(slug);
  if (!found) notFound();
  const { region, zones, products } = found;
  const availability = (await getSlotAvailability()).get(region.id);
  const market = region.market as { name: string; state: string } | null;

  // Dynamic step pricing: each spot sold raises the next spot ~15% (capped at
  // list price) — the rate card always shows the price of the NEXT spot.
  const supabase = createStaticClient();
  const [{ data: featuredNow }, { data: premiumNow }] = await Promise.all([
    supabase.rpc('slot_price_cents', { p_region_id: region.id, p_slot_type: 'featured' }),
    supabase.rpc('slot_price_cents', { p_region_id: region.id, p_slot_type: 'premium' }),
  ]);

  const product = (slotType: string) => products.find((p) => p.slot_type === slotType);
  const featured = product('featured');
  const premium = product('premium');

  // The viewer's own live holds here: a reserved spot must LOOK reserved on
  // every return visit — otherwise the rate card re-offers the (now stepped)
  // price and the owner wonders whether their click did anything.
  const heldByType = new Map<string, string>();
  const authed = await createClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (user) {
    const { data: own } = await authed
      .from('ad_subscriptions')
      .select('status, slot:ad_slots!inner(region_id, slot_type)')
      .in('status', ['pending', 'active', 'past_due'])
      .eq('slot.region_id', region.id);
    for (const s of own ?? []) {
      const slot = s.slot as unknown as { slot_type: string } | null;
      if (slot) heldByType.set(slot.slot_type, s.status);
    }
  }

  const { adsEmail } = await getPlatformSettings();
  const contactHref = `mailto:${adsEmail}?subject=${encodeURIComponent(
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
          {availability?.exclusiveOpen ? (
            <a href={contactHref} className="mt-4 block">
              <span className="border-primary text-primary hover:bg-primary-muted inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors">
                <Mail className="h-4 w-4" /> Contact to reserve
              </span>
            </a>
          ) : (
            <div className="mt-4">
              <RequestAvailabilityButton regionId={region.id} slotType="exclusive" />
            </div>
          )}
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
            {typeof featuredNow === 'number'
              ? formatPrice(featuredNow)
              : featured
                ? formatPrice(featured.launch_price)
                : '—'}
            <span className="text-muted text-sm font-normal">/mo</span>
          </p>
          {featured &&
            (typeof featuredNow === 'number' && featuredNow > featured.launch_price ? (
              <p className="text-muted text-xs">
                Price for the next spot — each spot sold raises the next (launch was{' '}
                {formatPrice(featured.launch_price)}/mo).
              </p>
            ) : (
              featured.list_price > featured.launch_price && (
                <p className="text-muted text-xs">
                  Launch price — regularly <s>{formatPrice(featured.list_price)}/mo</s>. Locks in
                  for you; the next spot costs more.
                </p>
              )
            ))}
          <ul className="text-muted mt-3 space-y-1 text-sm">
            <li>· Rotating top position under the sponsor</li>
            <li>· Pinned above organic results, region-wide</li>
            <li>· “Featured” label</li>
          </ul>
          <div className="mt-4">
            {heldByType.has('featured') ? (
              <HeldSpotNote status={heldByType.get('featured')!} />
            ) : availability?.featuredOpen ? (
              <SlotCheckoutButton
                regionId={region.id}
                slotType="featured"
                label="Claim a Featured slot"
              />
            ) : (
              <RequestAvailabilityButton regionId={region.id} slotType="featured" />
            )}
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
            {typeof premiumNow === 'number'
              ? formatPrice(premiumNow)
              : premium
                ? formatPrice(premium.launch_price)
                : '—'}
            <span className="text-muted text-sm font-normal">/mo</span>
          </p>
          {premium &&
            (typeof premiumNow === 'number' && premiumNow > premium.launch_price ? (
              <p className="text-muted text-xs">
                Price for the next spot — each spot sold raises the next (launch was{' '}
                {formatPrice(premium.launch_price)}/mo).
              </p>
            ) : (
              premium.list_price > premium.launch_price && (
                <p className="text-muted text-xs">
                  Launch price — regularly <s>{formatPrice(premium.list_price)}/mo</s>. Locks in
                  for you; the next spot costs more.
                </p>
              )
            ))}
          <ul className="text-muted mt-3 space-y-1 text-sm">
            <li>· Boosted rank above standard listings</li>
            <li>· “Sponsored” badge on your card</li>
            <li>· 10 per region, first come first served</li>
          </ul>
          <div className="mt-4">
            {heldByType.has('premium') ? (
              <HeldSpotNote status={heldByType.get('premium')!} />
            ) : availability?.premiumOpen ? (
              <SlotCheckoutButton
                regionId={region.id}
                slotType="premium"
                label="Claim a Premium slot"
              />
            ) : (
              <RequestAvailabilityButton regionId={region.id} slotType="premium" />
            )}
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
