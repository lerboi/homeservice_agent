'use client';

const PIPELINE_STATUSES = [
  { value: 'new',       label: 'New',       activeClass: 'bg-[var(--brand-accent)] text-[var(--brand-accent-fg)] border-[var(--brand-accent)]' },
  { value: 'booked',    label: 'Booked',    activeClass: 'bg-blue-600 dark:bg-blue-500 text-white border-blue-600 dark:border-blue-500' },
  { value: 'completed', label: 'Completed', activeClass: 'bg-stone-700 dark:bg-stone-600 text-white border-stone-700 dark:border-border' },
  { value: 'paid',      label: 'Paid',      activeClass: 'bg-[#166534] dark:bg-emerald-600 text-white border-[#166534] dark:border-emerald-600' },
  { value: 'lost',      label: 'Lost',      activeClass: 'bg-red-600 dark:bg-red-500 text-white border-red-600 dark:border-red-500' },
];

const IDLE_CLASS =
  'bg-card text-foreground border-border hover:bg-accent hover:border-accent-foreground/20';

export default function LeadStatusPills({ counts, activeStatus, onStatusChange }) {
  function handleClick(status) {
    onStatusChange(activeStatus === status ? '' : status);
  }

  return (
    <div
      role="tablist"
      aria-label="Filter leads by status"
      className="flex items-center gap-2 overflow-x-auto px-6 pt-1 pb-4 -mb-px scroll-smooth
                 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
    >
      {PIPELINE_STATUSES.map(({ value, label, activeClass }) => {
        const count = counts?.[value] ?? 0;
        const isActive = activeStatus === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => handleClick(value)}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium shrink-0
                        transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1
                        ${isActive ? activeClass : IDLE_CLASS}`}
          >
            <span>{label}</span>
            <span
              className={`inline-flex items-center justify-center min-w-[20px] h-5 rounded-full px-1.5 text-[11px] font-semibold tabular-nums
                         ${isActive ? 'bg-white/20 dark:bg-white/15 text-white' : 'bg-muted text-muted-foreground'}`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
