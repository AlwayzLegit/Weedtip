'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Copyable iframe embed snippet for a dispensary's live menu widget. */
export function EmbedSnippet({ siteUrl, slug, name }: { siteUrl: string; slug: string; name: string }) {
  const code = `<iframe src="${siteUrl}/embed/${slug}" title="${name} menu" width="100%" height="600" style="border:0;border-radius:12px;max-width:680px"></iframe>`;
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-3">
      <pre className="border-border bg-surface-2 text-muted overflow-x-auto rounded-lg border p-3 text-xs">
        <code>{code}</code>
      </pre>
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy embed code'}
        </Button>
        <a
          href={`${siteUrl}/embed/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary text-sm hover:underline"
        >
          Preview widget
        </a>
      </div>
    </div>
  );
}
