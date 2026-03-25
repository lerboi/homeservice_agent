# Phase 20: Dashboard UX Overhaul - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure the entire dashboard UI/UX so that new users who just completed onboarding have a clear, guided path to completing setup and understanding the system. All existing features remain — this is a pure UI/UX improvement with no backend changes. The dashboard should feel modern, smooth, and lightweight with outstanding UX, fully mobile-responsive, and performant on lower-end devices.

</domain>

<decisions>
## Implementation Decisions

### Home Page Layout and Information Hierarchy
- **D-01:** Adaptive layout — the home page is setup-dominant when the user hasn't completed all setup items, and transitions to a stats/activity-dominant view for active users with complete setup.
- **D-02:** Multi-card section layout — break the current single white card wrapper into separate cards for setup progress, stat widgets, quick actions, and recent activity. Each card is independently styled with the existing design tokens.
- **D-03:** Contextual quick-action cards — surface 2-3 quick actions based on setup state (e.g., "Connect Calendar", "Configure Hours", "View Leads"). These disappear or change as setup progresses and daily operations begin.

### Setup Checklist Redesign
- **D-04:** Required vs optional distinction — required items (business profile, services, test call) are marked with a "Required" badge and appear first. Optional-but-recommended items (calendar sync, working hours) are labeled "Recommended" with a softer visual treatment. Visual hierarchy uses color coding (orange for required, stone/gray for recommended).
- **D-05:** Expandable checklist items — each item has a brief description explaining WHY it matters and a direct action button (e.g., "Connect" or "Configure") that navigates to the relevant settings page/section.
- **D-06:** Progress ring or segmented progress — replace the linear progress bar with a more visually engaging progress indicator that shows required vs optional completion separately.

### Guided Tour (Joyride)
- **D-07:** Install `react-joyride` as a dependency. The tour covers the essential dashboard flow: home page overview, leads tab, calendar tab, services tab, and settings tab — highlighting the key action in each.
- **D-08:** Auto-offer on first dashboard visit — show a welcome modal/tooltip asking "Want a quick tour?" on first visit (track via localStorage flag). A "Start Tour" button is always available in the top bar for repeat access.
- **D-09:** Tour steps should be concise (max 2 sentences per step), use the brand orange accent color for the spotlight, and include a skip button. The tour should not block any functionality.

### Mobile Navigation
- **D-10:** Bottom tab bar on mobile — replace the hamburger drawer with a fixed bottom tab bar showing the 5 primary nav items (Home, Leads, Analytics, Calendar, Services). Settings accessed via a gear icon in the top bar on mobile.
- **D-11:** Cards stack vertically on mobile with reduced horizontal padding. All interactive elements have minimum 44px touch targets. Animations are lighter on mobile (reduce or skip complex transitions).
- **D-12:** The layout container drops the single-card wrapper on mobile — content sections flow directly on the warm surface background for better use of screen real estate.

### Overall Design Direction
- **D-13:** Modern, clean aesthetic — keep the existing design token palette (brand orange, navy, warm surface) but refine spacing, shadows, and typography hierarchy. No heavy gradients, no glassmorphism beyond the existing top bar blur.
- **D-14:** Performance first — no heavy animation libraries beyond framer-motion (already installed). Use CSS transitions where possible instead of JS animations. Lazy load non-critical components. Respect `prefers-reduced-motion` throughout.
- **D-15:** All stat cards, checklist items, and activity items should have subtle hover states using the existing `card.hover` token pattern.

### Claude's Discretion
- Exact Joyride step content and positioning (top/bottom/left/right)
- Specific breakpoint values for mobile/tablet/desktop transitions
- Animation timing and easing curves for card transitions
- Whether to add a "What's New" or changelog section (skip unless trivial)
- Icon choices for quick-action cards

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `src/lib/design-tokens.js` — Shared color palette, button classes, card classes, glass effect, grid texture tokens

### Dashboard Components (all must be updated)
- `src/app/dashboard/layout.js` — Dashboard layout wrapper with sidebar, top bar, breadcrumb
- `src/app/dashboard/page.js` — Home page: stats, checklist, activity feed
- `src/components/dashboard/DashboardSidebar.jsx` — Sidebar navigation with mobile drawer
- `src/components/dashboard/SetupChecklist.jsx` — Current setup checklist component
- `src/components/dashboard/ChecklistItem.jsx` — Individual checklist item
- `src/components/dashboard/SetupCompleteBar.jsx` — Setup completion banner
- `src/components/dashboard/DashboardHomeStats.jsx` — 4 stat widgets with animated counters
- `src/components/dashboard/WelcomeBanner.jsx` — Welcome message for empty dashboards
- `src/components/dashboard/RecentActivityFeed.jsx` — Activity feed timeline

### API (read-only reference — no backend changes)
- `src/app/api/setup-checklist/route.js` — Checklist derivation logic (items derived from tenant columns)

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
- `AnimatedSection` — Landing page component, can be reused for section entrance animations
- `Progress` component (shadcn) — Currently used for checklist progress bar
- `AlertDialog` (Radix UI) — For confirmations
- `sonner` — Toast notifications

### Established Patterns
- Client components with `'use client'` directive
- `useEffect` for data fetching on mount
- `Promise.allSettled` for parallel API calls
- `prefers-reduced-motion` checks before animations (rAF counter, framer-motion)
- Design token classes applied via template literals
- Mobile-first responsive: `sm:`, `lg:` breakpoint prefixes

### Integration Points
- `DashboardLayout` wraps all pages — layout changes affect all dashboard routes
- `DashboardSidebar` controls navigation — must be modified for bottom tab bar on mobile
- `SetupChecklist` fetches from `/api/setup-checklist` — response shape stays the same, frontend interprets items differently
- Joyride tour component should be added at the layout level to work across all pages
- Top bar breadcrumb area is where the "Start Tour" button should live

</code_context>

<specifics>
## Specific Ideas

- User wants the dashboard to feel less confusing for new users who just signed up — clear indication of what to do first
- User wants distinction between "necessary to start accepting calls" vs "nice to have but not compulsory" setup items
- User explicitly requested a Joyride tour guide button for essentials
- User wants modern, smooth, lightly interactive UI with outstanding UX
- User wants extremely mobile-responsive design with no performance impact on lower-end mobile devices
- User emphasized no design choices that cause lag — performance is a hard constraint
- User wants the entire dashboard redesigned and rearranged, not just incremental tweaks

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-dashboard-ux-overhaul*
*Context gathered: 2026-03-25*
