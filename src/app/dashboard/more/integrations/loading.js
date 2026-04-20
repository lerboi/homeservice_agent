import { Skeleton } from '@/components/ui/skeleton';

// Phase 58 Plan 58-05 (POLISH-02): integrations cards-grid skeleton. Mirrors
// the shipped layout — title + description, Calendar Connections card, then
// the 2-up provider cards grid (Xero / Jobber). Uses the shared <Skeleton>
// primitive. Kept ≤ 80 lines per UI-SPEC §8.
export default function IntegrationsLoading() {
  return (
    <div>
      <Skeleton className="h-6 w-56 mb-2" />
      <Skeleton className="h-4 w-full max-w-xl mb-1" />
      <Skeleton className="h-4 w-1/2 mb-4" />

      {/* Calendar Connections section */}
      <Skeleton className="h-5 w-44 mt-8 mb-2" />
      <Skeleton className="h-4 w-80 mb-4" />
      <div className="bg-card rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] border border-border/60 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Accounting & Job Management section */}
      <Skeleton className="h-5 w-56 mt-10 mb-2" />
      <Skeleton className="h-4 w-80 mb-6" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="bg-card rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] border border-border/60 p-5 flex flex-col"
          >
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-4" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
