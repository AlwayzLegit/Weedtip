'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Logo image with a graceful fallback to the entity's initial. Logos come from
 * third-party website favicons, which can fail to load (e.g. a 503).
 *
 * Why the mount-time check and not just onError: the <img> is server-rendered,
 * so if it errors before React hydrates and attaches the onError handler, that
 * error event is missed and the broken-image icon sticks. On mount we therefore
 * also check `complete && naturalWidth === 0` (a finished-but-failed load) and
 * fall back. onError covers failures that happen after hydration.
 *
 * `hideWhenEmpty` opts back into the name-only layout for tight spots; the
 * default always shows the initial avatar (Weedmaps-style identity slot) so
 * cards read consistently whether or not a logo exists.
 */
export function LogoImage({
  src,
  name,
  className = 'h-8 w-8',
  rounded = 'rounded-md',
  textClassName = 'text-sm',
  hideWhenEmpty = false,
}: {
  src?: string | null;
  name: string;
  className?: string;
  rounded?: string;
  textClassName?: string;
  hideWhenEmpty?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  const box = `border-border bg-surface text-muted flex shrink-0 items-center justify-center border ${rounded} ${className}`;
  const avatar = (
    <span className={box} aria-hidden>
      <span className={`font-bold ${textClassName}`}>{name.trim().charAt(0).toUpperCase() || '?'}</span>
    </span>
  );

  if (!src) return hideWhenEmpty ? null : avatar;
  if (failed) return avatar;
  return (
    <img
      ref={ref}
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className={`${box} object-contain p-1`}
    />
  );
}
