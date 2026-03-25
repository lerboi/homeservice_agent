# Phase 20: Dashboard UX Overhaul - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Full structural redesign of the dashboard UI/UX — not just cosmetic polish but rearranging tabs, merging pages, restructuring navigation, and redesigning the home page to serve the daily workflow of a home service business owner who checks their phone for 30 seconds between jobs. All existing features remain functional — this is a pure frontend restructuring with no backend changes. Must be fully mobile-responsive and performant on lower-end devices.

</domain>

<decisions>
## Implementation Decisions

### Navigation Restructure
- **D-01:** Reduce to 5 tabs: **Home, Leads, Calendar, Analytics, More**. Remove standalone Services tab — move its content (services list, working hours, calendar sync, zones, escalation chain) into sub-pages under More.
- **D-02:** Bottom tab bar on mobile — replace the hamburger drawer with a fixed bottom tab bar (56px height) showing all 5 tabs. Desktop keeps the sidebar. Content needs `pb-[72px] lg:pb-0` to prevent cards hiding behind the tab bar.
- **D-03:** "More" menu is a list of sub-pages: Services & Pricing, Working Hours, Calendar Connections, Service Zones & Travel, Escalation Contacts, AI & Voice Settings, Account. Each is a separate route under `/dashboard/more/[section]`, not collapsible accordion sections.

### Home Page — Adaptive States
- **D-04:** Two distinct home page states based on setup completion:
  - **Setup Mode** (setup incomplete): Setup checklist IS the page content. No empty stat cards, no empty activity feed. The checklist is the hero.
  - **Active Mode** (setup done, has data): Daily command center with hero metric, action-required cards, next appointment, this-week summary, recent activity.
- **D-05:** Hero metric at the top of active mode — "AI answered X calls today" in large, arm's-length readable text. This is the product's value proposition reinforced every visit.
- **D-06:** "Action Required" card section — surfaces leads needing response (new/unacted leads) as a red-priority card. This answers "do I need to act right now?"
- **D-07:** "Next Appointment" card — shows the next upcoming appointment with customer name, time, service type, and address. Answers "what's coming up?"
- **D-08:** "This Week" summary card — inline stats replacing the need for frequent Analytics visits: leads count, booked count, conversion rate. Simple numbers, no charts.
- **D-09:** Recent activity feed — last 5 events, compact format. Same data as current but capped at 5 instead of 20 for Home.

### Setup Checklist Redesign
- **D-10:** Split items into Required (business profile, services, test call) and Recommended (calendar sync, working hours, escalation contacts) with clear visual grouping and headers.
- **D-11:** Required items use orange brand color treatment. Recommended items use softer stone/gray. Each item has a one-line description of WHY it matters and a direct action button that deep-links to the relevant settings page.
- **D-12:** Progress shown as "X of Y complete" with a progress ring (conic-gradient). Required items listed first. The checklist card disappears when all items are done (replaced by a brief celebration banner, then gone).

### Guided Tour — Contextual Coachmarks + On-Demand Tour
- **D-13:** Install `react-joyride`. Mount at layout level (not page level) so it persists across tab navigation. Tour covers all 5 tabs with 4-5 concise steps.
- **D-14:** Do NOT auto-show tour on first dashboard visit (user just completed onboarding wizard — they're fatigued). Instead, show a "Start Tour" button on the Home page in setup mode. Track `has_seen_tour` in localStorage.
- **D-15:** Tour steps: max 2 sentences each, brand orange spotlight, always-visible skip button, "Got it" as final button text. Target `data-tour="*"` attributes on elements, not CSS selectors.
- **D-16:** Tour must be skippable, never block functionality, and respect `prefers-reduced-motion`.

### Mobile Design Rules
- **D-17:** Full-width cards only on mobile — no side-by-side cards below `lg` breakpoint. Cards stack vertically.
- **D-18:** 48px minimum touch targets on all interactive elements. Bottom tab bar icons + labels with 56px bar height.
- **D-19:** Layout drops the single white card wrapper on mobile — content sections (individual cards) flow directly on the warm surface background (`bg-[#F5F5F4]`) for better screen real estate usage.
- **D-20:** Content area has `pb-[72px]` on mobile to account for the fixed bottom tab bar.

### Performance Rules
- **D-21:** CSS transitions (`transform`, `opacity`) for all animations — no JS-driven animation except the existing rAF counter in stat widgets. Keep transitions under 200ms for interactions.
- **D-22:** Skeleton loading screens for all data-dependent sections. Skeleton shapes match real content dimensions to prevent layout shift (CLS).
- **D-23:** Lazy load below-fold sections on Home. Use `next/dynamic` with `ssr: false` for heavy components (analytics charts). `React.memo` on card components.
- **D-24:** Respect `prefers-reduced-motion` everywhere — disable animations, set values immediately.

### Services Page → More Sub-Pages
- **D-25:** Current services page (`/dashboard/services`) content splits into sub-pages under More:
  - `/dashboard/more` — list of all config sections
  - Services list (with drag-to-reorder, urgency tags) stays as one sub-page
  - WorkingHoursEditor becomes its own sub-page
  - CalendarSyncCard becomes its own sub-page
  - ZoneManager becomes its own sub-page
  - EscalationChainSection becomes its own sub-page
- **D-26:** Settings page (`/dashboard/settings`) is merged into More. SettingsAISection (phone number, tone, test call) becomes a sub-page. SettingsHoursSection and SettingsCalendarSection redirect to their respective More sub-pages.

### Analytics Page
- **D-27:** Analytics stays as its own tab (user confirmed). Keep existing AnalyticsCharts component (revenue line, funnel bar, pipeline donut). No changes to analytics content.

### Overall Design Direction
- **D-28:** Keep the existing design token palette (brand orange `#C2410C`, navy `#0F172A`, warm surface `#F5F5F4`). Refine spacing and typography hierarchy but no new color system.
- **D-29:** Each card uses the existing `card.base` token pattern. Subtle hover states with `card.hover` on interactive cards.
- **D-30:** AI status indicator at the top of Home — green dot with "AI Receptionist: Active" gives peace of mind that the system is working.

### Claude's Discretion
- Exact Joyride step content and tooltip positioning
- Specific breakpoint values for responsive transitions
- Animation timing and easing curves
- Icon choices for More menu items and quick-action cards
- Whether "More" menu items use icons or just text labels
- Exact skeleton component dimensions
- How the "celebration banner" looks when setup is complete
- Whether to show "AI answered X calls" or "X new leads" as the hero metric (whichever has data)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `src/lib/design-tokens.js` — Shared color palette, button classes, card classes, glass effect, grid texture tokens

### Dashboard Components (all must be updated)
- `src/app/dashboard/layout.js` — Dashboard layout wrapper — needs bottom tab bar, tour mount point
- `src/app/dashboard/page.js` — Home page — full rewrite for adaptive states
- `src/app/dashboard/leads/page.js` — Leads page — keep functional, add data-tour attributes
- `src/app/dashboard/analytics/page.js` — Analytics page — keep as-is, add data-tour attribute
- `src/app/dashboard/calendar/page.js` — Calendar page — keep functional, add data-tour attribute
- `src/app/dashboard/services/page.js` — Services page — REMOVE, split into More sub-pages
- `src/app/dashboard/settings/page.js` — Settings page — REMOVE, merge into More sub-pages
- `src/components/dashboard/DashboardSidebar.jsx` — Sidebar — must hide on mobile, bottom tab bar replaces it
- `src/components/dashboard/SetupChecklist.jsx` — Checklist — full redesign (required/recommended split)
- `src/components/dashboard/ChecklistItem.jsx` — Checklist item — redesign with descriptions + action buttons
- `src/components/dashboard/SetupCompleteBar.jsx` — Keep for celebration banner
- `src/components/dashboard/DashboardHomeStats.jsx` — Stat widgets — redesign for active-mode home
- `src/components/dashboard/WelcomeBanner.jsx` — REMOVE, replaced by setup-mode home
- `src/components/dashboard/RecentActivityFeed.jsx` — Activity feed — cap at 5 items on Home

### Components That Move to More Sub-Pages
- `src/components/dashboard/WorkingHoursEditor.js` — Moves under More
- `src/components/dashboard/CalendarSyncCard.js` — Moves under More (if exists, or CalendarView-related)
- `src/components/dashboard/ZoneManager.js` — Moves under More (if exists)
- `src/components/dashboard/EscalationChainSection.js` — Moves under More
- `src/components/dashboard/SettingsAISection.js` — Moves under More
- `src/components/dashboard/SettingsHoursSection.js` — Redirects to WorkingHours under More
- `src/components/dashboard/SettingsCalendarSection.js` — Redirects to Calendar Connections under More

### API (read-only reference — no backend changes)
- `src/app/api/setup-checklist/route.js` — Checklist derivation logic (items derived from tenant columns)
- `src/app/api/leads/route.js` — Leads API for action-required card
- `src/app/api/appointments/route.js` — Appointments API for next-appointment card (if exists)

### Skill Files (update after changes)
- `.claude/skills/dashboard-crm-system/` — Must be updated to reflect new dashboard structure

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `design-tokens.js` — `colors`, `btn`, `card`, `glass`, `gridTexture`, `focus`, `selected` exports cover all visual patterns
- `framer-motion` — Already installed, used for AnimatePresence, motion.div transitions, useReducedMotion
- `lucide-react` — Full icon library available
- `Skeleton` component — For loading states
- `Progress` component (shadcn) — For checklist progress bar
- `sonner` — Toast notifications
- `recharts` — Already installed for analytics charts

### Established Patterns
- Client components with `'use client'` directive
- `useEffect` for data fetching on mount
- `Promise.allSettled` for parallel API calls
- `prefers-reduced-motion` checks before animations
- Design token classes applied via template literals
- Mobile-first responsive: `sm:`, `lg:` breakpoint prefixes

### Integration Points
- `DashboardLayout` wraps all pages — layout changes affect all dashboard routes
- `DashboardSidebar` controls navigation — must be modified for bottom tab bar on mobile
- `SetupChecklist` fetches from `/api/setup-checklist` — response shape unchanged, frontend interprets differently
- Joyride tour must be mounted at layout level to work across tab navigation
- New `/dashboard/more/` routes needed for sub-pages
- Sidebar `NAV_ITEMS` array must be updated (remove Services, keep Analytics, add More)
- `BREADCRUMB_LABELS` in layout must be updated for new routes

### Key Risks
- Removing the single white card wrapper from layout.js affects ALL 5 existing pages — each needs its own card wrappers added
- Services page content split into multiple sub-pages means component imports shift
- Settings page merge into More means URL redirects needed for any deep links (setup checklist `href` values)

</code_context>

<specifics>
## Specific Ideas

- User wants this to feel like a full dashboard restructuring, not cosmetic polish — tabs rearranged, sections moved, optimal UX flow
- Target user is a plumber/HVAC/electrician checking phone for 30 seconds between jobs in a van
- Home page should answer: "Did I get new leads? What's my next job? Is my AI working?"
- Setup mode home should make the checklist the hero — no empty charts or zero-value stats
- Active mode home follows the "traffic light" pattern: Red (action required) → Yellow (coming up) → Green (on track)
- Analytics stays as its own tab per user confirmation
- "More" replaces both Services tab and Settings tab as a single config hub
- Modeled after field-service SaaS patterns (Jobber, Housecall Pro, ServiceTitan, Square)

</specifics>

<deferred>
## Deferred Ideas

- Swipe-to-action on lead cards (call back, dismiss, archive)
- "Weekly Report" push notification linked to analytics view
- Progressive disclosure — hiding Analytics tab until 10+ calls (too aggressive for now)
- Contextual coachmarks triggered by first real data (first lead, first booking) — do basic Joyride first, add contextual tooltips in a future phase

</deferred>

---

*Phase: 20-dashboard-ux-overhaul*
*Context gathered: 2026-03-25 (revised after interactive discussion)*
