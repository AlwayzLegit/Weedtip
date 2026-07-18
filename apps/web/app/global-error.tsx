'use client';

/**
 * Root-level error boundary. Replaces the whole document (including <html>/<body>)
 * when an error escapes the root layout, so it can't use app styles — keep it
 * self-contained with inline styles.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F0F4F1',
          color: '#1B2420',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <div style={{ maxWidth: 440, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#57635C', margin: '0 0 20px', lineHeight: 1.5 }}>
            An unexpected error occurred. Try again, and if it keeps happening please come back
            shortly.
          </p>
          {error.digest && (
            <p style={{ color: '#71807A', fontSize: 12, margin: '0 0 20px' }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              background: '#047857',
              color: '#FFFFFF',
              border: 0,
              borderRadius: 10,
              padding: '10px 18px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
