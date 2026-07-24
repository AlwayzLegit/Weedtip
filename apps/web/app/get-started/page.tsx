import { Link } from 'next-view-transitions';
import { redirect } from 'next/navigation';
import { AccountStep } from '@/components/onboarding/account-step';
import { BusinessStep } from '@/components/onboarding/business-step';
import { CreateStep } from '@/components/onboarding/create-step';
import { IntentStep } from '@/components/onboarding/intent-step';
import { PlanStep } from '@/components/onboarding/plan-step';
import { VerifyStep } from '@/components/onboarding/verify-step';
import { WizardShell } from '@/components/onboarding/wizard-shell';
import { getOnboardingState } from '@/lib/onboarding-flow';
import { pageSeo } from '@/lib/seo';

export const metadata = pageSeo({
  title: 'Get started — dispensary & brand owners',
  description:
    'Claim your dispensary listing or add your business to Weedtip. Free to list, verified against your state license, and no commission — ever.',
  path: '/get-started',
});

// Reads auth + claim state on every request; nothing here is cacheable.
export const dynamic = 'force-dynamic';

/**
 * The owner onboarding wizard.
 *
 * One route for the whole path — pick what you run, find your business, get an
 * account, prove you run it, choose a plan — rather than the four disconnected
 * pages it replaces (/claim's static explainer, the directory, the claim box
 * buried on a public listing page, and the dashboard's create-listing form).
 *
 * The step comes from `getOnboardingState`, which derives it from real state
 * rather than stored wizard progress, so this page is safe to land on at any
 * point: cold, mid-signup, after an email confirmation, or days later from the
 * approval email.
 */
export default async function GetStartedPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const s = await getOnboardingState();

  // Already running a listing — the wizard has nothing left to ask.
  if (s.step === 'done') redirect('/dashboard');

  if (s.step === 'intent') {
    return (
      <main>
        <WizardShell
          step="intent"
          title="Get your business on Weedtip"
          intro={
            <>
              Free to list, no commission on anything you sell, and every licensed dispensary is
              already in the directory waiting to be claimed. This takes about five minutes.
            </>
          }
          footer={
            <p className="text-muted text-sm">
              Just here to shop?{' '}
              <Link href="/dispensaries" className="text-primary hover:underline">
                Browse dispensaries
              </Link>
              .
            </p>
          }
        >
          <IntentStep />
        </WizardShell>
      </main>
    );
  }

  if (s.step === 'business') {
    return (
      <main>
        <WizardShell
          step="business"
          title="Find your business"
          intro="Search the directory for your shop. Licensed dispensaries are already listed — claiming one is faster than starting from scratch."
        >
          <BusinessStep initialQuery={q} />
        </WizardShell>
      </main>
    );
  }

  if (s.step === 'account') {
    return (
      <main>
        <WizardShell
          step="account"
          title={s.target ? `Claiming ${s.target.name}` : 'Set up your account'}
          intro={
            s.signedIn
              ? 'One more thing before you can claim a listing.'
              : "You'll need an account to manage a listing. We've held onto your selection — it'll still be here when you come back."
          }
        >
          <AccountStep signedIn={s.signedIn} />
        </WizardShell>
      </main>
    );
  }

  if (s.step === 'verify') {
    // Their shop wasn't in the directory, so they're adding it instead.
    if (!s.target) {
      return (
        <main>
          <WizardShell
            step="verify"
            title="Add your business"
            intro="Just the basics for now — enough for our team to verify you're a licensed operator. You'll fill in the rest from your dashboard."
          >
            <CreateStep />
          </WizardShell>
        </main>
      );
    }
    return (
      <main>
        <WizardShell
          step="verify"
          title="Prove you run this shop"
          intro="Weedtip verifies every claim against the state license record, so nobody can take over your listing."
        >
          <VerifyStep target={s.target} rejected={s.claimStatus === 'rejected'} />
        </WizardShell>
      </main>
    );
  }

  return (
    <main>
      <WizardShell
        step="plan"
        title={s.claimStatus === 'approved' ? "You're all set" : "You're in the queue"}
      >
        <PlanStep
          target={s.target}
          approved={s.claimStatus === 'approved'}
          planPreference={s.planPreference}
        />
      </WizardShell>
    </main>
  );
}
