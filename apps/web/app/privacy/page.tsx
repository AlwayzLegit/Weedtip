import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Weedtip collects, uses, and protects your information.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="June 2, 2026">
      <p>
        This Privacy Policy explains how Weedtip (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses,
        and shares information when you use our website and services (the &ldquo;Service&rdquo;). We
        take the sensitivity of cannabis-related data seriously and limit collection to what the
        Service needs to function.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account information</strong> — email, display name, and date of birth (used solely
          to verify you meet the legal age requirement).
        </li>
        <li>
          <strong>Order information</strong> — items, totals, pickup/delivery selection, and order
          history with the dispensaries you transact with.
        </li>
        <li>
          <strong>Location</strong> — approximate location only when you choose &ldquo;Use my
          location&rdquo; to find nearby dispensaries. We do not track your location in the
          background.
        </li>
        <li>
          <strong>Technical data</strong> — standard log and device data needed to operate and
          secure the Service.
        </li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>To provide the Service: authentication, age verification, search, and ordering.</li>
        <li>To route your orders to the licensed dispensary you select.</li>
        <li>To maintain security, prevent abuse, and comply with legal obligations.</li>
        <li>To improve the Service through aggregated, privacy-respecting analytics.</li>
      </ul>

      <h2>How we share information</h2>
      <p>
        We share order details with the dispensary fulfilling your order. We use service providers
        (e.g., hosting, database, and payment processing) bound by confidentiality obligations. We do
        not sell your personal information. We may disclose information where required by law.
      </p>

      <h2>Data retention &amp; your choices</h2>
      <p>
        We retain information for as long as your account is active or as needed to provide the
        Service and meet legal obligations. You may access or update your profile in your account
        settings, and you may request deletion of your account by contacting us. Note that
        dispensaries may retain transaction records as required by cannabis regulations.
      </p>

      <h2>Security</h2>
      <p>
        We use industry-standard safeguards, including row-level security on our database and
        encryption in transit. No method of transmission or storage is completely secure, and we
        cannot guarantee absolute security.
      </p>

      <h2>Children</h2>
      <p>
        The Service is not directed to anyone under the legal age to purchase cannabis, and we do not
        knowingly collect their information.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy questions or requests? Contact us at{' '}
        <a href="mailto:privacy@weedtip.com">privacy@weedtip.com</a>.
      </p>
    </LegalPage>
  );
}
