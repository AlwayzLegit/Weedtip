import { Check } from 'lucide-react';
import {
  ONBOARDING_STEPS,
  STEP_LABELS,
  stepIndex,
  type OnboardingStep,
} from '@/lib/onboarding-flow';
import { cn } from '@/lib/utils';

/**
 * Chrome for every wizard step: a progress rail, the step's own heading, and
 * the body.
 *
 * The rail exists to answer the question that makes onboarding feel endless —
 * "how much more of this is there?" — so it always shows all five steps, even
 * the ones ahead, rather than revealing them one at a time.
 */
export function WizardShell({
  step,
  title,
  intro,
  children,
  footer,
}: {
  step: OnboardingStep;
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const current = stepIndex(step);
  const steps = ONBOARDING_STEPS.filter((s): s is Exclude<OnboardingStep, 'done'> => s !== 'done');

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <ol className="mb-8 flex items-center gap-1.5" aria-label="Onboarding progress">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s} className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span
                aria-hidden
                className={cn(
                  'h-1 rounded-full transition-colors',
                  done || active ? 'bg-primary' : 'bg-border',
                )}
              />
              <span
                className={cn(
                  'flex items-center gap-1 truncate text-[11px] font-medium',
                  active ? 'text-primary' : done ? 'text-muted' : 'text-muted-foreground',
                )}
              >
                {done && <Check className="h-3 w-3 shrink-0" aria-hidden />}
                {/* At 360px each column is ~60px, truncating every label to
                    ellipses — so on mobile only the active label shows; the
                    colored bars still communicate progress. */}
                <span className={cn('truncate', !active && 'hidden sm:inline')}>
                  {STEP_LABELS[s]}
                </span>
              </span>
              <span className="sr-only">
                {active ? 'Current step' : done ? 'Completed' : 'Upcoming'}
              </span>
            </li>
          );
        })}
      </ol>

      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      {intro && <div className="text-muted mt-2 leading-relaxed">{intro}</div>}

      <div className="mt-6">{children}</div>

      {footer && <div className="border-border mt-8 border-t pt-4">{footer}</div>}
    </div>
  );
}
