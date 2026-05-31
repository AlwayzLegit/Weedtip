'use client';

import { useEffect } from 'react';
import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to monitoring in production.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-muted mt-2 text-sm">
        An unexpected error occurred. You can try again, or head back home.
      </p>
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>
          <RotateCw className="h-4 w-4" /> Try again
        </Button>
      </div>
    </main>
  );
}
