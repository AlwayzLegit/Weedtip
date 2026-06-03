import { Shield } from 'lucide-react';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { Badge } from '@/components/ui/badge';
import { requireAdmin } from '@/lib/admin';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <Shield className="text-primary h-5 w-5" />
        <h1 className="text-lg font-semibold">Admin</h1>
        <Badge tone="primary">Platform</Badge>
      </div>
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <DashboardNav variant="admin" />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
