# Phase 20: Dashboard UX Overhaul - Research

**Researched:** 2026-03-25
**Domain:** Next.js 19 / React 19 dashboard UX — guided tours, adaptive layouts, mobile-first navigation, setup checklist redesign
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Home Page Layout and Information Hierarchy**
- D-01: Adaptive layout — setup-dominant when setup incomplete, stats/activity-dominant for active users with complete setup.
- D-02: Multi-card section layout — break the single white card wrapper into separate cards for setup progress, stat widgets, quick actions, and recent activity. Each card independently styled with existing design tokens.
- D-03: Contextual quick-action cards — surface 2-3 quick actions based on setup state. Disappear or change as setup progresses.

**Setup Checklist Redesign**
- D-04: Required vs optional distinction — required items (business profile, services, test call) marked with "Required" badge (orange). Optional-but-recommended (calendar sync, working hours) labeled "Recommended" (softer visual, stone/gray).
- D-05: Expandable checklist items — each item has a description explaining WHY it matters and a direct action button navigating to the relevant settings page/section.
- D-06: Progress ring or segmented progress — replace linear progress bar with a more visually engaging indicator showing required vs optional completion separately.

**Guided Tour (Joyride)**
- D-07: Install `react-joyride` as a dependency. Tour covers: home page overview, leads tab, calendar tab, services tab, settings tab.
- D-08: Auto-offer on first dashboard visit via welcome modal/tooltip (localStorage flag). "Start Tour" button always available in top bar.
- D-09: Concise steps (max 2 sentences per step), brand orange spotlight, skip button included. Tour must not block functionality.

**Mobile Navigation**
- D-10: Bottom tab bar on mobile — replace hamburger drawer with fixed bottom tab bar for 5 primary nav items (Home, Leads, Analytics, Calendar, Services). Settings via gear icon in top bar on mobile.
- D-11: Cards stack vertically on mobile with reduced horizontal padding. All interactive elements minimum 44px touch targets. Lighter animations on mobile.
- D-12: Layout container drops the single-card wrapper on mobile — content sections flow directly on warm surface background.

**Overall Design Direction**
- D-13: Modern, clean aesthetic — keep existing design token palette but refine spacing, shadows, typography hierarchy. No heavy gradients, no glassmorphism beyond existing top bar blur.
- D-14: Performance first — no heavy animation libraries beyond framer-motion (already installed). CSS transitions where possible. Lazy load non-critical components. Respect `prefers-reduced-motion` throughout.
- D-15: All stat cards, checklist items, and activity items have subtle hover states using the existing `card.hover` token pattern.

### Claude's Discretion
- Exact Joyride step content and positioning (top/bottom/left/right)
- Specific breakpoint values for mobile/tablet/desktop transitions
- Animation timing and easing curves for card transitions
- Whether to add a "What's New" or changelog section (skip unless trivial)
- Icon choices for quick-action cards

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 20 is a pure frontend UI/UX overhaul of the existing dashboard. No backend changes are needed — the `/api/setup-checklist` response shape stays identical; only how the frontend interprets and renders items changes. The scope covers: (1) replacing the single-card layout wrapper with a multi-card home page grid, (2) redesigning the setup checklist with required/recommended distinctions and expandable items, (3) adding a react-joyride guided tour, and (4) replacing the mobile hamburger drawer with a bottom tab bar.

All existing feature components (LeadFlyout, KanbanBoard, CalendarView, AnalyticsCharts, etc.) are preserved unchanged. The structural changes are concentrated in `layout.js`, `page.js` (dashboard home), `DashboardSidebar.jsx`, `SetupChecklist.jsx`, and `ChecklistItem.jsx`. A new `DashboardTour.jsx` component is added at the layout level.

The primary risks are: (a) the `DashboardLayout` wraps every dashboard page — any change to the single white card wrapper needs careful handling to avoid visual regressions on leads/analytics/calendar/services pages, and (b) react-joyride 3.x uses `react` as a peer dep with compatibility declared for React 16.8–19, which matches the project's React 19 constraint.

**Primary recommendation:** Install `react-joyride@3.0.0`, build the tour as a standalone `DashboardTour` client component mounted in `layout.js` outside the main content area, and treat layout.js changes with high regression-testing care since it wraps all dashboard routes.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-joyride | 3.0.0 | Guided tour with spotlight, tooltips, step navigation | Locked by D-07; only industry-standard React tour library; MIT |
| framer-motion | 12.38.0 (installed) | Card entrance animations, AnimatePresence for tour modal | Already installed; project-wide pattern |
| lucide-react | 0.577.0 (installed) | Badge icons, quick-action icons, navigation icons | Already installed project-wide |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-collapsible (via radix-ui) | 1.4.3 (installed) | Expandable checklist items (D-05) | Already available through radix-ui bundle |
| CSS custom properties | native | Segmented progress ring (D-06) | No extra library — SVG or conic-gradient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-joyride | intro.js-react, shepherd.js | Locked by D-07 — do not use alternatives |
| SVG progress ring | Radix Progress + CSS clip | SVG ring gives more control over segmented required/optional display |
| Bottom tab bar (custom) | Radix Tabs | Custom is simpler — bottom nav only needs Link + active state, no tab panel semantics |

**Installation:**
```bash
npm install react-joyride
```

**Version verification:**
- `react-joyride`: `npm view react-joyride version` → 3.0.0 (verified 2026-03-25)
- Peer deps: `react: '16.8 - 19'` — compatible with project's React 19

---

## Architecture Patterns

### Current Structure (before Phase 20)

```
layout.js                      ← Single white card wraps ALL children
  ├── DashboardSidebar.jsx     ← Fixed left sidebar (lg) / hamburger drawer (mobile)
  ├── sticky top bar           ← breadcrumb only
  └── <AnimatedSection>
        └── <div white card>   ← children render inside here
              └── page.js      ← p-6 padding, checklist+stats+activity in one space-y-8
```

### Target Structure (after Phase 20)

```
layout.js                      ← Removes single white card wrapper; passes children directly
  ├── DashboardSidebar.jsx     ← Desktop: unchanged fixed sidebar
  │                               Mobile: REMOVED hamburger; replaced by BottomTabBar
  ├── sticky top bar           ← breadcrumb + "Start Tour" button
  ├── BottomTabBar.jsx (NEW)   ← Mobile-only: fixed bottom bar, 5 tabs + gear icon
  ├── DashboardTour.jsx (NEW)  ← Joyride tour component, mounted at layout level
  └── children (no white card) ← pages render their own cards

page.js (dashboard home)       ← Multi-card sections, adaptive based on setup state
  ├── SetupChecklist.jsx        ← Redesigned: required/optional badges, expandable items, progress ring
  ├── QuickActionCards.jsx (NEW)← 2-3 contextual quick actions based on setup state
  ├── DashboardHomeStats.jsx    ← Unchanged data; cards get card.hover token
  └── RecentActivityFeed.jsx    ← Unchanged data; now in its own card
```

### Pattern 1: Layout Wrapper Removal with Per-Page Cards

**What:** `DashboardLayout` removes the `<div className="bg-white rounded-2xl ...">` wrapper. Each dashboard page is responsible for its own card styling.
**When to use:** Required for D-02 (multi-card home) and D-12 (mobile — no card wrapper). All non-home pages need a card wrapper added at the page level to preserve their current appearance.
**Key risk:** Every existing dashboard page currently relies on the layout's white card for their background. The plan MUST add a wrapper card div to `leads/page.js`, `analytics/page.js`, `calendar/page.js`, `services/page.js`, and `settings/page.js` when removing it from `layout.js`.

```tsx
// layout.js AFTER — no white card wrapper
<div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 pb-20 lg:pb-6">
  {/* pb-20 on mobile to clear bottom tab bar */}
  {children}
</div>

// Each non-home page AFTER — adds its own card wrapper
<div className={`${card.base} p-6`}>
  {/* page content */}
</div>
```

### Pattern 2: react-joyride Integration

**What:** `DashboardTour` is a `'use client'` component that mounts Joyride at the layout level. Steps target elements via CSS selectors using the `target` prop. localStorage flag `gsd_tour_offered` tracks whether the auto-offer has been shown.
**When to use:** Joyride must be at layout level (not page level) because the tour spans multiple tabs. The component is mounted in `layout.js` and controls visibility via state.

```tsx
// Source: react-joyride v3 official API
'use client';
import Joyride, { STATUS } from 'react-joyride';
import { useReducedMotion } from 'framer-motion';

const STEPS = [
  {
    target: '[data-tour="home"]',
    content: 'This is your command center. Check setup progress and today\'s stats here.',
    disableBeacon: true,
  },
  // ...
];

export default function DashboardTour({ run, onFinish }) {
  const prefersReduced = useReducedMotion();

  function handleCallback({ status }) {
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      onFinish();
    }
  }

  return (
    <Joyride
      steps={STEPS}
      run={run}
      continuous
      showSkipButton
      showProgress
      disableScrolling={false}
      disableAnimation={prefersReduced}
      styles={{
        options: {
          primaryColor: '#C2410C',   // brand orange spotlight
          zIndex: 9999,
        },
      }}
      callback={handleCallback}
    />
  );
}
```

### Pattern 3: Bottom Tab Bar (Mobile)

**What:** A `'use client'` fixed bottom bar with 5 `Link` items and a gear icon. Replaces the hamburger drawer on mobile (`< lg` breakpoint). The sidebar is still shown on `lg:` and above.
**When to use:** On mobile only — use `lg:hidden` on the bottom bar, `hidden lg:flex` on the sidebar.
**Touch target requirement:** Each tab button must be at least 44px height (D-11). Use `h-[44px]` or `py-3`.

```tsx
// Mobile bottom tab bar — simplified pattern
const TABS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/leads', label: 'Leads', icon: Users },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar },
  { href: '/dashboard/services', label: 'Services', icon: Wrench },
];

// Fixed bottom bar with safe area padding for notched phones
<nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0F172A] border-t border-white/[0.06] pb-safe flex">
  {TABS.map(tab => (
    <Link key={tab.href} href={tab.href}
      className="flex-1 flex flex-col items-center justify-center h-[56px] min-h-[44px] gap-1 text-xs ..."
    >
      <tab.icon className="h-5 w-5" />
      <span>{tab.label}</span>
    </Link>
  ))}
</nav>
```

### Pattern 4: Segmented Progress Ring (D-06)

**What:** SVG-based circle with two arc segments — orange for required-complete, stone for optional-complete, light stone for incomplete. Built as a CSS/SVG component with no extra libraries.
**When to use:** Replaces `<Progress>` linear bar in `SetupChecklist`. Requires knowing required vs optional counts separately.

```tsx
// Conic-gradient approach (CSS-only, no SVG complexity)
// Two values: required% and optional%
const style = {
  background: `conic-gradient(
    #C2410C 0% ${requiredPct}%,          /* orange for required */
    #78716C ${requiredPct}% ${totalPct}%, /* stone for optional */
    #E7E5E4 ${totalPct}% 100%            /* warm stone empty */
  )`,
};
<div className="relative h-16 w-16 rounded-full" style={style}>
  <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center">
    <span className="text-xs font-semibold">{completedCount}/6</span>
  </div>
</div>
```

### Pattern 5: Expandable Checklist Items (D-05)

**What:** Each `ChecklistItem` gains an expand/collapse toggle that reveals a description and a direct CTA button. Uses `AnimatePresence` + `motion.div` for the expand animation, consistent with existing framer-motion usage.
**When to use:** All incomplete items are expandable. Complete items show collapsed with a checkmark.

### Pattern 6: Adaptive Home Layout (D-01)

**What:** `DashboardPage` derives an `isSetupComplete` boolean from the checklist data. When `isSetupComplete` is false, the setup checklist section is prominent (full width, top of page). When true, stats widgets move to top and checklist section is hidden (dismissed or not shown).
**Condition check:** `completedCount === 6 || dismissed` from the `/api/setup-checklist` response — no new API needed.

### Pattern 7: localStorage Tour Flag

**What:** `DashboardTour` reads `localStorage.getItem('gsd_tour_offered')` on mount. If not set, shows the welcome modal asking if the user wants a tour. Sets the flag on dismiss or acceptance.
**When to use:** Only runs in the browser (`useEffect`). Must handle SSR safely (`typeof window !== 'undefined'` guard or `useEffect`).

```tsx
useEffect(() => {
  if (!localStorage.getItem('gsd_tour_offered')) {
    setShowOffer(true);
    localStorage.setItem('gsd_tour_offered', '1');
  }
}, []);
```

### Anti-Patterns to Avoid

- **Removing the white card from layout without updating child pages:** Every existing dashboard page renders without its own wrapper. Removing the layout card without adding per-page wrappers breaks ALL non-home pages. This is the highest regression risk.
- **Mounting Joyride at page level:** The tour spans multiple tabs. It must be at layout level or use React context. If mounted inside `DashboardPage`, it is destroyed on navigation.
- **Using `document.body` scroll lock for Joyride during tour:** Joyride handles its own scroll. Do not add additional scroll locks.
- **Hardcoding bottom tab bar height:** Use `pb-safe` (Tailwind v4 safe area) + `pb-[56px]` on the main content div on mobile to prevent content hiding behind the tab bar.
- **CSS-in-JS `@keyframe` injection inside react-joyride styles override:** The project already uses `ensureSlideInKeyframe()` for dynamic keyframes. Do not duplicate this pattern for Joyride — use the `styles.options` API instead.
- **Forgetting `data-tour` attributes on elements:** Joyride `target` must match a selector present in the DOM at the time the step activates. Tour steps targeting sidebar items may not work on mobile (sidebar is hidden on mobile). Target the bottom tab items on mobile with a conditional step or use IDs on content sections instead of nav items.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Guided tour UI | Custom tooltip/overlay system | `react-joyride` | Handles spotlight mask, scroll-to-element, beacon, keyboard navigation, aria attributes — all non-trivial |
| Expandable sections | Custom accordion with CSS height | `AnimatePresence` + `motion.div` with `height: auto` | Framer-motion handles auto-height animation; already installed |
| SVG progress ring | A chart library for a simple ring | CSS `conic-gradient` or inline SVG | A full charting lib for a two-segment ring is massive overkill |
| Mobile safe area padding | Custom JS to detect notch | Tailwind `pb-safe` (`env(safe-area-inset-bottom)`) | CSS native; Tailwind v4 supports this |

**Key insight:** react-joyride handles all the hard parts of guided tours (spotlight masking via SVG overlay, step sequencing, beacon pulse animation, keyboard nav, ARIA roles). Building a custom equivalent would require hundreds of lines of DOM manipulation and a11y work.

---

## Common Pitfalls

### Pitfall 1: Layout Card Removal Breaks All Non-Home Dashboard Pages
**What goes wrong:** `DashboardLayout` currently wraps ALL `{children}` in a white rounded card. If this wrapper is removed to enable multi-card home layout, then `leads/page.js`, `analytics/page.js`, `calendar/page.js`, `services/page.js`, and `settings/page.js` will suddenly render with no white background — just content floating on the warm stone surface.
**Why it happens:** The single-card-wrapper pattern was a design shortcut — all pages inherit the card style for free from the layout.
**How to avoid:** Before removing the wrapper from `layout.js`, add `<div className={card.base + ' p-6'}>` wrappers inside each of the 5 non-home pages.
**Warning signs:** Visual regression test immediately after removing layout card — pages look broken.

### Pitfall 2: react-joyride `run` Prop Must Be Strictly Controlled
**What goes wrong:** If `run={true}` when Joyride mounts AND target elements are not yet in the DOM (e.g., during a loading state), Joyride throws a warning and may render the tooltip in the wrong position.
**Why it happens:** Joyride queries the DOM for the target element when the step activates. Components that mount asynchronously (after data fetch) are not present on initial render.
**How to avoid:** Only set `run={true}` after the page content has loaded. Gate with a `useEffect` or an `isReady` state.

### Pitfall 3: Mobile Bottom Tab Bar — Content Hidden Behind Fixed Bar
**What goes wrong:** The main content div does not account for the 56px bottom tab bar. On mobile, content at the bottom of the page scrolls behind the tab bar and is unreadable.
**Why it happens:** `position: fixed` elements are removed from normal flow. The content container doesn't know the bar exists.
**How to avoid:** Add `pb-[72px] lg:pb-0` to the main content wrapper in `layout.js`. Use `72px` (56px bar + 16px breathing room) on mobile, remove on `lg:`.

### Pitfall 4: Joyride Tour Steps Targeting Sidebar Elements on Mobile
**What goes wrong:** Tour step targets a nav item in the desktop sidebar with `target: '[href="/dashboard/leads"]'`. On mobile, the sidebar is hidden (`hidden lg:flex`). Joyride cannot find the target, throws an error, and the tour breaks.
**Why it happens:** The same element set doesn't exist in both mobile and desktop views when the mobile nav is entirely different (bottom tabs vs sidebar).
**How to avoid:** Target content section IDs (e.g., `data-tour="home-page"` on the page container) rather than sidebar/nav elements. These are always present regardless of viewport.

### Pitfall 5: framer-motion `useReducedMotion` Not Propagated to Joyride
**What goes wrong:** The project correctly uses `useReducedMotion` everywhere for framer-motion animations. But Joyride has its own animation system. When `prefers-reduced-motion` is active, framer-motion skips animations but Joyride still animates its spotlight.
**Why it happens:** Two separate animation systems with no shared configuration.
**How to avoid:** Pass `disableAnimation={prefersReduced}` to `<Joyride>` where `prefersReduced` comes from `useReducedMotion()`.

### Pitfall 6: Expandable ChecklistItem Height Animation with `overflow: hidden`
**What goes wrong:** Using `overflow: hidden` with a fixed max-height CSS transition on the expanded content causes content to be clipped if it wraps to more lines than expected on narrow screens.
**Why it happens:** Fixed max-height doesn't adapt to content size.
**How to avoid:** Use framer-motion `animate={{ height: 'auto' }}` with `initial={{ height: 0 }}` and `overflow: 'hidden'`. Framer handles the auto-height calculation.

### Pitfall 7: Quick Action Cards Not Updating When Checklist State Changes
**What goes wrong:** `QuickActionCards` renders static actions based on the initial checklist fetch. User completes an action, navigates back — cards still show old actions.
**Why it happens:** The checklist data is fetched once on mount and not refetched after navigation.
**How to avoid:** Either (a) lift checklist state to a context shared between `SetupChecklist` and `QuickActionCards`, or (b) add a `window.addEventListener('focus', refetch)` to refresh when user returns to the tab after completing a settings action. Simplest approach: both components call `/api/setup-checklist` independently on mount.

---

## Code Examples

Verified patterns from the existing codebase:

### Checklist API Response Shape (unchanged — no backend changes)
```js
// Source: src/app/api/setup-checklist/route.js
// Response shape stays identical — frontend adds required/optional classification
{
  items: [
    { id: 'create_account', label: 'Create account', complete: true, locked: true },
    { id: 'setup_profile', label: 'Set up business profile', complete: bool, locked: true },
    { id: 'configure_services', label: 'Configure services', complete: bool, locked: true },
    { id: 'connect_calendar', label: 'Connect Google Calendar', complete: bool, locked: false, href: '/dashboard/settings#calendar' },
    { id: 'configure_hours', label: 'Configure working hours', complete: bool, locked: false, href: '/dashboard/settings#hours' },
    { id: 'make_test_call', label: 'Make a test call', complete: bool, locked: false, href: '/dashboard/settings#ai' },
  ],
  dismissed: bool,
  completedCount: number
}
```

### Required vs Optional Classification (frontend-only, no API change)
```js
// Add this constant to the redesigned SetupChecklist.jsx
const ITEM_TYPE = {
  create_account: 'required',
  setup_profile: 'required',
  configure_services: 'required',
  make_test_call: 'required',
  connect_calendar: 'recommended',
  configure_hours: 'recommended',
};

// Separate counts for progress ring
const requiredItems = items.filter(i => ITEM_TYPE[i.id] === 'required');
const recommendedItems = items.filter(i => ITEM_TYPE[i.id] === 'recommended');
const requiredComplete = requiredItems.filter(i => i.complete).length;
const recommendedComplete = recommendedItems.filter(i => i.complete).length;
```

### Design Token Usage (existing — planner should reference)
```js
// Source: src/lib/design-tokens.js
import { colors, btn, card, glass } from '@/lib/design-tokens';

// Card with hover — use for all section cards on home page
<div className={`${card.base} ${card.hover} p-6`}>

// Required badge color: orange
// badge: 'bg-[#C2410C]/10 text-[#C2410C] text-xs font-medium px-2 py-0.5 rounded-full'

// Recommended badge color: stone/gray
// badge: 'bg-stone-100 text-stone-600 text-xs font-medium px-2 py-0.5 rounded-full'
```

### Existing Framer-Motion Patterns (reuse these)
```tsx
// Source: src/components/dashboard/SetupChecklist.jsx
// Card entrance animation — use for all new section cards
<motion.div
  initial={prefersReduced ? undefined : { opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: 'easeOut' }}
  className={card.base}
>

// Source: src/components/dashboard/SetupCompleteBar.jsx
// Exit animation — use for dismissible components
exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scaleY: 0, transformOrigin: 'top' }}
```

### Joyride Styles Override Pattern
```tsx
// react-joyride v3 official API — override to use brand colors
<Joyride
  styles={{
    options: {
      primaryColor: '#C2410C',      // brand orange
      backgroundColor: '#FFFFFF',
      textColor: '#0F172A',
      zIndex: 9999,
    },
    buttonNext: {
      backgroundColor: '#C2410C',
    },
    buttonBack: {
      color: '#475569',
    },
  }}
/>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hamburger drawer (mobile) | Bottom tab bar | Phase 20 | Standard mobile pattern; reduces navigation friction |
| Single white card wraps all pages | Per-page card wrappers | Phase 20 | Enables multi-card home layout |
| Linear progress bar (shadcn Progress) | Segmented progress ring | Phase 20 | Visual distinction for required vs optional |
| Flat checklist items (label + arrow) | Expandable items with description | Phase 20 | Context for WHY each item matters |

**Deprecated/outdated:**
- `WelcomeBanner` component: Will be replaced by the adaptive layout logic in D-01. The "welcome banner" concept is absorbed into the contextual quick-action cards. `WelcomeBanner.jsx` can be removed or repurposed.
- Mobile hamburger button in `DashboardSidebar.jsx`: The `Menu` button and drawer overlay pattern is removed on mobile. Desktop sidebar behavior is unchanged.

---

## Open Questions

1. **Joyride step targets on mobile vs desktop**
   - What we know: Tour targets must be present in the DOM when the step activates. Mobile hides the sidebar.
   - What's unclear: Whether to use different step arrays for mobile vs desktop, or simply target content areas (always present) rather than nav elements.
   - Recommendation: Target `data-tour="*"` attributes placed on content section wrappers, not on navigation elements. This works identically on all viewports.

2. **Quick action card data source**
   - What we know: `page.js` already fetches `/api/setup-checklist` via `SetupChecklist` on mount.
   - What's unclear: Should `QuickActionCards` share state with `SetupChecklist` via lifted state in `page.js`, or fetch independently?
   - Recommendation: Lift checklist fetch to `page.js` and pass `items` as props to both `SetupChecklist` and `QuickActionCards`. This avoids duplicate network requests and ensures both components always show consistent state.

3. **Settings gear icon location on mobile top bar**
   - What we know: D-10 says "Settings accessed via a gear icon in the top bar on mobile."
   - What's unclear: The current top bar renders only `DashboardBreadcrumb`. The top bar is in `layout.js` — the gear icon would need to link to `/dashboard/settings`.
   - Recommendation: Add a `<Link href="/dashboard/settings">` with a `Settings` lucide icon to the right side of the top bar. Show only on `lg:hidden`. This is a one-line addition.

---

## Environment Availability

Step 2.6: SKIPPED (no external services required — this is a pure frontend UI/UX phase. Only `react-joyride` npm install is needed, and npm is available in the project environment.)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 |
| Config file | `jest.config.js` (root) |
| Quick run command | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests` |
| Full suite command | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests` |

### Phase Requirements → Test Map

This phase has no formal requirement IDs (it is a UX improvement). However, the SETUP-01 through SETUP-05 requirements from REQUIREMENTS.md are addressed:

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| SETUP-01 | Checklist shows required vs recommended with direct nav links | manual | N/A | Visual verification |
| SETUP-02 | Empty states with CTA on all dashboard pages | manual | N/A | Visual verification |
| SETUP-03 | Test call from settings | existing (pre-existing) | N/A | Not new in Phase 20 |
| SETUP-04 | Checklist dismissal persists | manual | N/A | API behavior unchanged |
| SETUP-05 | User identifies dashboard sections in 30s | manual | N/A | UX evaluation |

**Key unit testable behaviors (additions):**
| Behavior | Test Type | File |
|----------|-----------|------|
| `ITEM_TYPE` classification map correct for all 6 item IDs | unit | `tests/crm/setup-checklist.test.js` |
| Required/optional counts derived correctly from items array | unit | `tests/crm/setup-checklist.test.js` |
| localStorage tour flag is read/written correctly | unit (jsdom) | `tests/crm/dashboard-tour.test.js` |

### Sampling Rate
- **Per task commit:** `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests`
- **Per wave merge:** Full suite
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/crm/setup-checklist.test.js` — covers ITEM_TYPE classification and required/optional counting logic
- [ ] `tests/crm/dashboard-tour.test.js` — covers localStorage flag logic for tour offer

---

## Project Constraints (from CLAUDE.md)

The following directives from `CLAUDE.md` apply to this phase:

1. **Skill file sync required:** After all dashboard component changes are complete, `.claude/skills/dashboard-crm-system/SKILL.md` MUST be updated to reflect: new component list (BottomTabBar, DashboardTour, QuickActionCards), updated DashboardLayout behavior, updated DashboardSidebar mobile behavior, and updated SetupChecklist behavior.
2. **Skill-driven architecture changes:** Read the skill file before making changes (already done in this research). Update the skill file after changes are made.
3. **The `dashboard-crm-system` skill file is the canonical reference** — it must stay in sync with the actual codebase after Phase 20.

---

## Sources

### Primary (HIGH confidence)
- Direct source read: `src/app/dashboard/layout.js` — current layout structure
- Direct source read: `src/app/dashboard/page.js` — current home page structure
- Direct source read: `src/components/dashboard/DashboardSidebar.jsx` — current sidebar/mobile nav
- Direct source read: `src/components/dashboard/SetupChecklist.jsx` — current checklist
- Direct source read: `src/components/dashboard/ChecklistItem.jsx` — current item component
- Direct source read: `src/app/api/setup-checklist/route.js` — API response shape
- Direct source read: `src/lib/design-tokens.js` — full token palette
- Direct source read: `.claude/skills/dashboard-crm-system/SKILL.md` — architectural reference
- npm registry: `react-joyride@3.0.0` — verified version and peer deps (React 16.8–19 compatible)

### Secondary (MEDIUM confidence)
- react-joyride v3 API: `styles.options`, `run` prop, `callback` prop pattern — from package metadata and known v3 API shape

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — react-joyride version verified from npm; framer-motion/lucide-react already installed
- Architecture: HIGH — based on direct source reading of all files being changed
- Pitfalls: HIGH — derived from direct analysis of current code structure (layout card dependency, Joyride DOM targeting, mobile nav)

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable libraries; react-joyride 3.x has been stable for months)
