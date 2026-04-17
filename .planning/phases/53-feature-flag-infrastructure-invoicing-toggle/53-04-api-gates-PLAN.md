---
phase: 53
plan: 04
type: execute
wave: 3
depends_on: [1, 2]
files_modified:
  - src/app/api/invoices/route.js
  - src/app/api/invoices/[id]/route.js
  - src/app/api/invoices/[id]/pdf/route.js
  - src/app/api/invoices/[id]/ai-describe/route.js
  - src/app/api/invoices/[id]/payments/route.js
  - src/app/api/invoices/[id]/send/route.js
  - src/app/api/invoices/batch/route.js
  - src/app/api/invoices/batch-send/route.js
  - src/app/api/estimates/route.js
  - src/app/api/estimates/[id]/route.js
  - src/app/api/estimates/[id]/convert/route.js
  - src/app/api/estimates/[id]/send/route.js
  - src/app/api/accounting/status/route.js
  - src/app/api/accounting/disconnect/route.js
  - src/app/api/accounting/[provider]/auth/route.js
  - src/app/api/accounting/[provider]/callback/route.js
  - src/app/api/invoice-settings/route.js
autonomous: true
requirements:
  - TOGGLE-02
must_haves:
  truths:
    - "Every HTTP method handler in /api/invoices/**, /api/estimates/**, /api/accounting/**, /api/invoice-settings returns 404 with no body when the caller's tenant has features_enabled.invoicing = false"
    - "When features_enabled.invoicing = true, every gated route serves its existing behavior unchanged"
    - "The 404 response carries no JSON body, no flag-state hint, and no error message that reveals the gate exists"
    - "The gate runs AFTER the existing tenantId resolution (preserves the existing 401 path for unauthenticated callers)"
  artifacts:
    - path: "src/app/api/invoices/route.js"
      provides: "Gated invoices list/create endpoints"
      contains: "getTenantFeatures"
    - path: "src/app/api/invoices/[id]/route.js"
      provides: "Gated single-invoice CRUD"
      contains: "getTenantFeatures"
    - path: "src/app/api/estimates/route.js"
      provides: "Gated estimates list/create endpoints"
      contains: "getTenantFeatures"
    - path: "src/app/api/accounting/status/route.js"
      provides: "Gated accounting connection status"
      contains: "getTenantFeatures"
    - path: "src/app/api/invoice-settings/route.js"
      provides: "Gated invoice settings GET/PATCH"
      contains: "getTenantFeatures"
  key_links:
    - from: "every gated API route"
      to: "src/lib/features.js getTenantFeatures()"
      via: "import + early-return 404"
      pattern: "getTenantFeatures"
---

<objective>
Add a 5-line early-return 404 gate to EVERY HTTP handler in the four gated API surfaces (`/api/invoices/**`, `/api/estimates/**`, `/api/accounting/**`, `/api/invoice-settings`). When the caller's tenant has `features_enabled.invoicing = false`, the route returns `404 Not Found` with NO body — matching D-06's "no info leak" rule.

Purpose: Defense-in-depth. The proxy gate (Plan 03) blocks page access, but a malicious or misconfigured client could still hit the API directly. The API gate is the canonical enforcement point — even if the proxy is bypassed, the API refuses to leak data.

Output: 17 route files modified. Each receives an identical 5-line gate block inserted between the existing `getTenantId()` check and the rest of the handler. No business logic changes.
</objective>

<execution_context>
@C:/Users/leheh/.Projects/homeservice_agent/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/leheh/.Projects/homeservice_agent/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-CONTEXT.md
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md
@src/lib/features.js
@src/lib/get-tenant-id.js
@src/app/api/invoices/route.js
@src/app/api/invoice-settings/route.js
@src/app/api/notification-settings/route.js
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-02-SUMMARY.md

<interfaces>
From src/lib/features.js (Plan 02 output):
```js
export async function getTenantFeatures(tenantId): Promise<{invoicing: boolean}>
```
Returns `{ invoicing: false }` for any error, missing row, or null column.

Canonical gate block (insert at the entry of every handler, after the existing tenantId check):
```js
import { getTenantFeatures } from '@/lib/features';

const features = await getTenantFeatures(tenantId);
if (!features.invoicing) {
  return new Response(null, { status: 404 });
}
```

Existing canonical 401 pattern (already present in every gated route — DO NOT modify):
```js
const tenantId = await getTenantId();
if (!tenantId) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
```

Per-route file inventory (verified via Glob 2026-04-17 — these are the files to gate):
- src/app/api/invoices/route.js (GET, POST)
- src/app/api/invoices/[id]/route.js (GET, PATCH, DELETE)
- src/app/api/invoices/[id]/pdf/route.js (GET)
- src/app/api/invoices/[id]/ai-describe/route.js (POST)
- src/app/api/invoices/[id]/payments/route.js (POST, GET probably)
- src/app/api/invoices/[id]/send/route.js (POST)
- src/app/api/invoices/batch/route.js (POST)
- src/app/api/invoices/batch-send/route.js (POST)
- src/app/api/estimates/route.js (GET, POST)
- src/app/api/estimates/[id]/route.js (GET, PATCH, DELETE)
- src/app/api/estimates/[id]/convert/route.js (POST)
- src/app/api/estimates/[id]/send/route.js (POST)
- src/app/api/accounting/status/route.js (GET)
- src/app/api/accounting/disconnect/route.js (POST or DELETE)
- src/app/api/accounting/[provider]/auth/route.js (GET)
- src/app/api/accounting/[provider]/callback/route.js (GET)
- src/app/api/invoice-settings/route.js (GET, PATCH)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Gate all 8 /api/invoices/** route files (every HTTP handler)</name>
  <files>src/app/api/invoices/route.js, src/app/api/invoices/[id]/route.js, src/app/api/invoices/[id]/pdf/route.js, src/app/api/invoices/[id]/ai-describe/route.js, src/app/api/invoices/[id]/payments/route.js, src/app/api/invoices/[id]/send/route.js, src/app/api/invoices/batch/route.js, src/app/api/invoices/batch-send/route.js</files>
  <read_first>
    - src/app/api/invoices/route.js (canonical pattern — already uses `getTenantId()` + 401)
    - src/lib/features.js (Plan 02 — `getTenantFeatures` import target)
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md Pattern 2 + D-06 (no body in 404)
  </read_first>
  <action>
For EACH of the 8 files listed in `<files>`, perform the following two changes:

CHANGE 1 — Add the import at the top of the file (alongside the existing `getTenantId` import). If the file already imports from `@/lib/features` (it should not at this point), reuse that line.

```js
import { getTenantFeatures } from '@/lib/features';
```

CHANGE 2 — Inside EVERY exported HTTP handler (`GET`, `POST`, `PATCH`, `DELETE`, etc.), insert the 5-line gate block immediately AFTER the existing `getTenantId()` + 401 check and BEFORE any other logic.

Example — `src/app/api/invoices/route.js` BEFORE:
```js
export async function GET(request) {
  const supabase = await createSupabaseServer();
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... rest of handler
}
```

EXACT replacement for `src/app/api/invoices/route.js GET handler` — AFTER:
```js
export async function GET(request) {
  const supabase = await createSupabaseServer();
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const features = await getTenantFeatures(tenantId);
  if (!features.invoicing) {
    return new Response(null, { status: 404 });
  }

  // ... rest of handler unchanged
}
```

Apply this same insertion to EVERY exported handler in EVERY file listed in `<files>`.

For files that do not currently use `getTenantId()` at the top (some routes like `[provider]/auth/route.js` may resolve tenantId differently — read each file first):
- If the route uses any other tenant resolution helper, place the `getTenantFeatures(tenantId)` call after that resolution.
- If the route lacks ANY tenantId resolution (e.g., a webhook), STOP and report — those routes need a different gating strategy. None of the 8 invoice files in this task should be in that category — they all serve authenticated dashboard users.

CRITICAL details:
- The 404 body MUST be `null` (passed to the `Response` constructor). Do NOT use `Response.json({ error: 'Not found' }, { status: 404 })` — D-06 mandates no body to prevent flag-state info leak.
- The order MUST be: tenantId resolution → 401 if missing → features fetch → 404 if disabled → existing logic. Putting the features check before the 401 check would leak that the route exists to unauthenticated callers.
- Do NOT wrap the gate in try/catch. `getTenantFeatures` returns the safe default `{ invoicing: false }` on error, which fails-closed (returns 404).
- Do NOT add logging at the gate. The route returning 404 silently is the expected behavior; logging would create noise.
- For each file, insert the gate block in EVERY exported handler (a file with both GET and POST handlers gets the gate twice).
  </action>
  <verify>
    <automated>FILES="src/app/api/invoices/route.js src/app/api/invoices/[id]/route.js src/app/api/invoices/[id]/pdf/route.js src/app/api/invoices/[id]/ai-describe/route.js src/app/api/invoices/[id]/payments/route.js src/app/api/invoices/[id]/send/route.js src/app/api/invoices/batch/route.js src/app/api/invoices/batch-send/route.js"; for f in $FILES; do grep -q "getTenantFeatures" "$f" || { echo "MISSING in $f"; exit 1; }; grep -q "new Response(null, { status: 404 })" "$f" || { echo "MISSING 404 in $f"; exit 1; }; done && npm run build 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - All 8 files contain the literal import string `import { getTenantFeatures } from '@/lib/features';`
    - All 8 files contain at least one occurrence of `await getTenantFeatures(tenantId)`
    - All 8 files contain at least one occurrence of `new Response(null, { status: 404 })`
    - In each file, the count of `getTenantFeatures(` calls equals or exceeds the count of `export async function` declarations (every handler gated)
    - No file uses `Response.json(..., { status: 404 })` for the gate (would violate D-06 no-body rule)
    - No file has the gate placed BEFORE the existing 401 check (the gate must come AFTER `if (!tenantId) return 401`)
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>All 8 invoice API files gated. Hitting any GET/POST/PATCH/DELETE on /api/invoices/** with flag=false returns 404 empty body.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Gate all 4 /api/estimates/** route files (every HTTP handler)</name>
  <files>src/app/api/estimates/route.js, src/app/api/estimates/[id]/route.js, src/app/api/estimates/[id]/convert/route.js, src/app/api/estimates/[id]/send/route.js</files>
  <read_first>
    - src/app/api/estimates/route.js (verify it follows the same `getTenantId` + 401 pattern as invoices)
    - src/lib/features.js
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md Pattern 2 + D-06
  </read_first>
  <action>
Apply the EXACT same gate insertion as Task 1 to each of the 4 `/api/estimates/**` route files. For every exported HTTP handler:

1. Add `import { getTenantFeatures } from '@/lib/features';` at the top of the file.
2. After the existing `getTenantId()` + 401 check, insert:
   ```js
   const features = await getTenantFeatures(tenantId);
   if (!features.invoicing) {
     return new Response(null, { status: 404 });
   }
   ```

Same rules as Task 1: 404 body MUST be `null`; gate goes AFTER the 401 check; insert into every exported handler in every file; no try/catch wrapping; no logging.

Read each file first to confirm the existing pattern. If a file uses a different tenant resolution (e.g., body-derived tenant ID for a webhook), STOP and report — none of the 4 estimate files should be in that category.
  </action>
  <verify>
    <automated>FILES="src/app/api/estimates/route.js src/app/api/estimates/[id]/route.js src/app/api/estimates/[id]/convert/route.js src/app/api/estimates/[id]/send/route.js"; for f in $FILES; do grep -q "getTenantFeatures" "$f" || { echo "MISSING in $f"; exit 1; }; grep -q "new Response(null, { status: 404 })" "$f" || { echo "MISSING 404 in $f"; exit 1; }; done && npm run build 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - All 4 files contain `import { getTenantFeatures } from '@/lib/features';`
    - All 4 files contain at least one `await getTenantFeatures(tenantId)`
    - All 4 files contain at least one `new Response(null, { status: 404 })`
    - In each file, every exported HTTP handler (each `export async function GET|POST|PATCH|DELETE`) contains the gate block
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>All 4 estimate API files gated identically to invoices.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Gate /api/accounting/** (4 files) and /api/invoice-settings (1 file)</name>
  <files>src/app/api/accounting/status/route.js, src/app/api/accounting/disconnect/route.js, src/app/api/accounting/[provider]/auth/route.js, src/app/api/accounting/[provider]/callback/route.js, src/app/api/invoice-settings/route.js</files>
  <read_first>
    - src/app/api/accounting/status/route.js (confirm tenant resolution shape)
    - src/app/api/accounting/[provider]/callback/route.js (OAuth callback — special handling note below)
    - src/app/api/invoice-settings/route.js (canonical JSONB read on tenants — verify pattern)
    - src/lib/features.js
  </read_first>
  <action>
Apply the same gate to these 5 files. Three nuances to be aware of (read each file before editing):

1. `src/app/api/accounting/status/route.js` — straightforward. Standard `getTenantId()` + 401, insert the gate block after.

2. `src/app/api/accounting/disconnect/route.js` — straightforward. Same pattern.

3. `src/app/api/accounting/[provider]/auth/route.js` — this initiates OAuth. Standard `getTenantId()` + 401 + gate. If invoicing is disabled and someone tries to start a new accounting OAuth flow, returning 404 is correct (no leakage that the gate exists).

4. `src/app/api/accounting/[provider]/callback/route.js` — OAuth callback receives a redirect from the third-party provider with a `code` query param. The callback DOES authenticate the request via the OAuth state parameter (not via session cookie always). READ the file carefully:
   - If the callback uses `getTenantId()` to resolve the tenant (typical session-cookie callback), apply the standard gate.
   - If the callback resolves tenant from OAuth state (HMAC-signed), apply the gate AFTER the state validation has resolved a tenantId. Place the gate immediately after the tenantId is in scope.
   - If the file currently has no tenant resolution at all, STOP and report — that means the route is not session-bound and needs the planner's review before gating.

5. `src/app/api/invoice-settings/route.js` — has `GET` and `PATCH` handlers. Standard `getTenantId()` + 401, insert gate in BOTH handlers.

For all 5 files, the canonical gate insertion is identical to Tasks 1 and 2:
```js
import { getTenantFeatures } from '@/lib/features';

// inside each handler, after the 401 check:
const features = await getTenantFeatures(tenantId);
if (!features.invoicing) {
  return new Response(null, { status: 404 });
}
```

For the OAuth callback edge case: if the callback returns a `redirect` to a dashboard page on success, the gate's 404 response is acceptable — the user simply sees a 404 in their browser. Document this behavior in the SUMMARY.
  </action>
  <verify>
    <automated>FILES="src/app/api/accounting/status/route.js src/app/api/accounting/disconnect/route.js src/app/api/accounting/[provider]/auth/route.js src/app/api/accounting/[provider]/callback/route.js src/app/api/invoice-settings/route.js"; for f in $FILES; do grep -q "getTenantFeatures" "$f" || { echo "MISSING in $f"; exit 1; }; grep -q "new Response(null, { status: 404 })" "$f" || { echo "MISSING 404 in $f"; exit 1; }; done && npm run build 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - All 5 files contain `import { getTenantFeatures } from '@/lib/features';`
    - All 5 files contain at least one `await getTenantFeatures(tenantId)`
    - All 5 files contain at least one `new Response(null, { status: 404 })`
    - `src/app/api/invoice-settings/route.js` contains the gate in BOTH the GET and PATCH handlers (`grep -c "getTenantFeatures" src/app/api/invoice-settings/route.js` returns at least 2)
    - The OAuth callback (`src/app/api/accounting/[provider]/callback/route.js`) places the gate AFTER tenant resolution has occurred (not before)
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>All accounting + invoice-settings APIs gated. /api/tenant/features (Plan 07's new route) is intentionally NOT in this list — it must remain accessible to flip the flag back on.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser/client → API route | Any authenticated client can hit any API route directly via fetch/curl, bypassing the proxy page-redirect gate. The API gate is the canonical enforcement boundary. |
| API route → tenant data | Each route already uses `getTenantId()` + tenant-scoped queries to enforce per-tenant data isolation. The features gate adds a second layer: even within one's own tenant, invoicing data is hidden when the flag is off. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-53-02 | Tampering | API direct call bypassing proxy | mitigate | Every gated route has its own `getTenantFeatures()` check that returns 404. The proxy gate is convenience UX; the API gate is enforcement. |
| T-53-04 | Information Disclosure | API response shape leaks flag state | mitigate | All 404 responses carry `null` body (no JSON, no error message). A caller cannot distinguish "route doesn't exist" from "route exists but flag is off" — both look identical. |
| T-53-04b | Information Disclosure | 401 vs 404 ordering leaks flag state | mitigate | The gate runs AFTER the 401 check. An unauthenticated caller always sees 401 (regardless of flag), so the 404 is only ever returned to authenticated callers — preserving existing 401 semantics. |
| T-53-cron-bypass | Tampering | Cron jobs hitting these routes | accept | Crons use the service-role client and don't call these REST routes. They have their own filter (Plan 05). N/A here. |
</threat_model>

<verification>
After all 3 tasks (17 files modified):
1. `npm run build` exits 0.
2. With dev's tenant features_enabled = `{"invoicing": false}`:
   - `curl -i http://localhost:3000/api/invoices` (with auth cookie) returns `HTTP/1.1 404` with empty body.
   - `curl -i http://localhost:3000/api/estimates` returns 404 empty body.
   - `curl -i http://localhost:3000/api/accounting/status` returns 404 empty body.
   - `curl -i http://localhost:3000/api/invoice-settings` returns 404 empty body.
   - `curl -i http://localhost:3000/api/tenant/features` (Plan 07's PATCH route) returns 200 / 4xx normally — NOT gated.
3. With features_enabled = `{"invoicing": true}`:
   - Same curls return their normal 200/JSON responses.
4. `curl -i http://localhost:3000/api/invoices` WITHOUT auth cookie returns `HTTP/1.1 401` with `{"error":"Unauthorized"}` (existing behavior preserved — 401 takes precedence over 404).
</verification>

<success_criteria>
- 17 API route files modified, every exported HTTP handler in each contains the gate
- All 404 responses carry no body (empty Response)
- Existing 401 path preserved for unauthenticated callers
- Build passes
- Manual curl verification confirms the gate fires correctly under flag=false
</success_criteria>

<output>
After completion, create `.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-04-SUMMARY.md` documenting:
- 17 files modified with verbose grep output showing gate presence
- Curl verification results (status codes for flag=true vs flag=false vs unauthenticated)
- Special note for OAuth callback handling (was tenantId resolved from session or OAuth state?)
- Build status
</output>
