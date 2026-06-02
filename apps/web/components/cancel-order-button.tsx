'use client';

import { cancelOrder } from '@/app/actions/orders';
import { SubmitButton } from './auth/submit-button';

export function CancelOrderButton({ orderId }: { orderId: string }) {
  return (
    <form
      action={cancelOrder.bind(null, orderId)}
      onSubmit={(e) => {
        if (!confirm('Cancel this order? This cannot be undone.')) e.preventDefault();
      }}
    >
      <SubmitButton variant="outline" size="sm">
        Cancel order
      </SubmitButton>
    </form>
  );
}
