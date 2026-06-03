'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { MediaImage } from './media-image';

/** Product image gallery: a main frame with a clickable thumbnail strip. */
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const main = images[active] ?? images[0] ?? null;

  return (
    <div className="space-y-3">
      <MediaImage
        url={main}
        alt={alt}
        className="rounded-card border-border shadow-card h-72 border sm:h-80"
        iconClassName="h-16 w-16"
        sizes="(max-width: 768px) 100vw, 500px"
      />
      {images.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {images.slice(0, 6).map((img, i) => (
            <button
              key={img + i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              aria-current={i === active}
              className={cn(
                'h-16 w-16 overflow-hidden rounded-lg border transition-colors',
                i === active
                  ? 'border-primary ring-primary/40 ring-1'
                  : 'border-border hover:border-border-strong',
              )}
            >
              <MediaImage url={img} alt="" className="h-full w-full" iconClassName="h-5 w-5" sizes="64px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
