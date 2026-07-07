import { CardGridSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="h-20 w-20 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
      <CardGridSkeleton count={10} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" />
    </main>
  );
}
