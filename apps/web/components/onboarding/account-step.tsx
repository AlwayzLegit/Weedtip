import { Link } from 'next-view-transitions';
import { Briefcase, LogIn, UserPlus } from 'lucide-react';
import { becomeBusinessAccount } from '@/app/get-started/actions';
import { Button } from '../ui/button';

/**
 * Step 3: the account.
 *
 * Two audiences land here. Someone with no account gets sign-up/sign-in, both
 * carrying `next=/get-started` so the confirmation link returns them to the
 * wizard with their business selection intact. Someone already signed in as a
 * shopper gets a one-click switch to a business account — previously that case
 * had no way forward at all.
 */
export function AccountStep({ signedIn }: { signedIn: boolean }) {
  if (signedIn) {
    return (
      <div className="space-y-4">
        <div className="rounded-card border-border bg-surface border p-5">
          <div className="flex items-start gap-4">
            <span className="bg-primary-muted text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
              <Briefcase className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">Switch to a business account</p>
              <p className="text-muted mt-1 text-sm leading-relaxed">
                You&apos;re signed in with a shopper account. Business accounts can claim listings
                and manage a menu. Your saved shops and reviews stay exactly as they are.
              </p>
              <form action={becomeBusinessAccount} className="mt-3">
                <Button type="submit">Use this account for my business</Button>
              </form>
            </div>
          </div>
        </div>
        <p className="text-muted text-sm">
          Rather keep them separate?{' '}
          <Link
            href="/sign-up?role=dispensary_owner&next=/get-started"
            className="text-primary hover:underline"
          >
            Create a separate business account
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Link href="/sign-up?role=dispensary_owner&next=/get-started" className="block">
        <div className="rounded-card border-border bg-surface hover:border-primary/60 hover:bg-surface-2 group flex items-start gap-4 border p-5 transition-colors">
          <span className="bg-primary-muted text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <UserPlus className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="group-hover:text-primary block font-semibold transition-colors">
              Create a business account
            </span>
            <span className="text-muted mt-1 block text-sm leading-relaxed">
              Free, and takes a minute. We&apos;ll email you a confirmation link — opening it brings
              you straight back here with your shop still selected.
            </span>
          </span>
        </div>
      </Link>

      <Link href="/sign-in?next=/get-started" className="block">
        <div className="rounded-card border-border bg-surface hover:border-primary/60 hover:bg-surface-2 group flex items-start gap-4 border p-5 transition-colors">
          <span className="bg-surface-2 text-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <LogIn className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="group-hover:text-primary block font-semibold transition-colors">
              I already have an account
            </span>
            <span className="text-muted mt-1 block text-sm leading-relaxed">
              Sign in and pick up right where you are.
            </span>
          </span>
        </div>
      </Link>
    </div>
  );
}
