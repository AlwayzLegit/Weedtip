'use client';

import { ChevronLeft, ChevronRight, Images, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ScrollCarousel } from '@/components/home/scroll-carousel';

/**
 * Storefront photo strip with a "See all N photos" lightbox (Weedmaps-style).
 * Photos are the Google-enriched gallery URLs the page already proxies.
 */
export function PhotoGallery({ photos, name }: { photos: string[]; name: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const count = photos.length;

  const go = useCallback(
    (dir: 1 | -1) => setOpen((i) => (i === null ? i : (i + dir + count) % count)),
    [count],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, go]);

  return (
    <section id="photos" className="scroll-mt-32">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Photos</h2>
        <button
          onClick={() => setOpen(0)}
          className="text-primary inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        >
          <Images className="h-4 w-4" /> See all {count} photo{count === 1 ? '' : 's'}
        </button>
      </div>
      <ScrollCarousel itemClassName="w-72" ariaLabel="Storefront photos">
        {photos.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Open photo ${i + 1}`}
            className="block"
          >
            <img
              src={url}
              alt={`${name} photo ${i + 1}`}
              loading="lazy"
              className="border-border bg-surface-2 h-44 w-72 rounded-xl border object-cover transition-opacity hover:opacity-90"
            />
          </button>
        ))}
      </ScrollCarousel>

      {open !== null && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90"
          role="dialog"
          aria-modal="true"
          aria-label={`${name} photos`}
          onClick={() => setOpen(null)}
        >
          <button
            onClick={() => setOpen(null)}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full p-2 text-white/80 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
          {count > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              aria-label="Previous photo"
              className="absolute left-2 rounded-full p-2 text-white/80 hover:text-white sm:left-6"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}
          <img
            src={photos[open]}
            alt={`${name} photo ${open + 1}`}
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {count > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              aria-label="Next photo"
              className="absolute right-2 rounded-full p-2 text-white/80 hover:text-white sm:right-6"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          )}
          <span className="absolute bottom-4 text-sm text-white/70">
            {open + 1} / {count}
          </span>
        </div>
      )}
    </section>
  );
}
