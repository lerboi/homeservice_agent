import { Skeleton } from '@/components/ui/skeleton';

export default function LeadsLoading() {
  return (
    <div className="bg-card rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] border border-border/60">
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-5 w-8 rounded-full" />
        </div>
        <Skeleton className="h-8 w-[74px] rounded-lg" />
      </div>
      <div className="px-6 py-1">
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
      <div className="px-6 py-4 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
