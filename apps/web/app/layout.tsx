import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { AgeGate } from '@/components/age-gate';
import { CartProvider } from '@/components/cart/cart-provider';
import { Footer } from '@/components/footer';
import { Navbar } from '@/components/navbar';
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
};

export const viewport: Viewport = {
  themeColor: '#0F1117',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} dark`}>
      <body className="bg-background text-foreground flex min-h-screen flex-col font-sans antialiased">
        <a
          href="#main-content"
          className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <CartProvider>
          <Navbar />
          <div id="main-content" className="flex-1">
            {children}
          </div>
          <Footer />
        </CartProvider>
        <AgeGate />
      </body>
    </html>
  );
}
