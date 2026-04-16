# Phase 54: Integration credentials foundation — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 54-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 54-integration-credentials-foundation-caching-prep-sandbox-provisioning
**Areas discussed:** Module boundary, OAuth route topology, cacheComponents rollout, accounting_credentials migration detail

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Module boundary: integrations/ vs accounting/ | New lib/ dir vs extend accounting/ vs shared foundation | ✓ |
| OAuth route topology — /api/integrations/ vs /api/accounting/ | Parallel, migrate with redirects, or shared handlers | ✓ |
| cacheComponents: true rollout risk | Enable + audit, enable narrow, or defer to Phase 55 | ✓ |
| accounting_credentials migration detail | Column shapes, index, backfill | ✓ |

**User's choice:** All four areas.

---

## Module boundary: integrations/ vs accounting/

### Q1: Where does the shared integration code live?

| Option | Description | Selected |
|--------|-------------|----------|
| New src/lib/integrations/ (Recommended) | Sibling directory; accounting/ keeps PUSH, integrations/ holds read-side | ✓ |
| Extend src/lib/accounting/ | Single adapter per provider grows both push + read methods | |
| Shared foundation, thin accounting/ re-exports | integrations/ has base interface; accounting/ imports and extends | |

**User's choice:** New src/lib/integrations/ (sibling to accounting/).

### Q2: What happens to Phase 35's existing xero.js?

| Option | Description | Selected |
|--------|-------------|----------|
| Leave accounting/xero.js untouched (Recommended) | Two files per provider — one push, one read | |
| Move OAuth helpers out, leave push methods | Partial refactor; shared OAuth | |
| Fully consolidate into integrations/xero.js | Everything moves; accounting/ shrinks or disappears | ✓ |

**User's choice:** Fully consolidate. Phase 54 migrates Phase 35's xero.js into integrations/xero.js as a unified adapter.

### Q3 (UX-reframed): One "Connect Xero" button, or one per capability?

| Option | Description | Selected |
|--------|-------------|----------|
| Single connection, one scope bundle (Recommended) | Unified OAuth button + combined scopes + one credentials row | ✓ |
| Split per capability — "Read customer context" vs "Push invoices" | Two buttons, granular scopes | |
| Unified now, split later if needed | Single button, scopes[] records grant for future progressive disclosure | |

**User's choice:** Single connection, one scope bundle per provider. Invoicing flag never affects OAuth; flag only gates whether push code path runs on the shared credentials.

### Q4 (UX-reframed): How does the integrations page read to the owner?

| Option | Description | Selected |
|--------|-------------|----------|
| Rename to "Business Integrations" + group cards (Recommended) | Heading rename; provider-first cards with status lines describing active behavior | ✓ |
| Keep "Accounting Integrations" heading; add Jobber as peer card | Minimal UI change but misleading label | |
| Defer UX copy to Phase 55/56 | Pure plumbing in Phase 54; copy comes later | |

**User's choice:** Rename + restructure in Phase 54.

**Notes:** User prompted ("Which option/design provides the best UI/UX that is usable in the real world") to pivot Q3 and Q4 away from code-organization framing toward owner-visible behavior. Resulting recommendations (single connection + "Business Integrations" heading) became the selected options.

---

## OAuth route topology

### Q1: What happens to /api/accounting/[provider]/{auth,callback} routes?

| Option | Description | Selected |
|--------|-------------|----------|
| 308 redirect to /api/integrations/ (Recommended) | Old paths redirect; dev-console URI still works | |
| Delete old routes, update redirect URI in provider console | Clean cut; user updates dev-console before merge | ✓ |
| Keep both URLs live (parallel routes) | Same handler mounted twice; shared behavior | |

**User's choice:** Delete old routes. Safe because Xero + Jobber sandbox accounts don't exist yet (user provisions them as part of Phase 54's user actions).

### Q2: Where do disconnect and status endpoints live?

| Option | Description | Selected |
|--------|-------------|----------|
| /api/integrations/{disconnect,status} (Recommended) | Canonical under new URL namespace | ✓ |
| Keep /api/accounting/{disconnect,status}, proxy bypass | Don't migrate smaller endpoints; add gate exclusion | |
| Mirror at both URLs during transition, delete in Phase 58 | Shared handler for a few weeks | |

**User's choice:** New canonical under /api/integrations/.

### Q3: How is the "Connect Xero/Jobber" button wired from the frontend?

| Option | Description | Selected |
|--------|-------------|----------|
| AccountingConnectionCard calls /api/integrations/xero/auth (Recommended) | Minimal frontend change — just button href swap | |
| Frontend untouched in Phase 54; redirects carry old buttons | Pure backend work; browser follows redirects | |
| Frontend migration + copy rewrite in Phase 54 | Backend routes + "Business Integrations" UX in same phase | ✓ |

**User's choice:** Full frontend migration + copy rewrite in Phase 54. Consequence: UI-SPEC recommended before planning.

---

## cacheComponents rollout

### Q1: When do we flip cacheComponents: true on?

| Option | Description | Selected |
|--------|-------------|----------|
| Enable in Phase 54 + dashboard smoke pass (Recommended) | Flag + audit all dashboard Server Components | ✓ |
| Enable in Phase 54 with narrow 'use cache' in integrations/ only | Flag + smoke test only; trust existing dynamic-marking | |
| Defer to Phase 55 | Phase 55 flips when it needs 'use cache' for customer-context TTL | |

**User's choice:** Enable + audit now.

### Q2: How deep does the audit go if we do it in Phase 54?

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard Server Components only (Recommended) | src/app/dashboard/** — public pages already static | ✓ |
| Every Server Component in src/app/** | Full audit including public + API routes | |
| Audit only files Phase 54 writes | Minimal — only the new integrations page + module | |

**User's choice:** Dashboard-only scope.

### Q3: What's the 'use cache' smoke test in integrations/?

| Option | Description | Selected |
|--------|-------------|----------|
| Cached getIntegrationStatus(tenantId) helper (Recommended) | Real consumer: new Business Integrations page reads from it; revalidateTag on disconnect/callback | ✓ |
| Empty stub with TODO comment | Build-time proof of wiring; Phase 55 implements | |
| Skip smoke test — Phase 55 proves it | No Phase 54 'use cache' code | |

**User's choice:** Cached `getIntegrationStatus(tenantId)` helper. Doubles as the data source for the new Business Integrations page.

---

## accounting_credentials migration detail

### Q1: scopes TEXT[] default value?

| Option | Description | Selected |
|--------|-------------|----------|
| DEFAULT '{}'::text[] (empty array, NOT NULL) (Recommended) | Empty array default; no null checks; existing rows backfill to [] | ✓ |
| NULL allowed, no default | Nullable; callers null-check | |
| Backfill existing rows with inferred scopes | UPDATE sets scopes to static list currently requested by accounting/xero.js | |

**User's choice:** Empty-array default, NOT NULL.

### Q2: last_context_fetch_at TIMESTAMPTZ — default + index?

| Option | Description | Selected |
|--------|-------------|----------|
| Default NULL + no index yet (Recommended) | Nullable; tenant-scoped selects covered by existing unique index | ✓ |
| Default NULL + index on (tenant_id, last_context_fetch_at) | Covering index for Phase 58 telemetry | |
| Default NULL + partial index WHERE last_context_fetch_at IS NOT NULL | Partial index covering populated rows | |

**User's choice:** NULL default, no new index. Revisit in Phase 58 if telemetry grows into non-tenant-scoped admin queries.

### Q3: Migration file naming + provider CHECK update

| Option | Description | Selected |
|--------|-------------|----------|
| supabase/migrations/051_integrations_schema.sql (Recommended) | Single migration; CHECK swap + both new columns | ✓ |
| Two migrations: 051_jobber_provider.sql + 052_integration_telemetry.sql | Split by concern | |
| Extend + rename — rename table to integration_credentials | Biggest refactor; invasive | |

**User's choice:** Single migration file.

### Q4: Do we delete QuickBooks + FreshBooks rows/adapters?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep rows + adapters (Recommended) | Adapters move to integrations/ with xero.js; push still functional | |
| Keep rows, quarantine adapters behind invoicing flag | Push-only code path | |
| Deprecate QB + FB in Phase 54 | Deprecation warnings; removal in Phase 58 | |
| **Other: remove them entirely** | User note: "remove them entirely" — delete adapter files, purge rows, drop from CHECK | ✓ |

**User's choice:** "Other" — remove QB/FB entirely in Phase 54. Files deleted, rows purged, CHECK becomes ('xero','jobber'). Safe because v6.0 is dev-only with no live users.

### Q5 (confirmation): QB/FB removal scope ripple?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, all of it — Phase 54 removes everything QB/FB (Recommended given pick) | Full scope ripple confirmed | ✓ |
| Prune lib + CHECK but keep rows | Not viable given new CHECK | |
| Defer QB/FB removal to a dedicated phase | Would revert to keeping them in Phase 54 | |

**User's choice:** Full removal confirmed.

---

## Claude's Discretion

- HMAC OAuth state helper — reuse `verifyOAuthState` from `src/app/api/google-calendar/auth/route.js`; extract to shared location only if Phase 55/56 needs a second consumer.
- Sandbox provisioning timing — Phase 54 ships pure scaffolding; user provisioning blocks Phase 55/56, not Phase 54 merge.
- Python agent (livekit-agent/) credential reads — not in Phase 54 scope; schema change verified Python-compatible.
- Webhook endpoint paths — stay at `/api/webhooks/<provider>/` per REQUIREMENTS wording; no relocation.
- Exact `IntegrationAdapter` typedef shape — planner picks between combined, split, or composition based on JSDoc readability.
- Copy for "Business Integrations" page — UI-SPEC territory.
- `getIntegrationStatus` return shape — planner picks `{xero: {...}, jobber: {...}}` vs `{providers: [...]}`.
- `accounting_sync_log` fate — planner reads current usage and decides whether to prune alongside QB/FB removal.

---

## Deferred Ideas

- Admin UI for support-side integration connection
- Progressive per-capability scope toggles (`scopes TEXT[]` leaves door open)
- Extracting HMAC OAuth state to shared lib/integrations/oauth-state.js
- Renaming `accounting_credentials` → `integration_credentials`
- Webhook URL relocation (`/api/webhooks/xero` → `/api/integrations/xero/webhook`)
- LaunchDarkly/Growthbook-style progressive rollout
- Voice agent (Python) credential refresh logic
- `accounting_sync_log` table cleanup
- Public marketing integrations page
- 308 redirect layer from `/api/accounting/**` to `/api/integrations/**` (rejected in favor of clean cut)
