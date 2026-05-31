import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';

export function RatingStars({
  rating,
  size = 14,
  className,
}: {
  rating: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      aria-label={`${rating} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          width={size}
          height={size}
          className={i <= Math.round(rating) ? 'fill-primary text-primary' : 'text-border'}
          aria-hidden
        />
      ))}
    </span>
  );
}
