'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type HoursRow = { label: string; range: string; isToday: boolean };
export type SpecialRow = { label: string; range: string };

/**
 * Collapsible hours card: shows the open/closed status + today's hours by
 * default (keeps the sidebar short), and expands to the full week + any special
 * hours on tap. Rows are pre-formatted server-side so this stays presentational.
 */
export function HoursCard({
  hasHours,
  isOpen,
  statusLabel,
  todayRange,
  rows,
  specials,
}: {
  hasHours: boolean;
  isOpen: boolean;
  statusLabel: string;
  todayRange: string | null;
  rows: HoursRow[];
  specials: SpecialRow[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-card border-border bg-surface shadow-card border p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-muted text-sm font-semibold uppercase tracking-wide">Hours</h2>
        {hasHours && (
          <span
            className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
              isOpen
                ? 'bg-primary-muted text-primary'
                : 'bg-surface-2 text-muted border-border border'
            }`}
          >
            {isOpen ? 'Open now' : statusLabel}
          </span>
        )}
      </div>

      {!hasHours ? (
        <p className="text-muted text-sm">Hours not listed.</p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="hover:text-primary -my-2 flex w-full items-center justify-between gap-2 py-2 text-sm transition-colors"
          >
            <span className="font-medium">
              Today <span className="text-muted font-normal">· {todayRange ?? 'Closed'}</span>
            </span>
            <span className="text-muted flex items-center gap-1 text-xs">
              {expanded ? 'Less' : 'All hours'}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            </span>
          </button>

          {expanded && (
            <ul className="border-border mt-2 space-y-1.5 border-t pt-2 text-sm">
              {rows.map((r) => (
                <li
                  key={r.label}
                  className={`flex justify-between ${r.isToday ? 'text-foreground font-medium' : ''}`}
                >
                  <span className={r.isToday ? '' : 'text-muted'}>{r.label}</span>
                  <span>{r.range}</span>
                </li>
              ))}
              {specials.length > 0 && (
                <li className="border-border mt-1 border-t pt-2">
                  <p className="text-muted mb-1.5 text-xs font-semibold uppercase tracking-wide">
                    Special hours
                  </p>
                  <ul className="space-y-1">
                    {specials.map((s) => (
                      <li key={s.label} className="flex justify-between gap-2">
                        <span className="text-muted">{s.label}</span>
                        <span>{s.range}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
