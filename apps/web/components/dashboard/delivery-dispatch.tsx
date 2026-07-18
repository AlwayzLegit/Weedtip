'use client';

import { useActionState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Truck } from 'lucide-react';
import {
  addDriver,
  assignOrderDriver,
  setOrderEta,
} from '@/app/dashboard/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { FormMessage } from '../auth/form-message';
import { SubmitButton } from '../auth/submit-button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';

export type RosterDriver = { id: string; name: string; phone: string | null };

const ETA_PRESETS = [15, 30, 45, 60, 90];

/**
 * Dispatch panel for a delivery order: assign a roster driver, set the
 * customer-facing ETA, and grow the roster inline. (Pickup orders reuse the
 * ETA control only — "ready in ~X min".)
 */
export function DeliveryDispatch({
  orderId,
  orderType,
  driverId,
  etaMinutes,
  drivers,
}: {
  orderId: string;
  orderType: string;
  driverId: string | null;
  etaMinutes: number | null;
  drivers: RosterDriver[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [addState, addAction] = useActionState(addDriver, EMPTY_FORM_STATE);

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="border-border bg-surface-2 rounded-card space-y-4 border p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Truck className="text-primary h-4 w-4" />
        {orderType === 'delivery' ? 'Delivery dispatch' : 'Ready time'}
      </p>

      {/* Customer-facing ETA */}
      <div>
        <p className="text-muted mb-1.5 text-xs font-medium uppercase tracking-wide">
          {orderType === 'delivery' ? 'Delivery ETA' : 'Ready in'}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {ETA_PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              disabled={pending}
              onClick={() => run(() => setOrderEta(orderId, m))}
              className={
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
                (etaMinutes === m
                  ? 'border-primary bg-primary-muted text-primary'
                  : 'border-border text-muted hover:text-foreground')
              }
            >
              {m} min
            </button>
          ))}
          {etaMinutes !== null && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setOrderEta(orderId, null))}
              className="text-muted hover:text-foreground text-xs underline"
            >
              Clear
            </button>
          )}
        </div>
        <p className="text-muted mt-1 text-xs">
          Shown to the customer on their order page and in notifications.
        </p>
      </div>

      {/* Driver assignment (delivery only) */}
      {orderType === 'delivery' && (
        <div>
          <p className="text-muted mb-1.5 text-xs font-medium uppercase tracking-wide">Driver</p>
          {drivers.length > 0 ? (
            <Select
              value={driverId ?? ''}
              disabled={pending}
              onChange={(e) =>
                run(() => assignOrderDriver(orderId, e.target.value || null))
              }
              aria-label="Assign driver"
            >
              <option value="">Unassigned</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.phone ? ` · ${d.phone}` : ''}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-muted text-sm">No drivers on your roster yet — add one below.</p>
          )}

          <form action={addAction} className="mt-3 flex flex-wrap items-end gap-2">
            <FormMessage state={{ error: addState.status === 'error' ? addState.message : undefined }} />
            <div className="min-w-0 flex-1">
              <Input name="name" placeholder="Driver name" aria-label="New driver name" />
            </div>
            <div className="min-w-0 flex-1">
              <Input name="phone" placeholder="Phone (optional)" aria-label="New driver phone" />
            </div>
            <SubmitButton size="sm" variant="outline">
              Add driver
            </SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}
