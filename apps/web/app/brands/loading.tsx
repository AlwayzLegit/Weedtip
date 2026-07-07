import { CardGridSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <Skeleton className="mb-2 h-8 w-40" />
      <Skeleton className="mb-6 h-4 w-64" />
      <CardGridSkeleton count={12} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" />
    </main>
  );
}
