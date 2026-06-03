import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Skeleton className="h-4 w-64" />
      <div className="mt-6 grid gap-8 sm:grid-cols-2">
        <Skeleton className="h-72 sm:h-80" />
        <div className="space-y-4">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-11 w-full max-w-xs" />
        </div>
      </div>
      <div className="mt-10 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-20 w-full" />
      </div>
    </main>
  );
}
