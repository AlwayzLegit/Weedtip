'use client';

import { useState, useTransition } from 'react';
import { Loader2, Send } from 'lucide-react';
import { sendClaimInviteBatch, type OutreachSendResult } from './actions';

/** Batch-send trigger with inline result feedback (no page reload). */
export function SendBatchButton({ enabled }: { enabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<OutreachSendResult | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={!enabled || pending}
        onClick={() => startTransition(async () => setResult(await sendClaimInviteBatch()))}
        className="bg-primary bg-primary-grad text-primary-foreground shadow-glow-sm inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {pending ? 'Sending…' : 'Send next batch (max 50)'}
      </button>
      {result && (
        <p className={`text-sm ${result.ok ? 'text-primary' : 'text-warning'}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
