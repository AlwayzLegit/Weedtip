import { CardGridSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-24 w-full rounded-card" />
      </div>
      <CardGridSkeleton count={8} className="grid-cols-2 sm:grid-cols-4" />
    </main>
  );
}
