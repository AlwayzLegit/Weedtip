import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import { RatingStars } from '@/components/rating-stars';
import { DisputeForm } from '@/components/dashboard/dispute-form';
import { ReplyForm } from '@/components/dashboard/reply-form';
import { Badge } from '@/components/ui/badge';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Reviews' };

export default async function DashboardReviews({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; rating?: string }>;
}) {
  const { dispensary } = await requireOwnerDispensary();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: allReviews } = await supabase
    .from('reviews')
    .select(
      'id,rating,quality,service,atmosphere,verified,body,created_at,author_name,owner_reply,owner_reply_at,dispute_reason,disputed_at',
    )
    .eq('dispensary_id', dispensary.id)
    .order('created_at', { ascending: false });

  const everything = allReviews ?? [];
  const total = everything.length;
  const avg = total ? everything.reduce((s, r) => s + r.rating, 0) / total : 0;
  const replied = everything.filter((r) => r.owner_reply).length;
  const needsResponse = total - replied;

  // Filters (needs-response / replied + by star rating).
  const filter = sp.filter === 'needs_response' || sp.filter === 'replied' ? sp.filter : 'all';
  const ratingFilter = ['1', '2', '3', '4', '5'].includes(sp.rating ?? '') ? Number(sp.rating) : null;
  const reviews = everything.filter((r) => {
    if (filter === 'needs_response' && r.owner_reply) return false;
    if (filter === 'replied' && !r.owner_reply) return false;
    if (ratingFilter !== null && Math.round(r.rating) !== ratingFilter) return false;
    return true;
  });

  const qs = (next: { filter?: string; rating?: string }) => {
    const params = new URLSearchParams();
    const f = next.filter ?? filter;
    const rt = next.rating ?? (ratingFilter?.toString() ?? '');
    if (f && f !== 'all') params.set('filter', f);
    if (rt) params.set('rating', rt);
    const s = params.toString();
    return s ? `/dashboard/reviews?${s}` : '/dashboard/reviews';
  };

  const FILTERS = [
    { key: 'all', label: `All (${total})` },
    { key: 'needs_response', label: `Needs response (${needsResponse})` },
    { key: 'replied', label: `Replied (${replied})` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Reviews</h1>
        {total > 0 && (
          <div className="text-muted flex items-center gap-2 text-sm">
            <RatingStars rating={avg} />
            <span>
              {avg.toFixed(1)} · {total} review{total === 1 ? '' : 's'} · {replied} replied
            </span>
          </div>
        )}
      </div>

      <p className="text-muted text-sm">
        Respond publicly to reviews of {dispensary.name}. Your response appears beneath the review on
        your listing.
      </p>

      {total > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="border-border bg-surface flex overflow-hidden rounded-lg border text-sm">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={qs({ filter: f.key })}
                className={`px-3 py-1.5 font-medium ${filter === f.key ? 'bg-primary-muted text-primary' : 'text-muted hover:text-foreground'}`}
              >
                {f.label}
              </Link>
            ))}
          </div>
          <div className="border-border bg-surface flex overflow-hidden rounded-lg border text-sm">
            <Link
              href={qs({ rating: '' })}
              className={`px-3 py-1.5 font-medium ${ratingFilter === null ? 'bg-primary-muted text-primary' : 'text-muted hover:text-foreground'}`}
            >
              All ★
            </Link>
            {[5, 4, 3, 2, 1].map((n) => (
              <Link
                key={n}
                href={qs({ rating: String(n) })}
                className={`px-3 py-1.5 font-medium ${ratingFilter === n ? 'bg-primary-muted text-primary' : 'text-muted hover:text-foreground'}`}
              >
                {n}★
              </Link>
            ))}
          </div>
        </div>
      )}

      {total === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted border p-10 text-center">
          No reviews yet.
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted border p-10 text-center">
          No reviews match this filter.
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-card border-border bg-surface border p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <RatingStars rating={r.rating} />
                  <span className="text-sm font-medium">{r.author_name ?? 'Weedtip member'}</span>
                  {r.verified && (
                    <Badge tone="primary">
                      <BadgeCheck className="mr-0.5 h-3 w-3" /> Verified
                    </Badge>
                  )}
                  {r.owner_reply && <Badge tone="muted">Replied</Badge>}
                  {r.disputed_at && <Badge tone="muted">Disputed</Badge>}
                </div>
                <span className="text-muted text-xs">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>
              {(r.quality || r.service || r.atmosphere) && (
                <div className="text-muted mt-1.5 flex flex-wrap gap-x-4 text-xs">
                  {r.quality != null && <span>Quality {r.quality.toFixed(1)}</span>}
                  {r.service != null && <span>Service {r.service.toFixed(1)}</span>}
                  {r.atmosphere != null && <span>Atmosphere {r.atmosphere.toFixed(1)}</span>}
                </div>
              )}
              {r.body ? (
                <p className="text-muted mt-2 text-sm">{r.body}</p>
              ) : (
                <p className="text-muted mt-2 text-sm italic">No written comment.</p>
              )}
              <ReplyForm
                reviewId={r.id}
                dispensarySlug={dispensary.slug}
                existingReply={r.owner_reply}
              />
              <DisputeForm
                reviewId={r.id}
                dispensarySlug={dispensary.slug}
                existingReason={r.dispute_reason}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
