'use client';

import { useState } from 'react';

/**
 * Dispensary logo with a graceful fallback. Logos are sourced from third-party
 * website favicons, which can fail to load (e.g. a 503), leaving a broken-image
 * icon and an unstable header row. When the image errors we swap to the shop's
 * initial in the same fixed-size box; when there's no logo URL at all we render
 * nothing (preserving the prior name-only layout).
 */
export function DispensaryLogo({
  src,
  name,
  className = 'h-8 w-8',
}: {
  src?: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src) return null;

  const box = `border-border bg-surface text-muted flex shrink-0 items-center justify-center rounded-md border ${className}`;
  if (failed) {
    return (
      <span className={box} aria-hidden>
        <span className="text-sm font-bold">{name.trim().charAt(0).toUpperCase() || '?'}</span>
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className={`${box} object-contain p-1`}
    />
  );
}
