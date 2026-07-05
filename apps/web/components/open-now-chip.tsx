'use client';

import { useEffect, useState } from 'react';
import type { OperatingHours } from '@weedtip/shared';
import { isOpenNow } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';

/**
 * Live Open/Closed chip for the card family. When `hours` is provided the
 * state is computed client-side after mount (in the shop's own timezone), so
 * ISR-cached pages still show the truth; otherwise a server-computed
 * `openNow` (e.g. from search RPCs) is shown as-is. Renders nothing while
 * the state is unknown.
 */
export function OpenNowChip({
  hours,
  timezone,
  openNow,
  className,
}: {
  hours?: OperatingHours | null;
  timezone?: string | null;
  openNow?: boolean | null;
  className?: string;
}) {
  const [live, setLive] = useState<boolean | null>(null);
  useEffect(() => {
    if (hours) setLive(isOpenNow(hours, timezone ?? null));
  }, [hours, timezone]);

  const open = live ?? (typeof openNow === 'boolean' ? openNow : null);
  if (open === null) return null;

  return (
    <Badge
      className={cn('bg-background/80', open ? 'text-primary' : 'text-muted', className)}
    >
      <span
        aria-hidden
        className={cn('h-1.5 w-1.5 rounded-full', open ? 'bg-primary' : 'bg-muted')}
      />
      {open ? 'Open now' : 'Closed'}
    </Badge>
  );
}
