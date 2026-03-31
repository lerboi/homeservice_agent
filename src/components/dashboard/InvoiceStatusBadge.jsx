'use client';

import { Badge } from '@/components/ui/badge';

export const STATUS_CONFIG = {
  draft:   { label: 'Draft',   className: 'bg-stone-100 text-stone-600 border-stone-300' },
  sent:    { label: 'Sent',    className: 'bg-blue-50 text-blue-700 border-blue-200' },
  paid:    { label: 'Paid',    className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  overdue: { label: 'Overdue', className: 'bg-red-50 text-red-700 border-red-200' },
  void:    { label: 'Void',    className: 'bg-stone-100 text-stone-400 border-stone-200' },
};

export default function InvoiceStatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
