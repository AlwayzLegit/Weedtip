import Link from 'next/link';
import { ArrowRight, CheckCircle2, Circle, Sparkles } from 'lucide-react';
import type { SetupStep } from '@/lib/onboarding';
import { setupProgress } from '@/lib/onboarding';
import { Button } from '@/components/ui/button';

/**
 * Guided first-run activation card. Turns a claimed-but-empty listing into an
 * active one by showing exactly what's left and the one-click path to each.
 * Collapses to a small "complete" banner once everything is done.
 */
export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const { done, total, pct } = setupProgress(steps);
  const complete = done === total;
  const nextStep = steps.find((s) => !s.done);

  if (complete) {
    return (
      <div className="rounded-card border-primary/30 bg-primary-muted text-primary flex items-center gap-2 border p-4 text-sm">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        Your listing is fully set up — nice work. Keep your menu and deals fresh to stay on top.
      </div>
    );
  }

  return (
    <div className="rounded-card border-border bg-surface shadow-card border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-lg font-semibold">
            <Sparkles className="text-primary h-5 w-5" /> Finish setting up your listing
          </h2>
          <p className="text-muted mt-0.5 text-sm">
            {done} of {total} done — a complete listing gets more views, orders, and search
            placement.
          </p>
        </div>
        {nextStep && (
          <Link href={nextStep.href}>
            <Button size="sm">
              {nextStep.cta} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>

      {/* Progress bar */}
      <div className="bg-surface-2 mt-4 h-2 overflow-hidden rounded-full" aria-hidden>
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-4 space-y-2">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-3">
            {s.done ? (
              <CheckCircle2 className="text-primary h-5 w-5 shrink-0" />
            ) : (
              <Circle className="text-muted h-5 w-5 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${s.done ? 'text-muted line-through' : ''}`}>
                {s.label}
              </p>
              {!s.done && <p className="text-muted text-xs">{s.hint}</p>}
            </div>
            {!s.done && (
              <Link
                href={s.href}
                className="text-primary focus-visible:ring-primary shrink-0 rounded text-sm font-medium hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2"
              >
                {s.cta}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
