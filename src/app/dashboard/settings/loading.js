import { Skeleton } from '@/components/ui/skeleton';

// Phase 58 Plan 58-05 (POLISH-02): settings form skeleton (labels + input bars
// + textarea + save button). Mirrors the shipped form layout for CLS ≤ 0.1.
// Uses the shared <Skeleton> primitive only.
export default function SettingsLoading() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] border border-border/60 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-4 w-3/4" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
    </div>
  );
}
