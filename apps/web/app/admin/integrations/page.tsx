import type { Metadata } from 'next';
import { AlertTriangle, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { GoogleEnrichConsole } from '@/components/admin/google-enrich-console';
import { integrationStatuses } from '@/lib/integration-status';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Integrations · Admin' };

// Read live env at request time so a freshly-deployed change is reflected.
export const dynamic = 'force-dynamic';

export default async function AdminIntegrations() {
  const statuses = integrationStatuses();
  const missingRequired = statuses.filter((s) => s.required && !s.configured);

  // Listings still eligible for Google enrichment (unlinked, unattempted, mappable).
  const supabase = await createClient();
  const { count: enrichRemaining } = await supabase
    .from('dispensaries')
    .select('id', { count: 'exact', head: true })
    .is('google_place_id', null)
    .is('google_enriched_at', null)
    .not('location', 'is', null)
    .eq('status', 'active');

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">System</p>
        <h2 className="text-2xl font-bold">Integrations</h2>
        <p className="text-muted mt-1 text-sm">
          What&apos;s wired in <strong>this</strong> environment. Shows whether each integration&apos;s
          env vars are present — never their values. Set vars in your host (e.g. Vercel) and redeploy,
          then refresh here to confirm.
        </p>
      </div>

      {missingRequired.length > 0 && (
        <div className="rounded-card border-danger/40 bg-danger/10 text-foreground flex items-start gap-2 border p-3 text-sm">
          <AlertTriangle className="text-danger mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Missing required configuration: {missingRequired.map((s) => s.name).join(', ')}. Core
            features may not work until these are set.
          </span>
        </div>
      )}

      <GoogleEnrichConsole initialRemaining={enrichRemaining ?? 0} />

      <div className="rounded-card border-border bg-surface divide-border divide-y border">
        {statuses.map((s) => (
          <div key={s.name} className="flex items-start justify-between gap-4 p-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{s.name}</span>
                {s.required ? (
                  <Badge tone="outline">Required</Badge>
                ) : (
                  <Badge tone="muted">Optional</Badge>
                )}
              </div>
              <p className="text-muted mt-1 text-sm">{s.gates}</p>
              <p className="text-muted-foreground mt-1 font-mono text-xs">{s.vars.join(' · ')}</p>
              {s.warning && (
                <p className="text-danger mt-1.5 flex items-start gap-1.5 text-xs">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {s.warning}
                </p>
              )}
            </div>
            <div className="shrink-0">
              {s.configured ? (
                <span className="text-primary inline-flex items-center gap-1 text-sm font-medium">
                  <Check className="h-4 w-4" /> Configured
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1 text-sm font-medium ${
                    s.required ? 'text-danger' : 'text-muted'
                  }`}
                >
                  <X className="h-4 w-4" /> Not set
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
