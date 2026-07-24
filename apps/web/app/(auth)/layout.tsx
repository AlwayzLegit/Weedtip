import Link from 'next/link';
import { Logo } from '@/components/brand/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-hero-glow mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-6 flex justify-center">
        <Link href="/" aria-label="Weedtip home">
          <Logo />
        </Link>
      </div>
      <div className="card sheen animate-slide-up p-5 sm:p-8">{children}</div>
      <p className="text-muted-foreground mx-auto mt-6 max-w-xs text-center text-xs">
        21+ only. By continuing you agree to Weedtip&apos;s Terms and Privacy Policy.
      </p>
    </div>
  );
}
