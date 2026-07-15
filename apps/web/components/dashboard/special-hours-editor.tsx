'use client';

import { useState } from 'react';
import { CalendarPlus, Trash2 } from 'lucide-react';
import type { SpecialHour } from '@weedtip/shared';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

type Row = { date: string; closed: boolean; open: string; close: string; note: string };

function toRows(v: SpecialHour[]): Row[] {
  return v.map((s) => ({
    date: s.date,
    closed: s.closed,
    open: s.open ?? '',
    close: s.close ?? '',
    note: s.note ?? '',
  }));
}

/**
 * Editor for date-specific hour overrides. Rows serialize to a single hidden
 * `special_hours` JSON field; upsertDispensary parses + validates it against
 * specialHoursSchema.
 */
export function SpecialHoursEditor({
  name = 'special_hours',
  defaultValue = [],
}: {
  name?: string;
  defaultValue?: SpecialHour[];
}) {
  const [rows, setRows] = useState<Row[]>(toRows(defaultValue));

  const update = (i: number, patch: Partial<Row>) =>
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const add = () => setRows([...rows, { date: '', closed: false, open: '', close: '', note: '' }]);
  const remove = (i: number) => setRows(rows.filter((_, idx) => idx !== i));

  const serialized = JSON.stringify(
    rows
      .filter((r) => r.date)
      .map((r) =>
        r.closed
          ? { date: r.date, closed: true, ...(r.note ? { note: r.note } : {}) }
          : { date: r.date, closed: false, open: r.open, close: r.close, ...(r.note ? { note: r.note } : {}) },
      ),
  );

  return (
    <fieldset className="rounded-card border-border border p-4">
      <legend className="px-1 text-sm font-medium">Special / holiday hours</legend>
      <input type="hidden" name={name} value={serialized} />
      <p className="text-muted mb-3 text-xs">
        Override your weekly hours on specific dates — a closure or custom times. Past dates are
        ignored on your listing.
      </p>
      <div className="space-y-2">
        {rows.length === 0 && <p className="text-muted text-xs">No special dates yet.</p>}
        {rows.map((r, i) => (
          <div
            key={i}
            className="border-border grid grid-cols-1 items-center gap-2 rounded-lg border p-2 sm:grid-cols-[auto_1fr_auto]"
          >
            <Input
              type="date"
              value={r.date}
              onChange={(e) => update(i, { date: e.target.value })}
              aria-label="Date"
              className="sm:w-40"
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={r.closed}
                  onChange={(e) => update(i, { closed: e.target.checked })}
                  className="accent-primary"
                />
                Closed
              </label>
              {!r.closed && (
                <>
                  <Input
                    type="time"
                    value={r.open}
                    onChange={(e) => update(i, { open: e.target.value })}
                    aria-label="Open time"
                    className="w-32"
                  />
                  <span className="text-muted text-xs">to</span>
                  <Input
                    type="time"
                    value={r.close}
                    onChange={(e) => update(i, { close: e.target.value })}
                    aria-label="Close time"
                    className="w-32"
                  />
                </>
              )}
              <Input
                value={r.note}
                onChange={(e) => update(i, { note: e.target.value })}
                placeholder="Label (optional)"
                maxLength={60}
                className="min-w-[8rem] flex-1"
              />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)} aria-label="Remove date">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add} className="mt-3">
        <CalendarPlus className="h-4 w-4" /> Add date
      </Button>
    </fieldset>
  );
}
