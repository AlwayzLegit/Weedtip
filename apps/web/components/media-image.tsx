import type { ReactNode } from 'react';
import { Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Media frame that renders a cover/product photo when available, or a tasteful
 * on-brand placeholder (gradient + cannabis-leaf watermark) when not. Seed and
 * unclaimed listings have no photos; owners upload their own via the dashboard.
 *
 * Pass sizing/rounding via `className`. Overlay badges etc. as `children`.
 */
export function MediaImage({
  url,
  className,
  iconClassName,
  children,
}: {
  url?: string | null;
  className?: string;
  iconClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'from-primary/25 via-primary/[0.07] to-surface-2 relative bg-gradient-to-br',
        className,
      )}
      style={
        url
          ? {
              backgroundImage: `url(${url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      {!url && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Leaf className={cn('text-primary/25', iconClassName)} strokeWidth={1.5} />
        </div>
      )}
      {children}
    </div>
  );
}
