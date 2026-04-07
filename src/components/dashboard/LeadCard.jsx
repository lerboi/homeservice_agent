'use client';

import { memo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Eye, FileText, Mail } from 'lucide-react';
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
  routine: 'border-l-stone-300',
  urgent: 'border-l-amber-500',
};

const URGENCY_BADGE = {
  emergency: 'bg-red-100 text-red-700 hover:bg-red-100',
  routine: 'bg-[#0F172A]/[0.06] text-[#0F172A]/70 hover:bg-[#0F172A]/[0.06]',
  urgent: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
};

const URGENCY_LABEL = {
  emergency: 'Emergency',
  routine: 'Routine',
  urgent: 'Urgent',
};

const STATUS_BADGE = {
  new: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
  booked: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  completed: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  paid: 'bg-green-100 text-green-700 hover:bg-green-100',
  lost: 'bg-red-100 text-red-700 hover:bg-red-100',
};

const STATUS_LABEL = {
  new: 'New',
  booked: 'Booked',
  completed: 'Completed',
  paid: 'Paid',
  lost: 'Lost',
};

const TRIAGE_LABEL = {
  emergency: 'Emergency',
  routine: 'Routine',
  urgent: 'Urgent',
};

const INVOICE_BADGE_STYLE = {
  draft: 'bg-stone-100 text-stone-600 border-stone-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-green-50 text-green-700 border-green-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  void: 'bg-stone-50 text-stone-400 border-stone-200',
  partially_paid: 'bg-violet-50 text-violet-700 border-violet-200',
};

const INVOICE_LABEL = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
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

function getFirstCall(lead) {
  const leadCalls = lead.lead_calls;
  if (!leadCalls || leadCalls.length === 0) return null;
  const firstEntry = leadCalls[0];
  return firstEntry?.calls || null;
}

export default memo(function LeadCard({ lead, onView, invoiceStatus, selectable = false, selected = false, onToggle }) {
  const urgency = lead.urgency || 'routine';
  const status = lead.status || 'new';
  const borderClass = URGENCY_BORDER[urgency] || URGENCY_BORDER.routine;
  const urgencyBadgeClass = URGENCY_BADGE[urgency] || URGENCY_BADGE.routine;
  const statusBadgeClass = STATUS_BADGE[status] || STATUS_BADGE.new;
  const firstCall = getFirstCall(lead);
  const displayName = lead.caller_name || lead.from_number || 'Unknown';
  const address = lead.street_name && lead.postal_code
    ? `${lead.street_name}, ${lead.postal_code}`
    : lead.service_address;

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
        ${selected ? 'border-[#C2410C] bg-[#C2410C]/[0.04] ring-2 ring-[#C2410C]/20' : 'bg-white border-stone-200/60'}
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
        {/* Left: caller info */}
        <div className="min-w-0 w-44 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-sm font-semibold text-[#0F172A] truncate">{displayName}</p>
            </TooltipTrigger>
            <TooltipContent side="top"><p>{displayName}</p></TooltipContent>
          </Tooltip>
          <div className="flex items-center gap-1.5 mt-0.5">
            <a
              href={`tel:${lead.from_number}`}
              className="text-xs text-[#C2410C] hover:text-[#9A3412] transition-colors truncate"
              onClick={(e) => e.stopPropagation()}
            >
              {lead.from_number || '—'}
            </a>
            {lead.email && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Mail className="h-3 w-3 text-stone-400 flex-shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="top"><p>{lead.email}</p></TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Center: job info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {lead.job_type && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center rounded-full bg-stone-100 text-stone-700 px-2 py-0.5 text-xs font-medium shrink-0 max-w-[140px] truncate">
                    {lead.job_type}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top"><p>{lead.job_type}</p></TooltipContent>
              </Tooltip>
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
                <p className="text-xs text-[#475569] truncate mt-1 max-w-[260px]">{address}</p>
              </TooltipTrigger>
              <TooltipContent side="top"><p>{address}</p></TooltipContent>
            </Tooltip>
          )}
          {firstCall?.urgency_classification && (
            <p className="text-xs text-[#475569]/70 mt-0.5">
              {TRIAGE_LABEL[firstCall.urgency_classification] || firstCall.urgency_classification}
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
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${INVOICE_BADGE_STYLE[invoiceStatus] || 'bg-stone-100 text-stone-500 border-stone-200'}`}>
                <FileText className="h-2.5 w-2.5" />
                {INVOICE_LABEL[invoiceStatus] || invoiceStatus}
              </span>
            )}
          </div>
          <span className="text-xs text-[#475569]">{getRelativeTime(lead.created_at)}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-[#475569] hover:text-[#0F172A] hover:bg-stone-100"
            onClick={() => onView?.(lead.id)}
            aria-label={`View lead from ${lead.caller_name || 'unknown caller'}`}
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
            <p className="text-sm font-semibold text-[#0F172A] truncate">{displayName}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge className={`${statusBadgeClass} text-xs`}>
              {STATUS_LABEL[status] || status}
            </Badge>
            <span className="text-[10px] text-[#475569]">{getRelativeTime(lead.created_at)}</span>
          </div>
        </div>
        {/* Row 2: phone + job type + urgency + view */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <a
              href={`tel:${lead.from_number}`}
              className="text-xs text-[#C2410C] hover:text-[#9A3412] transition-colors truncate shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              {lead.from_number || '—'}
            </a>
            {lead.job_type && (
              <span className="inline-flex items-center rounded-full bg-stone-100 text-stone-700 px-2 py-0.5 text-[10px] font-medium truncate max-w-[100px]">
                {lead.job_type}
              </span>
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
            className="h-7 px-2 text-xs text-[#475569] hover:text-[#0F172A] hover:bg-stone-100 shrink-0"
            onClick={() => onView?.(lead.id)}
            aria-label={`View lead from ${lead.caller_name || 'unknown caller'}`}
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            View
          </Button>
        </div>
      </div>
    </div>
  );
});
