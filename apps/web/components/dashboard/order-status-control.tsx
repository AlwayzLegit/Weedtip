'use client';

import { updateOrderStatus } from '@/app/dashboard/actions';
import { SubmitButton } from '../auth/submit-button';

// Valid forward transitions an owner can apply. Delivery orders dispatch
// (ready → out for delivery → complete); pickup orders hand off at the counter.
const NEXT_PICKUP: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  out_for_delivery: ['completed', 'cancelled'], // legacy safety: allow closing out
  completed: [],
  cancelled: [],
};

const NEXT_DELIVERY: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const LABEL: Record<string, string> = {
  confirmed: 'Confirm',
  ready: 'Mark ready',
  out_for_delivery: 'Dispatch driver',
  completed: 'Complete',
  cancelled: 'Cancel',
};

export function OrderStatusControl({
  orderId,
  status,
  orderType = 'pickup',
}: {
  orderId: string;
  status: string;
  orderType?: string;
}) {
  const map = orderType === 'delivery' ? NEXT_DELIVERY : NEXT_PICKUP;
  const transitions = map[status] ?? [];
  if (transitions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {transitions.map((next) => (
        <form key={next} action={updateOrderStatus.bind(null, orderId, next)}>
          <SubmitButton size="sm" variant={next === 'cancelled' ? 'outline' : 'primary'}>
            {LABEL[next]}
          </SubmitButton>
        </form>
      ))}
    </div>
  );
}
