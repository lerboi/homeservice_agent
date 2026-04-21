'use client';

// Phase 59 Plan 06: InquiryCard — clone of JobCard for unbooked calls (Inquiries).
// Prop: `inquiry`. No appointment row (inquiries have no appointment).
// Shows job_type, service_address, urgency badge, customer name link.
// D-07a INVARIANT: NO staleness UI in this component.
//   - No "N days old" badge
//   - No color-dim based on age
//   - No warning icon on old rows
//   - No auto-lost indicator
// Relative-time display in metadata is informational only (not a status signal).

import { memo } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Eye, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

const URGENCY_BORDER = {
  emergency: 'border-l-red-500',
  routine: 'border-l-border',
  urgent: 'border-l-amber-500',
};

const URGENCY_BADGE = {
  emergency: 'bg-red-100 text-red-700 hover:bg-red-100',
  routine: 'bg-muted text-muted-foreground hover:bg-muted',
  urgent: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
};

const URGENCY_LABEL = {
  emergency: 'Emergency',
  routine: 'Routine',
  urgent: 'Urgent',
};

const STATUS_BADGE = {
  open:      'bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/10',
  converted: 'bg-green-100 text-green-700 hover:bg-green-100',
  lost:      'bg-red-100 text-red-700 hover:bg-red-100',
};

const STATUS_LABEL = {
  open:      'Open',
  converted: 'Converted',
  lost:      'Lost',
};

function getRelativeTime(dateStr) {
  if (!dateStr) return '';
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return '';
  }
}

export default memo(function InquiryCard({ inquiry, onView }) {
  const urgency = inquiry.urgency || 'routine';
  const status = inquiry.status || 'open';
  const borderClass = URGENCY_BORDER[urgency] || URGENCY_BORDER.routine;
  const urgencyBadgeClass = URGENCY_BADGE[urgency] || URGENCY_BADGE.routine;
  const statusBadgeClass = STATUS_BADGE[status] || STATUS_BADGE.open;

  // Customer info from joined customer object
  const customer = inquiry.customer || {};
  const displayName = customer.name || inquiry.caller_name || 'Unknown';
  const phone = customer.phone_e164 || inquiry.from_number;
  const customerId = customer.id;

  const address = inquiry.service_address || customer.default_address;

  return (
    <div
      className={`
        rounded-xl border shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]
        hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.06)] hover:-translate-y-0.5
        transition-all duration-200
        border-l-4 ${borderClass}
        min-h-[72px]
        bg-card border-border
      `}
    >
      {/* ── Desktop layout (sm+) ────────────────────────────────────────── */}
      <div className="hidden sm:flex items-center w-full gap-4 px-4 py-3">
        {/* Left: customer info */}
        <div className="min-w-0 w-44 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              {customerId ? (
                <Link
                  href={`/dashboard/customers/${customerId}`}
                  className="text-sm font-semibold text-foreground truncate hover:underline block"
                >
                  {displayName}
                </Link>
              ) : (
                <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
              )}
            </TooltipTrigger>
            <TooltipContent side="top"><p>{displayName}</p></TooltipContent>
          </Tooltip>
          <div className="flex items-center gap-1.5 mt-0.5">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="text-xs text-[var(--brand-accent)] hover:text-[var(--brand-accent-hover)] transition-colors truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {phone}
              </a>
            )}
          </div>
        </div>

        {/* Center: inquiry info — job_type + address + urgency */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {inquiry.job_type && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium shrink-0 max-w-[140px] truncate">
                    {inquiry.job_type}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top"><p>{inquiry.job_type}</p></TooltipContent>
              </Tooltip>
            )}
            {inquiry.is_vip && (
              <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 text-xs shrink-0 gap-1">
                <Star className="h-3 w-3 fill-current" />
                Priority
              </Badge>
            )}
            {urgency && (
              <Badge className={`${urgencyBadgeClass} text-xs shrink-0`}>
                {URGENCY_LABEL[urgency] || urgency}
              </Badge>
            )}
          </div>
          {address && (
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs text-muted-foreground truncate mt-1 max-w-[260px]">{address}</p>
              </TooltipTrigger>
              <TooltipContent side="top"><p>{address}</p></TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Right: status, time, action */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Badge className={`${statusBadgeClass} text-xs`}>
            {STATUS_LABEL[status] || status}
          </Badge>
          {/* Relative time is informational only — not a staleness signal (D-07a) */}
          <span className="text-xs text-muted-foreground">{getRelativeTime(inquiry.created_at)}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
            onClick={() => onView?.(inquiry.id)}
            aria-label={`View inquiry from ${displayName}`}
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            View
          </Button>
        </div>
      </div>

      {/* ── Mobile layout (<sm) ─────────────────────────────────────────── */}
      <div className="flex sm:hidden flex-col gap-1.5 px-4 py-3 w-full">
        {/* Row 1: name + status + time */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {customerId ? (
              <Link
                href={`/dashboard/customers/${customerId}`}
                className="text-sm font-semibold text-foreground truncate hover:underline"
              >
                {displayName}
              </Link>
            ) : (
              <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge className={`${statusBadgeClass} text-xs`}>
              {STATUS_LABEL[status] || status}
            </Badge>
            {/* Relative time is informational only — not a staleness signal (D-07a) */}
            <span className="text-[10px] text-muted-foreground">{getRelativeTime(inquiry.created_at)}</span>
          </div>
        </div>
        {/* Row 2: phone + job type + urgency + view */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="text-xs text-[var(--brand-accent)] hover:text-[var(--brand-accent-hover)] transition-colors truncate shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {phone}
              </a>
            )}
            {inquiry.job_type && (
              <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-medium truncate max-w-[100px]">
                {inquiry.job_type}
              </span>
            )}
            {inquiry.is_vip && (
              <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 text-[10px] shrink-0 gap-0.5">
                <Star className="h-2.5 w-2.5 fill-current" />
                Priority
              </Badge>
            )}
            {urgency !== 'routine' && (
              <Badge className={`${urgencyBadgeClass} text-[10px] shrink-0`}>
                {URGENCY_LABEL[urgency] || urgency}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent shrink-0"
            onClick={() => onView?.(inquiry.id)}
            aria-label={`View inquiry from ${displayName}`}
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            View
          </Button>
        </div>
      </div>
    </div>
  );
});
