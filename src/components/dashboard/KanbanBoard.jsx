'use client';

import KanbanColumn from '@/components/dashboard/KanbanColumn';

const PIPELINE_STATUSES = ['new', 'booked', 'completed', 'paid', 'lost'];

/**
 * KanbanBoard — 5-column pipeline view grouped by lead status.
 * lg+: side-by-side. Below lg: horizontal scroll with snap-x.
 * No drag-and-drop (deferred). Status changes go through LeadFlyout.
 *
 * @param {{ leads: Array, onViewLead: Function }} props
 */
export default function KanbanBoard({ leads, onViewLead }) {
  // Group leads by status
  const grouped = PIPELINE_STATUSES.reduce((acc, status) => {
    acc[status] = (leads ?? []).filter((lead) => lead.status === status);
    return acc;
  }, {});

  return (
    <div
      className="
        flex gap-4
        overflow-x-auto snap-x snap-mandatory scroll-smooth
        lg:overflow-x-visible
        pb-4
      "
      aria-label="Lead pipeline board"
    >
      {PIPELINE_STATUSES.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          leads={grouped[status]}
          onViewLead={onViewLead}
        />
      ))}
    </div>
  );
}
