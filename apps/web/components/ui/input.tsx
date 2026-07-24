import { cn } from '@/lib/utils';
import { type InputHTMLAttributes } from 'react';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        // text-base at mobile widths: sub-16px inputs trigger iOS Safari's focus-zoom.
        'border-border bg-surface-2 text-foreground h-11 w-full rounded-lg border px-3.5 text-base transition-colors sm:text-sm',
        'placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-primary',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
