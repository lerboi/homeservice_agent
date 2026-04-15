import { BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function EmptyStateAnalytics() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <BarChart3 className="h-10 w-10 text-muted-foreground/30 mb-4" aria-hidden="true" />
      <h2 className="text-base font-semibold text-foreground mb-2">No data yet</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        Analytics populate automatically as calls come in. Make a test call to see your first data point.
      </p>
      <Button asChild>
        <Link href="/dashboard/more/ai-voice-settings">Make a Test Call</Link>
      </Button>
    </div>
  );
}
