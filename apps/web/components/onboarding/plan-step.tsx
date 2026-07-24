import { Link } from 'next-view-transitions';
import { Check, Clock, Mail } from 'lucide-react';
import { PAID_PLAN_NAME, PAID_PLAN_PRICE } from '@/lib/plan';
import type { ClaimTarget } from '@/lib/onboarding-flow';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

const FREE_POINTS = [
  'Name, logo, cover photo, phone and hours',
  'Your menu, added by hand',
  'Reply to reviews',
  '0% commission — forever',
];

const PAID_POINTS = [
  'Full profile: description, photo gallery, amenities, website',
  'Deals, promos and customer updates',
  'Menu import and Google sync',
  'Analytics, team accounts and online orders',
  'A Featured placement in your region, included',
];

/**
 * Step 5: what happens next, plus the plan choice.
 *
 * This screen replaces the old dead end — submitting a claim used to leave the
 * owner sitting on a public consumer page with an inline "submitted" note and
 * nowhere to go, while /dashboard actively bounced them to the create-a-listing
 * form. Now the wait itself is a step: it states where the claim is, what we're
 * doing with it, and what they can do meanwhile.
 *
 * Plans are sales-led (no card anywhere), so this presents the choice honestly
 * rather than pretending there's a checkout behind the button.
 */
export function PlanStep({
  target,
  approved,
  planPreference,
}: {
  target: ClaimTarget | null;
  approved: boolean;
  planPreference: 'free' | 'paid' | null;
}) {
  return (
    <div className="space-y-6">
      <div
        className={
          approved
            ? 'rounded-card border-primary/30 bg-primary-muted border p-4'
            : 'rounded-card border-border bg-surface-2 border p-4'
        }
      >
        <div className="flex items-start gap-3">
          <span className="text-primary mt-0.5 shrink-0">
            {approved ? <Check className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p className="font-semibold">
              {approved
                ? `You're verified as the owner of ${target?.name ?? 'your listing'}`
                : `Claim submitted for ${target?.name ?? 'your listing'}`}
            </p>
            <p className="text-muted mt-1 text-sm leading-relaxed">
              {approved
                ? 'The listing is attached to your dashboard — you can edit everything about it now.'
                : "We're checking your license number and email against the state record. Most claims clear the same day; you'll get an email either way."}
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Pick how you want to run it</h2>
        <p className="text-muted mt-1 text-sm">
          You start on Free — nothing here is charged today, and your listing stays live either way.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-card border-border bg-surface flex flex-col border p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold">Free</p>
              <p className="text-muted text-sm font-medium">$0</p>
            </div>
            {planPreference !== 'paid' && (
              <Badge tone="outline" className="mt-2 self-start">
                Your current plan
              </Badge>
            )}
            <ul className="text-muted mt-3 space-y-1.5 text-sm">
              {FREE_POINTS.map((p) => (
                <li key={p} className="flex gap-2">
                  <Check className="text-muted mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-card border-primary/40 bg-primary-subtle flex flex-col border p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold">{PAID_PLAN_NAME}</p>
              <p className="text-primary text-sm font-semibold">${PAID_PLAN_PRICE}/mo</p>
            </div>
            {planPreference === 'paid' && (
              <Badge tone="primary" className="mt-2 self-start">
                You asked about this
              </Badge>
            )}
            <ul className="text-muted mt-3 space-y-1.5 text-sm">
              {PAID_POINTS.map((p) => (
                <li key={p} className="flex gap-2">
                  <Check className="text-primary mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted mt-3 flex items-start gap-1.5 text-xs leading-relaxed">
              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              No card needed here. Pick it from your dashboard and our team sets up billing with you
              — and shows you exactly which area the included Featured placement covers.
            </p>
          </div>
        </div>
      </div>

      <div className="border-border border-t pt-5">
        <p className="font-medium">{approved ? 'Set up your listing' : "Don't wait on us"}</p>
        <p className="text-muted mt-1 text-sm leading-relaxed">
          {approved
            ? 'Your dashboard walks you through photos, hours, and your menu — in the order that gets you found.'
            : 'You can build out photos, hours, and your menu right now. Everything you add is waiting the moment your claim clears.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/dashboard">
            <Button size="lg">Go to my dashboard</Button>
          </Link>
          {target && (
            <Link href={`/dispensary/${target.slug}`}>
              <Button size="lg" variant="outline">
                View my listing
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
