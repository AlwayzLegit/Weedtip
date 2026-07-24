'use client';

import { Store } from 'lucide-react';
import { useActionState, useEffect, useState } from 'react';
import { requestOwnership, withdrawOwnership } from '@/app/actions/ownership';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { ClaimDocumentUpload } from './claim-document-upload';
import { SubmitButton } from './auth/submit-button';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

/**
 * Tier cards for the claim funnel. Copy mirrors the plans ladder (Free $0 /
 * Weedtip Pro $39 — sales-led, no card at claim time); kept as local
 * literals so this client component doesn't need server plan data.
 */
const CLAIM_TIERS = [
  {
    value: 'free',
    name: 'Free',
    price: '$0',
    blurb: 'Claim + manage the basics',
    bullets: ['Name, logo, phone & hours', 'Manual menu items', '0% commission, forever'],
  },
  {
    value: 'paid',
    name: 'Weedtip Pro',
    price: '$39/mo',
    blurb: 'Everything to run & grow',
    bullets: [
      'Online orders, website & Google sync',
      'Deals, promos, updates, analytics & team',
      'Featured placement in your region',
    ],
  },
] as const;

/**
 * "Claim this listing" CTA shown to dispensary-owner accounts on unclaimed, active
 * listings. Submits an ownership request an admin reviews. Reflects an existing
 * request's status so owners aren't prompted to claim twice.
 */
export function ClaimListing({
  dispensaryId,
  slug,
  existingStatus,
  legalName,
  licenseNumber,
}: {
  dispensaryId: string;
  slug: string;
  existingStatus: 'pending' | 'approved' | 'rejected' | null;
  /** Registered name + license # from the DCC record, shown so a claimer can verify the listing. */
  legalName?: string | null;
  licenseNumber?: string | null;
}) {
  const [state, action] = useActionState(requestOwnership, EMPTY_FORM_STATE);
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<string>('free');

  useEffect(() => {
    if (state.status === 'success') {
      track('claim_submitted', { dispensary_id: dispensaryId, slug });
    }
  }, [state.status, dispensaryId, slug]);

  if (existingStatus === 'pending' || state.status === 'success') {
    return (
      <div className="rounded-card border-primary/30 bg-primary-muted border p-4 text-sm">
        <p className="text-primary font-medium">Ownership claim submitted</p>
        <p className="text-muted mt-1">
          An admin will review your claim and attach this listing to your dashboard once approved.
        </p>
        <form action={withdrawOwnership.bind(null, dispensaryId, slug)} className="mt-3">
          <Button type="submit" size="sm" variant="ghost">
            Withdraw claim
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-card border-border bg-surface border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Own this dispensary?</p>
          <p className="text-muted text-sm">
            Claim this listing to manage its menu, deals, and orders.
          </p>
          {(legalName || licenseNumber) && (
            <p className="text-muted mt-1 text-xs">
              On file with the state licensing authority:{legalName ? ` ${legalName}` : ''}
              {legalName && licenseNumber ? ' · ' : ' '}
              {licenseNumber ? `License ${licenseNumber}` : ''}
            </p>
          )}
        </div>
        {!open && (
          <Button
            size="sm"
            onClick={() => {
              setOpen(true);
              track('claim_started', { dispensary_id: dispensaryId, slug });
            }}
          >
            <Store className="h-4 w-4" /> Claim listing
          </Button>
        )}
      </div>

      {open && (
        <form action={action} className="mt-4 space-y-3">
          <input type="hidden" name="dispensary_id" value={dispensaryId} />
          <input type="hidden" name="slug" value={slug} />
          {existingStatus === 'rejected' && (
            <p className="text-muted text-sm">
              Your previous claim was declined. Add details below and try again.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              name="claimant_role"
              required
              defaultValue=""
              className="border-border bg-surface-2 text-foreground h-11 w-full rounded-lg border px-3.5 text-sm"
              aria-label="Your role at this business"
            >
              <option value="" disabled>
                Your role at this business…
              </option>
              <option value="owner">Owner</option>
              <option value="manager">Manager</option>
              <option value="authorized_rep">Authorized representative</option>
            </select>
            <Input
              name="business_email"
              type="email"
              placeholder="Business email"
              required
              maxLength={254}
            />
            <Input name="business_phone" placeholder="Business phone (optional)" maxLength={30} />
            <Input name="license_number" placeholder="State license #" maxLength={120} required />
          </div>
          <p className="text-muted text-xs">
            Entering the license number exactly as issued verifies your claim against the state
            record instantly and speeds up review.
          </p>
          <Textarea
            name="message"
            placeholder="Anything else that helps verify you own this dispensary (optional)"
            maxLength={2000}
          />
          {/* Tier-based funnel: pick a starting plan with the claim. Free is the
              default; a paid pick becomes a pending sales-led request on
              approval — no card collected here. */}
          <div>
            <p className="mb-1.5 text-sm font-medium">Choose your starting plan</p>
            <input type="hidden" name="plan_preference" value={tier} />
            <div className="grid gap-2 sm:grid-cols-2">
              {CLAIM_TIERS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTier(t.value)}
                  aria-pressed={tier === t.value}
                  className={cn(
                    'rounded-card border p-3 text-left transition-colors',
                    tier === t.value
                      ? 'border-primary bg-primary-subtle'
                      : 'border-border bg-surface hover:border-border-strong',
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">{t.name}</span>
                    <span
                      className={cn(
                        'text-xs font-medium',
                        tier === t.value ? 'text-primary' : 'text-muted',
                      )}
                    >
                      {t.price}
                    </span>
                  </span>
                  <span className="text-muted mt-0.5 block text-xs">{t.blurb}</span>
                  <ul className="text-muted mt-1.5 space-y-0.5 text-xs">
                    {t.bullets.map((b) => (
                      <li key={b}>· {b}</li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
            {tier !== 'free' && (
              <p className="text-muted mt-1.5 text-xs">
                No card needed now — once your claim is approved, our team reaches out to set up
                billing. Your listing stays live on Free in the meantime.
              </p>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Proof of ownership (recommended)</p>
            <p className="text-muted mb-2 text-xs">
              Upload your state license or a business document to verify faster. Stored privately
              and only visible to our review team.
            </p>
            <ClaimDocumentUpload name="document_path" />
          </div>
          {state.status === 'error' && state.message && (
            <p className="border-danger/40 bg-danger/10 text-danger rounded-lg border px-3 py-2 text-sm">
              {state.message}
            </p>
          )}
          <div className="flex gap-2">
            <SubmitButton size="sm">Submit claim</SubmitButton>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
