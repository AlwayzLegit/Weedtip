import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main>
      <Skeleton className="h-48 rounded-none sm:h-72" />
      <div className="mx-auto max-w-7xl px-4">
        <div className="-mt-10">
          <div className="rounded-card border-border bg-surface shadow-card border p-5">
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="mt-3 h-4 w-2/3" />
            <div className="mt-4 flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-5 w-32" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </div>
      </div>
    </main>
  );
}
