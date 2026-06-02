'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { deleteAccount } from '@/app/account/actions';
import { Button } from '../ui/button';

export function DeleteAccountButton() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, pending]);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await deleteAccount();
      // On success the action redirects; only an error returns here.
      if (res && 'error' in res && res.error) setError(res.error);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="danger"
        size="sm"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Delete account
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Delete account"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
        >
          <div className="rounded-card border-border bg-surface w-full max-w-sm border p-5 shadow-xl">
            <p className="font-medium">Delete your account?</p>
            <p className="text-muted mt-1 text-sm">
              This permanently removes your profile, reviews, favorites, and notifications, and
              unlinks any dispensaries you own. This cannot be undone.
            </p>
            {error && (
              <p className="border-danger/40 bg-danger/10 text-danger mt-3 rounded-lg border px-3 py-2 text-sm">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" variant="danger" size="sm" disabled={pending} onClick={confirm}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete account
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
