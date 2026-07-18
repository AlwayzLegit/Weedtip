'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Store } from 'lucide-react';
import { selectDispensary } from '@/app/dashboard/actions';
import { cn } from '@/lib/utils';

type Item = { id: string; name: string; slug: string; role: string };

/**
 * Dropdown to switch which listing the dashboard manages, for owners/members who
 * have more than one. Selecting one submits a server action that stores the
 * choice in a cookie and revalidates the dashboard.
 */
export function LocationSwitcher({ items, currentId }: { items: Item[]; currentId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const current = items.find((i) => i.id === currentId) ?? items[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="border-border bg-surface hover:border-border-strong flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Store className="text-muted h-4 w-4 shrink-0" />
          <span className="truncate font-medium">{current?.name ?? 'Select listing'}</span>
        </span>
        <ChevronsUpDown className="text-muted h-4 w-4 shrink-0" />
      </button>

      {open && (
        <div
          role="listbox"
          className="rounded-card border-border bg-surface shadow-card-hover absolute z-40 mt-1 max-h-72 w-full overflow-auto border p-1"
        >
          {items.map((i) => (
            <form key={i.id} action={selectDispensary.bind(null, i.id)} onSubmit={() => setOpen(false)}>
              <button
                type="submit"
                role="option"
                aria-selected={i.id === currentId}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                  i.id === currentId ? 'bg-primary-muted text-primary' : 'hover:bg-surface-2',
                )}
              >
                <span className="min-w-0 truncate">
                  {i.name}
                  {i.role !== 'owner' && <span className="text-muted"> · {i.role}</span>}
                </span>
                {i.id === currentId && <Check className="h-4 w-4 shrink-0" />}
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
