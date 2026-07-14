'use client';

import { Check, Share2 } from 'lucide-react';
import { useState } from 'react';

/**
 * Share action: native share sheet where supported (mobile), clipboard-copy
 * fallback elsewhere. Styled to match the storefront's pill action buttons.
 */
export function ShareButton({ title, className }: { title: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User dismissed the sheet, or share failed — fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — nothing more we can do silently */
    }
  }

  return (
    <button type="button" onClick={share} className={className} aria-label="Share this dispensary">
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? 'Copied' : 'Share'}
    </button>
  );
}
