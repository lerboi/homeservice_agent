---
type: system
system: Dashboard and CRM
status: legacy-app
description: "Dashboard Layout. Covers: Banners; Navigation; Attention badges (2026-06-10); FeatureFlagsProvider (Phase 53)"
source: .claude/skills/dashboard-crm-system/SKILL.md § 1. Dashboard Layout
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Dashboard Layout

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

**File**: `src/app/dashboard/layout.js` (Server) +
`src/app/dashboard/DashboardLayoutClient.jsx` (Client).

Split in Phase 53 so server-side feature-flag fetching happens once per
request without losing client-side interactivity.

- `layout.js` — Server Component: calls `getTenantId()` +
  `getTenantFeatures(tenantId)`. Fails closed: `features = { invoicing: false }`
  if no tenant.
- `DashboardLayoutClient.jsx` — wraps children in
  `<FeatureFlagsProvider value={features}>`, first wrapper inside the
  Suspense-compatible inner function. Mounts `ChatProvider`,
  `TooltipProvider`, `DashboardSidebar`, `BottomTabBar`, `GridTexture`,
  `DashboardTour`, `SetupChecklistLauncher`, banners.

### Banners

- `ImpersonationBanner` (z-40, amber) — rendered when `?impersonate=` query
  param is present; admin impersonation mode wraps layout in
  `pointer-events-none opacity-60`.
- `BillingWarningBanner` (z-39) — amber during the `past_due` 3-day grace
  countdown + Stripe portal link; once grace expires it switches to a **RED
  "Payment failed — your AI receptionist is paused" suspended variant**
  (2026-06-12 — the agent gate has stopped answering; the banner used to hide
  post-grace expecting a middleware redirect that never existed). **Not
  dismissible** (dismiss button removed 2026-06-12).
- `TrialCountdownBanner` (z-39, blue >3d / amber ≤3d) — trial days +
  upgrade CTA. **Not dismissible** (2026-06-12).

### Navigation

**`DashboardSidebar`** — desktop-only (lg+). 7 nav items (Inquiries
removed in the 2026-06-10 merge): Home, Jobs, **Customers** (prod-readiness
2026-06, `Contact` icon), Calendar, Calls, Invoices, More. The
Invoices entry is filtered out when `invoicing=false`
(`NAV_ITEMS.filter(...)`). Sidebar uses `bg-[var(--sidebar-bg)]` — navy in
light mode, neutral dark in dark mode (see Section 12). Between Ask Voco AI
button and Log Out: theme toggle (sun/moon) via `next-themes.setTheme`.

> **Note**: Customers is NOT a `BottomTabBar` tab (still 5 tabs on mobile).
> Mobile reaches Customers via the `/dashboard/more` Business section
> (see Section 14).

**`BottomTabBar`** — mobile-only (`lg:hidden`). 5 tabs: Home, Calls,
Jobs, **Calendar**, More. The Inquiries tab (Phase 59 / D-08) was removed
in the 2026-06-10 merge — its queue lives in Calls — and the freed slot
**re-promoted Calendar** (which Phase 59 had demoted to the More menu to
stay at the 5-tab mobile safe limit; it also remains in More → Business).
Animated orange indicator (framer-motion spring).
Uses `bg-card border-t border-border` for dark-mode compatibility.
`data-tour="bottom-nav"`.

### Attention badges (2026-06-10)

Both `DashboardSidebar` and `BottomTabBar` render ONE numeric attention
badge — on **Calls** — fed by **`src/hooks/useAttentionCounts.js`**, which
exports a combined **`callsAttention` = `openInquiries` (stats
`newLeadsCount` = open inquiries) + `missedCallsToday`** alongside the two
raw counts. (Pre-merge there were two badges: Inquiries=openInquiries,
Calls=missedCallsToday — the Inquiries nav item is gone, so Calls carries
the combined "needs you" count.)

Hook mechanics: `useSWRFetch('/api/dashboard/stats', { refreshInterval:
60_000, revalidateOnFocus: true })` — **same SWR key as the Home tiles**, so
sidebar + tab bar + tiles share one in-flight request. `formatBadgeCount()`
caps display at **"9+"**. Badge is brand-accent pill (`bg-[var(--brand-accent)]`,
`tabular-nums`), `aria-hidden`, **hidden entirely at 0**; the count is
surfaced to AT via the nav `Link`'s `aria-label` instead —
`"Calls, N need(s) attention"` (no `aria-label` when the count is 0).
Sidebar badge sits `ml-auto` in the row; tab-bar badge is absolutely
positioned on the icon.

### FeatureFlagsProvider (Phase 53)

`src/components/FeatureFlagsProvider.jsx` — Context + `useFeatureFlags()`
hook. Mounted server-side per request. Default value:
`{ invoicing: false }` — fail-closed. Phase 53 consumers:
`DashboardSidebar`, `LeadFlyout`, `/dashboard/more/page.js`,
`/dashboard/more/features/page.js`. Phase 54 consumer:
`BusinessIntegrationsClient` (invoicing-aware status-line copy).

---
