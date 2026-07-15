import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Small status indicator with a leading dot. Distinct from <Badge> (which is a
 * generic label) — a StatusPill communicates a lifecycle/health state with
 * colour semantics. Tones map onto the theme's semantic tokens.
 */
export type PillTone = 'live' | 'scheduled' | 'expired' | 'inactive' | 'neutral';

const TONES: Record<PillTone, string> = {
  live: 'bg-primary-muted text-primary',
  scheduled: 'bg-warning/15 text-warning',
  expired: 'bg-danger/15 text-danger',
  inactive: 'bg-surface-2 text-muted',
  neutral: 'bg-surface-2 text-muted',
};

export function StatusPill({
  tone,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone: PillTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
      {...props}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  );
}
