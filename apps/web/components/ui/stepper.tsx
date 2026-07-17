import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Compact numbered step indicator for multi-step forms (wizards). */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                active
                  ? 'bg-primary text-primary-foreground'
                  : done
                    ? 'bg-primary-muted text-primary'
                    : 'bg-surface-2 text-muted',
              )}
            >
              {done ? <Check className="h-4 w-4" /> : n}
            </span>
            <span className={cn('hidden text-sm sm:inline', active ? 'font-medium' : 'text-muted')}>
              {label}
            </span>
            {i < steps.length - 1 && <span className="bg-border mx-1 h-px w-5 sm:w-8" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
