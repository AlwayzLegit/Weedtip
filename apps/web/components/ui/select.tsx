import { cn } from '@/lib/utils';
import { type SelectHTMLAttributes } from 'react';

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'border-border bg-surface text-foreground h-10 w-full rounded-lg border px-3 text-sm',
        'focus-visible:border-primary focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
