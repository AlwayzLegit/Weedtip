import { cn } from '@/lib/utils';
import { type HTMLAttributes } from 'react';

type Tone = 'default' | 'primary' | 'outline' | 'muted';

const TONES: Record<Tone, string> = {
  default: 'bg-surface-2 text-foreground',
  primary: 'bg-primary-muted text-primary',
  outline: 'border border-border text-muted',
  muted: 'bg-surface-2 text-muted',
};

export function Badge({
  className,
  tone = 'default',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
