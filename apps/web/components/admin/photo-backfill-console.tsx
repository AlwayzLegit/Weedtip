'use client';

import { useRef, useState } from 'react';
import { Loader2, Play, Square } from 'lucide-react';
import { backfillPhotoGalleriesBatch } from '@/app/admin/google-enrich-actions';
import { Button } from '../ui/button';

/**
 * One-click photo-gallery backfill for listings enriched before
 * google_photo_names existed. Loops server-side batches until done or stopped;
 * the Places API key stays in the server environment.
 */
export function PhotoBackfillConsole({ initialRemaining }: { initialRemaining: number }) {
  const [remaining, setRemaining] = useState(initialRemaining);
  const [running, setRunning] = useState(false);
  const [tally, setTally] = useState({ withPhotos: 0, noPhotos: 0, failed: 0 });
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  async function run() {
    setRunning(true);
    setError(null);
    stopRef.current = false;
    let left = remaining;
    while (!stopRef.current && left > 0) {
      const res = await backfillPhotoGalleriesBatch();
      if (!res.ok) {
        setError(res.error);
        break;
      }
      left = res.remaining;
      setRemaining(res.remaining);
      setTally((t) => ({
        withPhotos: t.withPhotos + res.withPhotos,
        noPhotos: t.noPhotos + res.noPhotos,
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
          <p className="font-medium">Backfill storefront photo galleries</p>
          <p className="text-muted mt-0.5 text-sm">
            Fetches up to 8 Google photos for already-matched listings that predate the gallery
            field — powers the Photos section and covers on listing pages. One Place Details call
            per listing (roughly $0.02 each in Places API spend).
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
            <Play className="h-4 w-4" /> {remaining === 0 ? 'All caught up' : 'Backfill photos'}
          </Button>
        )}
      </div>

      <p className="text-muted mt-3 flex items-center gap-2 text-sm">
        {running && <Loader2 className="text-primary h-4 w-4 animate-spin" />}
        {remaining.toLocaleString()} listings awaiting galleries
        {(tally.withPhotos > 0 || tally.noPhotos > 0 || tally.failed > 0) && (
          <span>
            · this session: <span className="text-primary">{tally.withPhotos} with photos</span>,{' '}
            {tally.noPhotos} none on Google{tally.failed > 0 ? `, ${tally.failed} errors` : ''}
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
