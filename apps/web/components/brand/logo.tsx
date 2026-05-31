import { cn } from '@/lib/utils';
import { Leaf } from 'lucide-react';

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-lg font-bold', className)}>
      <Leaf className="text-primary h-5 w-5" aria-hidden />
      <span>
        Weed<span className="text-primary">tip</span>
      </span>
    </span>
  );
}
