import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';
import { getPlatformSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms governing your use of Weedtip.',
  alternates: { canonical: '/terms' },
};

export default async function TermsPage() {
  const s = await getPlatformSettings();
  return (
    <LegalPage title="Terms of Service" updated="June 2, 2026">
      <p>
        Welcome to Weedtip. These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and
        use of the Weedtip website, products, and services (collectively, the
        &ldquo;Service&rdquo;). By accessing or using the Service, you agree to be bound by these
        Terms. If you do not agree, do not use the Service.
      </p>

      <h2>1. Eligibility &amp; age requirement</h2>
      <p>
        The Service is intended only for adults of legal age to purchase and consume cannabis in
        their jurisdiction (21 years of age or older in most jurisdictions; 18+ where permitted for
        qualifying medical patients). By using the Service you represent and warrant that you meet
        this requirement. We may refuse service, remove content, or terminate accounts that violate
        this requirement.
      </p>

      <h2>2. Nature of the Service</h2>
      <p>
        Weedtip is a discovery and ordering marketplace that connects consumers with licensed
        cannabis dispensaries. Weedtip is not a dispensary, does not take title to any product, and
        does not sell, deliver, or dispense cannabis. All transactions are fulfilled by the
        independent, licensed dispensary you select, subject to that dispensary&rsquo;s own terms,
        pricing, availability, and applicable law.
      </p>

      <h2>3. Accounts</h2>
      <p>
        You are responsible for the accuracy of the information you provide, for maintaining the
        confidentiality of your credentials, and for all activity under your account. Notify us
        immediately of any unauthorized use. Dispensary owner accounts are additionally subject to
        the verification and approval process described in the Service.
      </p>

      <h2>4. Orders &amp; payment</h2>
      <ul>
        <li>Order totals, taxes, and availability are determined at the time of order.</li>
        <li>
          Where online payment is available, it is processed by a third-party payment provider;
          where it is not, orders are paid in person at the dispensary upon pickup.
        </li>
        <li>
          Valid government-issued ID confirming you meet the age requirement is required at pickup
          or delivery. Dispensaries may cancel orders that cannot be verified.
        </li>
      </ul>

      <h2>5. Acceptable use</h2>
      <p>
        You agree not to misuse the Service, including by attempting to access it unlawfully,
        scraping at scale, interfering with its operation, submitting false information, or using it
        to facilitate any transaction that is illegal in your jurisdiction.
      </p>

      <h2>6. Content</h2>
      <p>
        Listings, menus, reviews, and other content may be provided by dispensaries or users.
        Weedtip does not guarantee the accuracy, completeness, or legality of such content. You
        retain rights to content you submit but grant Weedtip a non-exclusive license to host and
        display it within the Service.
      </p>

      <h2>7. Disclaimers &amp; limitation of liability</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; without warranties of any kind. See our{' '}
        <a href="/disclaimer">Disclaimer</a> for important health, legal, and regulatory notices. To
        the maximum extent permitted by law, Weedtip is not liable for indirect, incidental, or
        consequential damages arising from your use of the Service.
      </p>

      <h2>8. Changes</h2>
      <p>
        We may update these Terms from time to time. Material changes will be reflected by the
        &ldquo;Last updated&rdquo; date above. Continued use after changes constitutes acceptance.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about these Terms? Contact us at{' '}
        <a href={`mailto:${s.supportEmail}`}>{s.supportEmail}</a>.
      </p>
    </LegalPage>
  );
}
