'use client';

import { Repeat } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * RecurringBadge — Visual indicator for recurring invoice templates.
 * Shows a violet badge with a Repeat icon and "Recurring" text.
 *
 * @param {{ className?: string }} props
 */
export default function RecurringBadge({ className = '' }) {
  return (
    <Badge
      variant="outline"
      className={`bg-violet-50 text-violet-700 border-violet-200 gap-1 ${className}`}
    >
      <Repeat className="h-3 w-3 text-[#C2410C]" />
      Recurring
    </Badge>
  );
}
