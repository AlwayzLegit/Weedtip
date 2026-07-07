import { CardGridSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <Skeleton className="mb-2 h-8 w-48" />
      <div className="mb-6 mt-4 flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <CardGridSkeleton count={12} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
    </main>
  );
}
