'use client';

/**
 * KanbanColumn — single pipeline column with compact lead card stack.
 * 280px fixed width, snap-start for horizontal scroll on mobile.
 * Cards are static (no drag-and-drop — deferred).
 *
 * @param {{ status: string, leads: Array, onViewLead: Function }} props
 */

const STATUS_COLORS = {
  new: 'text-[#C2410C]',
  booked: 'text-blue-700',
  completed: 'text-stone-600',
  paid: 'text-[#166534]',
  lost: 'text-red-700',
};

const URGENCY_DOT = {
  emergency: 'bg-red-500',
  high_ticket: 'bg-amber-500',
  routine: 'bg-[#0F172A]/30',
};

function formatRelativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function KanbanColumn({ status, leads, onViewLead }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  const count = leads?.length ?? 0;
  const labelColor = STATUS_COLORS[status] || 'text-stone-600';

  return (
    <div
      role="region"
      aria-label={`${label} leads`}
      className="w-[280px] min-w-[280px] snap-start flex flex-col gap-2"
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-1 pb-1">
        <span className={`text-sm font-semibold ${labelColor}`}>{label}</span>
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-stone-100 text-[11px] font-semibold text-stone-500">
          {count}
        </span>
      </div>

      {/* Card stack */}
      <div className="flex flex-col gap-2">
        {count === 0 ? (
          <div className="rounded-lg border border-stone-200/60 border-dashed bg-white/60 p-4 text-center">
            <span className="text-xs text-stone-400">No leads</span>
          </div>
        ) : (
          leads.map((lead) => {
            const urgencyDot = URGENCY_DOT[lead.urgency] || URGENCY_DOT.routine;
            return (
              <button
                key={lead.id}
                type="button"
                onClick={() => onViewLead?.(lead.id)}
                className="
                  w-full text-left rounded-lg border border-stone-200/60 bg-white
                  p-3 space-y-1.5
                  shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]
                  hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.06)] hover:-translate-y-0.5
                  transition-all duration-150 group
                "
              >
                {/* Top row: caller name + urgency dot */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#0F172A] truncate">
                    {lead.caller_name || 'Unknown Caller'}
                  </span>
                  <span
                    className={`flex-shrink-0 w-2 h-2 rounded-full ${urgencyDot}`}
                    title={lead.urgency}
                    aria-hidden="true"
                  />
                </div>

                {/* Job type */}
                {lead.job_type && (
                  <span className="block text-xs text-stone-500 capitalize truncate">
                    {lead.job_type}
                  </span>
                )}

                {/* Relative time */}
                <span className="block text-[11px] text-stone-400 tabular-nums">
                  {formatRelativeTime(lead.created_at)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
