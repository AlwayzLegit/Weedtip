import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  /** Extra classes for body cells in this column. */
  className?: string;
  /** Extra classes for the header cell. */
  headerClassName?: string;
};

/**
 * Generic, dark-theme table primitive. Horizontally scrolls on narrow screens,
 * so wide content never breaks the page layout. Callers pass typed columns +
 * rows; render an <EmptyState> yourself when `rows` is empty.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  footer,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  /** Optional footer (e.g. a "Showing X–Y of N" pager). */
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-card border-border bg-surface shadow-card overflow-hidden border',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-border text-muted border-b text-left text-xs tracking-wide uppercase">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    'px-4 py-2.5 font-medium whitespace-nowrap',
                    c.align === 'right' && 'text-right',
                    c.headerClassName,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={getRowKey(row, i)}
                className="border-border/60 hover:bg-surface-2/40 border-b transition-colors last:border-0"
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'px-4 py-3 align-middle',
                      c.align === 'right' && 'text-right',
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer && (
        <div className="border-border text-muted flex items-center justify-between border-t px-4 py-2.5 text-xs">
          {footer}
        </div>
      )}
    </div>
  );
}
