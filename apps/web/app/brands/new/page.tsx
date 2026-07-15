import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { BrandCreateForm } from '@/components/brand/brand-create-form';
import { getAuth } from '@/lib/auth';

export const metadata: Metadata = { title: 'Create your brand', robots: { index: false } };

/** Self-serve brand creation. Any signed-in user can create a brand they own. */
export default async function NewBrandPage() {
  const { user } = await getAuth();
  if (!user) redirect('/sign-in?next=/brands/new');

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <Breadcrumbs
        items={[
          { name: 'For brands', href: '/for-brands' },
          { name: 'Create your brand', href: '/brands/new' },
        ]}
      />
      <h1 className="text-2xl font-bold tracking-tight">Create your brand</h1>
      <p className="text-muted mb-6 mt-1 text-sm">
        Add your brand to Weedtip. It goes live after a quick review, and you can start setting it up
        right away.
      </p>
      <BrandCreateForm />
    </main>
  );
}
