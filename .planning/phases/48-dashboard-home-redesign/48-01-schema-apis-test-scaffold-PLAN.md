---
phase: 48
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/050_checklist_overrides.sql
  - src/app/api/setup-checklist/route.js
  - src/app/api/usage/route.js
  - tests/unit/setup-checklist-derive.test.js
  - tests/unit/usage-api.test.js
  - tests/unit/setup-checklist.test.js
  - tests/unit/usage-tile.test.js
  - tests/unit/chat-provider.test.js
  - tests/unit/chat-panel.test.js
  - tests/unit/help-discoverability.test.js
autonomous: false
requirements: [HOME-01, HOME-02, HOME-03, HOME-04, HOME-05, HOME-06, HOME-07]  # Plan 48-01 Task 1 scaffolds Wave-0 test files for all 7 HOME-XX IDs; HOME-02 + HOME-03 are also implemented here (migration + /api/usage + /api/setup-checklist extension). HOME-01/04/05/06/07 implementations land in Plans 02–05 but their test scaffolds live here.
tags: [dashboard, supabase, migration, api, usage, checklist]
user_setup: []

must_haves:
  truths:
    - "Running migration 050 adds checklist_overrides JSONB column to tenants"
    - "Supabase db push has been executed so the live DB has the new column before any code reads/writes it"
    - "GET /api/usage returns {callsUsed, callsIncluded, cycleDaysLeft, overageDollars} for authenticated tenant"
    - "PATCH /api/setup-checklist accepts {item_id, mark_done:true|false} and {item_id, dismiss:true|false} and persists per-item overrides"
    - "deriveChecklistItems() applies overrides on top of auto-detected state, with mark_done forcing complete:true and dismiss excluding the item"
    - "Wave 0 test files exist for every HOME-XX automated verification listed in 48-RESEARCH.md Validation Architecture"
  artifacts:
    - path: "supabase/migrations/050_checklist_overrides.sql"
      provides: "checklist_overrides JSONB column + documentation comment"
      contains: "ALTER TABLE tenants ADD COLUMN checklist_overrides JSONB"
    - path: "src/app/api/usage/route.js"
      provides: "GET /api/usage handler"
      exports: ["GET"]
    - path: "src/app/api/setup-checklist/route.js"
      provides: "GET + PATCH handlers extended with per-item mark_done/dismiss and setup_profile/setup_billing items"
      exports: ["GET", "PATCH"]
    - path: "tests/unit/setup-checklist-derive.test.js"
      provides: "Unit tests for server-side completion detection + override logic"
      contains: "describe('deriveChecklistItems'"
    - path: "tests/unit/usage-api.test.js"
      provides: "Unit tests for /api/usage computation"
      contains: "describe('/api/usage'"
  key_links:
    - from: "src/app/api/setup-checklist/route.js"
      to: "tenants.checklist_overrides"
      via: "supabase.from('tenants').update({ checklist_overrides })"
      pattern: "checklist_overrides"
    - from: "src/app/api/usage/route.js"
      to: "subscriptions (calls_used, calls_limit, current_period_end, plan_id) + PRICING_TIERS"
      via: "createSupabaseServer() auth then service-role read"
      pattern: "calls_used.*calls_limit|PRICING_TIERS"
---

<objective>
Ship the database + API + test-scaffold foundation Phase 48 depends on.

Purpose: Every other plan in Phase 48 needs (a) per-item checklist override storage, (b) the usage meter data endpoint, and (c) Jest scaffolds for the 7 Wave-0 test files cited in 48-RESEARCH.md. Doing it all in Wave 1 unblocks Waves 2+3 to run in parallel.
Output:
 - Supabase migration `050_checklist_overrides.sql` applied via `supabase db push`
 - Extended `/api/setup-checklist` handlers (GET returns themed groups + new items; PATCH accepts per-item mark_done/dismiss with validation)
 - New `/api/usage` GET endpoint
 - Seven failing Wave-0 test files (RED) ready for later waves to turn GREEN
</objective>

<execution_context>
@/Users/leroyngzz/Projects/homeservice_agent/.claude/get-shit-done/workflows/execute-plan.md
@/Users/leroyngzz/Projects/homeservice_agent/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/48-dashboard-home-redesign/48-CONTEXT.md
@.planning/phases/48-dashboard-home-redesign/48-RESEARCH.md
@.planning/phases/48-dashboard-home-redesign/48-UI-SPEC.md
@.claude/skills/auth-database-multitenancy/SKILL.md
@.claude/skills/payment-architecture/SKILL.md
@.claude/skills/dashboard-crm-system/SKILL.md
@src/app/api/setup-checklist/route.js
@src/app/api/billing/data/route.js
@src/app/(public)/pricing/pricingData.js
@src/lib/supabase-server.js
@supabase/migrations/010_billing_schema.sql

<interfaces>
<!-- Contracts downstream plans depend on. Executor MUST match these exactly. -->

GET /api/setup-checklist response shape (extended):
```json
{
  "items": [
    { "id": "setup_profile", "theme": "profile", "required": true,  "complete": true,  "dismissed": false, "mark_done_override": false, "title": "...", "description": "...", "href": "/dashboard/settings#profile" },
    { "id": "configure_services", "theme": "voice", "required": true, "complete": false, "dismissed": false, "mark_done_override": false, "title": "...", "description": "...", "href": "/dashboard/services" }
    // ...
  ],
  "dismissedGlobal": false,
  "progress": { "total": 10, "complete": 4, "percent": 40 }
}
```

PATCH /api/setup-checklist request bodies (server must accept ALL three shapes):
```json
// whole-checklist dismiss (existing behavior, preserve)
{ "dismissed": true }

// per-item mark_done (new)
{ "item_id": "configure_services", "mark_done": true }  // or false to clear

// per-item dismiss (new)
{ "item_id": "configure_services", "dismiss": true }   // or false to undo
```
PATCH response: `{ "success": true, "item": { /* updated item or null */ } }`

GET /api/usage response shape:
```json
{ "callsUsed": 42, "callsIncluded": 200, "cycleDaysLeft": 12, "overageDollars": 0 }
```
401 when unauthenticated. 404 when tenant has no subscription.

VALID_ITEM_IDS (must be exported from api/setup-checklist/route.js for PATCH validation):
```js
export const VALID_ITEM_IDS = [
  'setup_profile',
  'configure_services', 'make_test_call', 'configure_hours',
  'configure_notifications', 'configure_call_routing',
  'connect_calendar', 'configure_zones', 'setup_escalation',
  'setup_billing',
];
```

Theme → items map (per RESEARCH Pattern 4):
```js
export const THEME_GROUPS = {
  profile:  ['setup_profile'],
  voice:    ['configure_services', 'make_test_call', 'configure_hours', 'configure_notifications', 'configure_call_routing'],
  calendar: ['connect_calendar', 'configure_zones', 'setup_escalation'],
  billing:  ['setup_billing'],
};
```

Required vs recommended (badge — NOT grouping, per D-02):
- required: setup_profile, configure_services, make_test_call, configure_hours, setup_billing
- recommended: all others
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Wave 0 — test scaffolds (RED) for all 7 Phase 48 automated suites</name>
  <files>
    tests/unit/setup-checklist-derive.test.js,
    tests/unit/usage-api.test.js,
    tests/unit/setup-checklist.test.js,
    tests/unit/usage-tile.test.js,
    tests/unit/chat-provider.test.js,
    tests/unit/chat-panel.test.js,
    tests/unit/help-discoverability.test.js
  </files>
  <read_first>
    .planning/phases/48-dashboard-home-redesign/48-RESEARCH.md (Validation Architecture → Phase Requirements → Test Map),
    .planning/phases/48-dashboard-home-redesign/48-VALIDATION.md,
    jest.config.js,
    tests/unit/chat-message-parse.test.js (existing pattern reference),
    tests/unit/chatbot-knowledge.test.js (existing pattern reference)
  </read_first>
  <behavior>
    Each test file must contain at least one `describe` block and one failing `it`/`test` that RED-asserts the shape required by later waves. These tests MUST fail at this task's completion (implementation comes in Task 2–4 + Plans 02–05) and be structured so later plans simply add more cases.
    - setup-checklist-derive.test.js: `describe('deriveChecklistItems')` — RED test "returns theme groupings profile/voice/calendar/billing", RED test "mark_done override forces complete:true", RED test "dismiss override removes item from list".
    - usage-api.test.js: `describe('/api/usage GET')` — RED test "returns {callsUsed, callsIncluded, cycleDaysLeft, overageDollars}", RED test "overageDollars = 0 when callsUsed <= callsIncluded", RED test "overageDollars = (used-included) * planRate when over cap".
    - setup-checklist.test.js: `describe('SetupChecklist')` — RED test "renders 4 theme accordions in order profile/voice/calendar/billing", RED test "Dismiss button fires PATCH /api/setup-checklist with {item_id, dismiss:true}", RED test "Mark done button fires PATCH with {item_id, mark_done:true}".
    - usage-tile.test.js: `describe('UsageTile thresholds')` — RED test "bar fill copper (bg-[#C2410C]) when percent < 75", RED test "bar fill amber-600 when 75 <= percent < 100", RED test "bar fill red-700 when percent >= 100".
    - chat-provider.test.js: `describe('ChatProvider')` — RED test "useChatContext exposes {messages, isLoading, sendMessage}", RED test "messages sent via one consumer visible to another consumer (shared state)", RED test "currentRoute from context is forwarded to POST /api/chat body".
    - chat-panel.test.js: `describe('ChatPanel')` — RED test "renders messages from useChatContext", RED test "submitting input calls sendMessage from context".
    - help-discoverability.test.js: `describe('HelpDiscoverabilityCard')` — RED test "renders 3 to 4 tiles each with a Link whose href is a /dashboard route", RED test "tile labels match verb+noun sentence-case pattern".

    Use `@testing-library/react` + `jest.fn()` + `whatwg-fetch` polyfill only if not already in jest setup. Do NOT install new packages — all required testing deps are already present per package.json (verify with `grep "@testing-library" package.json` before writing).
  </behavior>
  <action>
    Create each of the 7 test files. Use CommonJS require() if existing tests use CJS, else ESM imports — match the style of `tests/unit/chat-message-parse.test.js` exactly. Each file begins with:
    ```js
    /** RED (Wave 0): will be made GREEN by Plan 0X — do not delete */
    ```
    Use `jest.mock()` to stub `@/lib/supabase-server` and `fetch` where needed. Tests SHOULD throw "not implemented" or assert against imports that don't exist yet — that is the intended RED state. The goal is to lock test names/IDs so the Validation table in 48-VALIDATION.md stays stable.

    48-VALIDATION.md is already populated pre-execution (Test Infrastructure block, Sampling Rate, Per-Task Verification Map, Wave 0 Requirements, Manual-Only Verifications). The executor does NOT fill those sections — instead, update the `Status` column of the Per-Task Verification Map rows as each scaffold is added (⬜ pending → ✅ green for this task when all 7 files exist and `grep -l "RED (Wave 0)" tests/unit/*.test.js | wc -l` returns 7). Leave `nyquist_compliant: false` — it flips to `true` only at Plan 48-05 Task 3 checkpoint close.
  </action>
  <verify>
    <automated>npx jest --testPathPattern="tests/unit/(setup-checklist-derive|usage-api|setup-checklist\.test|usage-tile|chat-provider|chat-panel|help-discoverability)" --no-coverage 2>&1 | tail -20</automated>
  </verify>
  <done>
    All 7 files exist. `npx jest ...` reports failures (RED is expected). `grep -l "RED (Wave 0)" tests/unit/*.test.js | wc -l` returns 7. 48-VALIDATION.md Per-Task Verification Map Status column updated for the 48-01-01 row (Test Infrastructure block was pre-populated by the planner).
  </done>
  <acceptance_criteria>
    `ls tests/unit/setup-checklist-derive.test.js tests/unit/usage-api.test.js tests/unit/setup-checklist.test.js tests/unit/usage-tile.test.js tests/unit/chat-provider.test.js tests/unit/chat-panel.test.js tests/unit/help-discoverability.test.js` prints all 7 paths with no "No such file" error.
    `grep -c "describe(" tests/unit/setup-checklist-derive.test.js` returns >= 1.
    `grep -q "RED (Wave 0)" tests/unit/usage-api.test.js` exits 0.
    `grep -q "Framework.*Jest" .planning/phases/48-dashboard-home-redesign/48-VALIDATION.md` exits 0 (pre-populated — verifies the planner-provided contract survived).
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Write migration 050_checklist_overrides.sql</name>
  <files>supabase/migrations/050_checklist_overrides.sql</files>
  <read_first>
    supabase/migrations/010_billing_schema.sql,
    supabase/migrations/049_vip_caller_routing.sql (latest migration — style reference),
    .claude/skills/auth-database-multitenancy/SKILL.md,
    .planning/phases/48-dashboard-home-redesign/48-RESEARCH.md (Pitfall 3 + Open Questions #1)
  </read_first>
  <action>
    Create `supabase/migrations/050_checklist_overrides.sql`. Exact content:
    ```sql
    -- Phase 48: Per-item setup checklist override storage
    -- Adds JSONB map for { [item_id]: { mark_done?: bool, dismissed?: bool } }
    -- Follows existing notification_preferences JSONB pattern on tenants.
    ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS checklist_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

    COMMENT ON COLUMN tenants.checklist_overrides IS
      'Per-item overrides for setup checklist. Shape: { [item_id]: { mark_done?: boolean, dismissed?: boolean } }. Used by /api/setup-checklist PATCH. Validated against VALID_ITEM_IDS in application layer.';

    -- No RLS policy change needed — existing "Owners manage own tenant" policy (migration 001) already covers UPDATE.
    ```
    Do NOT modify any existing migration file. Do NOT run `supabase db push` yet — that is Task 3 (blocking checkpoint).
  </action>
  <verify>
    <automated>test -f supabase/migrations/050_checklist_overrides.sql &amp;&amp; grep -q "ADD COLUMN IF NOT EXISTS checklist_overrides JSONB" supabase/migrations/050_checklist_overrides.sql &amp;&amp; grep -q "DEFAULT '{}'::jsonb" supabase/migrations/050_checklist_overrides.sql</automated>
  </verify>
  <done>
    Migration file created. Column definition present. Comment present. No other migration files modified.
  </done>
  <acceptance_criteria>
    `test -f supabase/migrations/050_checklist_overrides.sql` exits 0.
    `grep -c "ALTER TABLE tenants" supabase/migrations/050_checklist_overrides.sql` returns 1.
    `grep -c "checklist_overrides JSONB" supabase/migrations/050_checklist_overrides.sql` returns >= 1.
    `git status supabase/migrations/` shows ONLY 050_checklist_overrides.sql as new; no other migration files modified.
  </acceptance_criteria>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3: [BLOCKING] Apply migration via supabase db push</name>
  <files>supabase/migrations/050_checklist_overrides.sql (already exists; this task applies it)</files>
  <read_first>
    supabase/migrations/050_checklist_overrides.sql,
    .planning/phases/48-dashboard-home-redesign/48-RESEARCH.md (schema_push_requirement)
  </read_first>
  <what-built>
    Task 2 wrote migration 050 but the live Supabase DB does not yet have the `checklist_overrides` column. Task 4 will write API code that SELECTs and UPDATEs that column — this MUST fail at runtime until the schema is pushed.
  </what-built>
  <how-to-verify>
    1. Ensure `SUPABASE_ACCESS_TOKEN` is exported in the shell (or user is logged in via `supabase login`).
    2. Run: `supabase db push`
       - If the CLI prompts interactively and cannot be suppressed, fallback: `npx supabase db push --include-all` against local instance, then manually apply to remote via Studio SQL editor (paste the contents of 050_checklist_overrides.sql).
    3. Verify the column exists:
       ```
       supabase db execute --query "SELECT column_name FROM information_schema.columns WHERE table_name='tenants' AND column_name='checklist_overrides';"
       ```
       Expected output includes `checklist_overrides`.
    4. Regenerate types if the project uses generated types:
       `supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/lib/supabase-types.ts` (skip if project uses JS-only + schema inference).
  </how-to-verify>
  <action>
    Execute `supabase db push`. Block execution of Task 4 until human types "applied" or confirms the column exists. If push fails, stop and surface error to user — do not proceed.
  </action>
  <verify>
    <automated>echo "Manual verification: run 'supabase db execute --query \"SELECT column_name FROM information_schema.columns WHERE table_name='\\''tenants'\\'' AND column_name='\\''checklist_overrides'\\'';\"' and confirm column is present"</automated>
  </verify>
  <done>
    Live Supabase DB has `tenants.checklist_overrides` column with JSONB type and default `{}`.
  </done>
  <acceptance_criteria>
    Human confirms migration applied OR automated check `supabase db execute ...` returns a row containing `checklist_overrides`.
  </acceptance_criteria>
  <resume-signal>Type "applied" when the migration has been pushed and column verified, or paste the error output if push failed.</resume-signal>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Extend /api/setup-checklist (themes + per-item overrides) and build /api/usage</name>
  <files>src/app/api/setup-checklist/route.js, src/app/api/usage/route.js</files>
  <read_first>
    src/app/api/setup-checklist/route.js (CURRENT implementation — deriveChecklistItems + PATCH),
    src/app/api/billing/data/route.js (auth pattern for usage route),
    src/lib/supabase-server.js (createSupabaseServer),
    src/app/(public)/pricing/pricingData.js (PRICING_TIERS, overageRate per plan),
    supabase/migrations/010_billing_schema.sql (subscriptions columns),
    tests/unit/setup-checklist-derive.test.js (RED tests from Task 1 — target),
    tests/unit/usage-api.test.js (RED tests from Task 1 — target),
    .planning/phases/48-dashboard-home-redesign/48-RESEARCH.md (Pattern 4, Pattern 5, Pattern 6, Pitfall 3, Pitfall 4)
  </read_first>
  <behavior>
    After this task:
    - `GET /api/setup-checklist` returns items with a `theme` field (one of `profile`/`voice`/`calendar`/`billing`), a `required` boolean (kept for badge rendering), and includes two new items `setup_profile` + `setup_billing` (per RESEARCH Pattern 4).
    - Completion detection for `setup_profile`: `tenants.business_name IS NOT NULL AND length(trim(business_name)) > 0`.
    - Completion detection for `setup_billing`: subscription row exists with `status IN ('trialing','active','past_due')` and `is_current = true`.
    - Completion detection for `make_test_call`: unchanged (existing logic).
    - Overrides applied AFTER auto-detection: if `checklist_overrides[item_id]?.mark_done === true` → force `complete:true`; if `...dismissed === true` → exclude from `items` array.
    - `PATCH /api/setup-checklist` accepts all 3 body shapes (see interfaces block). Unknown `item_id` → 400 with `{error: 'Invalid item_id'}`. Non-boolean `mark_done`/`dismiss` → 400. Tenant scoping: always via `getTenantId()` — never trust body-supplied tenant_id (V4 access control).
    - `GET /api/usage` returns `{callsUsed, callsIncluded, cycleDaysLeft, overageDollars}` per interfaces. 401 unauth, 404 when no active subscription row.

    Input validation (V5): zod schema at top of PATCH handler:
    ```js
    const PatchSchema = z.union([
      z.object({ dismissed: z.boolean() }).strict(),
      z.object({ item_id: z.enum(VALID_ITEM_IDS), mark_done: z.boolean() }).strict(),
      z.object({ item_id: z.enum(VALID_ITEM_IDS), dismiss: z.boolean() }).strict(),
    ]);
    ```
    (Use existing zod install — it's already a project dep; verify with `grep '"zod"' package.json`.)

    Tests written in Task 1 must turn GREEN. Add new describe cases ONLY for the exported `THEME_GROUPS` / `VALID_ITEM_IDS` constants if the initial RED stubs do not already cover them.
  </behavior>
  <action>
    1. Export `VALID_ITEM_IDS` and `THEME_GROUPS` constants (see interfaces block) from `src/app/api/setup-checklist/route.js` so test files and SetupChecklist.jsx can import them.
    2. Extend `deriveChecklistItems(supabase, tenantId)`:
       - Parallel-fetch with `Promise.all`: existing queries PLUS `tenants.business_name` (already in tenant row) and subscription status.
       - Build item objects with `theme`, `required`, `complete`, `dismissed`, `mark_done_override` fields.
       - Apply `checklist_overrides` from the tenants row AFTER auto-detection.
       - Order items by theme: profile → voice → calendar → billing (matches UI-SPEC accordion order).
    3. Extend PATCH handler: zod validate body; branch on body shape; for `mark_done` / `dismiss` per-item, read current `checklist_overrides`, merge, write back with `supabase.from('tenants').update({ checklist_overrides: newOverrides }).eq('id', tenantId)`. Return updated item (re-derive then filter to requested item) or `{success:true}` for global dismiss (existing behavior preserved).
    4. Create `src/app/api/usage/route.js` per RESEARCH Code Example "Usage Meter Data Route Pattern" lines 436–465, but use `getTenantId()` helper (follow existing `/api/setup-checklist` auth pattern) rather than re-querying `tenants.owner_id`. Import `PRICING_TIERS` from `@/app/(public)/pricing/pricingData`. Handle missing/null subscription by returning 404 with `{error:'No active subscription'}`.
    5. Rate limiting: `/api/usage` GET is low-cost (one query). Skip rate limiting unless existing middleware already applies project-wide (check `src/middleware.js` with grep). PATCH on setup-checklist: if existing rate-limit middleware is present (grep `rateLimit\|ratelimit`), include the same wrapper here; otherwise document "No rate limit middleware detected — not adding new pattern in this phase" in code comment and move on.

    Implementation note for currentRoute / performance: cycle-days-left math must use server's `new Date()` (UTC) — do not trust client clock.
  </action>
  <verify>
    <automated>npx jest --testPathPattern="tests/unit/(setup-checklist-derive|usage-api)" --no-coverage 2>&amp;1 | tail -10</automated>
  </verify>
  <done>
    - `GET /api/setup-checklist` returns themed items incl. setup_profile + setup_billing.
    - PATCH accepts per-item mark_done/dismiss and persists to tenants.checklist_overrides.
    - PATCH rejects unknown item_id with 400.
    - `GET /api/usage` returns the 4-field payload with correct overageDollars math.
    - Both derive and usage test files GREEN.
  </done>
  <acceptance_criteria>
    `grep -q "export const VALID_ITEM_IDS" src/app/api/setup-checklist/route.js` exits 0.
    `grep -q "export const THEME_GROUPS" src/app/api/setup-checklist/route.js` exits 0.
    `grep -q "setup_profile" src/app/api/setup-checklist/route.js` exits 0.
    `grep -q "setup_billing" src/app/api/setup-checklist/route.js` exits 0.
    `grep -q "checklist_overrides" src/app/api/setup-checklist/route.js` exits 0.
    `test -f src/app/api/usage/route.js` exits 0.
    `grep -q "PRICING_TIERS" src/app/api/usage/route.js` exits 0.
    `grep -q "cycleDaysLeft" src/app/api/usage/route.js` exits 0.
    `npx jest tests/unit/setup-checklist-derive.test.js --no-coverage` exits 0 (GREEN).
    `npx jest tests/unit/usage-api.test.js --no-coverage` exits 0 (GREEN).
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → Next.js API route | Authenticated owner calls PATCH /api/setup-checklist and GET /api/usage. Body/query parameters crossing here must be validated. |
| Next.js API route → Supabase (service role) | Writes to `tenants.checklist_overrides` must be scoped to the caller's tenant via `getTenantId()`. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-48-01 | Tampering | PATCH /api/setup-checklist body | mitigate | zod strict schema; VALID_ITEM_IDS enum rejects unknown item_id (ASVS V5.1.3); booleans only for mark_done/dismiss. |
| T-48-02 | Elevation of Privilege | PATCH per-item overrides | mitigate | tenantId derived from session via getTenantId() (ASVS V4.1.1) — never accept tenant_id from request body; RLS on tenants table already enforces owner-only UPDATE. |
| T-48-03 | Information Disclosure | GET /api/usage subscription data | mitigate | `createSupabaseServer()` + `getTenantId()`; return 401 when unauthenticated; 404 only when NO subscription exists (no cross-tenant enumeration). |
| T-48-04 | Denial of Service | JSONB bloat on checklist_overrides | mitigate | VALID_ITEM_IDS enum caps the key space at ~10 entries; values are booleans → max row size bounded. Cite ASVS V5.1.4 structured data validation. |
| T-48-05 | Repudiation | Missing audit trail for checklist changes | accept | Low-value target — manual checklist overrides are reversible (Undo toast + window-focus refetch). Existing `activity_log` is reserved for call/lead events; adding checklist audit is out of Phase 48 scope. |
| T-48-06 | Spoofing | GET /api/usage unauthenticated access | mitigate | `createSupabaseServer()` validates Supabase JWT via httpOnly cookie; 401 on missing session (ASVS V2.1.1). |
</threat_model>

<verification>
- Migration 050 file created AND applied (via Task 3 blocking checkpoint).
- PATCH /api/setup-checklist rejects unknown item_id with 400.
- GET /api/usage returns correct overageDollars for Starter/Growth/Scale plans.
- All 7 Wave-0 test files exist. setup-checklist-derive + usage-api tests turn GREEN by end of Task 4. Remaining 5 test files stay RED (intentional — made GREEN by Plans 02–05).
- `48-VALIDATION.md` Test Infrastructure block filled.
</verification>

<success_criteria>
- [ ] `supabase/migrations/050_checklist_overrides.sql` exists and is applied to the live DB.
- [ ] `src/app/api/usage/route.js` GET returns `{callsUsed, callsIncluded, cycleDaysLeft, overageDollars}` shape.
- [ ] `src/app/api/setup-checklist/route.js` exports `VALID_ITEM_IDS` and `THEME_GROUPS`.
- [ ] PATCH accepts per-item `{item_id, mark_done}` and `{item_id, dismiss}` shapes.
- [ ] Two of seven Wave-0 tests GREEN (derive + usage-api); five stay RED (owned by later plans).
</success_criteria>

<output>
After completion, create `.planning/phases/48-dashboard-home-redesign/48-01-SUMMARY.md` documenting: migration applied timestamp, VALID_ITEM_IDS list, THEME_GROUPS map, usage route overage math cited from pricingData.js, RED tests remaining (by filename).
</output>
