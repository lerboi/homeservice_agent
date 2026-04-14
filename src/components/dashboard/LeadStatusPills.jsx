'use client';

const PIPELINE_STATUSES = [
  { value: 'new', label: 'New', activeClass: 'bg-[#C2410C] text-white border-[#C2410C]' },
  { value: 'booked', label: 'Booked', activeClass: 'bg-blue-600 text-white border-blue-600' },
  { value: 'completed', label: 'Completed', activeClass: 'bg-stone-700 text-white border-stone-700' },
  { value: 'paid', label: 'Paid', activeClass: 'bg-[#166534] text-white border-[#166534]' },
  { value: 'lost', label: 'Lost', activeClass: 'bg-red-600 text-white border-red-600' },
];

const IDLE_CLASS =
  'bg-white text-[#0F172A] border-stone-200 hover:bg-stone-50 hover:border-stone-300';

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
                        transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#C2410C] focus:ring-offset-1
                        ${isActive ? activeClass : IDLE_CLASS}`}
          >
            <span>{label}</span>
            <span
              className={`inline-flex items-center justify-center min-w-[20px] h-5 rounded-full px-1.5 text-[11px] font-semibold tabular-nums
                         ${isActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'}`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
