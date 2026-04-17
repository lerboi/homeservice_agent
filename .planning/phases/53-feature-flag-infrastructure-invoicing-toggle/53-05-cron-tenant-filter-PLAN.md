---
phase: 53
plan: 05
type: execute
wave: 3
depends_on: [1, 2]
files_modified:
  - src/app/api/cron/invoice-reminders/route.js
  - src/app/api/cron/recurring-invoices/route.js
autonomous: true
requirements:
  - TOGGLE-02
  - TOGGLE-04
must_haves:
  truths:
    - "invoice-reminders cron processes ONLY invoices belonging to tenants with features_enabled.invoicing = true"
    - "recurring-invoices cron processes ONLY templates belonging to tenants with features_enabled.invoicing = true"
    - "When ALL tenants have invoicing disabled, the crons run cleanly (no errors), report 0 reminders/0 generated, and finish quickly"
    - "When all tenants have invoicing enabled, the crons run with their existing behavior unchanged"
    - "The JSONB filter syntax `.eq('features_enabled->>invoicing', 'true')` is verified against the live DB and returns the expected enabled-tenants list (Assumption A1 closed)"
  artifacts:
    - path: "src/app/api/cron/invoice-reminders/route.js"
      provides: "Reminder dispatch cron that pre-filters to enabled tenants"
      contains: "features_enabled->>invoicing"
    - path: "src/app/api/cron/recurring-invoices/route.js"
      provides: "Recurring invoice generation cron that pre-filters to enabled tenants"
      contains: "features_enabled->>invoicing"
  key_links:
    - from: "src/app/api/cron/invoice-reminders/route.js"
      to: "tenants.features_enabled"
      via: "supabase.from('tenants').select('id').eq('features_enabled->>invoicing', 'true')"
      pattern: "features_enabled->>invoicing"
    - from: "src/app/api/cron/recurring-invoices/route.js"
      to: "tenants.features_enabled"
      via: "supabase.from('tenants').select('id').eq('features_enabled->>invoicing', 'true')"
      pattern: "features_enabled->>invoicing"
---

<objective>
Filter the two invoice-related cron jobs to skip tenants with `features_enabled.invoicing = false`. The crons must continue to process every invoicing-enabled tenant exactly as before, and silently skip every flagged-off tenant — no errors logged, no reminders sent, no draft invoices generated.

Purpose: Closes TOGGLE-02 (cron surface) and TOGGLE-04 (toggle has no data-loss because crons stop touching the tenant's data). Without this, a tenant who disables invoicing would still receive automated payment reminder emails to their customers — a serious user-trust violation.

Key risk: This plan's correctness hinges on Assumption A1 from RESEARCH.md — the JSONB filter syntax `.eq('features_enabled->>invoicing', 'true')` (string `'true'`, not boolean `true`). If wrong, the filter silently returns zero tenants and EVERY cron skips EVERY tenant, even those with invoicing on. Task 3 includes an explicit live-DB verification step.

Output: 2 files modified. Each cron is restructured so its top-level query is preceded by a "fetch enabled tenant IDs" lookup, then the existing query is filtered with `.in('tenant_id', enabledTenantIds)`.
</objective>

<execution_context>
@C:/Users/leheh/.Projects/homeservice_agent/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/leheh/.Projects/homeservice_agent/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-CONTEXT.md
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md
@src/app/api/cron/invoice-reminders/route.js
@src/app/api/cron/recurring-invoices/route.js
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-02-SUMMARY.md

<interfaces>
Both crons use the service-role client (`import { supabase } from '@/lib/supabase';`).

From src/app/api/cron/invoice-reminders/route.js (current top-level query — lines 36-46):
```js
const { data: invoices, error: invoiceError } = await supabase
  .from('invoices')
  .select(`
    id, invoice_number, due_date, total, status, tenant_id,
    customer_name, customer_email, customer_phone,
    reminders_enabled
  `)
  .in('status', ['sent', 'overdue', 'partially_paid'])
  .eq('reminders_enabled', true)
  .not('due_date', 'is', null);
```
And later (lines 178-185 for the late-fee section):
```js
const { data: overdueInvoices, error: overdueError } = await supabase
  .from('invoices')
  .select(`
    id, invoice_number, total, due_date, status, tenant_id,
    late_fee_applied_at
  `)
  .in('status', ['overdue', 'partially_paid'])
  .lt('due_date', today);
```
BOTH queries need the tenant filter applied.

From src/app/api/cron/recurring-invoices/route.js (current top-level query — lines 30-37):
```js
const { data: templates, error: queryError } = await supabase
  .from('invoices')
  .select('*')
  .eq('is_recurring_template', true)
  .eq('recurring_active', true)
  .lte('recurring_next_date', today)
  .or('recurring_end_date.is.null,recurring_end_date.gte.' + today);
```
This single query needs the tenant filter.

Per RESEARCH Pattern 9 + Pitfall 2: PostgREST `->>` operator returns TEXT. The filter literal value MUST be the string `'true'`, NOT the JS boolean `true`. Wrong syntax silently matches zero tenants.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Filter invoice-reminders cron to invoicing-enabled tenants only</name>
  <files>src/app/api/cron/invoice-reminders/route.js</files>
  <read_first>
    - src/app/api/cron/invoice-reminders/route.js (full 287-line file — TWO queries need filtering: lines 37-46 reminder dispatch, lines 178-185 late fee application)
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md Pattern 9 + Pitfall 2 (string `'true'` requirement)
  </read_first>
  <action>
Add a SINGLE pre-fetch of enabled tenant IDs at the top of the handler (after the auth check, before the first invoice query). Use this list to filter BOTH the reminder query AND the late-fee query.

INSERT this block immediately after the existing `let lateFeesApplied = 0;` line (around line 31), before the `// ─── PART 1` comment:

```js
  // ── Phase 53 — feature flag pre-filter ──────────────────────────────────
  // Skip every tenant with features_enabled.invoicing = false. PostgREST `->>`
  // returns TEXT, so the literal value MUST be the string 'true' (not boolean
  // true). Wrong syntax silently matches zero tenants and disables the cron
  // for everyone. Verified against live DB during Plan 05 Task 3.
  const { data: enabledTenants, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .eq('features_enabled->>invoicing', 'true');

  if (tenantError) {
    console.error('[invoice-reminders] Failed to fetch enabled tenants:', tenantError);
    return Response.json({ error: 'Tenant filter failed' }, { status: 500 });
  }

  const enabledTenantIds = (enabledTenants || []).map((t) => t.id);

  // Short-circuit when no tenants are enabled — saves the rest of the queries.
  if (enabledTenantIds.length === 0) {
    console.log('[invoice-reminders] No tenants with invoicing enabled — skipping');
    return Response.json({ reminders_sent: 0, late_fees_applied: 0 });
  }
```

THEN modify the EXISTING reminder-dispatch query (around line 37) to add `.in('tenant_id', enabledTenantIds)`:

```js
    const { data: invoices, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        id, invoice_number, due_date, total, status, tenant_id,
        customer_name, customer_email, customer_phone,
        reminders_enabled
      `)
      .in('tenant_id', enabledTenantIds)              // ← Phase 53 filter
      .in('status', ['sent', 'overdue', 'partially_paid'])
      .eq('reminders_enabled', true)
      .not('due_date', 'is', null);
```

THEN modify the EXISTING late-fee query (around line 178) similarly:

```js
    const { data: overdueInvoices, error: overdueError } = await supabase
      .from('invoices')
      .select(`
        id, invoice_number, total, due_date, status, tenant_id,
        late_fee_applied_at
      `)
      .in('tenant_id', enabledTenantIds)              // ← Phase 53 filter
      .in('status', ['overdue', 'partially_paid'])
      .lt('due_date', today);
```

Do NOT modify any other query in the file (the per-invoice `invoice_reminders.upsert`, the per-tenant settings/tenant fetches inside the loop). Those operate on already-filtered invoices, so they're inherently scoped.

Do NOT change the response shape — the cron still returns `{ reminders_sent, late_fees_applied }`.

Do NOT change auth (CRON_SECRET Bearer remains).
  </action>
  <verify>
    <automated>grep -q "features_enabled->>invoicing" src/app/api/cron/invoice-reminders/route.js && grep -q "enabledTenantIds = (enabledTenants" src/app/api/cron/invoice-reminders/route.js && [ "$(grep -c "\.in('tenant_id', enabledTenantIds)" src/app/api/cron/invoice-reminders/route.js)" -ge "2" ] && grep -q "if (enabledTenantIds.length === 0)" src/app/api/cron/invoice-reminders/route.js && npm run build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - File contains the literal string `.eq('features_enabled->>invoicing', 'true')` (the string `'true'`, NOT boolean `true`)
    - File contains `const enabledTenantIds = (enabledTenants || []).map((t) => t.id);`
    - File contains a short-circuit `if (enabledTenantIds.length === 0)` early return
    - File contains AT LEAST 2 occurrences of `.in('tenant_id', enabledTenantIds)` (one for reminder dispatch, one for late-fee application)
    - File does NOT contain `.eq('features_enabled->>invoicing', true)` (boolean — would silently fail)
    - The `Response.json({ reminders_sent: 0, late_fees_applied: 0 })` early-return is the same shape as the normal return path
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>invoice-reminders cron now skips tenants with invoicing off. When all tenants have it off, cron exits in <1s with the no-op response.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Filter recurring-invoices cron to invoicing-enabled tenants only</name>
  <files>src/app/api/cron/recurring-invoices/route.js</files>
  <read_first>
    - src/app/api/cron/recurring-invoices/route.js (full 195-line file — single top-level query at lines 30-37)
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md Pattern 9 + Pitfall 2
  </read_first>
  <action>
Insert the same pre-fetch + short-circuit block as Task 1 — but adapted to this cron's response shape (`{ generated }` instead of `{ reminders_sent, late_fees_applied }`).

INSERT this block immediately after the auth check (after `console.log('401: Unauthorized'); return ...; }` block, before `const today = new Date()...`):

```js
  // ── Phase 53 — feature flag pre-filter ──────────────────────────────────
  // Skip every tenant with features_enabled.invoicing = false. PostgREST `->>`
  // returns TEXT, so the literal value MUST be the string 'true' (not boolean
  // true). Wrong syntax silently matches zero tenants and disables the cron
  // for everyone. Verified against live DB during Plan 05 Task 3.
  const { data: enabledTenants, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .eq('features_enabled->>invoicing', 'true');

  if (tenantError) {
    console.error('[recurring-invoices] Failed to fetch enabled tenants:', tenantError);
    return Response.json({ error: 'Tenant filter failed' }, { status: 500 });
  }

  const enabledTenantIds = (enabledTenants || []).map((t) => t.id);

  if (enabledTenantIds.length === 0) {
    console.log('[recurring-invoices] No tenants with invoicing enabled — skipping');
    return Response.json({ generated: 0 });
  }
```

THEN modify the EXISTING templates query (lines 30-37) to add `.in('tenant_id', enabledTenantIds)`:

```js
  const { data: templates, error: queryError } = await supabase
    .from('invoices')
    .select('*')
    .eq('is_recurring_template', true)
    .eq('recurring_active', true)
    .in('tenant_id', enabledTenantIds)             // ← Phase 53 filter
    .lte('recurring_next_date', today)
    .or('recurring_end_date.is.null,recurring_end_date.gte.' + today);
```

Do NOT modify the inner-loop queries (template's line items fetch, invoice_settings fetch, RPC call, insert into invoices, insert into invoice_line_items, template update). Those operate on templates that already passed the tenant filter.

Do NOT change the response shape — still `{ generated }`.

Do NOT change auth.
  </action>
  <verify>
    <automated>grep -q "features_enabled->>invoicing" src/app/api/cron/recurring-invoices/route.js && grep -q "enabledTenantIds = (enabledTenants" src/app/api/cron/recurring-invoices/route.js && grep -q "\.in('tenant_id', enabledTenantIds)" src/app/api/cron/recurring-invoices/route.js && grep -q "if (enabledTenantIds.length === 0)" src/app/api/cron/recurring-invoices/route.js && npm run build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - File contains `.eq('features_enabled->>invoicing', 'true')` (string `'true'`)
    - File contains `const enabledTenantIds = (enabledTenants || []).map((t) => t.id);`
    - File contains the short-circuit `if (enabledTenantIds.length === 0) { ... return Response.json({ generated: 0 }); }`
    - File contains exactly one `.in('tenant_id', enabledTenantIds)` call (in the templates query)
    - File does NOT contain `.eq('features_enabled->>invoicing', true)` (boolean — would silently fail)
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>recurring-invoices cron now skips tenants with invoicing off.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Verify Assumption A1 — JSONB filter syntax against live database</name>
  <files>(none — this is a verification-only task that runs queries against the live DB and records the outcome)</files>
  <read_first>
    - src/app/api/cron/invoice-reminders/route.js (Task 1 output — confirm filter syntax matches what we test)
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md Assumption A1
  </read_first>
  <action>
Execute the following live-database verifications. Each query MUST return the expected result; if any does not, STOP and report — the cron filter is wrong and Tasks 1/2 must be rewritten with the correct syntax.

STEP 1 — Set the dev's own tenant features_enabled.invoicing to true (via SQL or via the Plan 07 toggle once it ships; for this verification step, use SQL directly):

```bash
supabase db execute --query "UPDATE tenants SET features_enabled = '{\"invoicing\": true}'::jsonb WHERE id = (SELECT id FROM tenants LIMIT 1) RETURNING id, features_enabled;"
```

Confirm the update succeeded — output should show one row with features_enabled = `{"invoicing": true}`.

STEP 2 — Run the EXACT filter that both crons use, via the Supabase CLI psql session:

```bash
# Equivalent of: .from('tenants').select('id').eq('features_enabled->>invoicing', 'true')
supabase db execute --query "SELECT id, features_enabled FROM tenants WHERE features_enabled->>'invoicing' = 'true';"
```

Expected: returns exactly the tenant(s) we set to enabled in STEP 1. If it returns 0 rows, the JSONB syntax is wrong — STOP and report.

STEP 3 — Negative check. Confirm that tenants with the default `{"invoicing": false}` do NOT match:

```bash
supabase db execute --query "SELECT count(*) FROM tenants WHERE features_enabled->>'invoicing' = 'true';"
```

Expected: equals the count of tenants explicitly enabled. The default tenants (with invoicing: false) MUST NOT appear.

STEP 4 — Run the actual cron locally with the auth header and confirm the filter applies:

```bash
# Trigger the cron manually
curl -i -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/invoice-reminders

# Expected response:
# HTTP/1.1 200 OK
# {"reminders_sent": 0, "late_fees_applied": 0}
# OR a non-zero count if there are due reminders for the enabled tenant.
```

The console output (visible in `npm run dev` logs) MUST include either `[invoice-reminders] No tenants with invoicing enabled — skipping` (if all tenants are off) OR the normal flow (if at least one is enabled).

STEP 5 — Reset the dev's tenant back to `{"invoicing": false}` (or leave enabled if the dev wants to keep using invoicing during continued QA):

```bash
supabase db execute --query "UPDATE tenants SET features_enabled = '{\"invoicing\": false}'::jsonb WHERE id = '<dev-tenant-id>';"
```

Document the verification results in the SUMMARY:
- STEP 2 row count (expected: matches enabled tenants)
- STEP 3 count (expected: matches enabled tenants)
- STEP 4 console output observed
- Any deviations
  </action>
  <verify>
    <automated>echo "Manual verification task — verify by reading the SUMMARY produced by this task. Verification queries listed in the action block above."</automated>
  </verify>
  <acceptance_criteria>
    - SUMMARY records the actual row count from STEP 2 (must equal the count of tenants with `features_enabled = {"invoicing": true}`)
    - SUMMARY records that STEP 3's count is non-zero ONLY when at least one tenant is enabled (proves the filter discriminates)
    - SUMMARY records the curl response from STEP 4 (status code + body)
    - SUMMARY records whether the cron's console.log output was observed (the short-circuit log line OR the normal flow)
    - If any STEP returns unexpected results, the SUMMARY clearly states "VERIFICATION FAILED" and identifies the failing step — Tasks 1/2 must be reopened
  </acceptance_criteria>
  <done>The JSONB filter syntax is empirically confirmed against the live DB. Assumption A1 is closed. Crons proven to filter correctly.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Vercel Cron → /api/cron/** | The cron-trigger HTTP request from Vercel's scheduler is authenticated via `Authorization: Bearer ${CRON_SECRET}`. Unauthenticated callers receive 401 (existing behavior, unchanged). |
| Cron → tenant data | Crons use the service-role client and read EVERY tenant's data. The features filter is the only mechanism preventing flagged-off tenants from being touched. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-53-05 | Tampering / Privacy | Cron sends reminder to disabled tenant's customers | mitigate | Pre-fetch enabled tenant IDs and filter the invoice query with `.in('tenant_id', enabledTenantIds)`. Tenants with the flag off are never returned by the filter, so the cron never iterates their invoices. |
| T-53-cron-syntax | Tampering / Availability | Wrong JSONB syntax silently disables crons for ALL tenants | mitigate | Task 3 is a dedicated verification task that runs the exact filter against the live DB. Acceptance criteria require empirical confirmation, not assumed correctness. |
| T-53-cron-fail-open | Tampering | Tenant filter query fails -> cron processes nothing | accept | Filter failure returns 500 with an error log — the cron does NOT continue with an empty `enabledTenantIds`. This is fail-CLOSED for the wrong reason (data preserved, but invoicing-enabled tenants miss reminders too). Acceptable: tenant filter fails are rare and observable in logs; alternative (fail-open) would silently violate TOGGLE-04. |
</threat_model>

<verification>
After all 3 tasks:
1. `npm run build` exits 0.
2. STEP 2-4 of Task 3 confirm the filter discriminates correctly against the live DB.
3. With dev's tenant features_enabled = `{"invoicing": false}` AND no other tenants enabled:
   - `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/invoice-reminders` returns `{"reminders_sent": 0, "late_fees_applied": 0}`
   - `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/recurring-invoices` returns `{"generated": 0}`
   - Console log shows `No tenants with invoicing enabled — skipping`
4. With dev's tenant features_enabled = `{"invoicing": true}`:
   - Same curls return non-zero counts (or zero, if no due reminders/templates) — but DO NOT short-circuit. Console log shows the normal processing flow.
5. No new errors in the logs.
</verification>

<success_criteria>
- 2 cron files modified, both have the pre-fetch + filter pattern
- JSONB filter syntax confirmed correct against live DB (Task 3)
- Crons short-circuit cleanly when no tenants are enabled
- Existing behavior preserved when tenants are enabled
- Build passes
</success_criteria>

<output>
After completion, create `.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-05-SUMMARY.md` documenting:
- 2 file changes summary
- Live-DB verification results from Task 3 (STEP 2 / STEP 3 / STEP 4 outputs)
- Final state of dev's tenant features_enabled value (so downstream plans know the test setup)
- Build status
</output>
