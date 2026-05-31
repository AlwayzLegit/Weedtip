import Link from 'next/link';
import { Logo } from './brand/logo';

export function Footer() {
  return (
    <footer className="border-border mt-16 border-t">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs space-y-2">
            <Logo />
            <p className="text-muted text-sm">
              The Google Maps of cannabis. Discover licensed dispensaries near you.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
            <Link href="/dispensaries" className="text-muted hover:text-foreground">
              Dispensaries
            </Link>
            <Link href="/products" className="text-muted hover:text-foreground">
              Products
            </Link>
            <Link href="/sign-up" className="text-muted hover:text-foreground">
              List your shop
            </Link>
            <Link href="/sign-in" className="text-muted hover:text-foreground">
              Sign in
            </Link>
          </nav>
        </div>
        <div className="border-border text-muted mt-8 border-t pt-6 text-xs">
          <p>
            For use by adults 21 and older. Cannabis products have not been evaluated by the FDA.
          </p>
          <p className="mt-1">© {new Date().getFullYear()} Weedtip. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
