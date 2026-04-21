// Phase 59 Plan 06: EmptyStateInquiries — UI-SPEC §Empty states copy verbatim.
// D-07a: no staleness messaging anywhere in this component.

import { PhoneIncoming } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

export function EmptyStateInquiries() {
  return (
    <EmptyState
      icon={PhoneIncoming}
      headline="No open inquiries"
      description="Callers who didn't book will land here. Nothing to chase right now."
      ctaLabel="View call history"
      ctaHref="/dashboard/calls"
    />
  );
}
