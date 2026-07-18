import type { ReactNode } from 'react';
import { Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FadeImage } from './ui/fade-image';

/**
 * Seeded placeholder palettes (complete class strings so Tailwind keeps them).
 * A grid of photo-less cards varies tastefully instead of repeating one frame —
 * the Dutchie-menu pattern for catalogs where most items ship without photos.
 */
const ART_TINTS = [
  'from-emerald-500/30 via-emerald-500/[0.08] to-surface-2',
  'from-teal-500/30 via-teal-500/[0.08] to-surface-2',
  'from-sky-500/30 via-sky-500/[0.08] to-surface-2',
  'from-violet-500/30 via-violet-500/[0.08] to-surface-2',
  'from-amber-500/30 via-amber-500/[0.08] to-surface-2',
  'from-rose-500/30 via-rose-500/[0.08] to-surface-2',
] as const;

function seededTint(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return ART_TINTS[h % ART_TINTS.length]!;
}

/**
 * Media frame that renders a cover/product photo when available, or a tasteful
 * on-brand placeholder (gradient + watermark icon) when not. Pass `artSeed`
 * (e.g. the item name) to vary the placeholder tint per item and `artIcon` to
 * swap the watermark (category glyphs, etc.).
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
  priority,
  artSeed,
  artIcon,
  children,
}: {
  url?: string | null;
  /** Accessible label / image alt text (e.g. the dispensary or product name). */
  alt?: string;
  className?: string;
  iconClassName?: string;
  /** Responsive sizes hint for the optimized image. */
  sizes?: string;
  /**
   * Marks this as an above-the-fold LCP image: next/image preloads it with
   * fetchpriority=high instead of lazy-loading. Set only on the hero / first
   * visible image — priority on off-screen images hurts more than it helps.
   */
  priority?: boolean;
  /** Varies the placeholder tint deterministically (use the item name). */
  artSeed?: string;
  /** Replaces the default leaf watermark on the placeholder. */
  artIcon?: ReactNode;
  children?: ReactNode;
}) {
  const tint = artSeed
    ? seededTint(artSeed)
    : 'from-primary/25 via-primary/[0.07] to-surface-2';
  return (
    <div
      role={!url && alt ? 'img' : undefined}
      aria-label={!url && alt ? alt : undefined}
      className={cn('relative overflow-hidden bg-gradient-to-br', tint, className)}
    >
      {url ? (
        <FadeImage
          src={url}
          alt={alt ?? ''}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : artIcon ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {artIcon}
        </div>
      ) : (
        /* Branded placeholder — reads as intentional Weedtip art, not a hole:
           oversized pattern leaf in the corner, brand chip + wordmark centered. */
        <div className="pointer-events-none absolute inset-0">
          <Leaf
            className="text-foreground/[0.06] absolute -right-4 -top-4 h-2/3 w-2/3 rotate-12"
            strokeWidth={1}
            aria-hidden
          />
          <div className="flex h-full flex-col items-center justify-center gap-1">
            <span className="bg-surface/70 flex items-center justify-center rounded-full p-2 backdrop-blur-[2px]">
              <Leaf className={cn('text-primary/60', iconClassName)} strokeWidth={1.5} />
            </span>
            <span className="text-foreground/25 text-[10px] font-bold tracking-[0.08em]">
              Weedtip
            </span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
