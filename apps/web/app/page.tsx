import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { CategoryPills } from '@/components/category-pills';
import { DispensaryCard } from '@/components/dispensary-card';
import { SearchBar } from '@/components/search-bar';
import { JsonLd } from '@/components/seo/json-ld';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

const DISP_FIELDS =
  'slug,name,city,state,cover_image_url,is_delivery,is_pickup,is_medical,is_recreational,rating_avg,rating_count,status';

export default async function HomePage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [{ data: featured }, { data: categories }, { data: heroPlacements }] = await Promise.all([
    supabase
      .from('dispensaries')
      .select(
        'slug,name,city,state,cover_image_url,is_delivery,is_pickup,is_medical,is_recreational,featured,rating_avg,rating_count',
      )
      .eq('status', 'active')
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(8),
    supabase.from('categories').select('name,slug').order('sort_order'),
    supabase
      .from('placements')
      .select(`id,priority,dispensary:dispensaries(${DISP_FIELDS})`)
      .eq('type', 'hero')
      .eq('is_active', true)
      .lte('starts_at', nowIso)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order('priority', { ascending: false })
      .limit(4),
  ]);

  // Live hero spotlights backed by paid placements (active dispensaries only).
  const spotlights = (heroPlacements ?? [])
    .map((p) => ({ placementId: p.id, d: p.dispensary as Record<string, unknown> | null }))
    .filter(
      (s): s is { placementId: string; d: Record<string, unknown> } =>
        !!s.d && s.d.status === 'active',
    );

  return (
    <main>
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
      {/* Hero */}
      <section className="border-border relative overflow-hidden border-b">
        <div
          className="from-primary/10 absolute inset-0 bg-gradient-to-b to-transparent"
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:py-28">
          <span className="bg-primary-muted text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            Find licensed dispensaries near you
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
            The Google Maps of <span className="text-primary">cannabis</span>
          </h1>
          <p className="text-muted mx-auto mt-4 max-w-xl text-lg">
            Discover dispensaries, browse menus, read reviews, find deals, and order for pickup or
            delivery — all in one place.
          </p>
          <div className="mt-8">
            <SearchBar size="lg" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-16">
        {/* Browse by category */}
        <section>
          <h2 className="mb-5 text-xl font-semibold">Browse by category</h2>
          <CategoryPills categories={categories ?? []} />
        </section>

        {/* Spotlight — paid homepage hero placements */}
        {spotlights.length > 0 && (
          <section>
            <div className="mb-5 flex items-center gap-2">
              <h2 className="text-xl font-semibold">Spotlight</h2>
              <Badge tone="outline">Sponsored</Badge>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {spotlights.map(({ placementId, d }) => (
                <DispensaryCard
                  key={placementId}
                  d={{
                    slug: String(d.slug),
                    name: String(d.name),
                    city: String(d.city),
                    state: String(d.state),
                    coverImageUrl: (d.cover_image_url as string | null) ?? null,
                    isDelivery: Boolean(d.is_delivery),
                    isPickup: Boolean(d.is_pickup),
                    isMedical: Boolean(d.is_medical),
                    isRecreational: Boolean(d.is_recreational),
                    sponsored: true,
                    placementId,
                    rating: (d.rating_avg as number | null) ?? null,
                    reviewCount: (d.rating_count as number) ?? 0,
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* Featured dispensaries */}
        <section>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Featured dispensaries</h2>
            <Link href="/dispensaries">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          {featured && featured.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((d) => (
                <DispensaryCard
                  key={d.slug}
                  d={{
                    slug: d.slug,
                    name: d.name,
                    city: d.city,
                    state: d.state,
                    coverImageUrl: d.cover_image_url,
                    isDelivery: d.is_delivery,
                    isPickup: d.is_pickup,
                    isMedical: d.is_medical,
                    isRecreational: d.is_recreational,
                    featured: d.featured,
                    rating: d.rating_avg,
                    reviewCount: d.rating_count,
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="text-muted">No dispensaries yet. Check back soon.</p>
          )}
        </section>

        {/* Owner CTA */}
        <section className="rounded-card border-border bg-surface border p-8 text-center sm:p-12">
          <h2 className="text-2xl font-bold">Own a dispensary?</h2>
          <p className="text-muted mx-auto mt-2 max-w-md">
            List your shop on Weedtip, manage your menu and deals, and reach customers searching
            nearby.
          </p>
          <Link href="/sign-up" className="mt-6 inline-block">
            <Button size="lg">List your dispensary</Button>
          </Link>
        </section>
      </div>
    </main>
  );
}
