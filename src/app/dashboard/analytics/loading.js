import { Skeleton } from '@/components/ui/skeleton';

export default function AnalyticsLoading() {
  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] border border-stone-200/60 p-6">
      <Skeleton className="h-6 w-24 mb-6" />
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <Skeleton className="h-5 w-40 mb-4" />
            <Skeleton className="h-[300px] w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
