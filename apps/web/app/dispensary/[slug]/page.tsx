import type { Metadata } from 'next';
import { Link } from 'next-view-transitions';
import { notFound, permanentRedirect } from 'next/navigation';
import {
  BadgeCheck,
  Check,
  Globe,
  Mail,
  MapPin,
  Megaphone,
  Navigation,
  PenLine,
  Phone,
  Store,
  Truck,
} from 'lucide-react';
import { AMENITY_GROUPS, AMENITY_LABELS, type OperatingHours } from '@weedtip/shared';
import { ShopViewTracker } from '@/components/analytics/shop-view-tracker';
import { RecordRecentlyViewed } from '@/components/recently-viewed';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ClaimListing } from '@/components/claim-listing';
import { LineupCard, type LineupItem } from '@/components/brand/lineup-card';
import { DispensaryCard } from '@/components/dispensary-card';
import { MenuBrowser, type MenuBrowserItem } from '@/components/dispensary/menu-browser';
import { ReviewList } from '@/components/dispensary/review-list';
import { MiniMap } from '@/components/dispensary/mini-map';
import { LogoImage } from '@/components/logo-image';
import { FavoriteButton } from '@/components/favorite-button';
import { ScrollCarousel } from '@/components/home/scroll-carousel';
import { MediaImage } from '@/components/media-image';
import { RatingStars } from '@/components/rating-stars';
import { ReviewForm } from '@/components/review-form';
import { JsonLd } from '@/components/seo/json-ld';
import { Badge } from '@/components/ui/badge';
import { DAY_ORDER, dayLabel, dealBadge, formatTime } from '@/lib/format';
import { getAuth } from '@/lib/auth';
import { CATALOG_IMAGE_EMBED, cardImageUrl, catalogImageSrc } from '@/lib/catalog';
import { generatedAbout } from '@/lib/shop-copy';
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

  const place = data.city ? `${data.city}, ${data.state}` : `${data.state} (delivery)`;
  const title = `${data.name} — ${place}`;
  const description =
    data.description?.slice(0, 160) ??
    `${data.name}${data.city ? ` in ${data.city}, ${data.state}` : ` — delivery in ${data.state}`}. Browse the menu, deals, hours, and reviews, then order for pickup or delivery on Weedtip.`;
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
  if (!d) {
    // A retired duplicate slug (from the dedup pass) 301s to its survivor so
    // indexed/linked old URLs keep their equity instead of 404ing.
    const { data: redir } = await supabase
      .from('dispensary_redirects')
      .select('new_slug')
      .eq('old_slug', slug)
      .maybeSingle();
    if (redir?.new_slug) permanentRedirect(`/dispensary/${redir.new_slug}`);
    notFound();
  }

  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);
  const [
    { data: products },
    { data: deals },
    { data: reviews },
    { data: updates },
    { data: promos },
    { user, profile },
    { data: region },
  ] = await Promise.all([
      supabase
        .from('products')
        .select(`*, category:categories(name,slug,sort_order), ${CATALOG_IMAGE_EMBED}`)
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
        .select(
          'id,rating,quality,service,atmosphere,verified,body,created_at,author_name,user_id,owner_reply,owner_reply_at,photo_urls,helpful_count',
        )
        .eq('dispensary_id', d.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('dispensary_updates')
        .select('id,title,body,created_at')
        .eq('dispensary_id', d.id)
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('dispensary_promos')
        .select('id,title,description,image_url,start_date,end_date')
        .eq('dispensary_id', d.id)
        .eq('is_active', true)
        .or(`start_date.is.null,start_date.lte.${today}`)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .order('sort_order')
        .limit(10),
      getAuth(),
      supabase
        .from('operating_regions')
        .select('is_medical_legal,is_recreational_legal')
        .eq('state', d.state)
        .maybeSingle(),
    ]);
  const medicalOnly = !!region && region.is_medical_legal && !region.is_recreational_legal;

  const avgRating = reviews?.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;
  const myReview = user ? (reviews ?? []).find((r) => r.user_id === user.id) : undefined;

  // Which reviews has the viewer already marked helpful?
  const myVotes = new Set<string>();
  if (user && reviews?.length) {
    const { data: votes } = await supabase
      .from('review_votes')
      .select('review_id')
      .eq('user_id', user.id)
      .in('review_id', reviews.map((r) => r.id));
    for (const v of votes ?? []) myVotes.add(v.review_id);
  }

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

  // Unclaimed, active listings can be claimed by dispensary-owner accounts —
  // but only when we hold the state license on file to verify the claim against.
  // Any unclaimed, license-verified listing advertises the claim path to
  // EVERYONE (Yelp/Weedmaps pattern) — the wizard itself needs a business
  // account, so visitors are funneled through sign-up and back here.
  const claimable = !d.owner_id && !!d.license_number;
  const canClaim = claimable && profile?.role === 'dispensary_owner' && !!user;
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

  // Active auto-apply storefront sales → effective price per product.
  const { data: salePrices } = await supabase.rpc('dispensary_sale_prices', {
    p_dispensary_id: d.id,
  });
  const saleByProduct = new Map(
    (salePrices ?? []).map((s) => [s.product_id, s] as const),
  );

  // Paying listings don't cross-promote competitors: the nearby rail below is
  // a free-listing tradeoff, removed once the shop pays. `featured` is the
  // public paid signal; is_paid_listing() additionally covers subscriptions
  // and non-featured placements. RPC errors degrade to "free" (rail shows).
  let paidListing = d.featured;
  if (!paidListing) {
    const { data: paid } = await supabase.rpc('is_paid_listing', { p_dispensary_id: d.id });
    paidListing = paid === true;
  }

  // Nearby shops rail (Weedmaps pattern): same city first, top state shops as
  // fill — always photo-backed so the rail merchandises well. Also the main
  // internal-linking surface between the 9k+ listing pages. Skipped entirely
  // for paying listings.
  const NEARBY_FIELDS =
    'slug,name,city,state,cover_image_url,logo_url,is_delivery,is_pickup,is_medical,is_recreational,featured,rating_avg,rating_count,hours,timezone';
  const nearby = paidListing
    ? []
    : await (async () => {
        let nearbyBase = supabase
          .from('dispensaries')
          .select(NEARBY_FIELDS)
          .eq('status', 'active')
          .neq('id', d.id)
          .eq('state', d.state)
          .not('cover_image_url', 'is', null)
          .order('featured', { ascending: false })
          .order('rating_count', { ascending: false })
          .limit(8);
        if (d.city) nearbyBase = nearbyBase.eq('city', d.city);
        const { data } = await nearbyBase;
        const shops = data ?? [];
        if (shops.length < 4) {
          const seen = new Set([...shops.map((n) => n.slug), d.slug]);
          const { data: stateFill } = await supabase
            .from('dispensaries')
            .select(NEARBY_FIELDS)
            .eq('status', 'active')
            .eq('state', d.state)
            .not('cover_image_url', 'is', null)
            .order('featured', { ascending: false })
            .order('rating_count', { ascending: false })
            .limit(12);
          for (const s of stateFill ?? []) {
            if (shops.length >= 8) break;
            if (!seen.has(s.slug)) {
              shops.push(s);
              seen.add(s.slug);
            }
          }
        }
        return shops;
      })();

  // When the shop has no published menu, merchandise the official brand
  // catalog instead of dead-ending — the page still shows real products.
  let catalogSpotlight: LineupItem[] = [];
  if ((products ?? []).length === 0) {
    const { data: lineup } = await supabase
      .from('brand_products')
      .select('id,name,strain_type,thc_percentage,description,image_url,brand:brands!inner(name,slug,logo_url)')
      .not('image_url', 'is', null)
      .order('sort_order')
      .limit(8);
    catalogSpotlight = (lineup ?? []).map((it) => {
      const brand = it.brand as unknown as { name: string; slug: string; logo_url: string | null };
      return {
        id: it.id,
        name: it.name,
        strainType: it.strain_type,
        thcPercentage: it.thc_percentage,
        description: it.description,
        imageUrl: catalogImageSrc(it.id, it.image_url),
        brandName: brand.name,
        brandSlug: brand.slug,
        brandLogoUrl: brand.logo_url,
      };
    });
  }

  // Flatten the menu for the interactive browser (search + category tabs + sort).
  const menuItems: MenuBrowserItem[] = (products ?? []).map((p) => {
    const cat = p.category as { name: string; slug: string; sort_order: number } | null;
    const sale = saleByProduct.get(p.id);
    return {
      id: p.id,
      name: p.name,
      brand: p.brand,
      priceCents: sale?.sale_cents ?? p.price_cents,
      originalPriceCents: sale ? p.price_cents : null,
      imageUrl: cardImageUrl(p),
      strainType: p.strain_type,
      thcPercentage: p.thc_percentage,
      inStock: p.in_stock,
      categorySlug: cat?.slug ?? 'other',
      categoryName: cat?.name ?? 'Other',
      categorySort: cat?.sort_order ?? 999,
    };
  });

  // Storefront photo gallery: Google photo references proxied through our API.
  const galleryUrls = ((d.google_photo_names as string[] | null) ?? [])
    .slice(0, 8)
    .map((_, i) => `/api/dispensary-photo/${d.slug}/${i}`);

  const hours = d.hours as OperatingHours | null;
  // Open-now status in the shop's own timezone, computed at request time. Falls
  // back to Eastern (the map default for unlisted states) if none is stored.
  const shopTz = (d.timezone as string | null) || 'America/New_York';
  const localNow = new Date(new Date().toLocaleString('en-US', { timeZone: shopTz }));
  const todayKey = (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[localNow.getDay()]!;
  const nowMinutes = localNow.getHours() * 60 + localNow.getMinutes();
  const toMinutes = (t: string) => {
    const [h = '0', m = '0'] = t.split(':');
    return Number(h) * 60 + Number(m);
  };
  const todayHours = hours?.[todayKey] ?? null;
  const isOpenNow =
    !!todayHours &&
    nowMinutes >= toMinutes(todayHours.open) &&
    nowMinutes < toMinutes(todayHours.close);

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
    ...(d.cover_image_url
      ? {
          image: d.cover_image_url.startsWith('http')
            ? d.cover_image_url
            : `${SITE_URL}${d.cover_image_url}`,
        }
      : {}),
    ...(d.phone ? { telephone: d.phone } : {}),
    ...(d.website ? { sameAs: [d.website] } : {}),
    address: {
      '@type': 'PostalAddress',
      ...(d.address ? { streetAddress: d.address } : {}),
      ...(d.city ? { addressLocality: d.city } : {}),
      addressRegion: d.state,
      ...(d.zip ? { postalCode: d.zip } : {}),
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
    // Delivery-only listings have no city — skip the city crumb.
    ...(d.city
      ? [{ name: d.city, href: `/dispensaries/${d.state.toLowerCase()}/${citySlug(d.city)}` }]
      : []),
    { name: d.name, href: `/dispensary/${d.slug}` },
  ];

  return (
    <main>
      <JsonLd data={jsonLd} />
      <ShopViewTracker
        dispensaryId={d.id}
        slug={d.slug}
        name={d.name}
        city={d.city}
        state={d.state}
      />
      <RecordRecentlyViewed
        item={{
          kind: 'dispensary',
          href: `/dispensary/${d.slug}`,
          name: d.name,
          image: d.cover_image_url,
          sub: d.city ? `${d.city}, ${d.state}` : d.state,
        }}
      />
      <div className="mx-auto max-w-7xl px-4 pt-4">
        <Breadcrumbs items={crumbs} />
      </div>
      {/* Hero banner (claimed look: cover photo + overlapping logo) */}
      <MediaImage
        url={d.cover_image_url}
        alt={d.name}
        className="h-56 sm:h-80"
        iconClassName="h-16 w-16"
      >
        <div
          className="from-background via-background/20 absolute inset-0 bg-gradient-to-t to-transparent"
          aria-hidden
        />
      </MediaImage>
      <div className="mx-auto max-w-7xl px-4">
        <div className="relative z-10 -mt-10 sm:-mt-14">
          <LogoImage
            src={d.logo_url}
            name={d.name}
            hideWhenEmpty={false}
            textClassName="text-3xl"
            className="ring-background bg-surface h-20 w-20 shadow-lg ring-4 sm:h-28 sm:w-28"
            rounded="rounded-2xl"
          />
        </div>

        {/* relative: the hero's absolute gradient overlay must not paint over
            this row (static content stacks below positioned elements). */}
        <div className="relative mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold sm:text-4xl">{d.name}</h1>
            <p className="text-muted mt-1.5 flex items-center gap-1 text-sm">
              {d.is_delivery && !d.is_pickup ? (
                <>
                  <Truck className="h-4 w-4" /> Delivery only
                  {d.county ? ` · serves ${d.county} County, ${d.state}` : ` · ${d.state}`}
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4" />{' '}
                  {[d.address, d.city, d.state].filter(Boolean).join(', ')}
                  {d.zip ? ` ${d.zip}` : ''}
                </>
              )}
            </p>
            {d.legal_name && d.legal_name.toLowerCase() !== d.name.toLowerCase() && (
              <p className="text-muted/80 mt-0.5 text-xs">Licensed as {d.legal_name}</p>
            )}

            {/* Rating summary + live status, up top */}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              {avgRating > 0 && (
                <a href="#reviews" className="flex items-center gap-1.5 hover:underline">
                  <RatingStars rating={avgRating} />
                  <span className="text-sm font-semibold">{avgRating.toFixed(1)}</span>
                  <span className="text-muted text-sm">({reviews!.length} reviews)</span>
                </a>
              )}
              {avgRating >= 4.5 && reviews && reviews.length >= 10 && (
                <Badge tone="primary">Top Rated</Badge>
              )}
              {hours && (
                <span
                  className={`text-sm font-medium ${isOpenNow ? 'text-primary' : 'text-muted'}`}
                >
                  {isOpenNow && todayHours
                    ? `Open until ${formatTime(todayHours.close)}`
                    : 'Closed now'}
                </span>
              )}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
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

          {/* Action row: Directions · Call · Website · Add review */}
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
            {(d.latitude != null || d.address) && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                  d.latitude != null && d.longitude != null
                    ? `${d.latitude},${d.longitude}`
                    : [d.address, d.city, d.state, d.zip].filter(Boolean).join(', '),
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border bg-surface hover:border-primary/50 hover:text-primary inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
              >
                <Navigation className="h-4 w-4" /> Directions
              </a>
            )}
            {d.phone && (
              <a
                href={`tel:${d.phone.replace(/[^+\d]/g, '')}`}
                className="border-border bg-surface hover:border-primary/50 hover:text-primary inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
              >
                <Phone className="h-4 w-4" /> Call
              </a>
            )}
            {d.email && (
              <a
                href={`mailto:${d.email}`}
                className="border-border bg-surface hover:border-primary/50 hover:text-primary inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
              >
                <Mail className="h-4 w-4" /> Email
              </a>
            )}
            {d.website && (
              <a
                href={d.website}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border bg-surface hover:border-primary/50 hover:text-primary inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
              >
                <Globe className="h-4 w-4" /> Website
              </a>
            )}
            <a
              href="#reviews"
              className="border-border bg-surface hover:border-primary/50 hover:text-primary inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
            >
              <PenLine className="h-4 w-4" /> Add review
            </a>
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

        {/* Sticky section bar (Weedmaps-style page nav; categories live in the menu browser) */}
        {(menuItems.length > 0 || (deals?.length ?? 0) > 0 || galleryUrls.length > 0) && (
          <nav
            aria-label="Page sections"
            className="border-border/70 bg-background/85 sticky top-16 z-30 -mx-4 mt-6 border-b px-4 backdrop-blur-xl"
          >
            <div className="scrollbar-none flex items-center gap-1 overflow-x-auto py-2">
              {(deals?.length ?? 0) > 0 && (
                <a
                  href="#deals"
                  className="text-primary hover:bg-primary-muted shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold"
                >
                  Deals
                </a>
              )}
              {menuItems.length > 0 && (
                <a
                  href="#menu"
                  className="text-muted hover:bg-surface-2 hover:text-foreground shrink-0 rounded-full px-3 py-1.5 text-sm font-medium"
                >
                  Menu
                </a>
              )}
              {galleryUrls.length > 0 && (
                <a
                  href="#photos"
                  className="text-muted hover:bg-surface-2 hover:text-foreground shrink-0 rounded-full px-3 py-1.5 text-sm font-medium"
                >
                  Photos
                </a>
              )}
              {(updates?.length ?? 0) > 0 && (
                <a
                  href="#updates"
                  className="text-muted hover:bg-surface-2 hover:text-foreground shrink-0 rounded-full px-3 py-1.5 text-sm font-medium"
                >
                  Updates
                </a>
              )}
              <a
                href="#reviews"
                className="text-muted hover:bg-surface-2 hover:text-foreground shrink-0 rounded-full px-3 py-1.5 text-sm font-medium"
              >
                Reviews
              </a>
            </div>
          </nav>
        )}

        {/* Deals strip */}
        {deals && deals.length > 0 && (
          <section id="deals" className="mt-6 scroll-mt-32">
            <h2 className="mb-3 text-lg font-semibold">Active deals</h2>
            <ScrollCarousel itemClassName="w-80" ariaLabel="Active deals">
              {deals.map((deal) => (
                <div
                  key={deal.id}
                  className="rounded-card border-primary/25 bg-primary-subtle flex h-full items-start justify-between gap-3 border p-4"
                >
                  <div className="min-w-0">
                    <p className="text-primary font-semibold">{deal.title}</p>
                    {deal.description && (
                      <p className="text-muted mt-1 line-clamp-2 text-sm">{deal.description}</p>
                    )}
                    {deal.code && (
                      <p className="mt-2 text-xs">
                        <span className="border-primary/40 text-primary rounded border border-dashed px-1.5 py-0.5 font-mono font-medium">
                          Use code {deal.code}
                        </span>
                      </p>
                    )}
                  </div>
                  <Badge tone="primary" className="shrink-0">
                    {dealBadge(deal.discount_type, deal.discount_value)}
                  </Badge>
                </div>
              ))}
            </ScrollCarousel>
          </section>
        )}

        {canClaim && (
          <div className="mt-6">
            <ClaimListing
              dispensaryId={d.id}
              slug={d.slug}
              existingStatus={ownershipStatus}
              legalName={d.legal_name}
              licenseNumber={d.license_number}
            />
          </div>
        )}

        {claimable && !canClaim && (
          <div className="rounded-card border-border bg-surface mt-6 flex flex-wrap items-center justify-between gap-3 border p-4">
            <div className="min-w-0">
              <p className="font-medium">Own this dispensary?</p>
              <p className="text-muted text-sm">
                Claim this free listing to manage your menu, hours, photos, deals, and orders —
                verified against the state license on file.
              </p>
            </div>
            <Link
              href={`/sign-up?role=dispensary_owner&next=/dispensary/${d.slug}`}
              className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
            >
              Claim this listing
            </Link>
          </div>
        )}

        {d.announcement && (
          <div className="rounded-card border-primary/30 bg-primary-muted mt-6 flex items-start gap-2 border p-4">
            <Megaphone className="text-primary mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-foreground text-sm">{d.announcement}</p>
          </div>
        )}

        {medicalOnly && (
          <div className="rounded-card border-border bg-surface-2 mt-6 border p-4">
            <p className="text-sm font-medium">Medical patients only</p>
            <p className="text-muted mt-0.5 text-sm">
              {d.state} licenses medical cannabis sales only. A valid medical card (or qualifying
              patient registration) is required to purchase.
            </p>
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          {/* min-w-0: grid items default to min-width auto, so the horizontal
              carousels inside would otherwise stretch the page sideways. */}
          <div className="min-w-0 space-y-8 lg:col-span-2">
            <section>
              <h2 className="mb-2 text-lg font-semibold">About</h2>
              <p className="text-muted">{d.description ?? generatedAbout(d, hours)}</p>
            </section>

            {d.amenities && d.amenities.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-semibold">Features &amp; amenities</h2>
                <div className="space-y-3">
                  {AMENITY_GROUPS.map((group) => {
                    const items = group.items.filter((a) => d.amenities.includes(a));
                    if (items.length === 0) return null;
                    return (
                      <div key={group.label}>
                        <p className="text-muted mb-1.5 text-xs font-semibold uppercase tracking-wide">
                          {group.label}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {items.map((a) => (
                            <span
                              key={a}
                              className="border-border bg-surface text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
                            >
                              <Check className="text-primary h-3.5 w-3.5" />
                              {AMENITY_LABELS[a]}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* In-store promos */}
            {promos && promos.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                  <BadgeCheck className="text-primary h-5 w-5" /> In-store offers
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {promos.map((promo) => (
                    <div
                      key={promo.id}
                      className="rounded-card border-border bg-surface overflow-hidden border"
                    >
                      {promo.image_url && (
                        <img
                          src={promo.image_url}
                          alt=""
                          className="h-32 w-full object-cover"
                        />
                      )}
                      <div className="p-4">
                        <p className="font-medium">{promo.title}</p>
                        {promo.description && (
                          <p className="text-muted mt-1 text-sm">{promo.description}</p>
                        )}
                        <p className="text-muted mt-2 text-xs">Claim in-store</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Menu */}
            <section id="menu" className="scroll-mt-32">
              <h2 className="mb-3 text-lg font-semibold">Menu</h2>
              {menuItems.length === 0 ? (
                <div className="space-y-5">
                  <div className="rounded-card border-border bg-surface text-muted border border-dashed p-6 text-center text-sm">
                    <p className="text-foreground font-medium">Menu coming soon</p>
                    <p className="mt-1">
                      {d.owner_id
                        ? 'This dispensary hasn’t published its menu yet.'
                        : d.license_number
                          ? 'This is an unclaimed listing. Are you the owner? Claim it to add your live menu, deals, and photos.'
                          : 'This is an unclaimed listing. Claiming opens once its state license is verified on our end.'}
                    </p>
                    {d.phone && (
                      <p className="mt-2">
                        Call{' '}
                        <a
                          href={`tel:${d.phone.replace(/[^+\d]/g, '')}`}
                          className="text-primary font-medium hover:underline"
                        >
                          {d.phone}
                        </a>{' '}
                        for today&apos;s menu and availability.
                      </p>
                    )}
                  </div>
                  {catalogSpotlight.length > 0 && (
                    <div>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="font-semibold">
                          Popular products {d.state ? `in ${US_STATES[d.state] ?? d.state}` : ''}
                        </h3>
                        <Link
                          href="/products"
                          className="text-primary shrink-0 text-sm font-medium hover:underline"
                        >
                          Browse all →
                        </Link>
                      </div>
                      <p className="text-muted mb-3 text-sm">
                        Official brand lineups you can ask for at licensed shops like this one.
                      </p>
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {catalogSpotlight.map((item) => (
                          <LineupCard key={item.id} item={item} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <MenuBrowser
                  dispensary={{ id: d.id, slug: d.slug, name: d.name }}
                  items={menuItems}
                />
              )}
            </section>

            {/* Storefront photos (Google-enriched gallery) */}
            {galleryUrls.length > 0 && (
              <section id="photos" className="scroll-mt-32">
                <h2 className="mb-3 text-lg font-semibold">Photos</h2>
                <ScrollCarousel itemClassName="w-72" ariaLabel="Storefront photos">
                  {galleryUrls.map((url, i) => (
                    <img
                      key={url}
                      src={url}
                      alt={`${d.name} photo ${i + 1}`}
                      loading="lazy"
                      className="border-border bg-surface-2 h-44 w-72 rounded-xl border object-cover"
                    />
                  ))}
                </ScrollCarousel>
              </section>
            )}

            {/* Updates from the shop */}
            {updates && updates.length > 0 && (
              <section id="updates" className="mb-8 scroll-mt-32">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                  <Megaphone className="text-primary h-5 w-5" /> Updates
                </h2>
                <div className="space-y-3">
                  {updates.map((u) => (
                    <div key={u.id} className="rounded-card border-border bg-surface border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{u.title}</p>
                        <span className="text-muted text-xs">
                          {new Date(u.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {u.body && <p className="text-muted mt-1 text-sm">{u.body}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Reviews */}
            <section id="reviews" className="scroll-mt-32">
              <h2 className="mb-3 text-lg font-semibold">Reviews</h2>
              {d.rating_count > 0 &&
                (d.rating_quality > 0 || d.rating_service > 0 || d.rating_atmosphere > 0) && (
                  <div className="rounded-card border-border bg-surface mb-4 grid grid-cols-3 gap-2 border p-4 text-center">
                    {(
                      [
                        ['Quality', d.rating_quality],
                        ['Service', d.rating_service],
                        ['Atmosphere', d.rating_atmosphere],
                      ] as const
                    ).map(([label, val]) => (
                      <div key={label}>
                        <p className="text-xl font-bold">{val.toFixed(1)}</p>
                        <p className="text-muted text-xs uppercase tracking-wide">{label}</p>
                      </div>
                    ))}
                  </div>
                )}
              {user && !isOwner && (
                <div className="rounded-card border-border bg-surface mb-6 border p-4">
                  <p className="mb-3 text-sm font-medium">
                    {myReview ? 'Edit your review' : 'Leave a review'}
                  </p>
                  <ReviewForm
                    dispensaryId={d.id}
                    dispensarySlug={d.slug}
                    initialQuality={myReview?.quality ?? 0}
                    initialService={myReview?.service ?? 0}
                    initialAtmosphere={myReview?.atmosphere ?? 0}
                    initialBody={myReview?.body ?? ''}
                    initialPhotoUrls={myReview?.photo_urls ?? []}
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
                <ReviewList
                  dispensaryName={d.name}
                  dispensarySlug={d.slug}
                  currentUserId={user?.id ?? null}
                  reviews={reviews.map((r) => ({
                    id: r.id,
                    rating: r.rating,
                    quality: r.quality,
                    service: r.service,
                    atmosphere: r.atmosphere,
                    verified: r.verified,
                    body: r.body,
                    createdAt: r.created_at,
                    authorName: r.author_name,
                    userId: r.user_id,
                    ownerReply: r.owner_reply,
                    ownerReplyAt: r.owner_reply_at,
                    photoUrls: r.photo_urls ?? [],
                    helpfulCount: r.helpful_count ?? 0,
                    votedByMe: myVotes.has(r.id),
                  }))}
                />
              ) : (
                <p className="text-muted">No reviews yet. Be the first.</p>
              )}
            </section>

            {/* Nearby shops (Weedmaps pattern) — keeps discovery going and
                interlinks listing pages for SEO. */}
            {nearby.length > 0 && (
              <section aria-label="Nearby dispensaries">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">
                    {d.city ? `More dispensaries near ${d.city}` : `More in ${US_STATES[d.state] ?? d.state}`}
                  </h2>
                  <Link
                    href={
                      d.city
                        ? `/dispensaries/${d.state.toLowerCase()}/${citySlug(d.city)}`
                        : `/dispensaries/${d.state.toLowerCase()}`
                    }
                    className="text-primary shrink-0 text-sm font-medium hover:underline"
                  >
                    View all →
                  </Link>
                </div>
                <ScrollCarousel itemClassName="w-72" ariaLabel="Nearby dispensaries">
                  {nearby.map((s) => (
                    <DispensaryCard
                      key={s.slug}
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
                        hours: (s.hours ?? null) as OperatingHours | null,
                        timezone: s.timezone,
                      }}
                    />
                  ))}
                </ScrollCarousel>
              </section>
            )}
          </div>

          {/* Sidebar: location + hours + contact */}
          <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
            {d.latitude != null && d.longitude != null && (
              <div className="rounded-card border-border bg-surface shadow-card border p-5">
                <h2 className="text-muted mb-3 text-sm font-semibold uppercase tracking-wide">
                  Location
                </h2>
                <MiniMap lat={d.latitude} lng={d.longitude} name={d.name} />
                {d.address && (
                  <p className="text-muted mt-3 text-sm">
                    {[d.address, d.city, d.state].filter(Boolean).join(', ')}
                    {d.zip ? ` ${d.zip}` : ''}
                  </p>
                )}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${d.latitude},${d.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary mt-2 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                >
                  <Navigation className="h-4 w-4" /> Get directions
                </a>
              </div>
            )}

            <div className="rounded-card border-border bg-surface shadow-card border p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-muted text-sm font-semibold uppercase tracking-wide">Hours</h2>
                {hours && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      isOpenNow
                        ? 'bg-primary-muted text-primary'
                        : 'bg-surface-2 text-muted border-border border'
                    }`}
                  >
                    {isOpenNow ? 'Open now' : 'Closed now'}
                  </span>
                )}
              </div>
              {hours ? (
                <ul className="space-y-1.5 text-sm">
                  {DAY_ORDER.map((day) => {
                    const h = hours[day];
                    const isToday = day === todayKey;
                    return (
                      <li
                        key={day}
                        className={`flex justify-between ${isToday ? 'text-foreground font-medium' : ''}`}
                      >
                        <span className={isToday ? '' : 'text-muted'}>{dayLabel(day)}</span>
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

            <div className="rounded-card border-border bg-surface shadow-card border p-5">
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
