import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Tag } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { DealCard } from '@/components/deal-card';
import { FaqSection } from '@/components/seo/faq-section';
import { JsonLd } from '@/components/seo/json-ld';
import { itemListJsonLd, pageSeo, US_STATES } from '@/lib/seo';
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

async function activeDealsInState(code: string): Promise<DealRow[]> {
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
  return (data ?? []) as unknown as DealRow[];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string }>;
}): Promise<Metadata> {
  const { state } = await params;
  const name = US_STATES[state.toUpperCase()];
  if (!name) return { title: 'Deals' };
  const title = `Cannabis Deals in ${name}`;
  const description = `Find live cannabis deals and discounts from licensed dispensaries in ${name}. Compare offers and order for pickup or delivery on Weedtip.`;
  return pageSeo({ title, description, path: `/deals/${state.toLowerCase()}` });
}

export default async function StateDealsPage({
  params,
}: {
  params: Promise<{ state: string }>;
}) {
  const { state } = await params;
  const code = state.toUpperCase();
  const stateName = US_STATES[code];
  if (!stateName) notFound();

  const deals = await activeDealsInState(code);

  const faqs = [
    {
      question: `Are there cannabis deals in ${stateName}?`,
      answer: `Weedtip lists ${deals.length} active ${deals.length === 1 ? 'deal' : 'deals'} from licensed dispensaries in ${stateName}, updated as offers change.`,
    },
    {
      question: `How do I redeem a cannabis deal in ${stateName}?`,
      answer: `Open the dispensary offering the deal, add qualifying items to your cart, and the discount applies at checkout per that dispensary's terms.`,
    },
    {
      question: `Do I need to be 21 to use cannabis deals?`,
      answer: `Yes — you must be 21 or older (or a qualifying medical patient where permitted) and present a valid ID at pickup or delivery.`,
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
        ]}
      />
      <h1 className="text-2xl font-bold">Cannabis deals in {stateName}</h1>
      <p className="text-muted mt-1 text-sm">
        {deals.length} active {deals.length === 1 ? 'deal' : 'deals'} from licensed dispensaries.
      </p>

      {deals.length === 0 ? (
        <div className="rounded-card border-border bg-surface mt-6 border p-10 text-center">
          <Tag className="text-muted mx-auto h-8 w-8" />
          <p className="mt-2 font-medium">No active deals in {stateName} right now</p>
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
