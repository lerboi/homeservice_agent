import { Skeleton } from '@/components/ui/skeleton';

// Phase 58 Plan 58-05 (POLISH-02): billing page skeleton — plan card, usage
// ring gauge, billing details, recent invoices. Matches the shipped 4-section
// layout for CLS ≤ 0.1. Uses the shared <Skeleton> primitive only. Kept ≤ 80
// lines per UI-SPEC §8.
export default function BillingLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Skeleton className="h-6 w-24" />

      {/* Plan card */}
      <div className="bg-card rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] border border-border/60 p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>

      {/* Usage meter */}
      <div className="bg-card rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] border border-border/60 p-6">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-[120px] w-[120px] rounded-full" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>

      {/* Billing details */}
      <div className="bg-card rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] border border-border/60 p-6">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="space-y-3">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </div>
        <Skeleton className="h-10 w-48 rounded-md mt-4" />
      </div>

      {/* Recent invoices */}
      <div className="bg-card rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] border border-border/60 p-6">
        <Skeleton className="h-6 w-36 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
