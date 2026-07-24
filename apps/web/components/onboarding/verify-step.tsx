'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck, MapPin } from 'lucide-react';
import { requestOwnership } from '@/app/actions/ownership';
import { goBack } from '@/app/get-started/actions';
import { track } from '@/lib/analytics';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import type { ClaimTarget } from '@/lib/onboarding-flow';
import { ClaimDocumentUpload } from '../claim-document-upload';
import { LogoImage } from '../logo-image';
import { SubmitButton } from '../auth/submit-button';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

/**
 * Step 4: prove you run this shop.
 *
 * The license number is deliberately NOT pre-filled even though we hold it —
 * comparing what the owner types against the state record is the strongest
 * self-serve verification signal we have, and pre-filling it would make every
 * claim "match" and render the signal meaningless. The copy explains the ask
 * instead, so it reads as verification rather than busywork.
 */
export function VerifyStep({ target, rejected }: { target: ClaimTarget; rejected: boolean }) {
  const [state, action] = useActionState(requestOwnership, EMPTY_FORM_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'success') {
      track('claim_submitted', { dispensary_id: target.id, slug: target.slug });
      // The wizard derives its step from claim status, so refreshing advances it.
      router.refresh();
    }
  }, [state.status, target.id, target.slug, router]);

  return (
    <div className="space-y-5">
      <div className="rounded-card border-border bg-surface-2 flex items-center gap-3 border p-4">
        <LogoImage src={target.logo_url} name={target.name} className="h-11 w-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{target.name}</p>
          <p className="text-muted flex items-center gap-1 truncate text-xs">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            {target.address ? `${target.address}, ` : ''}
            {target.city ? `${target.city}, ` : ''}
            {target.state}
          </p>
        </div>
        <form action={goBack}>
          <input type="hidden" name="to" value="business" />
          <Button type="submit" variant="ghost" size="sm">
            Change
          </Button>
        </form>
      </div>

      {target.legal_name && (
        <p className="text-muted text-sm">
          The state licensing record for this address lists{' '}
          <strong className="text-foreground">{target.legal_name}</strong>.
        </p>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="dispensary_id" value={target.id} />
        <input type="hidden" name="slug" value={target.slug} />
        {/* The plan choice is its own step; claims start on Free either way. */}
        <input type="hidden" name="plan_preference" value="free" />

        {rejected && (
          <p className="border-border bg-surface-2 text-muted rounded-lg border px-3 py-2 text-sm">
            Your previous claim was declined. Add anything that helps us verify you and try again.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="claimant_role">Your role</Label>
            <select
              id="claimant_role"
              name="claimant_role"
              required
              defaultValue=""
              className="border-border bg-surface-2 text-foreground h-11 w-full rounded-lg border px-3.5 text-sm"
            >
              <option value="" disabled>
                Your role here…
              </option>
              <option value="owner">Owner</option>
              <option value="manager">Manager</option>
              <option value="authorized_rep">Authorized representative</option>
            </select>
          </div>
          <div>
            <Label htmlFor="business_email">Business email</Label>
            <Input
              id="business_email"
              name="business_email"
              type="email"
              placeholder="you@yourshop.com"
              required
              maxLength={254}
            />
          </div>
          <div>
            <Label htmlFor="business_phone">Business phone (optional)</Label>
            <Input
              id="business_phone"
              name="business_phone"
              placeholder="(555) 555-0134"
              maxLength={30}
            />
          </div>
          <div>
            <Label htmlFor="license_number">State license #</Label>
            <Input
              id="license_number"
              name="license_number"
              placeholder="e.g. C10-0000042-LIC"
              required
              maxLength={120}
            />
          </div>
        </div>

        <div className="rounded-card border-border bg-surface-2 flex items-start gap-2.5 border p-3">
          <BadgeCheck className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="text-muted text-xs leading-relaxed">
            Two things get you verified fastest: a license number typed exactly as the state issued
            it, and an email on your shop&apos;s own domain. Both are checked automatically — match
            either and your claim usually clears the same day.
          </p>
        </div>

        <Textarea
          name="message"
          placeholder="Anything else that helps us confirm you run this shop (optional)"
          maxLength={2000}
          aria-label="Additional context"
        />

        <div>
          <p className="text-sm font-medium">Proof of ownership (optional)</p>
          <p className="text-muted mb-2 mt-0.5 text-xs">
            A license or business document clears a claim even when neither automatic check matches.
            Stored privately; only our review team sees it.
          </p>
          <ClaimDocumentUpload name="document_path" />
        </div>

        {state.status === 'error' && state.message && (
          <p className="border-danger/40 bg-danger/10 text-danger rounded-lg border px-3 py-2 text-sm">
            {state.message}
          </p>
        )}

        <SubmitButton size="lg">Submit claim</SubmitButton>
      </form>
    </div>
  );
}
