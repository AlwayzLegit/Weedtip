import { Star } from 'lucide-react';

/**
 * Weedmaps-style 5★→1★ distribution bars with per-rating percentages. Pure
 * presentation — the page computes the counts from the loaded reviews.
 */
export function ReviewHistogram({
  counts,
  total,
  average,
}: {
  /** counts[5], counts[4] … counts[1]. */
  counts: Record<number, number>;
  total: number;
  average: number;
}) {
  if (total === 0) return null;
  return (
    <div className="rounded-card border-border bg-surface mb-4 flex flex-col gap-4 border p-4 sm:flex-row sm:items-center">
      <div className="flex shrink-0 flex-col items-center justify-center sm:w-32">
        <p className="text-3xl font-bold">{average.toFixed(1)}</p>
        <div className="text-primary flex" aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              className="h-4 w-4"
              fill={i < Math.round(average) ? 'currentColor' : 'none'}
              strokeWidth={1.5}
            />
          ))}
        </div>
        <p className="text-muted mt-1 text-xs">
          {total} review{total === 1 ? '' : 's'}
        </p>
      </div>
      <div className="flex-1 space-y-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const n = counts[star] ?? 0;
          const pct = total > 0 ? Math.round((n / total) * 100) : 0;
          return (
            <div key={star} className="flex items-center gap-2 text-xs">
              <span className="text-muted w-3 text-right tabular-nums">{star}</span>
              <Star className="text-primary h-3 w-3 shrink-0" fill="currentColor" strokeWidth={0} />
              <div className="bg-surface-2 h-2 flex-1 overflow-hidden rounded-full">
                <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-muted w-9 text-right tabular-nums">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
