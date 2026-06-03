import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Tag } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { DealCard } from '@/components/deal-card';
import { FaqSection } from '@/components/seo/faq-section';
import { JsonLd } from '@/components/seo/json-ld';
import { citySlug, itemListJsonLd, pageSeo, US_STATES } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

const DEAL_SELECT = '*, dispensary:dispensaries!inner(slug,name,city,state,status)';

type DealRow = {
  id: string;
  title: string;
  description: string | null;
  code: string | null;
  discount_type: string;
  discount_value: number;
  dispensary: { slug: string; name: string; city: string; state: string } | null;
};

async function loadCityDeals(state: string, city: string) {
  const code = state.toUpperCase();
  const stateName = US_STATES[code];
  if (!stateName) return null;
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from('deals')
    .select(DEAL_SELECT)
    .eq('is_active', true)
    .lte('start_date', nowIso)
    .gte('end_date', nowIso)
    .eq('dispensary.status', 'active')
    .eq('dispensary.state', code)
    .order('end_date');
  const deals = ((data ?? []) as unknown as DealRow[]).filter(
    (d) => d.dispensary && citySlug(d.dispensary.city) === city.toLowerCase(),
  );
  // Resolve the city's display name even when it currently has no active deals.
  const { data: cityRow } = await supabase
    .from('dispensaries')
    .select('city')
    .eq('status', 'active')
    .eq('state', code);
  const cityName = (cityRow ?? []).map((r) => r.city).find((c) => citySlug(c) === city.toLowerCase());
  if (!cityName) return null;
  return { stateName, cityName, deals };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; city: string }>;
}): Promise<Metadata> {
  const { state, city } = await params;
  const found = await loadCityDeals(state, city);
  if (!found) return { title: 'Deals' };
  const title = `Cannabis Deals in ${found.cityName}, ${state.toUpperCase()}`;
  const description = `Find live cannabis deals and discounts from licensed dispensaries in ${found.cityName}, ${found.stateName}. Order for pickup or delivery on Weedtip.`;
  return pageSeo({
    title,
    description,
    path: `/deals/${state.toLowerCase()}/${city.toLowerCase()}`,
  });
}

export default async function CityDealsPage({
  params,
}: {
  params: Promise<{ state: string; city: string }>;
}) {
  const { state, city } = await params;
  const found = await loadCityDeals(state, city);
  if (!found) notFound();
  const { stateName, cityName, deals } = found;

  const faqs = [
    {
      question: `Are there cannabis deals in ${cityName}?`,
      answer: `Weedtip lists ${deals.length} active ${deals.length === 1 ? 'deal' : 'deals'} from licensed dispensaries in ${cityName}, ${stateName}.`,
    },
    {
      question: `How do I redeem a cannabis deal in ${cityName}?`,
      answer: `Open the dispensary offering the deal, add qualifying items to your cart, and the discount applies at checkout per that dispensary's terms.`,
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <JsonLd
        data={itemListJsonLd(
          deals.filter((d) => d.dispensary).map((d) => `/dispensary/${d.dispensary!.slug}`),
        )}
      />
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Deals', href: '/deals' },
          { name: stateName, href: `/deals/${state.toLowerCase()}` },
          { name: cityName, href: `/deals/${state.toLowerCase()}/${city.toLowerCase()}` },
        ]}
      />
      <h1 className="text-2xl font-bold">
        Cannabis deals in {cityName}, {state.toUpperCase()}
      </h1>
      <p className="text-muted mt-1 text-sm">
        {deals.length} active {deals.length === 1 ? 'deal' : 'deals'} in {cityName}.
      </p>

      {deals.length === 0 ? (
        <div className="rounded-card border-border bg-surface mt-6 border p-10 text-center">
          <Tag className="text-muted mx-auto h-8 w-8" />
          <p className="mt-2 font-medium">No active deals in {cityName} right now</p>
          <p className="text-muted mt-1 text-sm">Check back soon for fresh offers.</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {deals.map((deal) =>
            deal.dispensary ? (
              <DealCard
                key={deal.id}
                deal={{
                  title: deal.title,
                  description: deal.description,
                  code: deal.code,
                  discountType: deal.discount_type,
                  discountValue: deal.discount_value,
                  dispensarySlug: deal.dispensary.slug,
                  dispensaryName: deal.dispensary.name,
                  city: deal.dispensary.city,
                  state: deal.dispensary.state,
                }}
              />
            ) : null,
          )}
        </div>
      )}

      <FaqSection items={faqs} />
    </main>
  );
}
