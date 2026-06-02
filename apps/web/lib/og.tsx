import type { ReactElement } from 'react';

/** Standard Open Graph image dimensions. */
export const OG_SIZE = { width: 1200, height: 630 };

/**
 * Branded social-share card for next/og ImageResponse. Kept Satori-friendly:
 * every container sets display:flex and only leaf nodes hold text.
 */
export function ogCard({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}): ReactElement {
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        background: '#0F1117',
        color: '#E5E7EB',
        padding: 80,
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 38, fontWeight: 700 }}>
        <span style={{ color: '#E5E7EB' }}>Weed</span>
        <span style={{ color: '#34D399' }}>tip</span>
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 26,
          color: '#34D399',
          marginTop: 40,
          letterSpacing: 2,
        }}
      >
        {eyebrow.toUpperCase()}
      </div>
      <div style={{ display: 'flex', fontSize: 66, fontWeight: 800, marginTop: 12, lineHeight: 1.1 }}>
        {title.slice(0, 80)}
      </div>
      {subtitle ? (
        <div style={{ display: 'flex', fontSize: 30, color: '#9CA3AF', marginTop: 24 }}>
          {subtitle.slice(0, 100)}
        </div>
      ) : null}
      <div
        style={{
          display: 'flex',
          marginTop: 36,
          height: 10,
          width: 180,
          background: '#34D399',
          borderRadius: 9999,
        }}
      />
    </div>
  );
}
