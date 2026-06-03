import type { Metadata } from 'next';
import { BadgeCheck } from 'lucide-react';
import { RatingStars } from '@/components/rating-stars';
import { DisputeForm } from '@/components/dashboard/dispute-form';
import { ReplyForm } from '@/components/dashboard/reply-form';
import { Badge } from '@/components/ui/badge';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Reviews' };

export default async function DashboardReviews() {
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();
  const { data: reviews } = await supabase
    .from('reviews')
    .select(
      'id,rating,quality,service,atmosphere,verified,body,created_at,author_name,owner_reply,owner_reply_at,dispute_reason,disputed_at',
    )
    .eq('dispensary_id', dispensary.id)
    .order('created_at', { ascending: false });

  const total = reviews?.length ?? 0;
  const avg = total ? (reviews ?? []).reduce((s, r) => s + r.rating, 0) / total : 0;
  const replied = (reviews ?? []).filter((r) => r.owner_reply).length;

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

      {!reviews || reviews.length === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted border p-10 text-center">
          No reviews yet.
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
