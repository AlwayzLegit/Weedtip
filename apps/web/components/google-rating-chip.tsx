import { ExternalLink } from 'lucide-react';
import type { DisplayRating } from '@/lib/google-rating';
import { cn } from '@/lib/utils';
import { RatingStars } from './rating-stars';

/**
 * A Google-sourced rating, shown as Google's.
 *
 * Most listings in the directory have no Weedtip reviews yet, so this is what a
 * visitor sees instead of an empty rating row. Google's Maps Platform terms
 * require the rating to be attributed and to link back to the Place it came
 * from, and product-wise we want the same thing: an unclaimed listing borrowing
 * Google's signal must never read as if it earned reviews here.
 */
export function GoogleRatingChip({
  rating,
  className,
}: {
  rating: DisplayRating;
  className?: string;
}) {
  const label = `${rating.count.toLocaleString()} ${rating.count === 1 ? 'rating' : 'ratings'} on Google`;
  const body = (
    <>
      <RatingStars rating={rating.rating} />
      <span className="text-sm font-semibold">{rating.rating.toFixed(1)}</span>
      <span className="text-muted text-sm">({label})</span>
      {rating.sourceUrl && <ExternalLink className="text-muted h-3.5 w-3.5" aria-hidden />}
    </>
  );

  if (!rating.sourceUrl) {
    return <span className={cn('flex items-center gap-1.5', className)}>{body}</span>;
  }
  return (
    <a
      href={rating.sourceUrl}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={cn(
        'focus-visible:ring-primary flex items-center gap-1.5 rounded hover:underline focus-visible:outline-none focus-visible:ring-2',
        className,
      )}
      title="View this listing on Google Maps"
    >
      {body}
    </a>
  );
}
