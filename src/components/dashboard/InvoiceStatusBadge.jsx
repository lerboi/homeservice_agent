'use client';

import { Badge } from '@/components/ui/badge';

export const STATUS_CONFIG = {
  draft:          { label: 'Draft',          className: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-muted dark:text-muted-foreground dark:border-border' },
  sent:           { label: 'Sent',           className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60' },
  paid:           { label: 'Paid',           className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800/60' },
  overdue:        { label: 'Overdue',        className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/60' },
  void:           { label: 'Void',           className: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-muted dark:text-muted-foreground dark:border-border' },
  partially_paid: { label: 'Partially Paid', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60' },
};

export default function InvoiceStatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
