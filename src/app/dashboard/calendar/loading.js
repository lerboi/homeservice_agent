import { Skeleton } from '@/components/ui/skeleton';

// Phase 58 Plan 58-05 (POLISH-02): calendar grid skeleton — 7 columns × 8 hour
// rows to match the shipped layout so CLS stays ≤ 0.1 when the real
// CalendarView hydrates. Uses the shared <Skeleton> primitive (no hand-rolled
// animate-pulse). Kept ≤ 80 lines per UI-SPEC §8.
export default function CalendarLoading() {
  return (
    <div className="space-y-4" data-tour="calendar-page">
      {/* Top toolbar skeleton — navigation + view mode switcher */}
      <div className="bg-card rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] border border-border/60 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Main grid — 7 day columns × 8 hour rows (approximates the shipped
          week view). Column header row kept separate so it matches the
          sticky header CalendarView renders. */}
      <div className="bg-card rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] border border-border/60 p-4">
        <div className="grid grid-cols-8 gap-2 mb-2">
          <Skeleton className="h-5 w-10" />
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, row) => (
          <div key={row} className="grid grid-cols-8 gap-2 mb-2">
            <Skeleton className="h-12 w-10" />
            {Array.from({ length: 7 }).map((_, col) => (
              <Skeleton key={col} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ))}
      </div>

      {/* Agenda + side panels row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-card rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] border border-border/60 p-5 space-y-3"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
