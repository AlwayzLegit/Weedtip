'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Reveals its children with a soft rise + fade the first time they scroll into
 * view (the modern "content builds as you scroll" feel).
 *
 * Content is VISIBLE in the server HTML — the animation must never gate
 * visibility on JavaScript, or slow hydration leaves whole sections as blank
 * gaps. On mount, only elements still comfortably below the viewport are
 * hidden and armed to reveal on intersection; everything else stays shown.
 * Respects prefers-reduced-motion by never hiding at all.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Stagger, in ms — use the item index × ~60ms for a cascade. */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // 'ssr' = visible (server default) · 'armed' = hidden, waiting to intersect
  // · 'shown' = revealed with animation.
  const [state, setState] = useState<'ssr' | 'armed' | 'shown'>('ssr');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    // Only arm the animation for content the visitor hasn't reached yet —
    // anything at or near the viewport stays visible (no flash of hiding).
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 1.15) return;
    setState('armed');
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setState('shown');
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: state === 'shown' ? `${delay}ms` : '0ms' }}
      className={cn(
        'transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none',
        state === 'armed' ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100',
        className,
      )}
    >
      {children}
    </div>
  );
}
