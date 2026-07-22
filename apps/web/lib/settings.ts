import 'server-only';
import { cache } from 'react';
import { SITE_NAME, SITE_URL } from './site';
import { createStaticClient } from './supabase/static';

/**
 * Platform-wide brand + contact facts, read from the single-row
 * `platform_settings` table. This is the one source of truth consumed by the
 * footer, structured data, the legal pages, and every email (transactional +
 * Supabase auth). Falls back to sensible defaults so nothing breaks if the row
 * is missing or the DB is unreachable (e.g. build-time, local without seed).
 */
export type PlatformSettings = {
  brandName: string;
  legalName: string;
  tagline: string | null;
  supportEmail: string;
  salesEmail: string;
  adsEmail: string;
  privacyEmail: string;
  emailFrom: string;
  phoneDisplay: string | null;
  phoneE164: string | null;
  addressLine: string | null;
  addressLocality: string | null;
  addressRegion: string | null;
  postalCode: string | null;
  country: string;
  brandColor: string;
  /** Global kill-switch for consumer online ordering/checkout. OFF = marketing-only (payment-processor compliant). */
  orderingEnabled: boolean;
};

export const PLATFORM_FALLBACK: PlatformSettings = {
  brandName: SITE_NAME,
  legalName: SITE_NAME,
  tagline: 'The Google Maps of cannabis',
  supportEmail: 'support@weedtip.com',
  salesEmail: 'sales@weedtip.com',
  adsEmail: 'ads@weedtip.com',
  privacyEmail: 'privacy@weedtip.com',
  emailFrom: 'Weedtip <notifications@weedtip.com>',
  phoneDisplay: '(747) 250-4446',
  phoneE164: '+17472504446',
  addressLine: 'North Hollywood, CA 91606',
  addressLocality: 'North Hollywood',
  addressRegion: 'CA',
  postalCode: '91606',
  country: 'US',
  brandColor: '#1a7f4e',
  // Compliant default: no order-taking until the super-admin turns it on.
  orderingEnabled: false,
};

/** Memoized per request; the row is tiny and rarely changes. */
export const getPlatformSettings = cache(async (): Promise<PlatformSettings> => {
  try {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from('platform_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (!data) return PLATFORM_FALLBACK;
    return {
      brandName: data.brand_name,
      legalName: data.legal_name ?? data.brand_name,
      tagline: data.tagline,
      supportEmail: data.support_email,
      salesEmail: data.sales_email,
      adsEmail: data.ads_email,
      privacyEmail: data.privacy_email,
      emailFrom: data.email_from,
      phoneDisplay: data.phone_display,
      phoneE164: data.phone_e164,
      addressLine: data.address_line,
      addressLocality: data.address_locality,
      addressRegion: data.address_region,
      postalCode: data.postal_code,
      country: data.country,
      brandColor: data.brand_color,
      orderingEnabled: data.ordering_enabled ?? false,
    };
  } catch {
    return PLATFORM_FALLBACK;
  }
});

/** The one-line footer used in emails + the site footer, e.g. "Weedtip · North Hollywood, CA 91606 · (747) 250-4446". */
export function contactFooterLine(s: PlatformSettings): string {
  return [s.brandName, s.addressLine, s.phoneDisplay].filter(Boolean).join(' · ');
}

export { SITE_URL };
