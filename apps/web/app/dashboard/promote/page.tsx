import type { Metadata } from 'next';
import { Link } from 'next-view-transitions';
import { MapPin, Sparkles, Star } from 'lucide-react';
import { deleteAdCreative, saveAdCreative } from '@/app/dashboard/actions';
import { RenewalOfferCard } from '@/components/ads/renewal-offer-card';
import { CreativeLibrary } from '@/components/dashboard/creative-library';
import { EmbedSnippet } from '@/components/dashboard/embed-snippet';
import { PromoteBilling } from '@/components/dashboard/promote-billing';
import { Badge } from '@/components/ui/badge';
import { getSlotAvailability, resolveGeo } from '@/lib/ad-serving';
import { formatPrice } from '@/lib/format';
import { requireOwnerDispensary } from '@/lib/owner';
import { getDispensaryTier, PAID_PLAN_NAME, PAID_PLAN_PRICE } from '@/lib/plan';
import { SITE_URL } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Promote' };

const TYPE_LABEL: Record<string, string> = {
  featured: 'Featured placement',
  hero: 'Homepage spotlight',
  promoted_deal: 'Promoted deal',
  promoted_product: 'Promoted product',
};

function isLive(p: { is_active: boolean; starts_at: string; ends_at: string | null }): boolean {
  const now = Date.now();
  return (
    p.is_active &&
    new Date(p.starts_at).getTime() <= now &&
    (!p.ends_at || new Date(p.ends_at).getTime() >= now)
  );
}

export default async function PromotePage() {
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();

  const [
    { data: sub },
    { data: placements },
    { data: plans },
    { data: stats },
    { data: dealTargets },
    { data: productTargets },
    { data: creatives },
  ] = await Promise.all([
    supabase
      .from('dispensary_subscriptions')
      .select('status, plan:plans(name, price_cents)')
      .eq('dispensary_id', dispensary.id)
      .maybeSingle(),
    supabase
      .from('placements')
      .select('*, creative:ad_creatives(name)')
      .eq('dispensary_id', dispensary.id)
      .order('created_at', { ascending: false }),
    supabase.from('plans').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('placement_stats').select('*'),
    supabase
      .from('deals')
      .select('id, title')
      .eq('dispensary_id', dispensary.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('products')
      .select('id, name')
      .eq('dispensary_id', dispensary.id)
      .order('name')
      .limit(200),
    supabase
      .from('ad_creatives')
      .select('id, name, image_url, headline, body')
      .eq('dispensary_id', dispensary.id)
      .order('created_at', { ascending: false }),
  ]);

  // Every live ad-slot hold, pending or active — the owner's persistent
  // record that their one-click reserve actually took. Without this, a
  // reserved spot is invisible everywhere until billing activates it.
  const { data: adSlotSubs } = await supabase
    .from('ad_subscriptions')
    .select(
      'id, status, price_paid, is_house, plan_included, ends_at, slot:ad_slots(slot_type, region:ad_regions(name))',
    )
    .eq('dispensary_id', dispensary.id)
    .in('status', ['pending', 'active', 'past_due'])
    .order('created_at', { ascending: false });
  const slotHolds = (adSlotSubs ?? []).flatMap((r) => {
    const slot = r.slot as { slot_type: string; region: { name: string } | null } | null;
    if (!slot) return [];
    return [
      {
        id: r.id,
        status: r.status,
        isHouse: r.is_house,
        planIncluded: r.plan_included,
        priceCents: r.price_paid,
        endsAt: r.ends_at,
        slotType: slot.slot_type,
        regionName: slot.region?.name ?? 'your region',
      },
    ];
  });

  // First-right renewal offers on this shop's expiring ad slots.
  const { data: renewalSubs } = await supabase
    .from('ad_subscriptions')
    .select(
      'id, price_paid, ends_at, renewal_price_cents, slot:ad_slots(slot_type, region:ad_regions(name))',
    )
    .eq('dispensary_id', dispensary.id)
    .eq('status', 'active')
    .not('renewal_price_cents', 'is', null);
  // Already-accepted offers render as "processing" instead of a live button —
  // otherwise the offer looks unanswered on every reload until the ad desk
  // extends the term.
  const { data: acceptedReqs } = await supabase
    .from('ad_requests')
    .select('slot_type')
    .eq('dispensary_id', dispensary.id)
    .eq('kind', 'renewal_accept')
    .eq('status', 'open');
  const acceptedSlotTypes = new Set<string>((acceptedReqs ?? []).map((r) => r.slot_type));
  const renewalOffers = (renewalSubs ?? []).flatMap((r) => {
    const slot = r.slot as { slot_type: string; region: { name: string } | null } | null;
    if (!slot || !r.renewal_price_cents) return [];
    return [
      {
        subscriptionId: r.id,
        slotType: slot.slot_type,
        regionName: slot.region?.name ?? 'your region',
        currentCents: r.price_paid,
        offerCents: r.renewal_price_cents,
        endsAt: r.ends_at,
        accepted: acceptedSlotTypes.has(slot.slot_type),
      },
    ];
  });

  // Resolve the shop's ad region + open inventory, so the page can show what the
  // plan's included Featured placement actually covers (ads-bundling surface).
  const tier = await getDispensaryTier(dispensary.id);
  const isPaid = tier === 'paid';
  const { data: coords } = await supabase
    .from('dispensaries')
    .select('latitude, longitude')
    .eq('id', dispensary.id)
    .maybeSingle();
  const geo =
    coords?.latitude != null && coords?.longitude != null
      ? await resolveGeo(coords.longitude, coords.latitude)
      : null;
  const availability = geo ? ((await getSlotAvailability()).get(geo.regionId) ?? null) : null;
  const featuredHold = slotHolds.find((h) => h.slotType === 'featured') ?? null;

  // The neighborhoods/zones inside the shop's region — so the plan card can
  // answer "what area does this actually cover?" before they commit.
  let zoneNames: string[] = [];
  if (geo) {
    const { data: zoneRows } = await supabase.rpc('ad_region_zone_names');
    zoneNames =
      (zoneRows ?? []).find((z: { region_id: string }) => z.region_id === geo.regionId)
        ?.zone_names ?? [];
  }
  const coverage = geo
    ? {
        regionName: geo.regionName,
        regionSlug: geo.regionSlug,
        zoneNames,
        featuredOpen: availability?.featuredOpen ?? null,
      }
    : null;

  const plan = sub?.plan as { name: string; price_cents: number } | null;
  const live = (placements ?? []).filter(isLive);
  const statsByPlacement = new Map((stats ?? []).map((s) => [s.placement_id, s] as const));
  // Insights rollup across every placement (lifetime).
  const totals = (placements ?? []).reduce(
    (acc, p) => {
      const s = statsByPlacement.get(p.id);
      acc.impressions += s?.impressions ?? 0;
      acc.clicks += s?.clicks ?? 0;
      return acc;
    },
    { impressions: 0, clicks: 0 },
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Promote {dispensary.name}</h1>
          <p className="text-muted mt-1 text-sm">
            Your plan and every way to get in front of more customers, in one place. Reserving is
            free — our team confirms billing before anything is charged, and placements expire
            automatically.
          </p>
        </div>
        <a
          href="/dashboard/promote/spend"
          className="border-border bg-surface hover:border-primary/50 shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
        >
          Marketing spend report →
        </a>
      </div>

      {/* 1) Plan — the first decision, at the top. */}
      <PromoteBilling
        section="plans"
        coverage={coverage}
        plans={(plans ?? []).map((pl) => ({
          id: pl.id,
          name: pl.name,
          price_cents: pl.price_cents,
          features: Array.isArray(pl.features) ? (pl.features as string[]) : [],
        }))}
        currentPlanName={sub?.status === 'active' ? (plan?.name ?? 'Free') : 'Free'}
        planPending={sub?.status === 'pending'}
        city={dispensary.city ?? ''}
        state={dispensary.state}
        deals={[]}
        products={[]}
      />

      {/* 2) What Weedtip Pro's included Featured placement covers, for this shop's region. */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Featured placement in your region</h2>
        {!geo ? (
          <div className="rounded-card border-border bg-surface text-muted border p-5 text-sm">
            {dispensary.city ? `${dispensary.city}, ${dispensary.state}` : dispensary.state} isn’t a
            Weedtip ad region yet — we’ll open promotion here as the market grows.
          </div>
        ) : (
          <div className="rounded-card border-primary/25 bg-primary-subtle border p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-semibold">
                  <MapPin className="text-primary h-4 w-4" /> {geo.regionName}
                </p>
                {isPaid ? (
                  featuredHold ? (
                    <p className="text-muted mt-1 text-sm">
                      Your {PAID_PLAN_NAME} Featured spot is{' '}
                      {featuredHold.status === 'active'
                        ? 'live'
                        : 'being set up (within 1 business day)'}{' '}
                      in {geo.regionName}.
                    </p>
                  ) : (
                    <p className="text-muted mt-1 text-sm">
                      {PAID_PLAN_NAME} includes a Featured spot here.{' '}
                      {availability && availability.featuredOpen > 0
                        ? 'A spot is open — reserve it below and our team activates it within 1 business day.'
                        : 'The region is full right now; you’re first in line for the next opening.'}
                    </p>
                  )
                ) : (
                  <p className="text-muted mt-1 text-sm">
                    Upgrade to {PAID_PLAN_NAME} (${PAID_PLAN_PRICE}/mo) to get a Featured spot in{' '}
                    {geo.regionName} — plus every listing tool.
                  </p>
                )}
                {availability && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="border-border bg-surface inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5">
                      <Star className="text-primary h-3 w-3" /> {availability.featuredOpen} of 3
                      Featured open
                    </span>
                    <span className="border-border bg-surface inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5">
                      {availability.premiumOpen} of 10 Premium open
                    </span>
                  </div>
                )}
              </div>
              <Link
                href={`/advertise/${geo.regionSlug}`}
                className="border-primary text-primary hover:bg-primary-muted focus-visible:ring-primary shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
              >
                <Sparkles className="mr-1 inline h-4 w-4" />
                See {geo.regionName} placements →
              </Link>
            </div>
          </div>
        )}
      </section>

      {renewalOffers.length > 0 && (
        <section className="space-y-3">
          {renewalOffers.map((o) => (
            <RenewalOfferCard key={o.subscriptionId} offer={o} />
          ))}
        </section>
      )}

      {/* Sponsored ad-slot holds — pending reserves must stay visible. */}
      {slotHolds.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Sponsored placements</h2>
          {slotHolds.map((h) => (
            <div
              key={h.id}
              className="rounded-card border-border bg-surface flex flex-wrap items-center justify-between gap-3 border p-4"
            >
              <div>
                <p className="text-sm font-semibold capitalize">
                  {h.slotType} spot — {h.regionName}
                </p>
                <p className="text-muted mt-0.5 text-xs">
                  {h.planIncluded
                    ? `Included with ${PAID_PLAN_NAME} — no extra charge, labeled "Featured".`
                    : h.isHouse
                      ? 'Comped by Weedtip while the region ramps up — free, labeled "Featured".'
                      : h.status === 'pending'
                        ? `Reserved at ${formatPrice(h.priceCents)}/mo — our team is setting up billing (within 1 business day).`
                        : h.status === 'past_due'
                          ? `${formatPrice(h.priceCents)}/mo — payment past due; contact us to keep the spot.`
                          : `Live at ${formatPrice(h.priceCents)}/mo${h.endsAt ? ` · current term ends ${new Date(h.endsAt).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}` : ''}.`}
                </p>
              </div>
              <Badge
                tone={
                  h.status === 'active' ? 'primary' : h.status === 'pending' ? 'outline' : 'muted'
                }
              >
                {h.status === 'pending'
                  ? 'Reserved'
                  : h.status === 'past_due'
                    ? 'Past due'
                    : 'Live'}
              </Badge>
            </div>
          ))}
        </section>
      )}

      {/* Placements + insights (spec ⑥: scheduler view + performance) */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your placements</h2>
        {totals.impressions > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="card p-4">
              <p className="text-xl font-bold">{totals.impressions.toLocaleString()}</p>
              <p className="text-muted text-xs">Ad impressions</p>
            </div>
            <div className="card p-4">
              <p className="text-xl font-bold">{totals.clicks.toLocaleString()}</p>
              <p className="text-muted text-xs">Clicks</p>
            </div>
            <div className="card p-4">
              <p className="text-primary text-xl font-bold">
                {Math.round((totals.clicks / totals.impressions) * 1000) / 10}%
              </p>
              <p className="text-muted text-xs">CTR</p>
            </div>
          </div>
        )}
        {!placements || placements.length === 0 ? (
          <div className="rounded-card border-border bg-surface text-muted border p-6 text-center text-sm">
            No active placements. Get featured to climb search results.
          </div>
        ) : (
          <div className="space-y-2">
            {placements.map((p) => {
              const creative = p.creative as { name: string } | null;
              const pending = p.status === 'pending';
              return (
                <div
                  key={p.id}
                  className="rounded-card border-border bg-surface flex items-center justify-between border p-4"
                >
                  <div>
                    <p className="font-medium">{TYPE_LABEL[p.type] ?? p.type}</p>
                    <p className="text-muted text-xs">
                      {p.scope_city ? `${p.scope_city}, ` : ''}
                      {p.scope_state ?? 'Nationwide'} ·{' '}
                      {pending
                        ? p.requested_start
                          ? `requested to start ${new Date(`${p.requested_start}T00:00:00`).toLocaleDateString()}`
                          : 'starts when confirmed'
                        : `${new Date(p.starts_at).toLocaleDateString()} – ${
                            p.ends_at ? new Date(p.ends_at).toLocaleDateString() : 'open-ended'
                          }`}
                      {creative && ` · creative: ${creative.name}`}
                    </p>
                    {(() => {
                      const stat = statsByPlacement.get(p.id);
                      const impr = stat?.impressions ?? 0;
                      const clk = stat?.clicks ?? 0;
                      return (
                        <p className="text-muted mt-1 text-xs">
                          {impr.toLocaleString()} impressions · {clk.toLocaleString()} clicks
                          {impr > 0 && ` · ${Math.round((clk / impr) * 1000) / 10}% CTR`}
                        </p>
                      );
                    })()}
                  </div>
                  <Badge tone={isLive(p) ? 'primary' : 'muted'}>
                    {isLive(p)
                      ? 'Live'
                      : pending
                        ? 'Awaiting confirmation'
                        : p.is_active && new Date(p.starts_at).getTime() > Date.now()
                          ? 'Scheduled'
                          : p.is_active
                            ? 'Ended'
                            : 'Paused'}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
        {live.length > 0 && (
          <p className="text-muted text-xs">
            {live.length} placement{live.length === 1 ? '' : 's'} currently live.
          </p>
        )}
      </section>

      {/* Reserve an additional / à-la-carte placement (deals, products, wider reach). */}
      <PromoteBilling
        section="placements"
        plans={[]}
        currentPlanName={sub?.status === 'active' ? (plan?.name ?? 'Free') : 'Free'}
        planPending={sub?.status === 'pending'}
        city={dispensary.city ?? ''}
        state={dispensary.state}
        deals={(dealTargets ?? []).map((d) => ({ id: d.id, label: d.title }))}
        products={(productTargets ?? []).map((p) => ({ id: p.id, label: p.name }))}
        creatives={(creatives ?? []).map((c) => ({ id: c.id, label: c.name }))}
      />

      {/* Creative library (spec ⑥) */}
      <CreativeLibrary
        creatives={creatives ?? []}
        saveAction={saveAdCreative}
        deleteAction={deleteAdCreative}
      />

      {/* Embeddable menu widget */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Embeddable menu</h2>
          <p className="text-muted mt-1 text-sm">
            Drop your live Weedtip menu onto your own website. It updates automatically — including
            sale prices — and links shoppers back to order.
          </p>
        </div>
        <EmbedSnippet siteUrl={SITE_URL} slug={dispensary.slug} name={dispensary.name} />
      </section>
    </div>
  );
}
