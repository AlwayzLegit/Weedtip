'use client';

import { useState, useTransition } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { syncFromGoogle } from '@/app/actions/google-sync';
import { Button } from '../ui/button';

export function GoogleSyncButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function sync() {
    setResult(null);
    setError(null);
    start(async () => {
      const res = await syncFromGoogle();
      if (res.ok) {
        setResult(
          res.updated.length > 0
            ? `Imported ${res.updated.join(', ')} from Google.`
            : 'Google had nothing new to import.',
        );
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div>
      <Button onClick={sync} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Import from Google
      </Button>
      {result && <p className="text-primary mt-2 text-sm">{result}</p>}
      {error && (
        <p className="border-danger/40 bg-danger/10 text-danger mt-2 rounded-lg border px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
