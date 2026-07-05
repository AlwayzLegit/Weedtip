import { MarketBanner } from '@/components/market-banner';
import type { Metadata } from 'next';
import { Truck } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { DispensaryCard } from '@/components/dispensary-card';
import { DispensaryMap, type MapPoint } from '@/components/dispensary-map';
import { FaqSection } from '@/components/seo/faq-section';
import { JsonLd } from '@/components/seo/json-ld';
import { itemListJsonLd, pageSeo } from '@/lib/seo';
import { createStaticClient } from '@/lib/supabase/static';

// Public, anon-only page — serve cached HTML and refresh every 60 min (ISR).
export const revalidate = 3600;

export const metadata: Metadata = pageSeo({
  title: 'Cannabis Delivery',
  description:
    'Find licensed cannabis delivery services near you. Browse menus and deals from dispensaries that deliver, and order online on Weedtip.',
  path: '/deliveries',
});

const SELECT =
  'id,slug,name,city,state,latitude,longitude,cover_image_url,logo_url,is_delivery,is_pickup,is_medical,is_recreational,featured,rating_avg,rating_count';

export default async function DeliveriesPage() {
  const supabase = createStaticClient();
  const { data } = await supabase
    .from('dispensaries')
    .select(SELECT)
    .eq('status', 'active')
    .eq('is_delivery', true)
    .order('featured', { ascending: false })
    .order('rating_count', { ascending: false });

  const shops = data ?? [];
  const points: MapPoint[] = shops
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      lat: s.latitude as number,
      lng: s.longitude as number,
      featured: s.featured,
    }));

  const faqs = [
    {
      question: 'How does cannabis delivery work on Weedtip?',
      answer:
        'Browse dispensaries that deliver, add products to your cart, and check out for delivery. A valid 21+ ID is required at handoff.',
    },
    {
      question: 'Is cannabis delivery legal near me?',
      answer:
        'Delivery availability depends on your state and local rules. Each dispensary page shows whether it offers delivery in your area.',
    },
    {
      question: 'How long does delivery take?',
      answer:
        'Delivery times vary by dispensary and distance. Order status updates appear in your account once you check out.',
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <JsonLd data={itemListJsonLd(shops.map((s) => `/dispensary/${s.slug}`))} />
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Deliveries', href: '/deliveries' },
        ]}
      />
      <div className="mt-2">
        <p className="eyebrow mb-1">Order to your door</p>
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <Truck className="text-primary h-7 w-7" /> Cannabis delivery
        </h1>
      <MarketBanner hrefPrefix="/dispensaries" label="dispensaries" />
        <p className="text-muted mt-1 text-sm">
          {shops.length} {shops.length === 1 ? 'dispensary delivers' : 'dispensaries deliver'} near
          you.
        </p>
      </div>

      {shops.length === 0 ? (
        <div className="card text-muted mt-8 p-12 text-center">
          <Truck className="text-muted mx-auto h-8 w-8" />
          <p className="mt-2 font-medium">No delivery services listed yet</p>
          <p className="mt-1 text-sm">Check back soon, or browse pickup dispensaries.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {shops.map((s) => (
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
                    featured: s.featured,
                    rating: s.rating_avg,
                    reviewCount: s.rating_count,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="hidden lg:block">
            <div className="rounded-card border-border shadow-card sticky top-20 h-[70vh] overflow-hidden border">
              <DispensaryMap points={points} />
            </div>
          </div>
        </div>
      )}

      <section className="mt-12 max-w-3xl">
        <h2 className="mb-2 text-lg font-semibold">Cannabis delivery near you</h2>
        <p className="text-muted text-sm leading-relaxed">
          Compare licensed dispensaries that deliver cannabis near you on Weedtip. Browse live menus,
          prices, and deals, read reviews, and order online for delivery. Bring a valid 21+ ID at
          handoff and check your local regulations before ordering.
        </p>
      </section>

      <FaqSection items={faqs} />
    </main>
  );
}
