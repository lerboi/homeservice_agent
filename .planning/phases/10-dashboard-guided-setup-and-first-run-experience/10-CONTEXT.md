# Phase 10: Dashboard Guided Setup and First-Run Experience - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

A first-time user who lands on the dashboard after onboarding sees a guided setup checklist, contextual empty-state prompts, and a welcome message that walk them through every remaining configuration step — so they fully understand the product and complete setup without external help. Also builds out the settings page (currently a stub) as the home for checklist-linked actions.

</domain>

<decisions>
## Implementation Decisions

### Setup checklist
- **Top banner card** on dashboard home page, above the stats grid
- Full-width card with progress bar and checklist items
- **6 total items** with onboarding steps pre-checked for momentum:
  - [x] Create account (pre-checked from onboarding)
  - [x] Set up business profile (pre-checked from onboarding)
  - [x] Configure services (pre-checked from onboarding)
  - [ ] Connect Google Calendar — links to Settings > Calendar Connections
  - [ ] Configure working hours — links to Settings > Working Hours
  - [ ] Make a test call — links to Settings > AI Receptionist
- Each uncompleted item has an arrow/link to the relevant settings section
- **Progress persists across sessions** — stored in DB (not sessionStorage)
- **Dismiss behavior:** When all items complete, collapses to a small "Setup complete!" celebration bar with X to dismiss permanently. Dismiss state persisted in DB.

### Empty states (per-page)
- **Style:** Lucide icon + 1-2 line description + action CTA button
- **Pages needing empty states:**
  - Leads: "No leads yet — when callers reach your AI, leads appear here with full call details" + "Make a Test Call" CTA
  - Calendar: "No appointments yet — when your AI books jobs, they appear here" + "Connect Calendar" CTA
  - Analytics: "No data yet — analytics populate as calls come in" + "Make a Test Call" CTA
  - Activity feed (dashboard home): "No recent activity — your AI's actions will appear here as calls come in"
- **First-run only:** Rich empty state with CTA shown only when page has NEVER had data. After first lead/appointment, filtered-to-zero uses simple "No results match your filters" text.

### Dashboard home welcome
- When stats are all zeros AND activity feed is empty, show a welcome section below the checklist: "Welcome to your dashboard! Complete setup to start receiving calls."
- Disappears once any data exists

### Test call from dashboard
- **Two entry points:** Checklist item links to Settings, Settings page has permanent "Test My AI" card
- **Settings page inline card:** Shows AI phone number + "Test My AI" button
- **Flow:** Reuses/adapts existing TestCallPanel component from onboarding — triggers call, polls /api/onboarding/test-call-status, shows success inline. No page navigation.
- Checklist auto-checks "Make a test call" when a completed call is detected

### Settings page buildout
- Currently a stub ("coming soon") — build out with 3 sections:
  1. **Your AI Receptionist** — phone number display + "Test My AI" button with inline polling
  2. **Working Hours** — reuse existing WorkingHoursEditor component (from Phase 3)
  3. **Calendar Connections** — reuse existing CalendarSyncCard component (Google sync status, connect/disconnect)
- Sections are stacked cards, consistent with dashboard design language

### First-run guidance approach
- **No tooltips, no tour overlay, no coach marks**
- Checklist banner + per-page empty states with CTAs are sufficient
- Success criterion 5 ("identify what each section does within 30 seconds") met by clear sidebar nav labels + empty state descriptions

### Claude's Discretion
- Exact checklist detection logic (how to determine which items are complete from DB state)
- Welcome section design and animation
- Empty state icon choices per page
- "Setup complete" celebration bar design
- How to differentiate first-run empty state vs filtered-to-zero (query-based or flag-based)
- Settings page section spacing and responsive layout
- TestCallPanel adaptation for settings context (removing onboarding-specific copy)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — Phase 10 requirements are TBD (to be derived during planning from success criteria)

### Phase 10 success criteria
- `.planning/ROADMAP.md` — Phase 10 section: 5 success criteria defining checklist, empty states, test call, persistence, and 30-second comprehension

### Prior phase context
- `.planning/phases/07-unified-signup-and-onboarding-wizard/07-CONTEXT.md` — Onboarding wizard decisions: 5-step flow, test call finale, session persistence, completion detection
- `.planning/phases/04-crm-dashboard-and-notifications/04-CONTEXT.md` — Dashboard layout decisions, lead pipeline, activity feed, stat widgets
- `.planning/phases/03-scheduling-and-calendar-sync/03-CONTEXT.md` — Calendar sync, working hours, WorkingHoursEditor, CalendarSyncCard components

### Existing dashboard code
- `src/app/dashboard/layout.js` — Dashboard layout: sidebar + breadcrumb + white card wrapper
- `src/app/dashboard/page.js` — Dashboard home: stats grid + activity feed (insert checklist above)
- `src/components/dashboard/DashboardSidebar.jsx` — Sidebar nav items
- `src/components/dashboard/DashboardHomeStats.jsx` — 4-widget stats grid
- `src/components/dashboard/RecentActivityFeed.jsx` — Activity feed (has basic empty state to upgrade)
- `src/app/dashboard/settings/page.js` — Settings stub (to be rebuilt)

### Reusable components
- `src/components/dashboard/WorkingHoursEditor.js` — Working hours editor (reuse in settings)
- `src/components/dashboard/CalendarSyncCard.js` — Calendar sync card (reuse in settings)
- `src/components/onboarding/TestCallPanel.jsx` — Test call state machine (adapt for settings)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TestCallPanel` — Full test call state machine (ready → calling → in_progress → complete) with polling. Adapt for dashboard settings context.
- `WorkingHoursEditor` — Already built as dashboard component. Wire into settings page.
- `CalendarSyncCard` — Google Calendar connect/disconnect card. Wire into settings page.
- `DashboardHomeStats` — 4-widget animated stats grid. Checklist goes above this.
- `RecentActivityFeed` — Activity feed with basic "No recent activity" empty state. Upgrade to rich empty state.
- `AnimatedSection` — Framer Motion wrapper for page transitions. Use for checklist animations.
- shadcn components: Button, Card, Progress, Skeleton, Separator — all available.
- Heritage Copper tokens: `#C2410C`, `#0F172A`, `#F5F5F4`, `#475569` — consistent palette.

### Established Patterns
- `'use client'` for interactive dashboard pages, server components for static content
- Stats fetched via parallel `fetch()` calls to API routes in useEffect
- Supabase client (`supabase-browser`) for direct DB queries (activity feed pattern)
- Skeleton loading states during data fetch
- `prefers-reduced-motion` respected in all animations (counter, celebration)

### Integration Points
- Dashboard home page (`page.js`) — insert checklist banner above stats grid
- Settings page (`settings/page.js`) — rebuild from stub with 3 sections
- `/api/onboarding/test-call-status` — existing endpoint for test call polling (reuse)
- `/api/onboarding/test-call` — existing endpoint to trigger test call (reuse)
- Supabase `tenants` table — `onboarding_complete`, `retell_phone_number`, working hours fields
- Supabase `calendar_connections` table — Google Calendar sync status

</code_context>

<specifics>
## Specific Ideas

- Checklist should feel like "you're already halfway done" — pre-checked onboarding items give momentum
- Empty states should be helpful, not sad — explain what WILL appear here and how to trigger it
- Test call from settings is a permanent feature, not just first-run — owners should be able to test their AI anytime
- No tooltip tours or coach marks — the UI should be self-explanatory through good labeling and contextual empty states
- Settings page becomes the hub for all configuration — natural home for checklist-linked actions

</specifics>

<deferred>
## Deferred Ideas

- "Invite team member" checklist item — requires team/invite feature (separate phase)
- Notification preferences in settings — already covered by onboarding contact step, future enhancement

</deferred>

---

*Phase: 10-dashboard-guided-setup-and-first-run-experience*
*Context gathered: 2026-03-23*
