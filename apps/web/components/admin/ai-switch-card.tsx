'use client';

import { useActionState } from 'react';
import { Sparkles } from 'lucide-react';
import { saveAnthropicKey } from '@/app/admin/settings/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/auth/submit-button';

/**
 * Super-admin switch for AI review summaries: while no Anthropic key is
 * configured (env or here), every AI surface — the dashboard summary card,
 * the storefront blurb, the generate action — stays fully hidden. The stored
 * key is never echoed back; only its configured/off state is shown.
 */
export function AiSwitchCard({
  configured,
  viaEnv,
}: {
  configured: boolean;
  /** Key comes from the ANTHROPIC_API_KEY env var (wins over the stored one). */
  viaEnv: boolean;
}) {
  const [state, action] = useActionState(saveAnthropicKey, EMPTY_FORM_STATE);

  return (
    <div className="rounded-card border-border bg-surface border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="text-primary h-4 w-4" /> AI review summaries
        </h3>
        {configured ? (
          <Badge tone="primary">Active{viaEnv ? ' · env key' : ''}</Badge>
        ) : (
          <Badge tone="muted">Off — hidden site-wide</Badge>
        )}
      </div>
      <p className="text-muted mt-1 text-xs">
        Paste an Anthropic API key to switch the feature on: owners get a “generate summary”
        card on their Reviews page and listings show the AI blurb. Leave the field empty and
        save to switch it off again. The key is stored server-side only and never shown.
      </p>
      {viaEnv && (
        <p className="text-muted mt-1 text-xs">
          The ANTHROPIC_API_KEY environment variable is set and takes precedence — clearing the
          field below won’t turn the feature off until that variable is removed.
        </p>
      )}
      <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          name="anthropic_key"
          type="password"
          placeholder={configured && !viaEnv ? 'Key configured — paste to replace, save empty to clear' : 'sk-ant-…'}
          autoComplete="off"
          className="min-w-0 flex-1"
        />
        <SubmitButton size="sm">Save</SubmitButton>
      </form>
      {state.status === 'error' && state.message && (
        <p className="text-danger mt-2 text-xs">{state.message}</p>
      )}
      {state.status === 'success' && state.message && (
        <p className="text-primary mt-2 text-xs">{state.message}</p>
      )}
    </div>
  );
}
