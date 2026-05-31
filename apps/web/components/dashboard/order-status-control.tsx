'use client';

import { updateOrderStatus } from '@/app/dashboard/actions';
import { Button } from '../ui/button';

// Valid forward transitions an owner can apply.
const NEXT: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const LABEL: Record<string, string> = {
  confirmed: 'Confirm',
  ready: 'Mark ready',
  completed: 'Complete',
  cancelled: 'Cancel',
};

export function OrderStatusControl({ orderId, status }: { orderId: string; status: string }) {
  const transitions = NEXT[status] ?? [];
  if (transitions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {transitions.map((next) => (
        <form key={next} action={updateOrderStatus.bind(null, orderId, next)}>
          <Button type="submit" size="sm" variant={next === 'cancelled' ? 'outline' : 'primary'}>
            {LABEL[next]}
          </Button>
        </form>
      ))}
    </div>
  );
}
