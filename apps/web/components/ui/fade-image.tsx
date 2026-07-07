'use client';

import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * next/image that fades and gently de-blurs itself in on load instead of
 * popping. Keeps the "modern app" feel on photo-heavy grids without a layout
 * shift. Falls back to instant show when the image is already cached (the load
 * event still fires, so this stays correct).
 */
export function FadeImage({ className, onLoad, ...props }: ImageProps) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Image
      {...props}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      className={cn(
        'transition-[opacity,filter] duration-500 ease-out motion-reduce:transition-none',
        loaded ? 'opacity-100 blur-0' : 'opacity-0 blur-md',
        className,
      )}
    />
  );
}
