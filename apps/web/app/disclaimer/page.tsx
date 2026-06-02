import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Disclaimer',
  description: 'Important health, legal, and regulatory notices for Weedtip.',
  alternates: { canonical: '/disclaimer' },
};

export default function DisclaimerPage() {
  return (
    <LegalPage title="Disclaimer" updated="June 2, 2026">
      <h2>Age &amp; legal use</h2>
      <p>
        Weedtip is intended only for adults of legal age to purchase and consume cannabis in their
        jurisdiction (generally 21+, or 18+ for qualifying medical patients where permitted).
        Cannabis remains illegal under U.S. federal law and under the law of some states and
        localities. It is your responsibility to know and comply with the laws that apply to you.
      </p>

      <h2>Not medical advice</h2>
      <p>
        Content on Weedtip — including strain descriptions, effects, THC/CBD figures, and reviews —
        is for general informational purposes only and is not medical advice. Cannabis products have
        not been evaluated by the U.S. Food and Drug Administration and are not intended to diagnose,
        treat, cure, or prevent any disease. Consult a licensed healthcare provider before using
        cannabis, especially if you are pregnant, nursing, taking medication, or have a medical
        condition.
      </p>

      <h2>Marketplace role</h2>
      <p>
        Weedtip is a discovery and ordering platform connecting consumers with independent, licensed
        dispensaries. Weedtip does not sell, deliver, or dispense cannabis and does not take title to
        any product. Pricing, potency, availability, and fulfillment are the responsibility of the
        dispensary, which operates under its own licenses and policies.
      </p>

      <h2>Accuracy of information</h2>
      <p>
        Menus, potency figures, deals, and operating details may change without notice and may
        contain errors. Legality flags shown for states or regions are approximations and may not
        reflect current law. Always verify details directly with the dispensary and applicable
        regulators.
      </p>

      <h2>Do not operate impaired</h2>
      <p>
        Do not drive or operate machinery while under the influence of cannabis. Keep cannabis
        products away from children and pets.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? Contact us at <a href="mailto:support@weedtip.com">support@weedtip.com</a>.
      </p>
    </LegalPage>
  );
}
