import { cn } from '@/lib/utils';
import { type TextareaHTMLAttributes } from 'react';

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'border-border bg-surface text-foreground min-h-[80px] w-full rounded-lg border px-3 py-2 text-sm',
        'placeholder:text-muted focus-visible:border-primary focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
