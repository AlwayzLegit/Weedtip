import Link from 'next/link';
import { setFeatureOverride } from '@/app/admin/dispensaries/[id]/feature-actions';
import type { FeatureState } from '@/lib/features';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Super-admin sub-account console: the plan a dispensary is on plus a per-feature
 * control grid. Each feature normally follows the plan; an admin can force it on
 * (comp/grandfather) or off (suspend) per account. "Default" clears the override.
 */
export function AdminFeaturePanel({
  dispensaryId,
  features,
  planName,
  planStatus,
  posAddon,
}: {
  dispensaryId: string;
  features: FeatureState[];
  planName: string;
  planStatus: string | null;
  posAddon: boolean;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Plan &amp; features</h3>
          <p className="text-muted mt-0.5 text-sm">
            Control what this account can use. Overrides beat the plan.
          </p>
        </div>
        <Link href="/admin/billing">
          <Button size="sm" variant="outline">
            Billing console
          </Button>
        </Link>
      </div>

      <div className="rounded-card border-border bg-surface flex flex-wrap items-center gap-3 border p-4 text-sm">
        <span>
          <span className="text-muted">Plan:</span>{' '}
          <span className="font-medium">{planName}</span>
          {planStatus && planStatus !== 'active' ? ` (${planStatus})` : ''}
        </span>
        <span className="text-muted">·</span>
        <span>
          <span className="text-muted">POS:</span>{' '}
          <Badge tone={posAddon ? 'primary' : 'muted'}>{posAddon ? 'enabled' : 'off'}</Badge>
        </span>
      </div>

      <div className="rounded-card border-border bg-surface overflow-hidden border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2.5 font-medium">Feature</th>
              <th className="px-4 py-2.5 font-medium">Effective</th>
              <th className="px-4 py-2.5 font-medium">Control</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {features.map((f) => {
              const source = f.overridden
                ? `override: ${f.overrideEnabled ? 'on' : 'off'}`
                : `plan default: ${f.planDefault ? 'on' : 'off'}`;
              return (
                <tr key={f.key} className="bg-surface align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{f.label}</p>
                    <p className="text-muted text-xs">{f.description}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={f.effective ? 'primary' : 'muted'}>
                      {f.effective ? 'On' : 'Off'}
                    </Badge>
                    <p className="text-muted mt-1 text-xs">{source}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(['default', 'on', 'off'] as const).map((mode) => {
                        const active =
                          (mode === 'default' && !f.overridden) ||
                          (mode === 'on' && f.overridden && f.overrideEnabled) ||
                          (mode === 'off' && f.overridden && !f.overrideEnabled);
                        return (
                          <form
                            key={mode}
                            action={setFeatureOverride.bind(null, dispensaryId, f.key, mode)}
                          >
                            <button
                              type="submit"
                              className={cn(
                                'rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                                active
                                  ? 'border-primary bg-primary-muted text-primary'
                                  : 'border-border text-muted hover:text-foreground',
                              )}
                            >
                              {mode === 'default' ? 'Plan default' : `Force ${mode}`}
                            </button>
                          </form>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
