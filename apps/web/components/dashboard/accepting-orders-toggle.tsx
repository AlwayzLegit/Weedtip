'use client';

import { useTransition } from 'react';
import { Loader2, Pause, Play } from 'lucide-react';
import { setAcceptingOrders } from '@/app/dashboard/actions';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';

/** Pause/resume incoming online orders. Reflects + flips dispensaries.accepting_orders. */
export function AcceptingOrdersToggle({ accepting }: { accepting: boolean }) {
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-sm font-medium',
          accepting ? 'text-primary' : 'text-muted',
        )}
      >
        <span
          className={cn('h-2 w-2 rounded-full', accepting ? 'bg-primary' : 'bg-muted')}
          aria-hidden
        />
        {accepting ? 'Accepting orders' : 'Orders paused'}
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => start(async () => setAcceptingOrders(!accepting))}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : accepting ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        {accepting ? 'Pause orders' : 'Resume orders'}
      </Button>
    </div>
  );
}
