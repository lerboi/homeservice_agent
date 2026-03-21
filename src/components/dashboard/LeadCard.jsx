'use client';

import { formatDistanceToNow } from 'date-fns';
import { Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const URGENCY_BORDER = {
  emergency: 'border-l-red-500',
  routine: 'border-l-stone-300',
  high_ticket: 'border-l-amber-500',
};

const URGENCY_BADGE = {
  emergency: 'bg-red-100 text-red-700 hover:bg-red-100',
  routine: 'bg-[#0F172A]/[0.06] text-[#0F172A]/70 hover:bg-[#0F172A]/[0.06]',
  high_ticket: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
};

const URGENCY_LABEL = {
  emergency: 'Emergency',
  routine: 'Routine',
  high_ticket: 'High Ticket',
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

export default function LeadCard({ lead, onView }) {
  const urgency = lead.urgency || 'routine';
  const status = lead.status || 'new';
  const borderClass = URGENCY_BORDER[urgency] || URGENCY_BORDER.routine;
  const urgencyBadgeClass = URGENCY_BADGE[urgency] || URGENCY_BADGE.routine;
  const statusBadgeClass = STATUS_BADGE[status] || STATUS_BADGE.new;
  const firstCall = getFirstCall(lead);

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
          <p className="text-sm font-semibold text-[#0F172A] truncate">
            {lead.caller_name || 'Unknown Caller'}
          </p>
          <p className="text-xs text-[#475569] truncate mt-0.5">
            {lead.from_number || '—'}
          </p>
        </div>

        {/* Center section: job info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {lead.job_type && (
              <span className="inline-flex items-center rounded-full bg-stone-100 text-stone-700 px-2 py-0.5 text-xs font-medium shrink-0">
                {lead.job_type}
              </span>
            )}
            {urgency && (
              <Badge className={`${urgencyBadgeClass} text-xs shrink-0`}>
                {URGENCY_LABEL[urgency] || urgency}
              </Badge>
            )}
          </div>
          {lead.service_address && (
            <p className="text-xs text-[#475569] truncate mt-1">
              {lead.service_address}
            </p>
          )}
          {firstCall?.urgency_classification && (
            <p className="text-xs text-[#475569]/70 mt-0.5">
              Triage: {firstCall.urgency_classification}
            </p>
          )}
        </div>

        {/* Right section: status, time, action */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Badge className={`${statusBadgeClass} text-xs`}>
            {STATUS_LABEL[status] || status}
          </Badge>
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
}
