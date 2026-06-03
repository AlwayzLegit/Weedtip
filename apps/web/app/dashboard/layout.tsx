import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { getAuth } from '@/lib/auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getAuth();
  if (!user) redirect('/sign-in');
  if (profile?.role !== 'dispensary_owner' && profile?.role !== 'admin') redirect('/');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <DashboardNav variant="owner" />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
