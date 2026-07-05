'use client';

import { useRef, useState } from 'react';
import { Loader2, Play, Square } from 'lucide-react';
import { enrichFromGoogleBatch } from '@/app/admin/google-enrich-actions';
import { Button } from '../ui/button';

/**
 * One-click Google Places enrichment. Loops batches server-side until done or
 * stopped; the API key stays in the server environment. Attempted-but-unmatched
 * rows are stamped so they're never re-billed.
 */
export function GoogleEnrichConsole({ initialRemaining }: { initialRemaining: number }) {
  const [remaining, setRemaining] = useState(initialRemaining);
  const [running, setRunning] = useState(false);
  const [tally, setTally] = useState({ matched: 0, unmatched: 0, failed: 0 });
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  async function run() {
    setRunning(true);
    setError(null);
    stopRef.current = false;
    let left = remaining;
    while (!stopRef.current && left > 0) {
      const res = await enrichFromGoogleBatch();
      if (!res.ok) {
        setError(res.error);
        break;
      }
      left = res.remaining;
      setRemaining(res.remaining);
      setTally((t) => ({
        matched: t.matched + res.matched,
        unmatched: t.unmatched + res.unmatched,
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
          <p className="font-medium">Enrich listings from Google</p>
          <p className="text-muted mt-0.5 text-sm">
            Matches unlinked listings to Google Places (proximity + name verified) and imports
            place link, photo, phone, website, and hours. ~$0.03–0.04 per listing in Places API
            spend.
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
            <Play className="h-4 w-4" /> {remaining === 0 ? 'All caught up' : 'Run enrichment'}
          </Button>
        )}
      </div>

      <p className="text-muted mt-3 flex items-center gap-2 text-sm">
        {running && <Loader2 className="text-primary h-4 w-4 animate-spin" />}
        {remaining.toLocaleString()} eligible listings remaining
        {(tally.matched > 0 || tally.unmatched > 0 || tally.failed > 0) && (
          <span>
            · this session: <span className="text-primary">{tally.matched} matched</span>,{' '}
            {tally.unmatched} no confident match{tally.failed > 0 ? `, ${tally.failed} errors` : ''}
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
