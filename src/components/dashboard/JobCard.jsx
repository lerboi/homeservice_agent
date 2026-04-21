'use client';

// Phase 59 Plan 06: JobCard — clone of LeadCard for the new jobs schema.
// Prop: `job` (replaces `lead`). Reads from jobs+customers+appointments join.
// customer.name links to /dashboard/customers/{customer_id} per UI-SPEC §Navigation.
// Visual parity with LeadCard preserved (Phase 49 urgency badges, Phase 46 VIP badge).
// D-07a: no staleness UI anywhere in this component.

import { memo } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Eye, FileText, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  scheduled:  'bg-blue-100 text-blue-700 hover:bg-blue-100',
  completed:  'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  paid:       'bg-green-100 text-green-700 hover:bg-green-100',
  lost:       'bg-red-100 text-red-700 hover:bg-red-100',
  cancelled:  'bg-stone-100 text-stone-600 hover:bg-stone-100',
};

const STATUS_LABEL = {
  scheduled:  'Scheduled',
  completed:  'Completed',
  paid:       'Paid',
  lost:       'Lost',
  cancelled:  'Cancelled',
};

const INVOICE_BADGE_STYLE = {
  draft:          'bg-muted text-muted-foreground border-border',
  sent:           'bg-blue-50 text-blue-700 border-blue-200',
  paid:           'bg-green-50 text-green-700 border-green-200',
  overdue:        'bg-red-50 text-red-700 border-red-200',
  void:           'bg-muted text-muted-foreground/60 border-border',
  partially_paid: 'bg-violet-50 text-violet-700 border-violet-200',
};

const INVOICE_LABEL = {
  draft:          'Draft',
  sent:           'Sent',
  paid:           'Paid',
  overdue:        'Overdue',
  void:           'Void',
  partially_paid: 'Partial',
};

function getRelativeTime(dateStr) {
  if (!dateStr) return '';
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return '';
  }
}

export default memo(function JobCard({ job, onView, invoiceStatus, selectable = false, selected = false, onToggle }) {
  const urgency = job.urgency || 'routine';
  const status = job.status || 'scheduled';
  const borderClass = URGENCY_BORDER[urgency] || URGENCY_BORDER.routine;
  const urgencyBadgeClass = URGENCY_BADGE[urgency] || URGENCY_BADGE.routine;
  const statusBadgeClass = STATUS_BADGE[status] || STATUS_BADGE.scheduled;

  // Customer info from joined customer object
  const customer = job.customer || {};
  const displayName = customer.name || job.caller_name || 'Unknown';
  const phone = customer.phone_e164 || job.from_number;
  const customerId = customer.id;

  // Appointment info
  const appointment = job.appointment || {};
  const appointmentTime = appointment.start_time;

  // Address
  const address = job.service_address || customer.default_address;

  function handleCardClick(e) {
    if (!selectable) return;
    if (e.target.closest('button') || e.target.closest('a')) return;
    onToggle?.();
  }

  return (
    <div
      className={`
        rounded-xl border shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]
        hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.06)] hover:-translate-y-0.5
        transition-all duration-200
        border-l-4 ${borderClass}
        min-h-[72px]
        ${selected ? 'border-[var(--brand-accent)] bg-[var(--selected-fill)] ring-2 ring-[var(--brand-accent)]/20' : 'bg-card border-border'}
        ${selectable ? 'cursor-pointer' : ''}
      `}
      onClick={handleCardClick}
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
      onKeyDown={selectable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle?.(); } } : undefined}
      aria-pressed={selectable ? selected : undefined}
    >
      {/* ── Desktop layout (sm+) ────────────────────────────────────────── */}
      <div className="hidden sm:flex items-center w-full gap-4 px-4 py-3">
        {selectable && (
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggle?.()}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${displayName} for invoice`}
            className="shrink-0"
          />
        )}
        {/* Left: customer info */}
        <div className="min-w-0 w-44 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              {customerId ? (
                <Link
                  href={`/dashboard/customers/${customerId}`}
                  className="text-sm font-semibold text-foreground truncate hover:underline block"
                  onClick={(e) => e.stopPropagation()}
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

        {/* Center: job info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {job.job_type && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium shrink-0 max-w-[140px] truncate">
                    {job.job_type}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top"><p>{job.job_type}</p></TooltipContent>
              </Tooltip>
            )}
            {job.is_vip && (
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
          {appointmentTime && (
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              Appt: {getRelativeTime(appointmentTime)}
            </p>
          )}
        </div>

        {/* Right: status, invoice, time, action */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <Badge className={`${statusBadgeClass} text-xs`}>
              {STATUS_LABEL[status] || status}
            </Badge>
            {invoiceStatus && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${INVOICE_BADGE_STYLE[invoiceStatus] || 'bg-muted text-muted-foreground border-border'}`}>
                <FileText className="h-2.5 w-2.5" />
                {INVOICE_LABEL[invoiceStatus] || invoiceStatus}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{getRelativeTime(job.created_at)}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
            onClick={() => onView?.(job.id)}
            aria-label={`View job from ${displayName}`}
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            View
          </Button>
        </div>
      </div>

      {/* ── Mobile layout (<sm) ─────────────────────────────────────────── */}
      <div className="flex sm:hidden flex-col gap-1.5 px-4 py-3 w-full">
        {/* Row 1: checkbox + name + status + time */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {selectable && (
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggle?.()}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select ${displayName} for invoice`}
                className="shrink-0"
              />
            )}
            {customerId ? (
              <Link
                href={`/dashboard/customers/${customerId}`}
                className="text-sm font-semibold text-foreground truncate hover:underline"
                onClick={(e) => e.stopPropagation()}
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
            <span className="text-[10px] text-muted-foreground">{getRelativeTime(job.created_at)}</span>
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
            {job.job_type && (
              <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-medium truncate max-w-[100px]">
                {job.job_type}
              </span>
            )}
            {job.is_vip && (
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
            onClick={() => onView?.(job.id)}
            aria-label={`View job from ${displayName}`}
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            View
          </Button>
        </div>
      </div>
    </div>
  );
});
