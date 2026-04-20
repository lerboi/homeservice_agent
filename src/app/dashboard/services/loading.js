import { Skeleton } from '@/components/ui/skeleton';

// Phase 58 Plan 58-05 (POLISH-02): services list skeleton. Mirrors the shipped
// layout — title + Add-service button row, then 5 service rows of ~56px each.
// CLS ≤ 0.1 target. Uses the shared <Skeleton> primitive only.
export default function ServicesLoading() {
  return (
    <div className="bg-card rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] border border-border/60 p-6">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 bg-[var(--warm-surface)] border-b border-border">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-14" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_auto_auto] gap-4 items-center px-4 py-3 border-t border-border"
          >
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-36 rounded-md" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
