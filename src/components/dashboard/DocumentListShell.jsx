'use client';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shared layout shell for invoice/estimate list pages.
 * Handles: status tabs, loading skeleton, error state, empty filtered state.
 *
 * Page-specific content (header, summary cards, table, empty state) is passed as children.
 */

export function StatusTabs({ tabs, activeStatus, onStatusChange, loading, getCount }) {
  return (
    <div className="border-b border-stone-200">
      <div className="flex gap-0 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeStatus === tab.key;
          const count = getCount(tab.key);
          return (
            <button
              key={tab.key}
              onClick={() => onStatusChange(tab.key)}
              className={`
                flex-shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
                ${isActive
                  ? 'border-[#C2410C] text-[#C2410C]'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
                }
              `}
            >
              {tab.label}
              {!loading && count !== null && (
                <span className={`ml-1.5 text-xs ${isActive ? 'text-[#C2410C]' : 'text-stone-400'}`}>
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ListError({ message, onRetry }) {
  return (
    <div className="text-center py-12">
      <p className="text-sm text-red-600 mb-3">{message}</p>
      <button onClick={onRetry} className="text-sm text-[#C2410C] hover:text-[#9A3412] underline">
        Try again
      </button>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className={`h-12 w-full rounded-md ${i % 2 === 0 ? 'opacity-70' : ''}`} />
      ))}
    </div>
  );
}

export function EmptyFiltered({ icon: Icon, activeStatus, documentName }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Icon className="w-12 h-12 text-stone-300 mb-4" />
      <h2 className="text-xl font-semibold text-stone-900 mb-2">
        No {activeStatus} {documentName}
      </h2>
      <p className="text-sm text-stone-500">
        You don&apos;t have any {documentName} with this status.
      </p>
    </div>
  );
}
