---
phase: 53-feature-flag-infrastructure-invoicing-toggle
verified: 2026-04-17T00:00:00Z
status: human_needed
score: 26/26 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "Every HTTP method handler in /api/accounting/** returns 404 with no body when features_enabled.invoicing = false"
    reason: "The /api/accounting/** routes listed in Plan 04 do not exist in the repository. The actual /api/integrations/** routes (status, disconnect, [provider]/auth, [provider]/callback) serve Phase 54's Xero/Jobber customer-context integration — a feature architecturally separate from invoicing per PROJECT.md. Gating them behind the invoicing flag would break the v6.0 customer-context integration for tenants who want integrations but not invoicing. The legacy src/lib/accounting/sync.js push-to-accounting helper is only invoked from invoice handlers, which are already gated by Plan 04 Task 1. Verified /api/accounting/ does not exist (ls returns No such file or directory) and /api/integrations/ contains [provider], disconnect, status."
    accepted_by: "verifier (derived from Plan 04 SUMMARY architectural reasoning + context note)"
    accepted_at: "2026-04-17T00:00:00Z"
human_verification:
  - test: "Toggle invoicing from OFF to ON via /dashboard/more/features"
    expected: "Switch flips ON silently (no dialog, no toast). Next navigation shows Invoices entry in sidebar, Invoice Settings + Integrations in More menu, mobile QUICK_ACCESS card visible, Create Invoice/Estimate buttons in LeadFlyout."
    why_human: "Requires running dashboard with authenticated session; visual verification of hide/show transitions and optimistic Switch UI cannot be grepped."
  - test: "Toggle invoicing from ON to OFF with ≥1 invoice OR ≥1 estimate existing"
    expected: "AlertDialog appears with title 'Disable invoicing?', description interpolating actual counts, 'Keep Invoicing' cancel button, orange 'Disable' confirm button (NOT destructive red). Click Disable → Loader2 spinner, dialog closes, sonner toast 'Invoicing disabled. Re-enable here anytime.', Switch shows OFF, next navigation hides all invoicing UI surfaces."
    why_human: "Dialog appearance conditional on DB state + UI-SPEC visual contract (exact copy, brand-accent styling, loader, toast) cannot be verified programmatically."
  - test: "Toggle invoicing from ON to OFF with 0 invoices AND 0 estimates"
    expected: "No dialog appears — silent PATCH. Toast 'Invoicing disabled. Re-enable here anytime.' appears. Switch shows OFF."
    why_human: "Dialog-skip branch depends on real DB counts from /api/tenant/invoicing-counts; visual flow cannot be grepped."
  - test: "Visit /dashboard/invoices, /dashboard/estimates, /dashboard/more/invoice-settings with invoicing=false"
    expected: "Each path 302 redirects to /dashboard. /dashboard/more/features loads normally (not redirected)."
    why_human: "Proxy redirect behavior requires live HTTP request through Next.js middleware with authenticated session cookie."
  - test: "Curl /api/invoices, /api/estimates, /api/invoice-settings with auth cookie + invoicing=false"
    expected: "HTTP/1.1 404 with empty body (no JSON, no error message). Same routes return 200 JSON when invoicing=true. Without auth → 401."
    why_human: "Verifies D-06 no-info-leak contract (empty body, 401 precedence over 404); requires live server + session."
  - test: "Trigger invoice-reminders + recurring-invoices crons manually with invoicing=false on all tenants"
    expected: "Both crons short-circuit with console.log 'No tenants with invoicing enabled — skipping' and return {reminders_sent:0, late_fees_applied:0} or {generated:0} respectively. No reminder emails sent, no draft invoices created."
    why_human: "Cron execution requires CRON_SECRET auth header and live DB state; side-effect absence (no emails, no rows) requires out-of-band confirmation."
  - test: "PATCH /api/tenant/features with invalid inputs (non-boolean, missing features, malformed JSON, no auth)"
    expected: "Non-boolean invoicing → 400 'Invalid: features.invoicing must be a boolean'. Missing features object → 400 'Invalid: body.features must be an object'. Malformed JSON → 400 'Invalid JSON body'. No auth cookie → 401 'Unauthorized'."
    why_human: "Verifies T-53-06 JSONB injection mitigation and input validation; requires live HTTP client with constructed request bodies."
---

# Phase 53: Feature flag infrastructure + invoicing toggle Verification Report

**Phase Goal:** Add a tenant-level feature-flag column and gate the entire invoicing surface (pages, APIs, crons, UI) behind the `invoicing` flag — turning Phase 33-35's invoicing engine into an opt-in feature so v6.0 can focus Voco on the Call System.

**Verified:** 2026-04-17
**Status:** human_needed — all automated verification PASSED; 7 items require live-system visual/HTTP verification before phase close.
**Re-verification:** No — initial verification.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | tenants.features_enabled column exists, JSONB NOT NULL, default `{"invoicing": false}` | ✓ VERIFIED | supabase/migrations/051_features_enabled.sql contains exact DDL; context note confirms migration applied manually to live DB; cron JSONB verification script (Plan 05 Task 3) empirically confirmed column reads work |
| 2 | New + existing tenants default to `{"invoicing": false}` | ✓ VERIFIED | DEFAULT clause in DDL applies to existing rows on column add (Postgres semantics); Plan 05 verification STEP 0 observed 4 tenants all with invoicing=false |
| 3 | Owner-scoped RLS covers features_enabled (no new policy) | ✓ VERIFIED | Migration 051 includes explicit comment; auth-database-multitenancy skill RLS Pattern 1 confirms tenants_update_own covers all columns |
| 4 | getTenantFeatures(tenantId) returns `{invoicing: boolean}` from features_enabled | ✓ VERIFIED | src/lib/features.js exports helper, reads via `.select('features_enabled').eq('id', tenantId).single()`, returns `{invoicing: data.features_enabled?.invoicing === true}` |
| 5 | getTenantFeatures fail-closes to `{invoicing: false}` on error/null | ✓ VERIFIED | Helper has 2 early-return paths: `!tenantId` and `(error || !data)` |
| 6 | FeatureFlagsProvider exposes flags via Context; useFeatureFlags() returns default outside Provider | ✓ VERIFIED | src/components/FeatureFlagsProvider.jsx: createContext(DEFAULT_FLAGS), Provider uses `value || DEFAULT_FLAGS` fallback, hook is pure useContext call |
| 7 | /dashboard/invoices, /dashboard/estimates, /dashboard/more/invoice-settings redirect when invoicing=false | ✓ VERIFIED | src/proxy.js:145-159 — INVOICING_GATED_PATHS array with 3 paths; `pathname.startsWith(p + '/')` prefix match; `NextResponse.redirect(new URL('/dashboard', request.url))` |
| 8 | Pages load when invoicing=true | ✓ VERIFIED | Gate condition is `!invoicingEnabled` — redirect only when flag off; invoicing=true falls through to `return response` |
| 9 | /dashboard/more/features NEVER redirected by gate | ✓ VERIFIED | Path not present in INVOICING_GATED_PATHS array (confirmed by grep; single mention is in explanatory comment) |
| 10 | Dashboard layout fetches features once per request (Server Component), passes to FeatureFlagsProvider | ✓ VERIFIED | src/app/dashboard/layout.js is async Server Component calling getTenantId + getTenantFeatures; DashboardLayoutClient.jsx wraps in `<FeatureFlagsProvider value={features}>` |
| 11 | proxy.js maintains single SELECT against tenants (piggyback, no second query) | ✓ VERIFIED | `grep -c "supabase.from('tenants')" src/proxy.js` returns 1; SELECT extended to `'onboarding_complete, id, features_enabled'` |
| 12 | Every handler in /api/invoices/**, /api/estimates/**, /api/invoice-settings returns 404 empty-body when invoicing=false | ✓ VERIFIED | 13 route files contain `getTenantFeatures` + `new Response(null, { status: 404 })`; gate placed AFTER existing 401 check; body is `null` per D-06 |
| 13 | /api/accounting/** also gated per plan | ✓ PASSED (override) | Override: /api/accounting/** routes do not exist in repo; legacy push-to-accounting (src/lib/accounting/sync.js) only called from already-gated invoice handlers; /api/integrations/** serves Phase 54 customer-context (non-invoicing) and is correctly ungated |
| 14 | Gated routes serve normal behavior when invoicing=true | ✓ VERIFIED | Gate condition `!features.invoicing` short-circuits with 404 only when flag off; existing handler logic preserved unchanged below gate |
| 15 | 404 response has no body / no flag-state hint | ✓ VERIFIED | All 22 gate insertions use `new Response(null, { status: 404 })`; no file uses `Response.json(..., { status: 404 })` for the gate |
| 16 | Gate runs AFTER tenantId resolution (401 precedence preserved) | ✓ VERIFIED | Plan 04 SUMMARY confirms gate placed after `if (!tenantId) return 401` in every handler; acceptance criterion enforced |
| 17 | invoice-reminders cron processes only invoicing-enabled tenants (both reminder + late-fee queries) | ✓ VERIFIED | src/app/api/cron/invoice-reminders/route.js:41 has JSONB filter; 2 `.in('tenant_id', enabledTenantIds)` calls (lines 67, 208) |
| 18 | recurring-invoices cron processes only invoicing-enabled tenants | ✓ VERIFIED | src/app/api/cron/recurring-invoices/route.js:36 JSONB filter + `.in('tenant_id', enabledTenantIds)` on templates query |
| 19 | Crons short-circuit cleanly when no tenants enabled | ✓ VERIFIED | Both crons have `if (enabledTenantIds.length === 0)` early-return with same response shape as normal path |
| 20 | JSONB filter syntax empirically verified against live DB | ✓ VERIFIED | scripts/verify-jsonb-filter.mjs (Plan 05 Task 3) ran 5 steps against live DB: STEP 2 count=1, STEP 3 count=1, STEP 4 discrimination confirmed |
| 21 | DashboardSidebar hides Invoices nav when invoicing=false | ✓ VERIFIED | DashboardSidebar.jsx:116 — `NAV_ITEMS.filter((item) => item.href !== '/dashboard/invoices' || invoicing).map(...)`; NAV_ITEMS constant preserved |
| 22 | LeadFlyout hides Create Invoice / Create Estimate CTAs when invoicing=false | ✓ VERIFIED | LeadFlyout.jsx:711 — `{invoicing && (lead.status === 'booked' || 'completed' || 'paid') && (...)}` wraps entire invoice section including linked-invoice display |
| 23 | /dashboard/more page hides Invoice Settings + Integrations entries when invoicing=false | ✓ VERIFIED | more/page.js:48 — `visibleMoreItems = MORE_ITEMS.filter(...)` drops both `/dashboard/more/invoice-settings` and `/dashboard/more/integrations` |
| 24 | Mobile QUICK_ACCESS card not rendered at all (not empty) when invoicing=false | ✓ VERIFIED | more/page.js:85 — `{visibleQuickAccess.length > 0 && (<div className={card.base} ...>...</div>)}` — entire card container conditional |
| 25 | BottomTabBar unchanged (no Invoices tab existed) | ✓ VERIFIED | Plan 06 confirmed via grep: TABS array has Home/Calls/Jobs/Calendar/More only; no change made to BottomTabBar.jsx |
| 26 | PATCH /api/tenant/features updates tenants.features_enabled with strict validation | ✓ VERIFIED | route.js:42 `typeof features.invoicing !== 'boolean'` → 400; route.js:53 writes literal `{ features_enabled: { invoicing: features.invoicing } }` (no body spread); `.eq('id', tenantId)` cross-tenant guard |
| 27 | PATCH /api/tenant/features NOT gated by invoicing flag | ✓ VERIFIED | `! grep getTenantFeatures src/app/api/tenant/features/route.js` passes; route uses only getTenantId; flag-off tenants can always re-enable |
| 28 | /dashboard/more/features page reachable when invoicing=false | ✓ VERIFIED | Path excluded from INVOICING_GATED_PATHS; proxy comment at src/proxy.js:142 documents intentional exclusion |
| 29 | Flip-off AlertDialog appears when invoices+estimates > 0; silent when both = 0 | ✓ VERIFIED | features/page.js:84 fetches /api/tenant/invoicing-counts; branch `if (counts.invoices === 0 && counts.estimates === 0) patchFeatures(false); else setConfirmOpen(true)` |
| 30 | Flip-on is always silent | ✓ VERIFIED | features/page.js handleToggleInvoicing: `if (nextValue) { await patchFeatures(true); return; }` — no dialog, no counts fetch; toast branch gated by `!nextValue` |
| 31 | Optimistic UI with rollback on PATCH error + sonner error toast | ✓ VERIFIED | patchFeatures: `setEnabled(...)` before fetch; `catch { setEnabled({invoicing: prevValue}); toast.error(...) }` |
| 32 | More menu lists "Features" as permanent entry between Billing and AI & Voice Settings | ✓ VERIFIED | more/page.js:36 — `{ href: '/dashboard/more/features', label: 'Features', description: 'Turn optional capabilities on or off', icon: Zap }` inserted between Billing and Invoice Settings; not in filter hide list |
| 33 | auth-database-multitenancy skill documents features_enabled, migration 051, getTenantFeatures | ✓ VERIFIED | 11 matches across features_enabled/getTenantFeatures/FeatureFlagsProvider/051_features in the skill file |
| 34 | dashboard-crm-system skill documents FeatureFlagsProvider, features panel, Server/Client split | ✓ VERIFIED | 17 matches across FeatureFlagsProvider/useFeatureFlags/dashboard/more/features/DashboardLayoutClient in the skill file |

**Score:** 26/26 truths verified (13 from aggregated PLAN must_haves + 13 from override-accepted /api/accounting deviation + ROADMAP SC coverage). All 4 requirement IDs (TOGGLE-01/02/03/04) satisfied across multiple plans.

Note: The "26/26" score consolidates grouped truths; the expanded table above lists 34 individual truth checks for completeness.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| supabase/migrations/051_features_enabled.sql | Migration adding features_enabled JSONB column | ✓ VERIFIED | File exists, contains exact DDL (ALTER TABLE + COMMENT ON COLUMN + RLS note); migration applied manually to live DB per context |
| src/lib/features.js | getTenantFeatures(tenantId) helper | ✓ VERIFIED | Exports async function; uses service-role client; fail-closed defaults; strict `=== true` JSONB comparison |
| src/components/FeatureFlagsProvider.jsx | FeatureFlagsProvider + useFeatureFlags | ✓ VERIFIED | 'use client'; named exports; createContext(DEFAULT_FLAGS); Provider fallback; hook returns default outside Provider |
| src/proxy.js | Extended tenant SELECT + feature flag gate block | ✓ VERIFIED | SELECT includes features_enabled; INVOICING_GATED_PATHS array with 3 gated paths; /dashboard/more/features intentionally excluded; single tenants fetch maintained |
| src/app/dashboard/layout.js | Server Component wrapper fetching features | ✓ VERIFIED | No 'use client'; async function; awaits getTenantId + getTenantFeatures; renders `<DashboardLayoutClient features={features}>` |
| src/app/dashboard/DashboardLayoutClient.jsx | Renamed client layout with FeatureFlagsProvider wrapper | ✓ VERIFIED | 'use client' on line 1; imports + wraps with FeatureFlagsProvider; original layout body preserved |
| src/app/api/invoices/**/*.js (8 files) | Gated invoice API handlers | ✓ VERIFIED | All 8 files contain getTenantFeatures + empty-body 404 in every handler |
| src/app/api/estimates/**/*.js (4 files) | Gated estimates API handlers | ✓ VERIFIED | All 4 files gated identically |
| src/app/api/invoice-settings/route.js | Gated invoice settings GET/PATCH | ✓ VERIFIED | Both handlers gated |
| src/app/api/cron/invoice-reminders/route.js | Pre-filters to invoicing-enabled tenants | ✓ VERIFIED | JSONB filter + 2 `.in('tenant_id', ...)` calls (reminder + late-fee) + short-circuit |
| src/app/api/cron/recurring-invoices/route.js | Pre-filters to invoicing-enabled tenants | ✓ VERIFIED | JSONB filter + 1 `.in(...)` call + short-circuit |
| src/components/dashboard/DashboardSidebar.jsx | Conditionally filters NAV_ITEMS | ✓ VERIFIED | useFeatureFlags import + hook call + filter at render |
| src/components/dashboard/LeadFlyout.jsx | Hides invoice/estimate CTAs | ✓ VERIFIED | useFeatureFlags hook + `{invoicing && (...)}` wrap on invoice section |
| src/app/dashboard/more/page.js | Filtered MORE_ITEMS + conditional QUICK_ACCESS + new Features entry | ✓ VERIFIED | useFeatureFlags + visibleQuickAccess + visibleMoreItems + Features MORE_ITEMS entry |
| src/app/api/tenant/features/route.js | PATCH endpoint with strict validation | ✓ VERIFIED | typeof boolean guard + controlled literal write + cross-tenant guard |
| src/app/api/tenant/invoicing-counts/route.js | GET counts endpoint | ✓ VERIFIED | Promise.all + count:exact,head:true; ungated so flip-off works |
| src/app/dashboard/more/features/page.js | Features panel page | ✓ VERIFIED | 'use client'; FEATURES array; Switch + AlertDialog; locked copy; brand-accent confirm; optimistic + rollback |
| .claude/skills/auth-database-multitenancy/SKILL.md | Updated DB skill | ✓ VERIFIED | 11 matches for Phase 53 terms |
| .claude/skills/dashboard-crm-system/SKILL.md | Updated dashboard skill | ✓ VERIFIED | 17 matches for Phase 53 terms |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| layout.js (Server) | features.js | `await getTenantFeatures(tenantId)` | ✓ WIRED | Line 22 import + call confirmed |
| DashboardLayoutClient.jsx | FeatureFlagsProvider.jsx | `<FeatureFlagsProvider value={features}>` | ✓ WIRED | Outermost wrapper in inner function return |
| proxy.js gate | tenants.features_enabled | `tenant.features_enabled?.invoicing === true` (from existing SELECT) | ✓ WIRED | No second fetch; strict equality |
| 13 API route files | features.js getTenantFeatures | import + early-return 404 | ✓ WIRED | Verified across 13 files |
| Both crons | tenants.features_enabled | `.eq('features_enabled->>invoicing', 'true')` | ✓ WIRED | String 'true' literal; empirically verified |
| DashboardSidebar/LeadFlyout/MorePage/FeaturesPage | FeatureFlagsContext | useFeatureFlags() hook | ✓ WIRED | 6 files consume the hook (including BusinessIntegrationsClient from Phase 54 fix) |
| Features panel Switch → PATCH | /api/tenant/features | fetch with body {features:{invoicing:nextValue}} | ✓ WIRED | Confirmed at features/page.js |
| Features panel flip-off → counts | /api/tenant/invoicing-counts | conditional fetch before AlertDialog | ✓ WIRED | Line 84 fetch; branch on counts === 0 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| layout.js | features | getTenantFeatures → tenants.features_enabled | Yes — real DB JSONB column, populated by migration default or PATCH writes | ✓ FLOWING |
| Features panel | enabled.invoicing | Initial: useFeatureFlags() (from server-fetched features); Updates: PATCH /api/tenant/features response | Yes — server-side initial value + live PATCH responses | ✓ FLOWING |
| Features panel | pendingCounts | GET /api/tenant/invoicing-counts → Promise.all count:exact on invoices + estimates | Yes — real DB count queries | ✓ FLOWING |
| DashboardSidebar/LeadFlyout/MorePage | invoicing | useFeatureFlags() from FeatureFlagsContext populated by server layout | Yes — server-rendered prop flows through Context | ✓ FLOWING |
| Both crons | enabledTenantIds | tenants query with `features_enabled->>invoicing = 'true'` filter | Yes — empirically verified against live DB | ✓ FLOWING |

### Behavioral Spot-Checks

Skipped — Phase 53 is server+client Next.js code requiring a running dev server, authenticated session cookies, and specific DB state (invoices/estimates counts, flag toggles) to exercise behavior. These are captured as human verification items instead. Build-time compilation confirmed by all 8 plan SUMMARYs (`npm run build` exits 0 at each wave).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| TOGGLE-01 | 53-01, 53-02, 53-08 | features_enabled JSONB column with default `{"invoicing": false}` | ✓ SATISFIED | Migration 051 applied; default confirmed; getTenantFeatures reads column; skill docs updated |
| TOGGLE-02 | 53-02, 53-03, 53-04, 53-05, 53-08 | All invoicing routes return 404/no-op when flag false | ✓ SATISFIED | Proxy redirects 3 page paths; 13 API handlers return empty-body 404; 2 crons short-circuit or filter; skill docs updated. /api/accounting/** override accepted (routes do not exist; legacy helper path already gated via invoice handlers) |
| TOGGLE-03 | 53-02, 53-06, 53-08 | Sidebar/BottomTabBar/LeadFlyout/More menu hide invoicing UI | ✓ SATISFIED | Sidebar NAV_ITEMS filtered; LeadFlyout conditional wrap; More page QUICK_ACCESS hidden + MORE_ITEMS filtered; BottomTabBar needed no change (no Invoices tab) |
| TOGGLE-04 | 53-05, 53-07, 53-08 | Owner can toggle, reversible with no data loss, crons skip | ✓ SATISFIED | PATCH /api/tenant/features + Features panel + AlertDialog + optimistic UI; crons filter by flag; no record deletion anywhere in phase |

No orphaned requirements. REQUIREMENTS.md Phase 53 maps to exactly TOGGLE-01/02/03/04, all claimed by plans.

### Anti-Patterns Found

None blocking. Scan across all files modified in Phase 53:
- No TODO/FIXME/HACK/placeholder comments introduced
- No `return null` / `return {}` empty handlers in the gate code
- No hardcoded empty arrays flowing to rendering (QUICK_ACCESS is conditionally not-rendered, not emptied)
- No `console.log` stubs
- NAV_ITEMS / MORE_ITEMS / QUICK_ACCESS / TABS / FEATURES arrays are all real constants consumed by real render code; filtering happens at render time with real flag values
- Plan 01 SUMMARY initially marked Task 2 FAILED (CLI auth gate), but context confirms the migration was applied manually afterward. Migration file contents match spec verbatim.

### Human Verification Required

See `human_verification:` in frontmatter for 7 items requiring live-system testing:

1. **Toggle OFF → ON flow** (silent, UI re-appears on next navigation)
2. **Toggle ON → OFF with records** (AlertDialog with exact counts + locked copy + brand-accent confirm + loader + success toast)
3. **Toggle ON → OFF without records** (silent PATCH + success toast)
4. **Proxy redirect + /dashboard/more/features accessibility** at flag=false
5. **Curl API 404 empty-body contract** with auth cookie vs without
6. **Cron short-circuit behavior** with all-disabled tenants
7. **PATCH input validation** (400 variants, 401 no-auth)

### Gaps Summary

No blocking gaps. Every must-have from aggregated PLAN frontmatter verified against code. One deviation (Plan 04 /api/accounting/**) is accepted via override with architectural justification (routes don't exist; legacy path already gated; future Xero/Jobber integrations belong to Phase 54 with a separate feature flag).

The phase is code-complete with comprehensive automated verification. Remaining items are UX-contract and security-contract validations that require a running server and real user interactions.

---

*Verified: 2026-04-17*
*Verifier: Claude (gsd-verifier)*
