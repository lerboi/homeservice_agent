'use client';

/**
 * DailyOpsHub — bento grid container composing the 4 daily-ops tiles (HOME-02).
 *
 * Layout (D-06 + UI-SPEC Layout Contract):
 *   Row 1: Today's Appointments (hero, md:col-span-2)
 *   Row 2: Calls + Hot/New Leads (two medium tiles, md:grid-cols-2)
 *   Row 3: Usage (full width, md:col-span-2)
 *
 * This component intentionally carries NO data-fetching responsibility —
 * each tile owns its own useSWRFetch call. The hub is pure layout.
 *
 * Responsive rules:
 *   - `grid-cols-1` on mobile: everything stacks (D-16 mobile order preserved
 *     by child source-order: appointments → calls → leads → usage)
 *   - `md:grid-cols-2` on tablet+: hero spans both cols, mediums sit side by
 *     side, usage spans both cols
 *   - NO larger-breakpoint tokens here — the outer content/chat-sidebar split
 *     (col-span-8 / col-span-4) lives in dashboard/page.js per RESEARCH
 *     Pitfall 5 so the bento never fights the sidebar column
 */

import TodayAppointmentsTile from './TodayAppointmentsTile';
import CallsTile from './CallsTile';
import HotLeadsTile from './HotLeadsTile';
import UsageTile from './UsageTile';

export default function DailyOpsHub() {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
      data-tour="daily-ops-hub"
    >
      <div className="md:col-span-2">
        <TodayAppointmentsTile />
      </div>
      <CallsTile />
      <HotLeadsTile />
      <div className="md:col-span-2">
        <UsageTile />
      </div>
    </div>
  );
}
