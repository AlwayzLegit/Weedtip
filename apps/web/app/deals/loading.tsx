import { CardGridSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Skeleton className="mb-2 h-8 w-40" />
      <Skeleton className="mb-6 h-4 w-64" />
      {/* Fulfilment filter pills */}
      <div className="mb-6 flex items-center gap-2">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
      <CardGridSkeleton count={6} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-2" />
    </main>
  );
}
