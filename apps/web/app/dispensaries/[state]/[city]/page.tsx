import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PRODUCT_CATEGORIES } from '@weedtip/shared';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { DispensaryCard } from '@/components/dispensary-card';
import { FaqSection } from '@/components/seo/faq-section';
import { JsonLd } from '@/components/seo/json-ld';
import { citySlug, itemListJsonLd, pageSeo, US_STATES } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

const LOCATION_SELECT =
  'id,slug,name,city,state,cover_image_url,logo_url,is_delivery,is_pickup,is_medical,is_recreational,featured,rating_avg,rating_count';

async function loadCity(state: string, city: string) {
  const code = state.toUpperCase();
  const stateName = US_STATES[code];
  if (!stateName) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('dispensaries')
    .select(LOCATION_SELECT)
    .eq('status', 'active')
    .eq('state', code)
    .order('name');
  const shops = (data ?? []).filter((s) => citySlug(s.city ?? '') === city.toLowerCase());
  const first = shops[0];
  if (!first) return null;

  // Geo-scoped featured: live featured placements whose scope matches this
  // location, for shops located here. Pins them to the top with tracking.
  const nowIso = new Date().toISOString();
  const shopIds = shops.map((s) => s.id);
  const { data: featured } = await supabase
    .from('placements')
    .select('id, dispensary_id, priority')
    .eq('type', 'featured')
    .eq('is_active', true)
    .in('dispensary_id', shopIds)
    .lte('starts_at', nowIso)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .or(`scope_state.is.null,scope_state.eq.${code}`)
    .or(`scope_city.is.null,scope_city.ilike.${first.city}`);

  const featuredByDispensary = new Map<string, { placementId: string; priority: number }>();
  for (const f of featured ?? []) {
    if (!f.dispensary_id) continue;
    const prev = featuredByDispensary.get(f.dispensary_id);
    if (!prev || f.priority > prev.priority) {
      featuredByDispensary.set(f.dispensary_id, { placementId: f.id, priority: f.priority });
    }
  }

  // Winning ad bids for this market are featured too (pinned, no beacon).
  const { data: bidWinners } = await supabase.rpc('region_featured_dispensaries', {
    p_state: code,
    p_city: first.city ?? '',
  });
  const shopIdSet = new Set(shopIds);
  for (const w of bidWinners ?? []) {
    if (shopIdSet.has(w.dispensary_id) && !featuredByDispensary.has(w.dispensary_id)) {
      featuredByDispensary.set(w.dispensary_id, { placementId: '', priority: 1 });
    }
  }

  // Pin featured shops first (by placement priority), keep the rest A→Z.
  const ordered = [...shops].sort((a, b) => {
    const fa = featuredByDispensary.get(a.id);
    const fb = featuredByDispensary.get(b.id);
    if (fa && fb) return fb.priority - fa.priority;
    if (fa) return -1;
    if (fb) return 1;
    return 0;
  });

  return { stateName, cityName: first.city ?? '', shops: ordered, featuredByDispensary };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; city: string }>;
}): Promise<Metadata> {
  const { state, city } = await params;
  const found = await loadCity(state, city);
  if (!found) return { title: 'Dispensaries' };
  const title = `Dispensaries in ${found.cityName}, ${state.toUpperCase()}`;
  const description = `Find licensed cannabis dispensaries in ${found.cityName}, ${found.stateName}. Compare menus, deals, hours, and reviews, then order for pickup or delivery on Weedtip.`;
  return pageSeo({
    title,
    description,
    path: `/dispensaries/${state.toLowerCase()}/${city.toLowerCase()}`,
  });
}

export default async function CityDispensariesPage({
  params,
}: {
  params: Promise<{ state: string; city: string }>;
}) {
  const { state, city } = await params;
  const found = await loadCity(state, city);
  if (!found) notFound();
  const { stateName, cityName, shops, featuredByDispensary } = found;

  const faqs = [
    {
      question: `How many cannabis dispensaries are in ${cityName}?`,
      answer: `Weedtip lists ${shops.length} licensed ${shops.length === 1 ? 'dispensary' : 'dispensaries'} in ${cityName}, ${stateName}, each with menus, deals, and reviews.`,
    },
    {
      question: `Can I order cannabis for pickup or delivery in ${cityName}?`,
      answer: `Many ${cityName} dispensaries on Weedtip offer in-store pickup, and some offer delivery. Each dispensary's page shows the options it supports.`,
    },
    {
      question: `Do I need to be 21 to buy cannabis in ${cityName}?`,
      answer: `You must be 21 or older (or a qualifying medical patient where permitted) and present a valid government-issued ID at pickup or delivery.`,
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <JsonLd data={itemListJsonLd(shops.map((s) => `/dispensary/${s.slug}`))} />
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Dispensaries', href: '/dispensaries' },
          { name: stateName, href: `/dispensaries/${state.toLowerCase()}` },
          { name: cityName, href: `/dispensaries/${state.toLowerCase()}/${city.toLowerCase()}` },
        ]}
      />
      <h1 className="text-2xl font-bold">
        Cannabis dispensaries in {cityName}, {state.toUpperCase()}
      </h1>
      <p className="text-muted mt-1 text-sm">
        {shops.length} {shops.length === 1 ? 'dispensary' : 'dispensaries'} in {cityName}.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shops.map((s) => {
          const promo = featuredByDispensary.get(s.id);
          return (
            <DispensaryCard
              key={s.id}
              d={{
                slug: s.slug,
                name: s.name,
                city: s.city,
                state: s.state,
                coverImageUrl: s.cover_image_url,
                logoUrl: s.logo_url,
                isDelivery: s.is_delivery,
                isPickup: s.is_pickup,
                isMedical: s.is_medical,
                isRecreational: s.is_recreational,
                featured: s.featured || !!promo,
                placementId: promo?.placementId,
                rating: s.rating_avg,
                reviewCount: s.rating_count,
              }}
            />
          );
        })}
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Browse {cityName} by category</h2>
        <div className="flex flex-wrap gap-2">
          {PRODUCT_CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/dispensaries/${state.toLowerCase()}/${city.toLowerCase()}/${c.slug}`}
              className="border-border bg-surface hover:border-primary/50 hover:text-primary rounded-full border px-4 py-2 text-sm font-medium transition-colors"
            >
              {c.name}
            </Link>
          ))}
          <Link
            href={`/deals/${state.toLowerCase()}/${city.toLowerCase()}`}
            className="border-primary/30 bg-primary-muted text-primary rounded-full border px-4 py-2 text-sm font-medium hover:underline"
          >
            Deals in {cityName}
          </Link>
        </div>
      </section>

      <section className="mt-12 max-w-3xl">
        <h2 className="mb-2 text-lg font-semibold">
          About cannabis dispensaries in {cityName}
        </h2>
        <p className="text-muted text-sm leading-relaxed">
          Find and compare licensed cannabis dispensaries in {cityName}, {stateName} on Weedtip.
          Browse menus, prices, and deals, read reviews, and order online for pickup or delivery.
          Bring a valid 21+ ID and check local regulations before ordering.
        </p>
      </section>

      <FaqSection items={faqs} />
    </main>
  );
}
