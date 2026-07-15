import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-3 w-72" />
      </div>
      <div className="rounded-card border-border bg-surface overflow-hidden border">
        <Skeleton className="border-border h-10 w-full rounded-none border-b" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-border/60 flex items-center gap-4 border-b p-4 last:border-0">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="ml-auto h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
