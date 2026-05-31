import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Globe, Mail, MapPin, Phone, Store, Truck } from 'lucide-react';
import type { OperatingHours } from '@weedtip/shared';
import { AddToCart } from '@/components/cart/add-to-cart';
import { FavoriteButton } from '@/components/favorite-button';
import { ProductCard } from '@/components/product-card';
import { RatingStars } from '@/components/rating-stars';
import { ReviewForm } from '@/components/review-form';
import { Badge } from '@/components/ui/badge';
import { DAY_ORDER, dayLabel, formatTime } from '@/lib/format';
import { getAuth } from '@/lib/auth';
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
    .select('name,city,state')
    .eq('slug', slug)
    .maybeSingle();
  return { title: data ? `${data.name} — ${data.city}, ${data.state}` : 'Dispensary' };
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
        .select('id,rating,body,created_at')
        .eq('dispensary_id', d.id)
        .order('created_at', { ascending: false }),
      getAuth(),
    ]);

  const avgRating = reviews?.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

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

  return (
    <main>
      {/* Header */}
      <div
        className="from-primary/30 to-surface-2 h-48 bg-gradient-to-br sm:h-60"
        style={
          d.cover_image_url
            ? {
                backgroundImage: `url(${d.cover_image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
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

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            {d.description && (
              <section>
                <h2 className="mb-2 text-lg font-semibold">About</h2>
                <p className="text-muted">{d.description}</p>
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
                  <p className="mb-3 text-sm font-medium">Leave a review</p>
                  <ReviewForm dispensaryId={d.id} dispensarySlug={d.slug} />
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
                      <div className="flex items-center justify-between">
                        <RatingStars rating={r.rating} />
                        <span className="text-muted text-xs">
                          {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {r.body && <p className="text-muted mt-2 text-sm">{r.body}</p>}
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
