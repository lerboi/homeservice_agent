'use client';

import { Repeat } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * RecurringBadge — Visual indicator for recurring invoice templates.
 * Shows an orange/brand badge with a Repeat icon and "Recurring" text.
 * Uses the Active/brand category from UI-SPEC §Status Badges for both light and dark.
 *
 * @param {{ className?: string }} props
 */
export default function RecurringBadge({ className = '' }) {
  return (
    <Badge
      variant="outline"
      className={`bg-[var(--accent-sky)]/10 text-[var(--accent-sky)] border-[var(--accent-sky)]/25 gap-1 ${className}`}
    >
      <Repeat className="h-3 w-3 text-[var(--accent-sky)]" />
      Recurring
    </Badge>
  );
}
