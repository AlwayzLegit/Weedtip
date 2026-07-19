'use client';

import { useState, useTransition } from 'react';
import { BellRing, Loader2, Send } from 'lucide-react';
import {
  sendClaimInviteBatch,
  sendClaimReminderBatch,
  type OutreachSendResult,
} from './actions';

/**
 * Campaign controls: market-targeted invite batches (state codes + optional
 * registry-contact reach + campaign label) and the one-time reminder drip.
 * Inline result feedback, no page reload.
 */
export function SendBatchButton({ enabled }: { enabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<OutreachSendResult | null>(null);
  const [states, setStates] = useState('');
  const [campaign, setCampaign] = useState('');
  const [useRegistry, setUseRegistry] = useState(false);

  const run = (fn: () => Promise<OutreachSendResult>) =>
    startTransition(async () => setResult(await fn()));

  return (
    <div className="rounded-card border-border bg-surface space-y-4 border p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Target states (optional)</span>
          <input
            value={states}
            onChange={(e) => setStates(e.target.value)}
            placeholder="e.g. OK, NM — blank = nationwide"
            className="border-border bg-surface-2 h-10 w-full rounded-lg border px-3 text-sm uppercase"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Campaign label (optional)</span>
          <input
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            maxLength={60}
            placeholder="e.g. ok-launch-wave-1"
            className="border-border bg-surface-2 h-10 w-full rounded-lg border px-3 text-sm"
          />
        </label>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={useRegistry}
          onChange={(e) => setUseRegistry(e.target.checked)}
          className="accent-primary mt-0.5 h-4 w-4"
        />
        <span>
          <span className="font-medium">Also reach state-registry contacts</span>
          <span className="text-muted block text-xs">
            Shops with no public email get invited via their licensed-business contact on the
            state record (unlocks California&apos;s ~1.5k listings). Slightly colder audience.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!enabled || pending}
          onClick={() =>
            run(() =>
              sendClaimInviteBatch({
                states: states
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
                campaign: campaign || undefined,
                useRegistryEmail: useRegistry,
              }),
            )
          }
          className="bg-primary bg-primary-grad text-primary-foreground shadow-glow-sm inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {pending ? 'Working…' : 'Send next invite batch (max 50)'}
        </button>
        <button
          type="button"
          disabled={!enabled || pending}
          onClick={() => run(() => sendClaimReminderBatch())}
          className="border-border bg-surface hover:border-primary/50 inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          <BellRing className="h-4 w-4" /> Send due reminders (max 50)
        </button>
      </div>
      <p className="text-muted text-xs">
        Reminders go only to invites sent 5+ days ago that never claimed, one reminder ever per
        shop, never to unsubscribed addresses.
      </p>
      {result && (
        <p className={`text-sm ${result.ok ? 'text-primary' : 'text-warning'}`}>{result.message}</p>
      )}
    </div>
  );
}
