'use client';

import { Badge } from '@/components/ui/badge';

export const ESTIMATE_STATUS_CONFIG = {
  draft:    { label: 'Draft',    className: 'bg-stone-100 text-stone-600 border-stone-300' },
  sent:     { label: 'Sent',     className: 'bg-blue-50 text-blue-700 border-blue-200' },
  approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  declined: { label: 'Declined', className: 'bg-red-50 text-red-700 border-red-200' },
  expired:  { label: 'Expired',  className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export default function EstimateStatusBadge({ status }) {
  const config = ESTIMATE_STATUS_CONFIG[status] || ESTIMATE_STATUS_CONFIG.draft;
  return (
    <Badge variant="outline" className={`border text-xs font-medium ${config.className}`}>
      {config.label}
    </Badge>
  );
}
