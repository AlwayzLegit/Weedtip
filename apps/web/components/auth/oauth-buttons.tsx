'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Social sign-in (Google for now — Apple/Facebook need developer accounts).
 * Redirects through /auth/callback, which already exchanges OAuth codes and
 * runs the first-visit welcome/first-run routing. Requires the Google
 * provider to be enabled in the Supabase dashboard; if it isn't, the button
 * surfaces an inline error instead of dead-ending.
 */
export function OAuthButtons({ next }: { next?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setPending(true);
    setError(null);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback${
      next ? `?next=${encodeURIComponent(next)}` : ''
    }`;
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (err) {
      setError('Google sign-in isn’t available right now — use email instead.');
      setPending(false);
    }
    // On success the browser navigates away; leave the pending state on.
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        disabled={pending}
        className="border-border bg-surface hover:bg-surface-2 flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" className="shrink-0" aria-hidden width="18" height="18">
          <path
            fill="#4285F4"
            d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.28a7.21 7.21 0 0 1 0-4.56V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.98 11.98 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
          />
        </svg>
        {pending ? 'Redirecting…' : 'Continue with Google'}
      </button>
      {error && <p className="text-danger text-center text-xs">{error}</p>}
      <div className="flex items-center gap-3" aria-hidden>
        <div className="bg-border h-px flex-1" />
        <span className="text-muted text-xs uppercase tracking-wide">or</span>
        <div className="bg-border h-px flex-1" />
      </div>
    </div>
  );
}
