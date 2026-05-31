import { cn } from '@/lib/utils';
import { type InputHTMLAttributes } from 'react';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'border-border bg-surface text-foreground h-10 w-full rounded-lg border px-3 text-sm',
        'placeholder:text-muted focus-visible:border-primary focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
