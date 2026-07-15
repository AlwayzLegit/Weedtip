'use client';

import { useMemo, useRef, useState } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Dest = { key: string; label: string; path: string };
type Theme = { key: string; label: string; fg: string; bg: string };

const THEMES: Theme[] = [
  { key: 'green', label: 'Weedtip green', fg: '#0b3d2e', bg: '#ffffff' },
  { key: 'black', label: 'Black', fg: '#111111', bg: '#ffffff' },
  { key: 'inverted', label: 'Inverted', fg: '#ffffff', bg: '#0b3d2e' },
  { key: 'mono', label: 'Black & white', fg: '#000000', bg: '#ffffff' },
];

export function QrGenerator({
  baseUrl,
  slug,
  name,
}: {
  baseUrl: string;
  slug: string;
  name: string;
}) {
  const destinations: Dest[] = [
    { key: 'storefront', label: 'Storefront', path: `/dispensary/${slug}` },
    { key: 'menu', label: 'Order menu', path: `/dispensary/${slug}#menu` },
    { key: 'reviews', label: 'Leave a review', path: `/dispensary/${slug}#reviews` },
    { key: 'custom', label: 'Custom URL', path: '' },
  ];

  const [destKey, setDestKey] = useState('storefront');
  const [custom, setCustom] = useState('');
  const [themeKey, setThemeKey] = useState('green');
  const [fg, setFg] = useState('#0b3d2e');
  const theme = THEMES.find((t) => t.key === themeKey) ?? THEMES[0]!;
  const bg = theme.bg;
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);

  function pickTheme(key: string) {
    const t = THEMES.find((x) => x.key === key) ?? THEMES[0]!;
    setThemeKey(key);
    setFg(t.fg);
  }

  const value = useMemo(() => {
    if (destKey === 'custom') return custom.trim() || baseUrl;
    const path = destKey === 'menu' ? '#menu' : destKey === 'reviews' ? '#reviews' : '';
    return `${baseUrl}/dispensary/${slug}${path}`;
  }, [destKey, custom, baseUrl, slug]);

  function downloadPng() {
    const canvas = wrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${slug}-qr.png`;
    a.click();
  }

  function downloadSvg() {
    const svg = svgRef.current?.querySelector('svg');
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printQr() {
    const canvas = wrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    const win = window.open('', '_blank', 'width=420,height=520');
    if (!win) return;
    win.document.write(
      `<html><head><title>${name} — QR</title></head><body style="display:flex;flex-direction:column;align-items:center;font-family:sans-serif;gap:16px;padding:24px">` +
        `<h2>${name}</h2><img src="${canvas.toDataURL('image/png')}" style="width:280px;height:280px"/>` +
        `<p style="color:#555;word-break:break-all">${value}</p>` +
        `</body></html>`,
    );
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-4">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Destination</span>
          <select
            value={destKey}
            onChange={(e) => setDestKey(e.target.value)}
            className="border-border bg-background w-full rounded-md border px-3 py-2"
          >
            {destinations.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </label>

        {destKey === 'custom' && (
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Custom URL</span>
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="https://"
              className="border-border bg-background w-full rounded-md border px-3 py-2"
            />
          </label>
        )}

        <div className="space-y-1.5 text-sm">
          <span className="font-medium">Theme</span>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => pickTheme(t.key)}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                  themeKey === t.key
                    ? 'border-primary bg-primary-muted text-primary'
                    : 'border-border text-muted hover:text-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 text-sm">
          <span className="font-medium">Custom color</span>
          <input
            type="color"
            value={fg}
            onChange={(e) => setFg(e.target.value)}
            className="border-border h-9 w-14 rounded border"
            aria-label="QR color"
          />
        </label>

        <p className="text-muted break-all text-xs">{value}</p>

        <div className="flex flex-wrap gap-2">
          <Button onClick={downloadPng}>Download PNG</Button>
          <Button variant="outline" onClick={downloadSvg}>
            Download SVG
          </Button>
          <Button variant="outline" onClick={printQr}>
            Print
          </Button>
        </div>
      </div>

      <div className="flex items-start justify-center">
        <div
          ref={wrapRef}
          className="rounded-card border-border border p-4"
          style={{ background: bg }}
        >
          <QRCodeCanvas value={value} size={240} fgColor={fg} bgColor={bg} level="M" includeMargin />
        </div>
        {/* Hidden SVG mirror, serialized on SVG download. */}
        <div ref={svgRef} className="hidden">
          <QRCodeSVG value={value} size={240} fgColor={fg} bgColor={bg} level="M" includeMargin />
        </div>
      </div>
    </div>
  );
}
