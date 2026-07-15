import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { LocationSwitcher } from '@/components/dashboard/location-switcher';
import { ownsAnyBrand } from '@/lib/brand-owner';
import { getOwnerContext } from '@/lib/owner';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Admits owners, admins, and active team members (redirects everyone else).
  const { userId, memberRole, dispensary, dispensaries } = await getOwnerContext();
  const isOwner = memberRole === 'owner';

  // Only surface Brand Studio to owners who actually manage a brand — otherwise
  // the link dead-ends by redirecting to the public brand directory.
  const showBrandStudio = isOwner && (await ownsAnyBrand(userId));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          {dispensaries.length > 1 && dispensary && (
            <LocationSwitcher items={dispensaries} currentId={dispensary.id} />
          )}
          <DashboardNav variant="owner" showBrandStudio={showBrandStudio} isOwner={isOwner} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
