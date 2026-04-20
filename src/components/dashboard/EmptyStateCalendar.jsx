// Phase 58 Plan 58-04: thin wrapper around <EmptyState> (POLISH-01).
// Preserves the existing named export + the `padding` / `onConnect` props so
// `src/app/dashboard/calendar/page.js:925` (<EmptyStateCalendar padding="py-6"
// onConnect={() => {}} />) keeps rendering without change.
//
// Scope note: the UI-SPEC §10.1 locked copy for the calendar empty state
// ("Add a time block" CTA wired to TimeBlockSheet) is a page-level behavior
// change owned by Plan 58-05's dashboard sweep. This wrapper therefore retains
// the current shipped copy + the caller-provided onConnect handler so no
// behavior regresses ahead of that sweep.

import { Calendar } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

export function EmptyStateCalendar({ padding = 'py-16', onConnect }) {
  // The generic primitive fixes `py-16`; if a caller needs a tighter padding
  // (e.g. the collapsed-sidebar mini-calendar at py-6), we wrap the primitive
  // in a padding-only shell so the inner py-16 is visually neutralised.
  const needsPaddingOverride = padding && padding !== 'py-16';

  const body = (
    <EmptyState
      icon={Calendar}
      headline="No appointments yet"
      description="When your AI books jobs, confirmed appointments appear here with job details and time slots."
      ctaLabel={onConnect ? 'Connect Calendar' : undefined}
      ctaOnClick={onConnect}
    />
  );

  if (!needsPaddingOverride) return body;

  // Override path: neutralise the primitive's py-16 with an outer wrapper whose
  // padding wins. Purely visual — semantics identical.
  return <div className={padding}>{body}</div>;
}
