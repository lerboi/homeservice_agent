# Phase 54: Integration credentials foundation + Next.js 16 caching prep + sandbox provisioning — Context

**Gathered:** 2026-04-17
**Status:** Ready for UI-SPEC (frontend rewrite in scope) → then planning

<domain>
## Phase Boundary

Lay the plumbing that Phases 55 (Xero), 56 (Jobber), 57 (Jobber schedule), and 58 (checklist + telemetry) will build on. Deliver four things in one cohesive phase:

1. **New `src/lib/integrations/` module** — canonical home for all third-party business-system integrations going forward. Holds the shared `IntegrationAdapter` interface (getAuthUrl / exchangeCode / refreshTokenIfNeeded / fetchCustomerByPhone / revoke), HMAC OAuth state helpers, a `getIntegrationStatus(tenantId)` helper with Next.js 16 `"use cache"` + `cacheTag`, and a relocated/unified Xero adapter. QuickBooks and FreshBooks adapters are **deleted outright** (safe: v6.0 is still dev-only, no live tenants).

2. **Route scaffolding at `/api/integrations/**`** — `/api/integrations/[provider]/{auth,callback}` and `/api/integrations/{disconnect,status}` become canonical. The Phase 35 equivalents at `/api/accounting/[provider]/{auth,callback}` and `/api/accounting/{disconnect,status}` are **deleted** (not redirected). Tenant dev-console redirect URIs must be updated to the new `/api/integrations/xero/callback` path before merge — zero real risk since Xero + Jobber sandbox accounts don't exist yet.

3. **Migration `051_integrations_schema.sql`** — drop + recreate `accounting_credentials.provider` CHECK as `('xero','jobber')` (QuickBooks + FreshBooks rows purged in same migration); add `scopes TEXT[] NOT NULL DEFAULT '{}'`; add `last_context_fetch_at TIMESTAMPTZ` NULL. No new index — tenant-scoped selects covered by the existing `UNIQUE (tenant_id, provider)` index.

4. **Next.js 16 `cacheComponents: true` enabled** in `next.config.js` plus a full dashboard Server Component audit pass — every `src/app/dashboard/**` page/layout either calls `await cookies()`/`await headers()`, marks itself `'use cache'`, or applies `unstable_noStore` as appropriate. Smoke test: the new `getIntegrationStatus()` helper proves the `'use cache'` + `cacheTag` + `revalidateTag` (from disconnect/callback) loop end-to-end.

5. **Owner-facing frontend rewrite** — `/dashboard/more/integrations` heading renamed to "Business Integrations." Cards restructured provider-first with status lines ("Xero — Connected. Sharing customer context with your AI receptionist." / "... + sending invoices" when invoicing ON). Single "Connect Xero / Connect Jobber" button per provider, one OAuth flow, one unified scope bundle, one `accounting_credentials` row per provider.

Explicitly **out of scope** (hard boundaries):

- No actual `fetchCustomerByPhone` implementation for any provider — Phase 55 (Xero) and Phase 56 (Jobber) do the real fetch. Phase 54 ships stubs that throw `NotImplementedError`, routes that return `501 Not Implemented`, or equivalent.
- No webhook routes for cache invalidation — `/api/webhooks/xero` and `/api/webhooks/jobber` are Phase 55 + 56 work.
- No LiveKit agent (Python) changes — Phase 55+ reads credentials via service-role Supabase in `livekit-agent/`. Phase 54 only confirms the new schema shape is Python-compatible.
- No billing, usage, or subscription changes — read-side integrations never gate on Stripe state.
- No QuickBooks / FreshBooks "deprecation" period — deletion is immediate.
- No progressive scope disclosure / per-capability toggles — single-button unified-scope model; revisit only if real owner demand emerges.

</domain>

<decisions>
## Implementation Decisions

### Module boundary (Area 1)

- **D-01:** New directory `src/lib/integrations/` sibling to `src/lib/accounting/`. `integrations/` holds the unified provider adapters, interface typedef, OAuth state helper (if extracted), credentials I/O helpers, and the `'use cache'` status reader.
- **D-02:** Full consolidation — Phase 54 moves Phase 35's `src/lib/accounting/xero.js` into `src/lib/integrations/xero.js` as a single unified adapter (push methods + OAuth + read-side stubs). `src/lib/accounting/quickbooks.js` and `src/lib/accounting/freshbooks.js` are deleted outright, not migrated. `src/lib/accounting/{types,adapter,sync}.js` get refactored or relocated: interface typedef moves to `integrations/types.js`; adapter factory moves to `integrations/adapter.js`; `sync.js` stays in `accounting/` if it's push-only orchestration, or moves if it's generic — planner decides based on read-after-refactor clarity.
- **D-03:** Single unified OAuth per provider. One "Connect Xero" button requesting one combined scope bundle (`openid profile email accounting.transactions accounting.contacts offline_access` for Xero; the Jobber equivalent for Jobber). One `accounting_credentials` row per tenant × provider. Invoicing flag state never affects the OAuth flow — when OFF, Voco silently uses the connection for caller context only; when ON, invoice push ALSO runs on the same credentials.
- **D-04:** `/dashboard/more/integrations` renamed "Business Integrations" (page heading + nav label). Cards are provider-first (Xero card, Jobber card) with a status line describing what the connection is actively doing. Phase 54 implements this copy + restructure as part of the phase, not deferred.

### OAuth route topology (Area 2)

- **D-05:** `/api/accounting/[provider]/{auth,callback}` is **deleted**. Canonical OAuth entry becomes `/api/integrations/[provider]/{auth,callback}`. User updates Xero + Jobber dev-console redirect URIs to the new path during sandbox provisioning (pre-merge). No 308 redirects — clean cut is acceptable because Xero/Jobber sandbox accounts don't exist yet.
- **D-06:** `/api/accounting/{disconnect,status}` is **deleted**. Canonical becomes `/api/integrations/{disconnect,status}`. Disconnect revokes at provider (via adapter `revoke()`) + deletes the `accounting_credentials` row. Status returns `{connected, provider, scopes, last_context_fetch_at}` per provider.
- **D-07:** Phase 54 includes the **frontend migration + copy rewrite** — updating `AccountingConnectionCard` (or a rename to `BusinessIntegrationCard`) and the `/dashboard/more/integrations` page to the new "Business Integrations" layout, provider-first cards, unified button href, and status-line copy. This triggers a `UI-SPEC.md` need (see Next Up).

### Next.js 16 `cacheComponents: true` (Area 3)

- **D-08:** Flip `cacheComponents: true` in `next.config.js` in Phase 54. Next.js `^16.1.7` already installed — no version bump needed.
- **D-09:** Dashboard Server Component audit — grep `src/app/dashboard/**/{page,layout}.js` for request-time signals (cookies, headers, supabase session reads, Date.now, Math.random). Each page/layout either: (a) explicitly awaits `cookies()`/`headers()` and stays dynamic; (b) marks itself `'use cache'` with a `cacheTag`; or (c) wraps request-time sections in `Suspense` with `unstable_noStore` inside. Public marketing pages (landing, pricing, about) are already static — no audit needed. API Route Handlers are always dynamic by default — not in audit scope.
- **D-10:** Smoke test — `getIntegrationStatus(tenantId)` in `src/lib/integrations/status.js` (or similar): `'use cache'` directive at top, `cacheTag(\`integration-status-${tenantId}\`)` inside, returns `{xero: {connected, scopes, last_context_fetch_at}, jobber: {...}}`. The new `/dashboard/more/integrations` page renders from this cached read. Disconnect and callback routes call `revalidateTag(\`integration-status-${tenantId}\`)` to invalidate on state change. Proves the full cache/revalidate loop before Phase 55 needs it for customer-context TTL.

### Migration + schema (Area 4)

- **D-11:** Single migration file `supabase/migrations/051_integrations_schema.sql`. Sequence: (a) `DELETE FROM accounting_credentials WHERE provider IN ('quickbooks', 'freshbooks')`; (b) `ALTER TABLE ... DROP CONSTRAINT accounting_credentials_provider_check`; (c) `ALTER TABLE ... ADD CONSTRAINT ... CHECK (provider IN ('xero', 'jobber'))`; (d) `ALTER TABLE ... ADD COLUMN scopes TEXT[] NOT NULL DEFAULT '{}'`; (e) `ALTER TABLE ... ADD COLUMN last_context_fetch_at TIMESTAMPTZ`. All in one transactional migration for atomicity.
- **D-12:** `scopes TEXT[] NOT NULL DEFAULT '{}'::text[]` — existing Xero rows backfill to empty array automatically. Pre-v6.0 sandbox Xero rows (if any in dev) will show `scopes=[]` until owner reconnects through the unified OAuth flow; acceptable because dev re-grants with the new scope bundle.
- **D-13:** `last_context_fetch_at TIMESTAMPTZ` NULL default. No new index — Phase 58 telemetry queries are tenant-scoped and hit the existing `UNIQUE (tenant_id, provider)` index. Revisit index decision in Phase 58 if telemetry grows into non-tenant-scoped admin queries.
- **D-14:** Provider CHECK becomes `('xero', 'jobber')` after the migration. QuickBooks and FreshBooks values are permanently invalid. Forward-compatible: adding a future provider requires DROP + recreate of the CHECK (same pattern as this migration).
- **D-15:** QB/FB removal scope ripple — delete `src/lib/accounting/quickbooks.js` and `src/lib/accounting/freshbooks.js`; remove QB/FB from the `PROVIDERS` array; remove QB/FB connection cards from `/dashboard/more/integrations`; delete any `/api/accounting/**` routes specific to QB/FB (beyond the `[provider]` dynamic routes which are being deleted anyway); confirm `accounting_sync_log` has no QB/FB-specific FKs that would block row deletion (cascading deletes should handle it via the existing tenant FK).

### Claude's Discretion

- **HMAC OAuth state helper** — `verifyOAuthState` lives in `src/app/api/google-calendar/auth/route.js` and is already imported by the current accounting callback. Phase 54 reuses this import as-is. Only extract to `src/lib/integrations/oauth-state.js` if Phase 55/56 actually develops a second consumer that can't cleanly reach the Google Calendar module. Don't refactor pre-emptively.
- **Sandbox provisioning timing** — Phase 54 ships pure scaffolding (interface + stubs + routes returning 501 where not implemented + migration + `cacheComponents` + frontend rewrite). User provisioning of Xero + Jobber dev apps blocks Phase 55/56 execution, not Phase 54 merge. `.env.example` entries (`XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `JOBBER_CLIENT_ID`, `JOBBER_CLIENT_SECRET`) ship in Phase 54.
- **Python agent credential reads** — Phase 54 confirms `accounting_credentials` schema change is Python-compatible (Supabase `TEXT[]` → Python `list[str]`; `TIMESTAMPTZ` → `datetime`). No `livekit-agent/` code changes in Phase 54.
- **Webhook endpoint paths** — `/api/webhooks/xero` and `/api/webhooks/jobber` remain the Phase 55/56 canonical locations (matches REQUIREMENTS.md wording). Don't relocate to `/api/integrations/xero/webhook` — those phases' code should live where their requirements say.
- **Exact `IntegrationAdapter` typedef shape** — planner picks between single combined interface, split AccountingAdapter + IntegrationAdapter, or a composition/trait approach, based on JSDoc readability with real Xero + Jobber stubs side-by-side. All three approaches were considered; no hard lock.
- **Copy tone for "Business Integrations" page** — match the voice of existing `/dashboard/more/*` pages (plain, owner-directed, no marketing copy). UI-SPEC captures specific strings.
- **`getIntegrationStatus` return shape** — planner finalizes; consumer is the new Business Integrations page and Phase 58 telemetry. `{xero: {...}, jobber: {...}}` vs `{providers: [...]}` is a formatting call.
- **`accounting_sync_log` table fate** — if it only references providers that no longer exist (QB/FB) it may be prunable; if Xero push still uses it, keep untouched. Planner reads Phase 35 usage and decides.
- **Rename `accounting_credentials` → `integration_credentials`** — explicitly rejected as out of scope for Phase 54. Keep the existing table name; revisit in a future "rename" phase if the mismatch becomes a readability problem.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + Scope
- `.planning/REQUIREMENTS.md` §"Integration Foundation (Phase 54)" lines 23-27 — INTFOUND-01 (shared interface), INTFOUND-02 (schema changes), INTFOUND-03 (cacheComponents)
- `.planning/REQUIREMENTS.md` lines 29-42 — XERO-01..04 + JOBBER-01..05 (downstream phases that depend on Phase 54's interface + schema)
- `.planning/ROADMAP.md` line 193 — Phase 54 checklist entry (authoritative scope line)
- `.planning/ROADMAP.md` lines 201-202 — Pre-requisite user actions (Xero + Jobber dev app registration)
- `.planning/ROADMAP.md` lines 204-212 — v6.0 Key Decisions (default OFF invoicing, reuse `accounting_credentials`, Python-direct fetches, Next.js 16 caching scope)
- `.planning/PROJECT.md` — v6.0 milestone goal and target features

### Prior Phase Context (patterns to mirror or cut around)
- `.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-CONTEXT.md` — Phase 53 gates `/api/accounting/**` behind invoicing flag. Phase 54 deliberately sidesteps by using `/api/integrations/**` (not gated).
- `src/proxy.js:41-61` — Admin gate pattern
- `src/proxy.js:77-82` — Tenant fetch pattern in proxy (already reads tenant row per request)
- `src/proxy.js:107-135` — Subscription gate pattern (template for conditional matcher logic)
- `src/proxy.js:142` — Matcher config

### Files Migrated or Deleted in Phase 54
- `src/lib/accounting/xero.js` → **migrated to `src/lib/integrations/xero.js`** as unified adapter (push + read surface, stubs where applicable)
- `src/lib/accounting/quickbooks.js` — **deleted**
- `src/lib/accounting/freshbooks.js` — **deleted**
- `src/lib/accounting/types.js` → **migrated to `src/lib/integrations/types.js`** (`IntegrationAdapter` typedef; `PROVIDERS = ['xero','jobber']`)
- `src/lib/accounting/adapter.js` → **migrated to `src/lib/integrations/adapter.js`** (provider factory)
- `src/lib/accounting/sync.js` — planner decides: migrate to integrations/ if generic, keep in accounting/ if invoice-push-specific
- `src/app/api/accounting/[provider]/auth/route.js` — **deleted** (replaced by `src/app/api/integrations/[provider]/auth/route.js`)
- `src/app/api/accounting/[provider]/callback/route.js` — **deleted** (replaced by `src/app/api/integrations/[provider]/callback/route.js`)
- `src/app/api/accounting/disconnect/route.js` — **deleted** (replaced by `src/app/api/integrations/disconnect/route.js`)
- `src/app/api/accounting/status/route.js` — **deleted** (replaced by `src/app/api/integrations/status/route.js`)

### New Files to Create
- `supabase/migrations/051_integrations_schema.sql` — migration covering CHECK swap + two new columns + QB/FB row delete
- `src/lib/integrations/types.js` — `IntegrationAdapter` typedef, `PROVIDERS = ['xero','jobber']`
- `src/lib/integrations/adapter.js` — `getIntegrationAdapter(provider)` factory
- `src/lib/integrations/xero.js` — unified Xero adapter (migrated + stubbed)
- `src/lib/integrations/jobber.js` — Jobber adapter stub with real OAuth (planner's call) or full 501 stub
- `src/lib/integrations/status.js` — `getIntegrationStatus(tenantId)` with `'use cache'` + `cacheTag`
- `src/lib/integrations/oauth-state.js` — **optional**, only if extracted from google-calendar
- `src/app/api/integrations/[provider]/auth/route.js`
- `src/app/api/integrations/[provider]/callback/route.js`
- `src/app/api/integrations/disconnect/route.js`
- `src/app/api/integrations/status/route.js`

### Files Modified in Phase 54
- `next.config.js` — add `cacheComponents: true`
- `src/app/dashboard/more/integrations/page.js` (+ any sub-pages) — heading to "Business Integrations," provider-first cards, unified button wiring
- `src/components/**/AccountingConnectionCard.jsx` (or rename to `BusinessIntegrationCard.jsx`) — new props, status-line copy
- Any dashboard Server Components flagged by the `cacheComponents` audit pass — explicit dynamic markings or `'use cache'`

### Existing Code Worth Reading
- `src/app/api/google-calendar/auth/route.js` — `verifyOAuthState` HMAC helper (Phase 54 reuses)
- `src/app/api/accounting/[provider]/callback/route.js` — existing OAuth callback shape (template for new route)
- `src/lib/accounting/xero.js` — existing Xero adapter implementation (migrates into integrations/xero.js)
- `src/lib/accounting/types.js` — existing `AccountingAdapter` typedef (basis for new `IntegrationAdapter`)

### Architectural Skills (read before implementing, update after)
- `auth-database-multitenancy` — migration pattern, `accounting_credentials` RLS policies, service-role reads, `getTenantId()` composition
- `dashboard-crm-system` — `/dashboard/more/*` page conventions, More menu patterns, client/server boundary placement
- `payment-architecture` — reference for OAuth flow patterns (Stripe Connect), cache/revalidate patterns
- `voice-call-architecture` — reference for how Phase 55+ Python agent will consume these credentials (informs schema compatibility)
- `nextjs-16-complete-guide` — `cacheComponents`, `'use cache'`, `cacheTag`, `revalidateTag`, audit patterns for existing pages

### External Docs (research phase)
- Next.js 16 Cache Components docs (via Context7 or WebFetch) — audit patterns, edge cases, Turbopack compat
- Xero OAuth 2.0 + xero-node SDK docs — confirm scope bundle covers both read + push
- Jobber Developer docs at developer.getjobber.com — OAuth flow shape, scope naming
- `supabase/migrations/050_checklist_overrides.sql` — latest migration (sequence number 051 is next)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `verifyOAuthState` / `signOAuthState` in `src/app/api/google-calendar/auth/route.js` — HMAC OAuth state signer already exists and is already imported by the Phase 35 accounting callback. Phase 54 imports from the same location.
- `XeroClient` from `xero-node` package — wrapped in existing `src/lib/accounting/xero.js`; reused under the new path.
- `src/proxy.js` tenant fetch pattern — the migration's new columns don't affect proxy behavior; no proxy.js changes needed in Phase 54 (unlike Phase 53).
- Existing `AccountingConnectionCard` component — rename + prop rework into `BusinessIntegrationCard` (planner decides whether to rename file or keep for diff-noise minimization).
- `accounting_credentials` table RLS policies (`service_role_all_*` + tenant-scoped) — untouched; flag reads + new column reads piggyback.

### Established Patterns
- Migration naming sequence — `NNN_description.sql`; Phase 54 is `051_integrations_schema.sql`.
- Provider CHECK constraint pattern — Phase 35 set up multi-provider as `CHECK (provider IN (...))`; Phase 54 drops + recreates with new set.
- Next.js App Router Route Handler shape — match the existing `/api/accounting/[provider]/callback/route.js` exports (`export async function GET`).
- Supabase upsert with `onConflict: 'tenant_id,provider'` — carry over to new integration callback.
- `getTenantId()` auth helper (per `auth-database-multitenancy` skill) — consumed by disconnect/status routes.
- Dashboard Server Component + `<provider>` pattern — Phase 53 introduced `FeatureFlagsProvider` (layout-level fetch + Context). Phase 54 doesn't need a parallel provider for integration status because status is per-page, not tree-wide; cached `getIntegrationStatus()` is the right primitive.

### Integration Points
- **Next.js config:** `next.config.js` at project root — one-line add for `cacheComponents: true`. Keep Sentry + next-intl wrappers intact.
- **Migration sequence:** `supabase/migrations/050_checklist_overrides.sql` is latest. Phase 54 adds `051_integrations_schema.sql`.
- **Proxy bypass:** Phase 53's `/api/accounting/**` gate does NOT apply to `/api/integrations/**` — verified by reading `src/proxy.js:142` matcher. No proxy change needed.
- **Phase 55/56 handoff:** downstream phases import from `src/lib/integrations/xero.js` and `src/lib/integrations/jobber.js` respectively. Phase 54 defines the surface they extend.
- **Python agent (Phase 55+):** `livekit-agent/` service-role Supabase reads `accounting_credentials` directly. Phase 54's schema additions (`scopes TEXT[]`, `last_context_fetch_at TIMESTAMPTZ`) must be readable from `supabase-py` — both types map cleanly to Python (`list[str]`, `datetime`).

### Blast Radius
- **~25-30 source files touched.** Breakdown: 1 migration; 6-8 new files in `src/lib/integrations/`; 2-3 files deleted from `src/lib/accounting/`; 4 new route handlers under `/api/integrations/**`; 4 route handlers deleted from `/api/accounting/**`; 1-2 dashboard components rewritten for "Business Integrations"; 1 `next.config.js` edit; 3-6 dashboard page files touched during `cacheComponents` audit pass.
- **Plan shape:** likely 4-5 plans — (1) migration, (2) lib/integrations module + adapter migration + QB/FB deletion, (3) new routes + delete old routes, (4) cacheComponents enable + dashboard audit + smoke-test helper, (5) frontend rewrite "Business Integrations" page.
- **UI-SPEC needed:** yes — frontend rewrite is owner-visible. Invoke `/gsd:ui-phase 54` after CONTEXT, before `/gsd:plan-phase 54`.

### Known Pitfalls
- **CHECK constraint swap order** — can't ALTER CHECK in-place in Postgres; must DROP then recreate. Any row violating the new CHECK must be DELETEd BEFORE the ADD CONSTRAINT step, or the ALTER will fail. Migration must DELETE QB/FB rows first, then swap constraint.
- **`accounting_sync_log` FK chain** — the sync log table has a FK back to `accounting_credentials`. If CASCADE is set, the QB/FB row deletions will cascade-delete sync log rows (desired). If RESTRICT, the delete fails. Planner reads the existing constraint and picks DELETE approach accordingly.
- **Xero dev-console redirect URI** — if any sandbox Xero dev app is already registered (check `process.env.XERO_CLIENT_ID` existence), its callback URL must be updated to `/api/integrations/xero/callback` before Phase 54 merges. If no sandbox exists yet (likely), Phase 54's user-action documentation walks through setup with the new URL from the start.
- **`cacheComponents` + Turbopack** — Next.js 16 production-ready but some edge cases with dynamic-detection still report issues in Turbopack dev mode. Research phase should check Next.js 16 release notes for open issues; dashboard audit pass catches false positives (page cached when it should be dynamic).
- **`AccountingConnectionCard` prop drift** — existing component is typed around invoicing concepts (sync status, invoice push history). Rename + repurpose needs careful prop renaming to avoid JSDoc/TS errors in unrelated consumers. If blast radius grows too wide, keep the old name as an alias during Phase 54 and rename in Phase 58.
- **Route deletion vs file absence** — removing `src/app/api/accounting/[provider]/auth/route.js` means that URL returns 404 immediately after merge. Owner browsers hitting the old path get 404 — acceptable because this is the OAuth *initiation* URL, not an end-user landing page. Callbacks (redirect targets) are driven by the dev-console registration, which gets updated in the same change.
- **`'use cache'` directive placement** — must be the VERY FIRST line inside the function (before any other statements). Easy to miss; audit pass checklist includes this.

</code_context>

<specifics>
## Specific Ideas

- **Owner mental model is provider-centric, not capability-centric.** "I connected Xero" should mean "Voco and Xero talk." Internal capability splits (push vs read) are invisible. Phase 54's single-button unified-scope design delivers this.
- **"Business Integrations" card status-line copy:**
  - Disconnected: "Connect Xero to share customer history with your AI receptionist during calls."
  - Connected (invoicing OFF): "Xero — Connected. Sharing customer context with your AI receptionist."
  - Connected (invoicing ON): "Xero — Connected. Sharing customer context + sending invoices."
  - Mirror structure for Jobber.
  - Exact wording is UI-SPEC territory; these are anchor examples.
- **QB/FB deletion is not deprecation.** No warning banners, no migration UI, no "we're removing this in 30 days." The files stop existing. Safe because v6.0 is still dev and no tenants have live QB/FB connections worth preserving. Restoring QB/FB in the future is a new phase, not a revert.
- **The smoke-test cache helper is deliberately owner-facing-useful.** `getIntegrationStatus()` isn't throwaway — it's the read behind the new Business Integrations page. By making the smoke test the real consumer, Phase 54 avoids test-only code and Phase 55 inherits a proven primitive.
- **Naming intent:** `integrations/` > `accounting/` for owner clarity. Voco talks to Jobber (field service) and Xero (accounting); calling the module "accounting" misrepresents Jobber and is a live confusion source in the product UI.

</specifics>

<deferred>
## Deferred Ideas

- **Admin UI for connecting integrations on behalf of tenants** — support operations tooling; not owner-facing. Future ops phase.
- **Progressive scope disclosure** — per-capability toggles ("allow Voco to read invoices" vs "allow Voco to push invoices"). The `scopes TEXT[]` column leaves the door open; add only if owner feedback after Phase 55/56 demands granular control.
- **Extracting HMAC OAuth state to `src/lib/integrations/oauth-state.js`** — only if Phase 55/56 surfaces a real second consumer that can't cleanly reach the Google Calendar export.
- **Renaming `accounting_credentials` → `integration_credentials`** — cosmetic consistency with the new `lib/integrations/` directory. Revisit in a dedicated rename phase if the mismatch becomes a readability problem.
- **Webhook URL relocation** (`/api/webhooks/xero` → `/api/integrations/xero/webhook`) — rejected for Phase 54+. Phase 55/56 keep webhooks at `/api/webhooks/<provider>/` per REQUIREMENTS wording.
- **LaunchDarkly/Growthbook-style progressive rollout** for Jobber/Xero per cohort — over-engineered for the current user count; `features_enabled` JSONB in Phase 53 covers the simple flag case.
- **Voice agent (Python) credential refresh logic** — out of scope for Phase 54 (schema-only). Phase 55 builds Python-side refresh pattern when it implements first real fetch.
- **Deleting `accounting_sync_log` table or repurposing** — potentially relevant now that QB/FB are gone and only Xero push remains, but outside Phase 54 scope. Flag for Phase 58 cleanup if the table becomes dead weight.
- **Public-facing "integrations" marketing page** — listing Jobber + Xero on the marketing site as features. Out of scope (Phase 47+ landing work is separate).
- **308 redirect layer from `/api/accounting/**` to `/api/integrations/**`** — considered for back-compat and rejected in favor of clean deletion. Revisit only if a live tenant gets stuck post-merge.

</deferred>

---

*Phase: 54-integration-credentials-foundation-caching-prep-sandbox-provisioning*
*Context gathered: 2026-04-17*
