import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { getAuth } from '@/lib/auth';
import { ownsAnyBrand } from '@/lib/brand-owner';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getAuth();
  if (!user) redirect('/sign-in');
  if (profile?.role !== 'dispensary_owner' && profile?.role !== 'admin') redirect('/');

  // Only surface Brand Studio to owners who actually manage a brand — otherwise
  // the link dead-ends by redirecting to the public brand directory.
  const showBrandStudio = await ownsAnyBrand(user.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <DashboardNav variant="owner" showBrandStudio={showBrandStudio} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
