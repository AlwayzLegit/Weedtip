import Image from 'next/image';
import type { ReactNode } from 'react';
import { Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Media frame that renders a cover/product photo when available, or a tasteful
 * on-brand placeholder (gradient + cannabis-leaf watermark) when not. Seed and
 * unclaimed listings have no photos; owners upload their own via the dashboard.
 *
 * Real photos use next/image (`fill`) for responsive, optimized delivery. Pass
 * sizing/rounding via `className`, `sizes` for the responsive hint, and overlay
 * badges etc. as `children`. When there's no photo, `alt` labels the placeholder
 * frame for screen readers.
 */
export function MediaImage({
  url,
  alt,
  className,
  iconClassName,
  sizes = '(max-width: 768px) 100vw, 400px',
  children,
}: {
  url?: string | null;
  /** Accessible label / image alt text (e.g. the dispensary or product name). */
  alt?: string;
  className?: string;
  iconClassName?: string;
  /** Responsive sizes hint for the optimized image. */
  sizes?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role={!url && alt ? 'img' : undefined}
      aria-label={!url && alt ? alt : undefined}
      className={cn(
        'from-primary/25 via-primary/[0.07] to-surface-2 relative overflow-hidden bg-gradient-to-br',
        className,
      )}
    >
      {url ? (
        <Image src={url} alt={alt ?? ''} fill sizes={sizes} className="object-cover" />
      ) : (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Leaf className={cn('text-primary/25', iconClassName)} strokeWidth={1.5} />
        </div>
      )}
      {children}
    </div>
  );
}
