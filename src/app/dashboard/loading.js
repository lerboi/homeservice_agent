import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardHomeLoading() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="h-2.5 w-2.5 rounded-full" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}
