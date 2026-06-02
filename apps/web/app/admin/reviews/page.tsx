import type { Metadata } from 'next';
import Link from 'next/link';
import { adminDeleteProductReview, adminDeleteReview } from '@/app/admin/actions';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { RatingStars } from '@/components/rating-stars';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Reviews · Admin' };

export default async function AdminReviews() {
  const supabase = await createClient();
  const [{ data: reviews }, { data: productReviews }] = await Promise.all([
    supabase
      .from('reviews')
      .select('id,rating,body,author_name,created_at, dispensary:dispensaries(name,slug)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('product_reviews')
      .select('id,rating,body,author_name,created_at, product:products(id,name)')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Reviews</h2>
        <p className="text-muted mt-1 text-sm">Moderate dispensary and product reviews.</p>
      </div>

      <section>
        <h3 className="mb-3 text-lg font-semibold">Dispensary reviews</h3>
        {!reviews || reviews.length === 0 ? (
          <p className="text-muted text-sm">No reviews yet.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => {
              const d = r.dispensary as { name: string; slug: string } | null;
              return (
                <div
                  key={r.id}
                  className="rounded-card border-border bg-surface flex items-start justify-between gap-3 border p-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <RatingStars rating={r.rating} />
                      <span className="text-sm font-medium">{r.author_name ?? 'Member'}</span>
                      {d && (
                        <Link href={`/dispensary/${d.slug}`} className="text-muted text-xs hover:underline">
                          · {d.name}
                        </Link>
                      )}
                    </div>
                    {r.body && <p className="text-muted mt-1 text-sm">{r.body}</p>}
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
          <p className="text-muted text-sm">No product reviews yet.</p>
        ) : (
          <div className="space-y-3">
            {productReviews.map((r) => {
              const p = r.product as { id: string; name: string } | null;
              return (
                <div
                  key={r.id}
                  className="rounded-card border-border bg-surface flex items-start justify-between gap-3 border p-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <RatingStars rating={r.rating} />
                      <span className="text-sm font-medium">{r.author_name ?? 'Member'}</span>
                      {p && (
                        <Link href={`/product/${p.id}`} className="text-muted text-xs hover:underline">
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
