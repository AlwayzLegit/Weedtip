import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, Globe, Mail, MapPin, Megaphone, Phone, Store, Truck } from 'lucide-react';
import { AMENITY_LABELS, type Amenity, type OperatingHours } from '@weedtip/shared';
import { deleteReview } from '@/app/actions/reviews';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { AddToCart } from '@/components/cart/add-to-cart';
import { ClaimListing } from '@/components/claim-listing';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { FavoriteButton } from '@/components/favorite-button';
import { MediaImage } from '@/components/media-image';
import { ProductCard } from '@/components/product-card';
import { RatingStars } from '@/components/rating-stars';
import { ReviewForm } from '@/components/review-form';
import { JsonLd } from '@/components/seo/json-ld';
import { Badge } from '@/components/ui/badge';
import { DAY_ORDER, dayLabel, formatTime } from '@/lib/format';
import { getAuth } from '@/lib/auth';
import { citySlug, openingHoursSpec, US_STATES } from '@/lib/seo';
import { SITE_URL } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('dispensaries')
    .select('name,city,state,description')
    .eq('slug', slug)
    .maybeSingle();
  if (!data) return { title: 'Dispensary' };

  const title = `${data.name} — ${data.city}, ${data.state}`;
  const description =
    data.description?.slice(0, 160) ??
    `${data.name} in ${data.city}, ${data.state}. Browse the menu, deals, hours, and reviews, then order for pickup or delivery on Weedtip.`;
  const canonical = `/dispensary/${slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', title, description, url: canonical },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function DispensaryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: d } = await supabase
    .from('dispensaries')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (!d) notFound();

  const nowIso = new Date().toISOString();
  const [{ data: products }, { data: deals }, { data: reviews }, { user, profile }] =
    await Promise.all([
      supabase
        .from('products')
        .select('*, category:categories(name,slug,sort_order)')
        .eq('dispensary_id', d.id)
        .order('name'),
      supabase
        .from('deals')
        .select('*')
        .eq('dispensary_id', d.id)
        .eq('is_active', true)
        .lte('start_date', nowIso)
        .gte('end_date', nowIso)
        .order('end_date'),
      supabase
        .from('reviews')
        .select('id,rating,body,created_at,author_name,user_id,owner_reply,owner_reply_at')
        .eq('dispensary_id', d.id)
        .order('created_at', { ascending: false }),
      getAuth(),
    ]);

  const avgRating = reviews?.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;
  const myReview = user ? (reviews ?? []).find((r) => r.user_id === user.id) : undefined;

  let isFavorite = false;
  if (user) {
    const { data: fav } = await supabase
      .from('favorites')
      .select('dispensary_id')
      .eq('user_id', user.id)
      .eq('dispensary_id', d.id)
      .maybeSingle();
    isFavorite = !!fav;
  }
  // The actual owner of THIS shop — admins manage via /admin, not the owner dashboard.
  const isOwner = profile?.role === 'dispensary_owner' && d.owner_id === user?.id;

  // Unclaimed, active listings can be claimed by dispensary-owner accounts.
  const canClaim = !d.owner_id && profile?.role === 'dispensary_owner' && !!user;
  let ownershipStatus: 'pending' | 'approved' | 'rejected' | null = null;
  if (canClaim && user) {
    const { data: req } = await supabase
      .from('ownership_requests')
      .select('status')
      .eq('dispensary_id', d.id)
      .eq('user_id', user.id)
      .maybeSingle();
    ownershipStatus = (req?.status as 'pending' | 'approved' | 'rejected' | undefined) ?? null;
  }

  // Group menu by category, preserving sort_order.
  const sections = new Map<string, { name: string; sort: number; items: typeof products }>();
  for (const p of products ?? []) {
    const cat = p.category as { name: string; slug: string; sort_order: number } | null;
    const key = cat?.slug ?? 'other';
    if (!sections.has(key)) {
      sections.set(key, { name: cat?.name ?? 'Other', sort: cat?.sort_order ?? 999, items: [] });
    }
    sections.get(key)!.items!.push(p);
  }
  const menu = [...sections.values()].sort((a, b) => a.sort - b.sort);

  const hours = d.hours as OperatingHours | null;

  const prices = (products ?? []).map((p) => p.price_cents);
  const priceRange = prices.length
    ? `$${Math.round(Math.min(...prices) / 100)}–$${Math.round(Math.max(...prices) / 100)}`
    : undefined;
  const openingHours = openingHoursSpec(hours as Record<string, { open?: string; close?: string }> | null);

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    '@id': `${SITE_URL}/dispensary/${d.slug}`,
    name: d.name,
    url: `${SITE_URL}/dispensary/${d.slug}`,
    ...(d.description ? { description: d.description } : {}),
    ...(d.cover_image_url ? { image: d.cover_image_url } : {}),
    ...(d.phone ? { telephone: d.phone } : {}),
    ...(d.website ? { sameAs: [d.website] } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: d.address,
      addressLocality: d.city,
      addressRegion: d.state,
      postalCode: d.zip,
      addressCountry: 'US',
    },
    ...(d.latitude != null && d.longitude != null
      ? { geo: { '@type': 'GeoCoordinates', latitude: d.latitude, longitude: d.longitude } }
      : {}),
    ...(openingHours.length ? { openingHoursSpecification: openingHours } : {}),
    ...(priceRange ? { priceRange } : {}),
    ...(reviews && reviews.length > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number(avgRating.toFixed(1)),
            reviewCount: reviews.length,
          },
          review: reviews.slice(0, 10).map((r) => ({
            '@type': 'Review',
            reviewRating: {
              '@type': 'Rating',
              ratingValue: r.rating,
              bestRating: 5,
              worstRating: 1,
            },
            author: { '@type': 'Person', name: r.author_name ?? 'Weedtip member' },
            datePublished: new Date(r.created_at).toISOString().slice(0, 10),
            ...(r.body ? { reviewBody: r.body } : {}),
          })),
        }
      : {}),
  };

  const crumbs = [
    { name: 'Home', href: '/' },
    { name: 'Dispensaries', href: '/dispensaries' },
    { name: US_STATES[d.state] ?? d.state, href: `/dispensaries/${d.state.toLowerCase()}` },
    {
      name: d.city,
      href: `/dispensaries/${d.state.toLowerCase()}/${citySlug(d.city)}`,
    },
    { name: d.name, href: `/dispensary/${d.slug}` },
  ];

  return (
    <main>
      <JsonLd data={jsonLd} />
      <div className="mx-auto max-w-7xl px-4 pt-4">
        <Breadcrumbs items={crumbs} />
      </div>
      {/* Header */}
      <MediaImage
        url={d.cover_image_url}
        alt={d.name}
        className="h-48 sm:h-60"
        iconClassName="h-16 w-16"
      />
      <div className="mx-auto max-w-7xl px-4">
        <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="rounded-card border-border bg-surface border p-5">
            <h1 className="text-2xl font-bold">{d.name}</h1>
            <p className="text-muted mt-1 flex items-center gap-1 text-sm">
              <MapPin className="h-4 w-4" /> {d.address}, {d.city}, {d.state} {d.zip}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {avgRating > 0 && (
                <span className="flex items-center gap-1.5">
                  <RatingStars rating={avgRating} />
                  <span className="text-muted text-sm">
                    {avgRating.toFixed(1)} ({reviews!.length})
                  </span>
                </span>
              )}
              {d.is_pickup && (
                <Badge tone="outline">
                  <Store className="h-3 w-3" /> Pickup
                </Badge>
              )}
              {d.is_delivery && (
                <Badge tone="outline">
                  <Truck className="h-3 w-3" /> Delivery
                </Badge>
              )}
              {d.is_medical && <Badge tone="outline">Medical</Badge>}
              {d.is_recreational && <Badge tone="outline">Recreational</Badge>}
            </div>
          </div>
          <div className="flex gap-2">
            {user && !isOwner && (
              <FavoriteButton dispensaryId={d.id} slug={d.slug} isFavorite={isFavorite} />
            )}
            {isOwner && (
              <Link href="/dashboard">
                <Badge tone="primary" className="px-3 py-2">
                  Manage in dashboard
                </Badge>
              </Link>
            )}
          </div>
        </div>

        {canClaim && (
          <div className="mt-6">
            <ClaimListing dispensaryId={d.id} slug={d.slug} existingStatus={ownershipStatus} />
          </div>
        )}

        {d.announcement && (
          <div className="rounded-card border-primary/30 bg-primary-muted mt-6 flex items-start gap-2 border p-4">
            <Megaphone className="text-primary mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-foreground text-sm">{d.announcement}</p>
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            {d.description && (
              <section>
                <h2 className="mb-2 text-lg font-semibold">About</h2>
                <p className="text-muted">{d.description}</p>
              </section>
            )}

            {d.amenities && d.amenities.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-semibold">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {d.amenities.map((a) => (
                    <span
                      key={a}
                      className="border-border bg-surface text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
                    >
                      <Check className="text-primary h-3.5 w-3.5" />
                      {AMENITY_LABELS[a as Amenity] ?? a}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Deals */}
            {deals && deals.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-semibold">Active deals</h2>
                <div className="space-y-3">
                  {deals.map((deal) => (
                    <div
                      key={deal.id}
                      className="rounded-card border-primary/30 bg-primary-muted flex items-start justify-between border p-4"
                    >
                      <div>
                        <p className="text-primary font-semibold">{deal.title}</p>
                        {deal.description && (
                          <p className="text-muted mt-1 text-sm">{deal.description}</p>
                        )}
                        {deal.code && (
                          <p className="mt-2 text-xs">
                            <span className="border-primary/40 text-primary rounded border border-dashed px-1.5 py-0.5 font-mono font-medium">
                              Use code {deal.code}
                            </span>
                          </p>
                        )}
                      </div>
                      <Badge tone="primary">
                        {deal.discount_type === 'percentage'
                          ? `${deal.discount_value}% off`
                          : deal.discount_type === 'fixed'
                            ? `$${deal.discount_value} off`
                            : 'BOGO'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Menu */}
            <section>
              <h2 className="mb-3 text-lg font-semibold">Menu</h2>
              {menu.length === 0 ? (
                <p className="text-muted">No products listed yet.</p>
              ) : (
                <div className="space-y-8">
                  {menu.map((section) => (
                    <div key={section.name}>
                      <h3 className="text-muted mb-3 text-sm font-semibold uppercase tracking-wide">
                        {section.name}
                      </h3>
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                        {section.items!.map((p) => (
                          <div key={p.id} className="space-y-2">
                            <ProductCard
                              p={{
                                name: p.name,
                                brand: p.brand,
                                priceCents: p.price_cents,
                                imageUrl: p.image_urls[0] ?? null,
                                strainType: p.strain_type,
                                thcPercentage: p.thc_percentage,
                                inStock: p.in_stock,
                                productId: p.id,
                              }}
                            />
                            {p.in_stock && (
                              <AddToCart
                                dispensary={{ id: d.id, slug: d.slug, name: d.name }}
                                product={{
                                  productId: p.id,
                                  name: p.name,
                                  priceCents: p.price_cents,
                                }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Reviews */}
            <section>
              <h2 className="mb-3 text-lg font-semibold">Reviews</h2>
              {user && !isOwner && (
                <div className="rounded-card border-border bg-surface mb-6 border p-4">
                  <p className="mb-3 text-sm font-medium">
                    {myReview ? 'Edit your review' : 'Leave a review'}
                  </p>
                  <ReviewForm
                    dispensaryId={d.id}
                    dispensarySlug={d.slug}
                    initialRating={myReview?.rating ?? 0}
                    initialBody={myReview?.body ?? ''}
                  />
                </div>
              )}
              {!user && (
                <p className="text-muted mb-6 text-sm">
                  <Link href="/sign-in" className="text-primary hover:underline">
                    Sign in
                  </Link>{' '}
                  to leave a review.
                </p>
              )}
              {reviews && reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((r) => (
                    <div key={r.id} className="rounded-card border-border bg-surface border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <RatingStars rating={r.rating} />
                          <span className="text-sm font-medium">
                            {r.author_name ?? 'Weedtip member'}
                          </span>
                        </div>
                        <span className="text-muted text-xs">
                          {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {r.body && <p className="text-muted mt-2 text-sm">{r.body}</p>}
                      {r.owner_reply && (
                        <div className="border-border bg-surface-2 mt-3 rounded-lg border-l-2 border-l-primary p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground text-xs font-semibold">
                              Response from {d.name}
                            </span>
                            {r.owner_reply_at && (
                              <span className="text-muted text-xs">
                                {new Date(r.owner_reply_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <p className="text-muted mt-1 text-sm">{r.owner_reply}</p>
                        </div>
                      )}
                      {user && r.user_id === user.id && (
                        <div className="mt-2 flex items-center gap-2">
                          <Badge tone="muted">Your review</Badge>
                          <DeleteButton
                            action={deleteReview.bind(null, r.id, d.slug)}
                            label="Delete"
                            confirmText="Delete your review? This cannot be undone."
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted">No reviews yet. Be the first.</p>
              )}
            </section>
          </div>

          {/* Sidebar: hours + contact */}
          <aside className="space-y-6">
            <div className="rounded-card border-border bg-surface border p-5">
              <h2 className="text-muted mb-3 text-sm font-semibold uppercase tracking-wide">
                Hours
              </h2>
              {hours ? (
                <ul className="space-y-1.5 text-sm">
                  {DAY_ORDER.map((day) => {
                    const h = hours[day];
                    return (
                      <li key={day} className="flex justify-between">
                        <span className="text-muted">{dayLabel(day)}</span>
                        <span>
                          {h ? `${formatTime(h.open)} – ${formatTime(h.close)}` : 'Closed'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-muted text-sm">Hours not listed.</p>
              )}
            </div>

            <div className="rounded-card border-border bg-surface border p-5">
              <h2 className="text-muted mb-3 text-sm font-semibold uppercase tracking-wide">
                Contact
              </h2>
              <ul className="space-y-2 text-sm">
                {d.phone && (
                  <li className="flex items-center gap-2">
                    <Phone className="text-muted h-4 w-4" /> {d.phone}
                  </li>
                )}
                {d.email && (
                  <li className="flex items-center gap-2">
                    <Mail className="text-muted h-4 w-4" /> {d.email}
                  </li>
                )}
                {d.website && (
                  <li className="flex items-center gap-2">
                    <Globe className="text-muted h-4 w-4" />
                    <a
                      href={d.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Website
                    </a>
                  </li>
                )}
                {d.license_number && (
                  <li className="text-muted text-xs">License #{d.license_number}</li>
                )}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
