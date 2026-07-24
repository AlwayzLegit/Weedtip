import { cn } from '@/lib/utils';
import { type SelectHTMLAttributes } from 'react';

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        // text-base at mobile widths: sub-16px inputs trigger iOS Safari's focus-zoom.
        'border-border bg-surface-2 text-foreground h-11 w-full rounded-lg border px-3.5 text-base transition-colors sm:text-sm',
        'hover:border-border-strong focus-visible:border-primary',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
