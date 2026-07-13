import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy',
  description:
    'How order cancellations, refunds, and returns work for purchases placed through Weedtip.',
  alternates: { canonical: '/refunds' },
};

export default function RefundsPage() {
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
        You may cancel an order at no charge at any time <strong>before the dispensary begins
        preparing it</strong>. To cancel, use the cancel option on your order page (under{' '}
        <a href="/orders">Your orders</a>) or contact the dispensary directly using the phone number
        on its listing. Once an order is marked as being prepared, out for delivery, or ready for
        pickup, cancellation is at the dispensary&apos;s discretion, subject to applicable law.
      </p>

      <h2>Refunds</h2>
      <p>
        Approved refunds are issued to your original payment method. Depending on your bank, funds
        typically appear within <strong>5–10 business days</strong> of approval. Refunds are issued
        in full for orders cancelled before preparation, for items that were charged but never
        received, and for orders the dispensary could not fulfill.
      </p>
      <p>
        If you receive an incorrect, defective, mislabeled, or unsafe product, contact the
        dispensary and Weedtip support within <strong>48 hours</strong> of pickup or delivery. State
        cannabis regulations restrict returns of cannabis products once they leave the licensed
        premises; where a physical return is not permitted, the dispensary may offer a refund,
        replacement, or store credit consistent with its license and state law.
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
        recipient was unavailable, the dispensary&apos;s failed-delivery policy applies and a
        restocking or delivery fee may be deducted where permitted. If a dispensary cancels your
        order (for example, an item went out of stock), you will receive a full refund
        automatically.
      </p>

      <h2>Fees, deals, and promotions</h2>
      <p>
        Discounts and promotional pricing are applied at the time of order and refunded
        proportionally. Delivery fees are refunded when an order is cancelled before dispatch or
        when the dispensary is unable to fulfill it.
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
        Questions or refund requests: email <a href="mailto:support@weedtip.com">support@weedtip.com</a>,
        call <a href="tel:+17472504446">(747) 250-4446</a>, or write to Weedtip, North Hollywood, CA
        91606. Include your order number so we can help quickly.
      </p>
    </LegalPage>
  );
}
