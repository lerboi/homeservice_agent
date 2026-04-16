# Phase 53: Feature flag infrastructure + invoicing toggle — Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a tenant-level feature-flag column and gate the entire invoicing surface behind the `invoicing` flag — turning Phase 33-35's internal invoicing engine into an opt-in feature so v6.0 can focus Voco on the Call System. Scope:

- New migration `051_features_enabled.sql` — `tenants.features_enabled` JSONB NOT NULL DEFAULT `'{"invoicing": false}'::jsonb` for all tenants (existing + new)
- Gate 3 dashboard pages (`/dashboard/invoices/**`, `/dashboard/estimates/**`, `/dashboard/more/invoice-settings`) via `src/proxy.js` matcher extension
- Gate 4 API groups (`/api/invoices/**`, `/api/estimates/**`, `/api/accounting/**`, `/api/invoice-settings`) via a shared `getTenantFeatures(tenantId)` helper called in each route
- Gate 2 crons (`/api/cron/invoice-reminders`, `/api/cron/recurring-invoices`) via a WHERE clause filtering tenants by flag
- Conditionally hide UI surfaces: `DashboardSidebar` Invoices entry, `BottomTabBar` Invoices tab, `LeadFlyout` Create Invoice / Create Estimate CTAs, `/dashboard/more` menu invoice-settings + accounting-integrations links
- New `/dashboard/more/features` panel — dedicated always-accessible surface hosting the invoicing toggle; scales to future phases (could host Jobber/Xero flags if the project decides those need flags)
- Client-side flag distribution: dashboard `layout.js` server-fetches flags, passes into a new `<FeatureFlagsProvider>` client boundary; client components consume via `useFeatureFlags()` hook

Explicitly **out of scope** (hard boundaries, do not cross):

- No deletion or modification of existing invoice/estimate records (TOGGLE-04 reversibility)
- No changes to Phase 35's Jobber/Xero PUSH code semantics — it stays as-is but inherits the same flag gating (already in `/api/accounting/**` surface)
- No other feature flags added — this phase introduces the mechanism with `invoicing` as the sole flag; future phases add their own flags via the same JSONB column
- No admin-panel UI for support to toggle tenant flags (deferred; toggle is owner-self-serve only in Phase 53)
- No setup-checklist integration changes (checklist can be tackled in Phase 58 alongside `connect_jobber` / `connect_xero` items)
- No voice agent / call processor changes — the LiveKit agent doesn't read feature flags in v6.0

</domain>

<decisions>
## Implementation Decisions

### Gate Enforcement (D-01)
- **D-01:** Hybrid gate strategy — three code paths keyed to surface type:
  - **Dashboard pages:** Extend `src/proxy.js` matcher to include `/dashboard/invoices/:path*`, `/dashboard/estimates/:path*`, `/dashboard/more/invoice-settings`. Add a gate block (mirroring the admin gate at `src/proxy.js:41-61`) that reads `features_enabled.invoicing` from the existing tenant query and redirects to `/dashboard` when false.
  - **APIs:** Shared helper `getTenantFeatures(tenantId): Promise<{invoicing: boolean, ...}>` in `src/lib/features.js` (or similar). Each gated API route early-returns 404 when the relevant flag is off. No proxy matcher extension for `/api/**` (avoids Supabase round-trip per API call).
  - **Crons:** `/api/cron/invoice-reminders` and `/api/cron/recurring-invoices` filter their tenant-iteration query with `WHERE features_enabled->>'invoicing' = 'true'`. Skipped tenants are not logged as errors.

### Flag Distribution to UI (D-02)
- **D-02:** Server-fetch + Context Provider hybrid:
  - Dashboard `src/app/dashboard/layout.js` (Server Component) calls `getTenantFeatures()` once per request.
  - Layout wraps dashboard tree in a new `<FeatureFlagsProvider value={flags}>` client component (thin Context wrapper in `src/components/FeatureFlagsProvider.jsx`).
  - Client components (`LeadFlyout.jsx`, `BottomTabBar.jsx`) consume via `useFeatureFlags()` hook to conditionally render invoice CTAs / tab.
  - Server-rendered children (`DashboardSidebar.jsx`, More menu page) read flags as props from layout (no context needed there).
  - One DB query per page load — matches existing tenant-fetch pattern in proxy.js.

### Toggle Placement + Flip-Off UX (D-03)
- **D-03:** New dedicated panel at `/dashboard/more/features`:
  - Always accessible (never gated by any flag). Lists feature toggles with short descriptions.
  - Scalable to future flags — design for N toggles, not a single hardcoded invoicing checkbox.
  - Placement: new entry in `/dashboard/more` menu labeled "Features" (permanent item, above or below Integrations).
- **D-04:** Flip-off confirmation is **conditional** on whether records exist:
  - Before flipping `invoicing` OFF, fetch counts: `invoices.count` + `estimates.count` scoped to tenant.
  - If either count > 0: show confirmation dialog: "You have {N} invoice(s) and {M} estimate(s). Disabling will hide the invoicing surface from your dashboard but your data is preserved. You can re-enable anytime from this page. Continue?"
  - If both counts = 0: silent toggle (no dialog).
  - Flip-on is always silent.
- **D-05:** Toggle persistence: single PATCH request to a new `/api/tenant/features` route (RLS: owner-only via existing tenant ownership check). Optimistic UI update; rollback on error.

### Route-Off Response (D-06)
- **D-06:** Mixed response by surface type:
  - **APIs** (`/api/invoices/**`, `/api/estimates/**`, `/api/accounting/**`, `/api/invoice-settings`): return `404 Not Found` with no body (matches REST standard; no info leak about flag state).
  - **Crons:** tenant-skip is silent at the query level (WHERE filter) — skipped tenants never enter the iteration loop.
  - **Dashboard pages:** silent `NextResponse.redirect(/dashboard)` from proxy. No query param, no toast. Users who re-enable later can bookmark the page again.

### Migration + Defaults (D-07)
- **D-07:** Migration `051_features_enabled.sql`:
  - `ALTER TABLE tenants ADD COLUMN features_enabled JSONB NOT NULL DEFAULT '{"invoicing": false}'::jsonb;`
  - No backfill needed — DEFAULT applies to existing rows on column add.
  - v6.0 Key Decision locks this: default OFF for ALL tenants, including dev's own tenant. Dev re-enables via the toggle post-migration to test invoicing workflows.
  - Column is JSONB (not boolean) so future phases extend the same column instead of adding columns per flag.
  - RLS: no change needed — `tenants` table already has owner-scoped policies; flag reads + writes piggyback.

### LeadFlyout Behavior (D-08)
- **D-08:** When `invoicing = false`:
  - "Create Invoice" and "Create Estimate" buttons do NOT render (not disabled — removed from DOM).
  - Any existing per-lead invoice/estimate badges or linked counts on the flyout are hidden (consistent rule: no invoicing UI anywhere when flag off).
  - Lead records themselves remain visible — only the invoicing cross-links disappear.

### Claude's Discretion
- Helper signature shape: `getTenantFeatures(tenantId): Promise<{invoicing: boolean}>` vs `isFeatureEnabled(tenantId, name): Promise<boolean>` — planner picks whichever reads cleaner at call sites. The JSONB-returning shape is slightly preferred because a single DB read can return multiple flags when more are added.
- Whether `/dashboard/more/features` uses the existing More-menu card visual pattern (like Integrations, Services Pricing) or a dedicated layout — pick whichever matches sibling pages.
- Exact dialog copy for the flip-off confirmation — match tone of existing dashboard toasts/dialogs.
- Whether to emit a telemetry event on toggle flip (activity_log entry) — low-cost nice-to-have; add if it fits the existing activity_log pattern.
- Client component boundary placement: `<FeatureFlagsProvider>` can wrap the whole dashboard tree or only the subtree that needs it. Layout-level wrap is cleanest; planner confirms.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + Scope
- `.planning/REQUIREMENTS.md` §"Invoicing Toggle (Phase 53)" lines 16-21 — TOGGLE-01, TOGGLE-02, TOGGLE-03, TOGGLE-04 requirement text
- `.planning/ROADMAP.md` line 192 — Phase 53 checklist entry with full route/UI surface list
- `.planning/ROADMAP.md` lines 204-212 — v6.0 Key Decisions (invoicing default OFF, accounting_credentials reuse, etc.)
- `.planning/PROJECT.md` lines 11-24 — v6.0 milestone goal and target features
- `.planning/PROJECT.md` line 124 — Key Decision: "Invoicing as optional toggleable feature, not core"

### Prior Phase Context (patterns to mirror)
- `src/proxy.js:41-61` — Admin gate pattern (existence + rewrite to forbidden page). Template for page gate shape.
- `src/proxy.js:107-135` — Subscription gate pattern (tenant fetch + conditional action). Template for flag lookup.
- `src/proxy.js:142` — Matcher config. Phase 53 extends this list with invoicing page paths.
- `src/proxy.js:77-82` — Existing tenant fetch in proxy. Phase 53 extends this SELECT to include `features_enabled`.

### Gated Dashboard Pages (move or guard)
- `src/app/dashboard/invoices/page.js` + children (`[id]/`, `batch-review/`, `new/`, `loading.js`)
- `src/app/dashboard/estimates/**`
- `src/app/dashboard/more/invoice-settings/page.js`

### Gated APIs (early-return 404)
- `src/app/api/invoices/**`
- `src/app/api/estimates/**`
- `src/app/api/accounting/**`
- `src/app/api/invoice-settings/**`

### Gated Crons (WHERE clause filter)
- `src/app/api/cron/invoice-reminders/route.js`
- `src/app/api/cron/recurring-invoices/route.js`

### UI Hide Targets
- `src/components/dashboard/DashboardSidebar.jsx` — Invoices nav entry
- `src/components/dashboard/BottomTabBar.jsx` — mobile Invoices tab
- `src/components/dashboard/LeadFlyout.jsx` — Create Invoice / Create Estimate CTAs
- `src/app/dashboard/more/page.js` — invoice-settings + accounting-integrations links

### New Files to Create (planner confirms exact paths)
- `supabase/migrations/051_features_enabled.sql` — migration for the new column
- `src/lib/features.js` (or similar) — `getTenantFeatures(tenantId)` helper
- `src/components/FeatureFlagsProvider.jsx` — React Context + `useFeatureFlags()` hook
- `src/app/dashboard/more/features/page.js` — dedicated toggle panel
- `src/app/api/tenant/features/route.js` — PATCH endpoint for toggle persistence

### Architectural Skills (read before implementing, update after)
- `auth-database-multitenancy` — for the new migration, RLS pattern on `tenants`, `getTenantId()` usage in the helper
- `dashboard-crm-system` — for layout.js changes, client/server boundary placement, More menu conventions, sidebar entry patterns
- `payment-architecture` — reference for cron tenant-skip pattern (already used for subscription-gated crons)

### Existing Migration Sequence
- `supabase/migrations/050_checklist_overrides.sql` — latest migration; next is `051_features_enabled.sql`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/proxy.js` already fetches `tenants` row (lines 77-82) for onboarding check. Extending the SELECT to `onboarding_complete, id, features_enabled` piggybacks on that query — no extra DB round-trip for the page gate.
- `src/proxy.js`'s admin gate pattern (lines 41-61) shows exactly how to early-return from the matcher with a rewrite or redirect. Phase 53's page gate mirrors this shape.
- `src/proxy.js` matcher syntax (line 142) is already a list of Next.js path patterns — extending it is a one-line change per gated subtree.
- The `tenants` table already has owner-scoped RLS — no new RLS work for the flag column.
- JSONB operators (`->>`, `->`) are available in the existing Postgres instance; cron WHERE clauses can filter directly (`features_enabled->>'invoicing' = 'true'`).

### Established Patterns
- Server Components fetch tenant data; client components receive data via props or context. The existing dashboard doesn't use a tenant-wide Context provider, so `<FeatureFlagsProvider>` is a greenfield but small addition — follows React + Next.js App Router conventions.
- API routes use `getTenantId()` (per auth-database-multitenancy skill) to resolve tenant. The `getTenantFeatures()` helper composes with `getTenantId()` cleanly.
- Crons iterate tenants via `admin.from('tenants').select(...)` with service role — adding a `.filter('features_enabled->>invoicing', 'eq', 'true')` is standard Supabase JS syntax.
- Dialogs are rendered via shadcn `<AlertDialog>` components already present in the dashboard (per existing LeadFlyout + flows). No new dialog primitive needed.

### Integration Points
- **Proxy matcher:** `src/proxy.js:142` — add 3 page path patterns.
- **Proxy gate block:** insert new block inside `if (user)` branch between subscription gate (line 107) and the final `return response`. Reads `tenant.features_enabled` from the existing fetch.
- **Layout fetch:** `src/app/dashboard/layout.js` (if exists as Server Component — confirm; may be page-level layout) adds `features_enabled` to its tenant query, passes to provider.
- **LeadFlyout:** `src/components/dashboard/LeadFlyout.jsx` — wrap Create Invoice / Create Estimate buttons in `{invoicing && (...)}`.
- **Sidebar/BottomTabBar:** conditional render of Invoices entry based on `features.invoicing`.
- **More menu page:** filter the link list based on flags.
- **Crons:** update the tenant-fetch query; add a short log line when skipping for observability.

### Blast Radius
- ~15 source files touched: 1 migration, 1 helper, 1 provider component, 1 new page + loading, 1 new API route, 1 proxy.js update, 4-5 dashboard components (sidebar, bottomtabbar, leadflyout, more page, layout), 2 cron routes, plus any API routes that need the early-return helper call (4 API groups × ~1 file each at minimum).
- No test-file sprawl — the helper is small and pure; gate behavior is exercised via integration of page + API.

### Known Pitfalls
- `src/proxy.js` runs for every matched request. The existing tenant fetch is already there; DO NOT add a second fetch — extend the SELECT instead.
- `features_enabled` is JSONB; always default-check via `features_enabled?.invoicing === true` to handle missing keys (future-proofs when new flags are added without a backfill).
- The dev's own tenant needs invoicing RE-ENABLED after migration to continue testing the existing invoice workflows during Phase 53 QA. The toggle must work end-to-end before migration is merged to ensure recoverability.
- LeadFlyout CTAs, Sidebar nav, BottomTabBar all need to update in the SAME commit that lands the gate — otherwise users see UI entries that lead to 404/redirects.

</code_context>

<specifics>
## Specific Ideas

- Feature panel UX intent: think "Settings → Labs" not "Billing → Downgrade." The toggle is a capability switch, not a destructive action. Visual treatment should feel additive ("turn on invoicing to track payments") not restrictive.
- The confirmation dialog for flip-off should emphasize **reversibility**, not warn about data loss — TOGGLE-04 preserves records, so framing it as "you can flip this back on anytime, data is kept" reduces hesitation.
- `/dashboard/more/features` is the planned home for future flags (e.g., if Phases 54-58 decide to gate Jobber / Xero behind per-tenant rollout flags). Design the page as a list-of-toggles, not a single invoicing checkbox.
- Name the helper `getTenantFeatures()` not `getFeatureFlags()` — "features" is the user-facing label on the panel, aligns with `features_enabled` column name, and doesn't invoke the "feature flag tooling" connotation (LaunchDarkly, etc.) that suggests infrastructure we don't have.

</specifics>

<deferred>
## Deferred Ideas

- Admin dashboard UI for support reps to flip per-tenant flags — valuable for customer support but not required for Phase 53. Could land in Phase 58 or a later ops-improvement phase.
- Setup-checklist integration — should the checklist auto-hide invoice-related items when `invoicing = false`? This is a small addition but belongs in Phase 58 (which reworks the setup checklist for `connect_jobber` / `connect_xero`).
- Telemetry dashboard for flag-flip events (how many tenants have invoicing on, how often toggled) — not required for Phase 53. Could add activity_log entries now and build the analytics view later.
- Per-user (vs per-tenant) feature flags — the JSONB is tenant-level. If later work needs per-user toggles (e.g., technician-specific), that's a new column + different Provider scope.
- LaunchDarkly / Unleash / Growthbook integration — over-engineering for v6.0's single flag. The JSONB column is the right shape until we have a real need for progressive rollouts or cohort targeting.
- Voice agent flag awareness — the LiveKit agent doesn't read features in v6.0. If future phases need the agent to behave differently based on flags (e.g., mention invoicing during calls only when enabled), that's a separate phase.

</deferred>

---

*Phase: 53-feature-flag-infrastructure-invoicing-toggle*
*Context gathered: 2026-04-16*
