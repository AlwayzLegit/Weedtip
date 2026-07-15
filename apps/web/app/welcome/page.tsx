import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { WelcomeFlow } from '@/components/welcome/welcome-flow';
import { getAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Welcome to Weedtip', robots: { index: false } };

/**
 * Shopper first-run. Reached automatically after a new consumer confirms their
 * email (see /auth/callback). Signed-out visitors are sent to sign-in; everyone
 * can skip. Business/brand owners have their own flows, but this page is
 * harmless for them and still lets them set a location.
 */
export default async function WelcomePage() {
  const { user, profile } = await getAuth();
  if (!user) redirect('/sign-in?next=/welcome');

  const supabase = await createClient();
  const { data: categories } = await supabase
    .from('categories')
    .select('name,slug')
    .order('sort_order');

  const firstName = profile?.display_name?.split(' ')[0];

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">
        Welcome{firstName ? `, ${firstName}` : ''} 🌿
      </h1>
      <p className="text-muted mt-2">
        Let&apos;s set you up. This takes a few seconds and you can change it all later.
      </p>
      <div className="mt-8">
        <WelcomeFlow
          categories={categories ?? []}
          initialCategories={profile?.preferred_categories ?? []}
        />
      </div>
    </main>
  );
}
