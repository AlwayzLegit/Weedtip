import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { AgeGate } from '@/components/age-gate';
import { CartProvider } from '@/components/cart/cart-provider';
import { Footer } from '@/components/footer';
import { Navbar } from '@/components/navbar';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Weedtip — Find dispensaries near you',
    template: '%s · Weedtip',
  },
  description:
    'Discover dispensaries, browse menus, read reviews, find deals, and order for pickup or delivery.',
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
