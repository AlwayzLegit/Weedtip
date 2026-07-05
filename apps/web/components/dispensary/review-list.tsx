'use client';

import { useMemo, useState, useTransition } from 'react';
import { BadgeCheck, ThumbsUp } from 'lucide-react';
import { deleteReview, toggleHelpfulVote } from '@/app/actions/reviews';
import { RatingStars } from '@/components/rating-stars';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface ReviewListItem {
  id: string;
  rating: number;
  quality: number | null;
  service: number | null;
  atmosphere: number | null;
  verified: boolean;
  body: string | null;
  createdAt: string;
  authorName: string | null;
  userId: string;
  ownerReply: string | null;
  ownerReplyAt: string | null;
  photoUrls: string[];
  helpfulCount: number;
  /** Whether the CURRENT viewer has voted this review helpful. */
  votedByMe: boolean;
}

type SortKey = 'newest' | 'highest' | 'lowest' | 'helpful';
type FilterKey = 'all' | 'photos' | 'verified';

function HelpfulButton({
  review,
  signedIn,
}: {
  review: ReviewListItem;
  signedIn: boolean;
}) {
  const [voted, setVoted] = useState(review.votedByMe);
  const [count, setCount] = useState(review.helpfulCount);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (!signedIn) {
      setError('Sign in to mark reviews as helpful.');
      return;
    }
    setError(null);
    // Optimistic; reconciled with the server's answer.
    setVoted((v) => !v);
    setCount((c) => (voted ? Math.max(c - 1, 0) : c + 1));
    startTransition(async () => {
      const res = await toggleHelpfulVote(review.id);
      if ('error' in res) {
        setVoted(review.votedByMe);
        setCount(review.helpfulCount);
        setError(res.error);
      } else {
        setVoted(res.voted);
        setCount(res.count);
      }
    });
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={voted}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
          voted
            ? 'border-primary bg-primary-muted text-primary'
            : 'border-border text-muted hover:text-foreground',
        )}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
        Helpful{count > 0 ? ` (${count})` : ''}
      </button>
      {error && <span className="text-muted text-xs">{error}</span>}
    </span>
  );
}

/**
 * Interactive reviews block: sort (newest / highest / lowest / most helpful),
 * quick filters (photos, verified shoppers), photo strips, and helpful votes —
 * all client-side over the reviews the page already loaded.
 */
export function ReviewList({
  reviews,
  dispensaryName,
  dispensarySlug,
  currentUserId,
}: {
  reviews: ReviewListItem[];
  dispensaryName: string;
  dispensarySlug: string;
  currentUserId: string | null;
}) {
  const [sort, setSort] = useState<SortKey>('newest');
  const [filter, setFilter] = useState<FilterKey>('all');

  const visible = useMemo(() => {
    let list = reviews;
    if (filter === 'photos') list = list.filter((r) => r.photoUrls.length > 0);
    else if (filter === 'verified') list = list.filter((r) => r.verified);
    const sorted = [...list];
    switch (sort) {
      case 'highest':
        sorted.sort((a, b) => b.rating - a.rating || +new Date(b.createdAt) - +new Date(a.createdAt));
        break;
      case 'lowest':
        sorted.sort((a, b) => a.rating - b.rating || +new Date(b.createdAt) - +new Date(a.createdAt));
        break;
      case 'helpful':
        sorted.sort(
          (a, b) => b.helpfulCount - a.helpfulCount || +new Date(b.createdAt) - +new Date(a.createdAt),
        );
        break;
      default:
        sorted.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }
    return sorted;
  }, [reviews, sort, filter]);

  const photoCount = reviews.filter((r) => r.photoUrls.length > 0).length;
  const verifiedCount = reviews.filter((r) => r.verified).length;

  const chip = (active: boolean) =>
    cn(
      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
      active
        ? 'border-primary bg-primary-muted text-primary'
        : 'border-border text-muted hover:text-foreground',
    );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" className={chip(filter === 'all')} onClick={() => setFilter('all')}>
          All ({reviews.length})
        </button>
        {photoCount > 0 && (
          <button
            type="button"
            className={chip(filter === 'photos')}
            onClick={() => setFilter('photos')}
          >
            With photos ({photoCount})
          </button>
        )}
        {verifiedCount > 0 && (
          <button
            type="button"
            className={chip(filter === 'verified')}
            onClick={() => setFilter('verified')}
          >
            Verified ({verifiedCount})
          </button>
        )}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort reviews"
          className="border-border bg-surface ml-auto h-8 rounded-full border px-3 text-xs"
        >
          <option value="newest">Newest first</option>
          <option value="highest">Highest rated</option>
          <option value="lowest">Lowest rated</option>
          <option value="helpful">Most helpful</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="text-muted text-sm">No reviews match that filter.</p>
      ) : (
        <div className="space-y-4">
          {visible.map((r) => (
            <div key={r.id} className="rounded-card border-border bg-surface border p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <RatingStars rating={r.rating} />
                  <span className="text-sm font-medium">{r.authorName ?? 'Weedtip member'}</span>
                  {r.verified && (
                    <Badge tone="primary">
                      <BadgeCheck className="mr-0.5 h-3 w-3" /> Verified shopper
                    </Badge>
                  )}
                </div>
                <span className="text-muted text-xs">
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>

              {(r.quality || r.service || r.atmosphere) && (
                <div className="text-muted mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                  {r.quality != null && <span>Quality {r.quality.toFixed(1)}</span>}
                  {r.service != null && <span>Service {r.service.toFixed(1)}</span>}
                  {r.atmosphere != null && <span>Atmosphere {r.atmosphere.toFixed(1)}</span>}
                </div>
              )}

              {r.body && <p className="text-muted mt-2 text-sm">{r.body}</p>}

              {r.photoUrls.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.photoUrls.map((url, i) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url}
                        alt={`Photo ${i + 1} from ${r.authorName ?? 'a shopper'}'s review`}
                        loading="lazy"
                        className="border-border h-24 w-24 rounded-lg border object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}

              {r.ownerReply && (
                <div className="border-border bg-surface-2 border-l-primary mt-3 rounded-lg border-l-2 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground text-xs font-semibold">
                      Response from {dispensaryName}
                    </span>
                    {r.ownerReplyAt && (
                      <span className="text-muted text-xs">
                        {new Date(r.ownerReplyAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-muted mt-1 text-sm">{r.ownerReply}</p>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <HelpfulButton review={r} signedIn={!!currentUserId} />
                {currentUserId === r.userId && (
                  <>
                    <Badge tone="muted">Your review</Badge>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Delete your review? This cannot be undone.')) {
                          void deleteReview(r.id, dispensarySlug);
                        }
                      }}
                      className="text-muted hover:text-danger text-xs underline"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
