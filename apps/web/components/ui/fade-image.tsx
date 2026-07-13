'use client';

import Image, { type ImageProps } from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * next/image that fades and gently de-blurs itself in on load instead of
 * popping — without ever *requiring* JavaScript to be visible.
 *
 * Server HTML renders the image fully visible, so pre-hydration paints, slow
 * devices, and no-JS clients all see imagery. On mount, images that are still
 * in flight switch to the hidden→fade-in treatment; images that already
 * decoded (cache hits) stay visible untouched.
 */
export function FadeImage({ className, onLoad, ...props }: ImageProps) {
  // 'ssr' = visible (server default) · 'loading' = hidden, will fade · 'loaded' = visible
  const [state, setState] = useState<'ssr' | 'loading' | 'loaded'>('ssr');
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) setState('loaded');
    else setState('loading');
  }, []);
  return (
    <Image
      {...props}
      ref={ref}
      onLoad={(e) => {
        setState('loaded');
        onLoad?.(e);
      }}
      className={cn(
        'transition-[opacity,filter] duration-500 ease-out motion-reduce:transition-none',
        state === 'loading' ? 'opacity-0 blur-md' : 'opacity-100 blur-0',
        className,
      )}
    />
  );
}
