'use client';

import { memo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Eye, FileText, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  new: 'bg-[#C2410C]/10 text-[#C2410C] hover:bg-[#C2410C]/10',
  booked: 'bg-blue-50 text-blue-700 hover:bg-blue-50',
  completed: 'bg-stone-100 text-stone-600 hover:bg-stone-100',
  paid: 'bg-green-50 text-[#166534] hover:bg-green-50',
  lost: 'bg-red-50 text-red-700 hover:bg-red-50',
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

export default memo(function LeadCard({ lead, onView, invoiceStatus }) {
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

  return (
    <div
      className={`
        bg-white rounded-xl border border-stone-200/60 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]
        hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200
        border-l-4 ${borderClass}
        min-h-[72px] flex items-center
      `}
    >
      <div className="flex items-center w-full gap-4 px-4 py-3">
        {/* Left section: caller info */}
        <div className="min-w-0 w-44 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-sm font-semibold text-[#0F172A] truncate">
                {displayName}
              </p>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{displayName}</p>
            </TooltipContent>
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
                <TooltipContent side="top">
                  <p>{lead.email}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Center section: job info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {lead.job_type && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center rounded-full bg-stone-100 text-stone-700 px-2 py-0.5 text-xs font-medium shrink-0 max-w-[140px] truncate">
                    {lead.job_type}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{lead.job_type}</p>
                </TooltipContent>
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
                <p className="text-xs text-[#475569] truncate mt-1 max-w-[260px]">
                  {address}
                </p>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{address}</p>
              </TooltipContent>
            </Tooltip>
          )}
          {firstCall?.urgency_classification && (
            <p className="text-xs text-[#475569]/70 mt-0.5">
              {TRIAGE_LABEL[firstCall.urgency_classification] || firstCall.urgency_classification}
            </p>
          )}
        </div>

        {/* Right section: status, invoice, time, action */}
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
          <span className="text-xs text-[#475569]">
            {getRelativeTime(lead.created_at)}
          </span>
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
    </div>
  );
});
