'use client';

import { useEffect, useState } from 'react';
import { Logo } from './brand/logo';
import { Button } from './ui/button';

const STORAGE_KEY = 'weedtip:age-verified';

/**
 * Compliance age gate shown on first visit. Persists acknowledgement in
 * localStorage so it appears once per device. A signed-in user's real DOB is
 * still the authoritative check (see age-verify Edge Function) — this is the
 * public, pre-auth gate.
 */
export function AgeGate() {
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    setVerified(localStorage.getItem(STORAGE_KEY) === 'true');
  }, []);

  // Avoid flashing the modal before we've read localStorage.
  if (verified === null || verified) return null;

  function confirm() {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVerified(true);
  }

  function deny() {
    window.location.href = 'https://www.google.com';
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="bg-background/95 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur"
    >
      <div className="rounded-card border-border bg-surface w-full max-w-md border p-8 text-center">
        <div className="mb-6 flex justify-center">
          <Logo className="text-2xl" />
        </div>
        {/* h2, not h1: this dialog renders on every page, and a second h1
            trips "multiple h1" checks site-wide. */}
        <h2 id="age-gate-title" className="text-xl font-bold">
          Are you 21 or older?
        </h2>
        <p className="text-muted mt-2 text-sm">
          You must be of legal age to enter Weedtip and browse cannabis products.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button size="lg" onClick={confirm}>
            Yes, I&apos;m 21 or older
          </Button>
          <Button size="lg" variant="outline" onClick={deny}>
            No, take me back
          </Button>
        </div>
      </div>
    </div>
  );
}
