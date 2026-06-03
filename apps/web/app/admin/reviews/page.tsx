import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import { adminDeleteProductReview, adminDeleteReview } from '@/app/admin/actions';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { RatingStars } from '@/components/rating-stars';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Reviews · Admin' };

export default async function AdminReviews({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const lowOnly = filter === 'low';
  const disputedOnly = filter === 'disputed';

  const supabase = await createClient();
  const reviewsQuery = supabase
    .from('reviews')
    .select(
      'id,rating,verified,dispute_reason,disputed_at,body,author_name,created_at, dispensary:dispensaries(name,slug)',
    )
    .order('created_at', { ascending: false })
    .limit(50);
  const productQuery = supabase
    .from('product_reviews')
    .select('id,rating,body,author_name,created_at, product:products(id,name)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (lowOnly) {
    reviewsQuery.lte('rating', 2);
    productQuery.lte('rating', 2);
  }
  if (disputedOnly) reviewsQuery.not('disputed_at', 'is', null);
  const [{ data: reviews }, { data: productReviews }] = await Promise.all([reviewsQuery, productQuery]);

  const tabs = [
    { key: undefined, label: 'All recent' },
    { key: 'low', label: 'Low ratings (≤2★)' },
    { key: 'disputed', label: 'Disputed' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Moderation</p>
          <h2 className="text-2xl font-bold">Reviews</h2>
          <p className="text-muted mt-1 text-sm">Moderate dispensary and product reviews.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Link
              key={t.label}
              href={t.key ? `/admin/reviews?filter=${t.key}` : '/admin/reviews'}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                (filter ?? undefined) === t.key
                  ? 'border-primary bg-primary-muted text-primary'
                  : 'border-border text-muted hover:text-foreground',
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      <section>
        <h3 className="mb-3 text-lg font-semibold">Dispensary reviews</h3>
        {!reviews || reviews.length === 0 ? (
          <p className="text-muted text-sm">No reviews{lowOnly ? ' with low ratings' : ''}.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => {
              const d = r.dispensary as { name: string; slug: string } | null;
              return (
                <div
                  key={r.id}
                  className="rounded-card border-border bg-surface shadow-card flex items-start justify-between gap-3 border p-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <RatingStars rating={r.rating} />
                      <span className="text-sm font-medium">{r.author_name ?? 'Member'}</span>
                      {r.verified && (
                        <Badge tone="primary">
                          <BadgeCheck className="mr-0.5 h-3 w-3" /> Verified
                        </Badge>
                      )}
                      {r.disputed_at && <Badge tone="muted">Disputed</Badge>}
                      {d && (
                        <Link
                          href={`/dispensary/${d.slug}`}
                          className="text-muted text-xs hover:underline"
                        >
                          · {d.name}
                        </Link>
                      )}
                    </div>
                    {r.body && <p className="text-muted mt-1 text-sm">{r.body}</p>}
                    {r.dispute_reason && (
                      <p className="border-danger/40 bg-danger/10 text-danger mt-2 rounded-md border px-2 py-1 text-xs">
                        Owner dispute: {r.dispute_reason}
                      </p>
                    )}
                    <p className="text-muted mt-1 text-xs">
                      {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <DeleteButton
                    action={adminDeleteReview.bind(null, r.id)}
                    confirmText="Delete this review?"
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold">Product reviews</h3>
        {!productReviews || productReviews.length === 0 ? (
          <p className="text-muted text-sm">No product reviews{lowOnly ? ' with low ratings' : ''}.</p>
        ) : (
          <div className="space-y-3">
            {productReviews.map((r) => {
              const p = r.product as { id: string; name: string } | null;
              return (
                <div
                  key={r.id}
                  className="rounded-card border-border bg-surface shadow-card flex items-start justify-between gap-3 border p-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <RatingStars rating={r.rating} />
                      <span className="text-sm font-medium">{r.author_name ?? 'Member'}</span>
                      {p && (
                        <Link
                          href={`/product/${p.id}`}
                          className="text-muted text-xs hover:underline"
                        >
                          · {p.name}
                        </Link>
                      )}
                    </div>
                    {r.body && <p className="text-muted mt-1 text-sm">{r.body}</p>}
                    <p className="text-muted mt-1 text-xs">
                      {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <DeleteButton
                    action={adminDeleteProductReview.bind(null, r.id)}
                    confirmText="Delete this review?"
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
