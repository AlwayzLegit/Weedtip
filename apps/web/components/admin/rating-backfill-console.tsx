'use client';

import { useRef, useState } from 'react';
import { Loader2, Play, Square } from 'lucide-react';
import { backfillGoogleRatingsBatch } from '@/app/admin/google-enrich-actions';
import { Button } from '../ui/button';

/**
 * Import + refresh Google star ratings for already-matched listings. Loops
 * server-side batches until done or stopped; the Places API key stays in the
 * server environment.
 *
 * Doubles as the refresh job: the queue re-includes any rating cached longer
 * than the 30-day window, so re-running this keeps displayed ratings inside the
 * terms we're allowed to cache under.
 */
export function RatingBackfillConsole({ initialRemaining }: { initialRemaining: number }) {
  const [remaining, setRemaining] = useState(initialRemaining);
  const [running, setRunning] = useState(false);
  const [tally, setTally] = useState({ rated: 0, unrated: 0, failed: 0 });
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  async function run() {
    setRunning(true);
    setError(null);
    stopRef.current = false;
    let left = remaining;
    while (!stopRef.current && left > 0) {
      const res = await backfillGoogleRatingsBatch();
      if (!res.ok) {
        setError(res.error);
        break;
      }
      left = res.remaining;
      setRemaining(res.remaining);
      setTally((t) => ({
        rated: t.rated + res.rated,
        unrated: t.unrated + res.unrated,
        failed: t.failed + res.failed,
      }));
      if (res.processed === 0) break;
    }
    setRunning(false);
  }

  return (
    <div className="rounded-card border-border bg-surface border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Import &amp; refresh Google ratings</p>
          <p className="text-muted mt-0.5 text-sm">
            Pulls the star rating, rating count, and Maps link for listings already matched to a
            Google Place. Ratings are always shown attributed to Google, and anything cached longer
            than 30 days is treated as expired — re-run this to refresh those. One Place Details
            call per listing.
          </p>
        </div>
        {running ? (
          <Button
            variant="outline"
            onClick={() => {
              stopRef.current = true;
            }}
          >
            <Square className="h-4 w-4" /> Stop
          </Button>
        ) : (
          <Button onClick={run} disabled={remaining === 0}>
            <Play className="h-4 w-4" /> {remaining === 0 ? 'All caught up' : 'Import ratings'}
          </Button>
        )}
      </div>

      <p className="text-muted mt-3 flex items-center gap-2 text-sm">
        {running && <Loader2 className="text-primary h-4 w-4 animate-spin" />}
        {remaining.toLocaleString()} listings to fetch or refresh
        {(tally.rated > 0 || tally.unrated > 0 || tally.failed > 0) && (
          <span>
            · this session: <span className="text-primary">{tally.rated} rated</span>,{' '}
            {tally.unrated} unrated on Google{tally.failed > 0 ? `, ${tally.failed} errors` : ''}
          </span>
        )}
      </p>
      {error && (
        <p className="border-danger/40 bg-danger/10 text-danger mt-2 rounded-lg border px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
