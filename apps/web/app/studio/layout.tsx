import { BrandStudioNav } from '@/components/dashboard/brand-studio-nav';
import { getBrandOwnerContext } from '@/lib/brand-owner';

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  // Gates the whole portal on brand ownership (redirects otherwise).
  await getBrandOwnerContext();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <p className="eyebrow mb-1">Brand Studio</p>
        <p className="text-muted text-sm">Manage the brands you own.</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <BrandStudioNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
