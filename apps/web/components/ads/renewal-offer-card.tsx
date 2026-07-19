'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Loader2, RefreshCcw } from 'lucide-react';
import { acceptRenewalOffer, type AdRequestResult } from '@/app/actions/ads';
import { formatPrice } from '@/lib/format';
import { Button } from '../ui/button';

export type RenewalOffer = {
  subscriptionId: string;
  slotType: string;
  regionName: string;
  currentCents: number;
  offerCents: number;
  endsAt: string | null;
};

/**
 * First right of renewal: the incumbent sees their expiring placement and the
 * going rate before the spot returns to the open market. Accepting lands on
 * the admin Ad desk for the term extension.
 */
export function RenewalOfferCard({ offer }: { offer: RenewalOffer }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AdRequestResult | null>(null);

  return (
    <div className="rounded-card border-primary/30 bg-primary-muted border p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <RefreshCcw className="text-primary h-4 w-4" /> Your {offer.slotType} spot in{' '}
        {offer.regionName} is ending
        {offer.endsAt ? ` ${new Date(offer.endsAt).toLocaleDateString()}` : ' soon'}
      </p>
      <p className="text-muted mt-1 text-xs">
        As the current holder you get it first — renew at the going rate of{' '}
        <span className="text-foreground font-semibold">{formatPrice(offer.offerCents)}/mo</span>
        {offer.offerCents !== offer.currentCents && (
          <> (you pay {formatPrice(offer.currentCents)}/mo today)</>
        )}
        . After that, the spot goes back on the market at the same price.
      </p>
      {result?.ok ? (
        <p className="text-primary mt-2 flex items-center gap-1.5 text-sm font-medium">
          <CheckCircle2 className="h-4 w-4" /> {result.message}
        </p>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => setResult(await acceptRenewalOffer(offer.subscriptionId)))
            }
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Renew at{' '}
            {formatPrice(offer.offerCents)}/mo
          </Button>
          {result && !result.ok && <p className="text-danger text-xs">{result.message}</p>}
        </div>
      )}
    </div>
  );
}
