# Phase 53: Feature flag infrastructure + invoicing toggle — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 53 — Feature flag infrastructure + invoicing toggle
**Areas discussed:** Gate enforcement location, UI-hiding mechanism, Toggle placement + flip-off UX, Route-off response

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Gate enforcement location | proxy vs helper vs hybrid | ✓ |
| UI-hiding mechanism | provider vs props vs per-component | ✓ |
| Toggle placement + flip-off UX | where + what happens on off | ✓ |
| Route-off response | 404 vs redirect vs disabled page | ✓ |

**User's choice:** All 4 gray areas selected for discussion.

---

## Gate Enforcement Location

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: proxy + helper (Recommended) | Extend src/proxy.js matcher for dashboard invoicing pages. APIs use shared getTenantFeatures() helper. Crons use WHERE clause. | ✓ |
| Helper everywhere | Every route/layout/cron calls getTenantFeatures() directly. No proxy changes. | |
| Extend proxy matcher to /api/** too | Proxy matcher extended to cover all invoice APIs. Adds a Supabase round-trip per API call (tail latency). | |

**User's choice:** Hybrid: proxy + helper (Recommended).
**Notes:** Matches existing admin (`src/proxy.js:41-61`) and subscription (`src/proxy.js:107-135`) gate patterns. APIs bypass proxy overhead; crons filter at query level.

---

## UI-hiding Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Server-fetch + Context Provider (Recommended) | Dashboard layout.js server-fetches flags, passes into <FeatureFlagsProvider> client boundary. useFeatureFlags() hook in client components. Props for server components. | ✓ |
| Server-render everything with props | No client context. Prop-drill flags through every component. | |
| Per-component client fetch via SWR/useSWR | Each component calls /api/tenant-features; SWR dedupes. Adds a client round-trip. | |

**User's choice:** Server-fetch + Context Provider (Recommended).
**Notes:** One DB fetch per page load; client components (LeadFlyout, BottomTabBar) consume via hook; server children read via props. Greenfield Provider but small addition.

---

## Toggle Placement + Flip-off UX

| Option | Description | Selected |
|--------|-------------|----------|
| /more/features panel + conditional confirm (Recommended) | Dedicated /dashboard/more/features page (always accessible). Confirm dialog only when invoice/estimate records exist. | ✓ |
| Always-confirm toggle on /more/features | Same placement; every flip triggers confirmation. | |
| /more/features + silent toggle | No dialog ever. Data still preserved per TOGGLE-04. | |
| Account settings page toggle | Live inside existing account settings instead of new page. | |

**User's choice:** /more/features panel + conditional confirm (Recommended).
**Notes:** Dedicated panel scales to future flags (could host Jobber/Xero flags). Toggle MUST live outside the gated surface since invoice-settings gets 404'd when flag is off. Conditional dialog emphasizes reversibility — records preserved.

---

## Route-off Response

| Option | Description | Selected |
|--------|-------------|----------|
| Mix: 404 APIs/crons, silent redirect pages (Recommended) | APIs 404 (REST standard, no info leak). Crons skip at query level. Pages silent redirect to /dashboard. | ✓ |
| Mix with toast hint on redirect | Same as above + one-time toast "Invoicing is disabled. Enable in More → Features." | |
| Uniform 404 everywhere | All 11 surfaces 404. Maximally clean/consistent. | |
| Disabled-feature page | Pages render "Invoicing disabled" with CTA. APIs still 404. | |

**User's choice:** Mix: 404 APIs/crons, silent redirect pages (Recommended).
**Notes:** Matches REST convention for APIs; clean redirect for bookmarked pages. Users who re-enable can bookmark again.

---

## Claude's Discretion

- Helper signature shape (`getTenantFeatures()` returns object vs `isFeatureEnabled(name)` boolean) — planner picks; object-returning shape slightly preferred.
- `/dashboard/more/features` visual pattern (existing More-menu card vs dedicated layout) — planner picks.
- Flip-off dialog copy wording — tone-match existing dashboard dialogs.
- Telemetry on toggle flip (activity_log entry) — nice-to-have if fits existing pattern.
- `<FeatureFlagsProvider>` wrapping scope — layout-wide is cleanest; planner confirms.

## Deferred Ideas

- Admin dashboard flag-toggle UI for support reps (later ops phase)
- Setup-checklist integration for invoice items (belongs in Phase 58 with `connect_jobber`/`connect_xero`)
- Telemetry dashboard for flag usage metrics
- Per-user (vs per-tenant) flags
- LaunchDarkly / Unleash / Growthbook integration — over-engineering for Phase 53's single flag
- Voice agent flag awareness — not required in v6.0
