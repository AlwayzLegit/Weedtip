import { CardGridSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="flex h-[calc(100dvh-4rem)] flex-col">
      <div className="border-border flex items-center gap-3 border-b px-4 py-3">
        <Skeleton className="hidden h-7 w-40 sm:block" />
        <Skeleton className="h-9 w-full max-w-xs rounded-full" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-full" />
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-full px-4 py-4 lg:w-[42%] xl:w-[38%]">
          <Skeleton className="mb-3 h-4 w-40" />
          <CardGridSkeleton count={6} className="sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" />
        </div>
        <Skeleton className="hidden min-h-0 flex-1 rounded-none lg:block" />
      </div>
    </main>
  );
}
