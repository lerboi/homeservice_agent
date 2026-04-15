import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function EmptyStateLeads() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Users className="h-10 w-10 text-muted-foreground/30 mb-4" aria-hidden="true" />
      <h2 className="text-base font-semibold text-foreground mb-2">No leads yet</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        When callers reach your AI, leads appear here with caller details, job type, and urgency.
      </p>
      <Button asChild>
        <Link href="/dashboard/more/ai-voice-settings">Make a Test Call</Link>
      </Button>
    </div>
  );
}
