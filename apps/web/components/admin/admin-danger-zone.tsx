'use client';

import { useState, useTransition } from 'react';
import { adminDeleteDispensary, adminMergeDispensaries } from '@/app/admin/actions';
import { Button } from '../ui/button';
import { DispensaryPicker } from './dispensary-picker';

type Duplicate = {
  id: string;
  name: string;
  city: string | null;
  state: string;
  license_number: string | null;
};

/**
 * Merge + delete controls for a listing. Merging repoints every child row
 * (products, reviews, orders, deals, …) onto the kept listing, backfills
 * missing fields, and removes the duplicate. Delete is blocked server-side
 * when order history exists.
 */
export function AdminDangerZone({
  dispensaryId,
  dispensaryName,
  hasOrders,
  duplicates,
}: {
  dispensaryId: string;
  dispensaryName: string;
  hasOrders: boolean;
  duplicates: Duplicate[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [merged, setMerged] = useState<string | null>(null);

  function merge(dupId: string, label: string) {
    if (!window.confirm(`Merge “${label}” into “${dispensaryName}”? The duplicate is removed.`)) {
      return;
    }
    setError(null);
    start(async () => {
      const res = await adminMergeDispensaries(dispensaryId, dupId);
      if (res?.error) setError(res.error);
      else setMerged(label);
    });
  }

  function mergeFromForm(formData: FormData) {
    const dupId = formData.get('dispensary_id');
    if (typeof dupId !== 'string' || !dupId) {
      setError('Pick the duplicate listing to absorb.');
      return;
    }
    if (dupId === dispensaryId) {
      setError('Pick a different listing — this is the one being kept.');
      return;
    }
    merge(dupId, 'the selected listing');
  }

  function remove() {
    if (!window.confirm(`Permanently delete “${dispensaryName}”? This cannot be undone.`)) return;
    setError(null);
    start(async () => {
      const res = await adminDeleteDispensary(dispensaryId);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <section className="space-y-4">
      <div className="rounded-card border-border border p-4">
        <h3 className="text-sm font-semibold">Merge duplicates into this listing</h3>
        <p className="text-muted mt-1 text-sm">
          Products, reviews, orders, and deals move to “{dispensaryName}”; missing fields are
          backfilled from the duplicate; the duplicate is deleted.
        </p>

        {duplicates.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-muted text-xs font-semibold uppercase tracking-wide">
              Likely duplicates
            </p>
            {duplicates.map((dup) => (
              <div
                key={dup.id}
                className="border-border bg-surface-2 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">
                  {dup.name}
                  <span className="text-muted">
                    {' '}
                    · {dup.city ? `${dup.city}, ` : ''}
                    {dup.state}
                    {dup.license_number ? ` · ${dup.license_number}` : ''}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => merge(dup.id, dup.name)}
                >
                  Merge in
                </Button>
              </div>
            ))}
          </div>
        )}

        <form action={mergeFromForm} className="mt-3 flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <DispensaryPicker />
          </div>
          <Button type="submit" variant="outline" disabled={pending}>
            Merge in
          </Button>
        </form>

        {merged && (
          <p className="text-primary mt-2 text-sm">Merged {merged} into this listing.</p>
        )}
      </div>

      <div className="border-danger/30 rounded-card border p-4">
        <h3 className="text-danger text-sm font-semibold">Delete listing</h3>
        <p className="text-muted mt-1 text-sm">
          {hasOrders
            ? 'This listing has order history and cannot be deleted — merge it into another listing instead.'
            : 'Removes the listing and everything attached to it (products, reviews, deals). This cannot be undone.'}
        </p>
        <Button
          variant="outline"
          className="border-danger/40 text-danger hover:bg-danger/10 mt-3"
          disabled={pending || hasOrders}
          onClick={remove}
        >
          Delete listing
        </Button>
      </div>

      {error && (
        <p className="border-danger/40 bg-danger/10 text-danger rounded-lg border px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
