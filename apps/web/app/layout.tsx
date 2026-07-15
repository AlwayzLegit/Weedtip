import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { ViewTransitions } from 'next-view-transitions';
import { AgeGate } from '@/components/age-gate';
import { PostHogProvider } from '@/components/analytics/posthog-provider';
import { CartDrawer } from '@/components/cart/cart-drawer';
import { CartProvider } from '@/components/cart/cart-provider';
import { CommandPalette } from '@/components/command-palette';
import { Footer } from '@/components/footer';
import { Navbar } from '@/components/navbar';
import { JsonLd } from '@/components/seo/json-ld';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo';
import { getPlatformSettings } from '@/lib/settings';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const TITLE_DEFAULT = `${SITE_NAME} — Find dispensaries near you`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE_DEFAULT,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'dispensaries',
    'cannabis',
    'weed',
    'marijuana',
    'dispensary near me',
    'cannabis delivery',
    'cannabis pickup',
    'strains',
    'cannabis deals',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: TITLE_DEFAULT,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE_DEFAULT,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  // Search Console ownership proof — set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
  // in Vercel to the token from the "HTML tag" verification method.
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  themeColor: '#0F1117',
  width: 'device-width',
  initialScale: 1,
  // Enables env(safe-area-inset-*) so floating mobile controls clear the
  // iPhone home indicator.
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getPlatformSettings();
  return (
    <ViewTransitions>
      <html lang="en" className={`${manrope.variable} dark`}>
      <body className="bg-background text-foreground flex min-h-screen flex-col font-sans antialiased">
        {/* Sitewide brand + sitelinks-searchbox signals on every page. */}
        <JsonLd
          data={organizationJsonLd({
            brandName: settings.brandName,
            phoneE164: settings.phoneE164,
            addressLocality: settings.addressLocality,
            addressRegion: settings.addressRegion,
            postalCode: settings.postalCode,
            country: settings.country,
            supportEmail: settings.supportEmail,
          })}
        />
        <JsonLd data={websiteJsonLd()} />
        <a
          href="#main-content"
          className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <PostHogProvider>
          <CartProvider>
            <Navbar />
            <div id="main-content" className="flex-1">
              {children}
            </div>
            <Footer />
            <CommandPalette />
            <CartDrawer />
          </CartProvider>
          <AgeGate />
        </PostHogProvider>
      </body>
      </html>
    </ViewTransitions>
  );
}
