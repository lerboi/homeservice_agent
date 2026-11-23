---
type: system
system: Dashboard and CRM
status: legacy-app
description: "File: src/components/dashboard/DashboardTour.jsx — wraps"
source: .claude/skills/dashboard-crm-system/SKILL.md § 2. Guided Tour
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Guided Tour

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

**File**: `src/components/dashboard/DashboardTour.jsx` — wraps
`react-joyride` v3. Mounted at layout level for cross-tab persistence.

Up to 6 steps (2026-06-21 onboarding revamp — adds the call-readiness step + auto-start):
1. **Welcome** — `target: 'body'`, `placement: 'center'` (modal: no spotlight, no scroll)
2. `[data-tour="ai-status"]` — AI status block (greeting row, `page.js`); placement `right` desktop / `bottom` mobile
3. `[data-tour="call-readiness"]` — the CallReadinessCard (essentials meter + next step); placement `bottom`. **Conditional**: included only when the card is in the DOM (it hides once the owner is fully set up). `buildSteps(desktop, hasReadiness)` takes a flag; the component computes `hasReadiness` in a `useMemo` keyed on `[run, desktop]` via `document.querySelector('[data-tour="call-readiness"]')`, so the DOM is read only when the tour starts (not via setState-in-effect, which the project bans).
4. `[data-tour="todays-appointments"]` — the Today's-Appointments hero tile (`DailyOpsHub.jsx`); placement `bottom`. (Anchors the compact hero tile, NOT the full `daily-ops-hub` bento, which is taller than the mobile viewport and would push the tooltip off-screen.)
5. Navigation — `[data-tour="sidebar-nav"]` (desktop, `right`) / `[data-tour="bottom-nav"]` (mobile, `top`)
6. **Finish** — `target: 'body'`, `placement: 'center'` ("You're all set 🎉")

**Auto-start (2026-06-21)**: brand-new users (no `gsd_has_seen_tour`) get the tour
automatically. `page.js` dispatches `start-dashboard-tour` from a `useEffect`,
deferred ~400ms via `setTimeout` so (a) the layout's listener is attached first
(child effects run before parent effects) and (b) the `data-tour` targets are
mounted before Joyride anchors them. A per-session
`sessionStorage['voco_tour_autostarted']` guard prevents re-firing on revisits.
The checklist Sheet no longer auto-opens, so the tour is the only first-visit overlay.

**Why this shape**: the old step 1 targeted `[data-tour="home-page"]` (the WHOLE
page container) with `placement: 'bottom'`, so the first tooltip rendered below
the entire page — the user had to scroll to the bottom to find it. Centered
welcome/finish modals + spotlights on compact, real elements fix that and let
react-joyride **smooth-scroll** each target into view (`scrollOffset: 96`,
`scrollDuration: 350`). `placement: 'center'` (verified in the v3 build) renders a
modal with neither spotlight nor scroll — ideal for intro/outro.

**Responsive targeting**: the nav exists twice in the DOM — desktop sidebar
(`hidden lg:flex`, `data-tour="sidebar-nav"`) and mobile bottom bar (`lg:hidden`,
`data-tour="bottom-nav"`). Step 4 points at whichever is rendered for the current
breakpoint, tracked via a `matchMedia('(min-width:1024px)')` listener + `useMemo`
(also drives `right` vs `top` placement). Any new element step must target a
compact, always-present node (avoid the full-page container) and, if it's the
nav, branch on the breakpoint.

**Polish/behavior**: per-step `title` (bold) + `content`; left-aligned tooltip
(`tooltipContainer textAlign:left`), `borderRadius 14`, soft shadow,
`1px solid var(--border)`, `width 360`, `spotlightPadding 8` + `spotlightRadius 12`,
`overlayColor rgba(0,0,0,.55)`, `zIndex 10000`. `blockTargetInteraction: true` +
`overlayClickAction: false` make the page non-interactive mid-tour so a stray
click can't derail it (advance only via Next/Back/Skip). `showProgress` is OFF
(clean `Next`/`Got it` buttons for a short tour).

**react-joyride v3 API notes** (v3 differs substantially from v2 — get these
wrong and the tooltip renders broken):
- Theme + behavior live in the **`options`** prop, not `styles.options`:
  `primaryColor`, `backgroundColor`, `textColor`, `arrowColor`, `zIndex`,
  `showProgress`, `skipBeacon`, and `buttons: ['skip','back','primary']`
  (v3 has no top-level `showSkipButton`/`showProgress`/`disableScrolling`/
  `disableAnimation` props — `'skip'` in `buttons` is how the skip button shows).
- Colors must reference the design tokens **directly** (`var(--popover)`) — the
  tokens are OKLCH, so the old `hsl(var(--popover))` wrapping produced invalid
  CSS. Tokens resolve inside joyride's body-level portal because `:root`/`.dark`
  are on `<html>`.
- `styles.buttonPrimary` (v2 was `buttonNext`); `styles.buttonBack`/`buttonSkip`.
- Tour end handled via the **`onEvent`** prop (v2 was `callback`); both receive
  `{ status }`. Per-step beacon suppression is `skipBeacon` (v2 `disableBeacon`).
- `Joyride` and `STATUS` are **named** exports in v3.

Brand orange primary/spotlight (`var(--brand-accent)` → `#C2410C` light /
`#FB923C` dark). On FINISHED/SKIPPED:
`localStorage.setItem('gsd_has_seen_tour', '1')`.

Trigger via `window.dispatchEvent(new CustomEvent('start-dashboard-tour'))`.
Home page button only shows if `gsd_has_seen_tour` not set.

**Install note**: `react-joyride` (`package.json` + lockfile) must actually be
present in `node_modules` — run `npm install` after a fresh checkout, or the
layout's `dynamic(() => import('./DashboardTour'))` silently fails and the
"Take the tour" button does nothing.

---
