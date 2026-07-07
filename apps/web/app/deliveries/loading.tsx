import { CardGridSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <Skeleton className="mb-2 h-8 w-56" />
      <Skeleton className="mb-6 h-4 w-72" />
      <CardGridSkeleton count={9} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" />
    </main>
  );
}
