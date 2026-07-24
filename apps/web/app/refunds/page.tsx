import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';
import { getPlatformSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy',
  description:
    'How order cancellations and refunds work for orders reserved through Weedtip — you pay the dispensary directly, and refunds are handled by the dispensary.',
  alternates: { canonical: '/refunds' },
};

export default async function RefundsPage() {
  const s = await getPlatformSettings();
  return (
    <LegalPage title="Refund &amp; Cancellation Policy" updated="July 13, 2026">
      <h2>Overview</h2>
      <p>
        Weedtip is a marketplace connecting consumers with independent, licensed dispensaries.
        Orders placed through Weedtip are prepared and fulfilled by the dispensary you order from.
        This policy explains how cancellations and refunds work for those orders. Where a
        dispensary&apos;s own posted policy is stricter than state law allows, state law controls.
      </p>

      <h2>Cancelling an order</h2>
      <p>
        You may cancel an order at no charge at any time{' '}
        <strong>before the dispensary begins preparing it</strong>. To cancel, use the cancel option
        on your order page (under <a href="/orders">Your orders</a>) or contact the dispensary
        directly using the phone number on its listing. Once an order is marked as being prepared,
        out for delivery, or ready for pickup, cancellation is at the dispensary&apos;s discretion,
        subject to applicable law.
      </p>

      <h2>Payment &amp; refunds</h2>
      <p>
        <strong>Weedtip never charges shoppers.</strong> You pay the dispensary directly — at the
        counter for pickup, or to the dispensary&apos;s driver on delivery. Because no payment
        passes through Weedtip, all refunds, exchanges, and store credits for purchases are issued
        by the dispensary under its own posted policies and applicable state law. Cancelling an
        order before you&apos;ve paid simply releases it — there is nothing to refund.
      </p>
      <p>
        If you receive an incorrect, defective, mislabeled, or unsafe product, contact the
        dispensary within <strong>48 hours</strong> of your purchase, and let Weedtip support know
        so we can assist with the dispute. State cannabis regulations restrict returns of cannabis
        products once they leave the licensed premises; where a physical return is not permitted,
        the dispensary may offer a refund, replacement, or store credit consistent with its license
        and state law.
      </p>

      <h2>Shipping &amp; fulfillment</h2>
      <p>
        Weedtip does not ship products and nothing ordered through Weedtip is ever sent by mail.
        Every order is fulfilled directly by the licensed dispensary you order from — as in-store
        pickup or, where state law allows, local delivery by the dispensary or its licensed courier
        — under that dispensary&apos;s own fulfillment policies, service areas, fees, and time
        windows, which are shown on its listing and at checkout. Valid government-issued ID proving
        you are of legal age is required at every pickup and delivery handoff.
      </p>

      <h2>Unfulfilled and failed orders</h2>
      <p>
        If a delivery cannot be completed because valid ID could not be verified at handoff, or the
        recipient was unavailable, the dispensary&apos;s failed-delivery policy applies — since
        payment happens at handoff, an uncompleted order is simply cancelled. If a dispensary
        cancels your order (for example, an item went out of stock), you owe nothing and will be
        notified.
      </p>

      <h2>Fees, deals, and promotions</h2>
      <p>
        Discounts and promotional pricing shown on Weedtip are applied by the dispensary at the time
        you pay. Delivery fees, minimums, and how they apply to cancelled orders are set by each
        dispensary and shown on its listing.
      </p>

      <h2>Advertising and business services</h2>
      <p>
        Paid business services purchased from Weedtip (listing placements, advertising slots, and
        similar subscriptions) may be cancelled at any time from the owner dashboard; cancellation
        stops future renewal charges. Fees for the current billing period are non-refundable except
        where required by law or where the service was not delivered.
      </p>

      <h2>How to reach us</h2>
      <p>
        Questions or refund requests: email{' '}
        <a href={`mailto:${s.supportEmail}`}>{s.supportEmail}</a>
        {s.phoneE164 && s.phoneDisplay && (
          <>
            , call <a href={`tel:${s.phoneE164}`}>{s.phoneDisplay}</a>
          </>
        )}
        {s.addressLine ? `, or write to ${s.brandName}, ${s.addressLine}` : ''}. Include your order
        number so we can help quickly.
      </p>
    </LegalPage>
  );
}
