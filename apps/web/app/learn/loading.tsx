import { CardGridSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Skeleton className="mb-2 h-8 w-32" />
      <Skeleton className="mb-6 h-4 w-80" />
      <Skeleton className="mb-8 h-40 w-full rounded-card" />
      <CardGridSkeleton count={8} className="grid-cols-1 sm:grid-cols-2" />
    </main>
  );
}
