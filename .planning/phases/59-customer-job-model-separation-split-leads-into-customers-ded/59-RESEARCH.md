# Phase 59: Customer/Job Model Separation — Research

**Researched:** 2026-04-18
**Domain:** Data model refactor (leads → customers + jobs + inquiries) across Supabase DB, Next.js dashboard, Python LiveKit voice agent, invoicing FK reattribution
**Confidence:** HIGH (all sources in-repo, verified via grep + file reads)

## Summary

Phase 59 splits the single `leads` table into three entities: **customers** (phone-deduped per tenant), **jobs** (1:1 with booked `appointments`), and **inquiries** (unbooked calls). This is a big-bang cutover with forward-only migrations; v6.0 is still in dev, so there are no prod users to protect. The refactor touches five surfaces in lockstep: (1) DB schema + RPC, (2) `/api/leads/*` → `/api/customers/*` + `/api/jobs/*` + `/api/inquiries/*`, (3) dashboard UI (Jobs tab rewrite, new Inquiries tab, new Customer detail page, Merge flow with 7-day undo), (4) Python LiveKit agent's post-call write path, (5) invoice FK reattribution (`invoices.lead_id` → `invoices.job_id`).

All 19 decisions are already locked in `59-CONTEXT.md`. The research below maps those decisions to concrete file targets, verifies the migration number (next is 053), confirms no existing E.164 phone utility (needs creation), and catalogs runtime state that will survive or break the cutover.

**Primary recommendation:** Structure the plan as **Wave 0 (test scaffolds + phone util)** → **Wave 1 (DB migration 053 + RPC + backfill, all in one SQL file)** → **Wave 2 (API routes + Python agent in lockstep)** → **Wave 3 (Dashboard UI rewrite + merge flow)** → **Wave 4 (skill-file updates + cleanup of dead `/api/leads` paths)**. The single deploy-ordering risk is that the Python agent and Next.js must ship together (both write via the new RPC); capture in the plan's risk section.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Migration & cutover**
- **D-01:** Big-bang cutover. One migration creates `customers`, `jobs`, `inquiries`; backfills from `leads`/`appointments`/`lead_calls`; drops `leads` and `lead_calls`.
- **D-02:** Forward-only migrations. No down scripts. Idempotent backfill.
- **D-03:** API routes split: `/api/leads/*` → `/api/customers/*` + `/api/jobs/*` + `/api/inquiries/*`. All fetch sites and chatbot tools updated in this phase. Clean break.
- **D-04:** Voice agent (Python LiveKit) updated in same phase. Lockstep deploy required.

**Entity definitions**
- **D-05:** Customer dedup: `UNIQUE(tenant_id, phone_e164)`. Phone normalized to E.164. Phone is **immutable** post-create — "change" = Merge.
- **D-06:** Strict Job semantics: `jobs.appointment_id NOT NULL` (1:1 with `appointments`).
- **D-07:** Separate `inquiries` table. `inquiries.status` enum: `open`, `converted`, `lost`. Converted inquiries keep `converted_to_job_id` audit FK.
- **D-08:** Two top-level tabs: **Jobs** and **Inquiries** (sidebar + BottomTabBar).
- **D-09:** Distinct status pill sets per tab. Phase 49 pill palette + Phase 52 Lost-gap layout preserved verbatim.
  - Jobs: `Scheduled` → `Completed` → `Paid` … (gap) … `Cancelled`, `Lost`
  - Inquiries: `Open` → `Converted` … (gap) … `Lost`
- **D-10:** Inquiry → Job conversion: same-call auto-convert (via RPC transaction) + manual button for offline.

**Invoice reattribution + activity log**
- **D-11:** `invoices.lead_id` → `invoices.job_id NOT NULL`. Backfill via lead→appointment→job.
- **D-12:** `activity_log` schema: `customer_id NOT NULL`, `job_id NULLABLE`, `inquiry_id NULLABLE`. Three explicit FKs.
- **D-13:** Backfill rule: every existing `activity_log.lead_id` → `customer_id` + (`job_id` if lead had appointment_id, else `inquiry_id`).

**Voice agent + Realtime**
- **D-14:** New Postgres RPC `record_call_outcome(...)` returns `{customer_id, job_id?, inquiry_id?}`. Atomic upsert. **MUST be documented in `auth-database-multitenancy` and `voice-call-architecture` skill files.**
- **D-15:** Realtime publication: `customers`, `jobs`, `inquiries` all published with `REPLICA IDENTITY FULL`. Dashboard listeners updated per tab.
- **D-16:** `lead_calls` → `customer_calls` (n:1 calls→customer) + `job_calls` (n:1 calls→job).

**Customer detail page**
- **D-17:** Sticky header + 3 tabs (`Activity` | `Jobs` | `Invoices`). Header: name, phone, default address, lifetime value, outstanding balance, Jobber/Xero badges. Invoices tab gated by `features_enabled.invoicing` (Phase 53).
- **D-18:** Full CRUD modal for customer edit (name, address, email, notes, tags). Phone read-only.
- **D-19:** Merge: per-customer button + 7-day undo. Soft-delete source (`merged_into`, `merged_at`); reverse-repoint on undo.

### Claude's Discretion

- Indexing strategy beyond obvious `UNIQUE(tenant_id, phone_e164)` and `(tenant_id, status, created_at DESC)`
- Activity timeline rendering details (icon set, grouping)
- Modal styling, typeahead picker component choice
- Backfill batching strategy (single transaction likely fine at dev scale)
- Whether to publish `customer_calls` / `job_calls` to Realtime (recommend: no — derived)
- Notification email/SMS template wording adjustments

### Deferred Ideas (OUT OF SCOPE)

- Cross-tenant customer dedup
- Customer portal / customer-initiated workflows
- Field-by-field merge cherry-pick, global admin merge tool, auto-merge
- Customer tags taxonomy (start free-form)
- Bulk operations
- Rich-text notes / file attachments on customer
- v6.0 Jobber/Xero prompt enrichment with Customer fields (separate phase)
- Multi-job invoice line-item UX
- Migration audit log

## Phase Requirements

No requirement IDs in REQUIREMENTS.md for Phase 59 — the phase is a v6.0 data-model refactor whose goal is defined in ROADMAP.md §"Phase 59" (line 822) and CONTEXT.md. Planner should derive success criteria from CONTEXT.md decisions D-01 through D-19.

## Project Constraints (from CLAUDE.md)

- **Brand name is Voco** (not HomeService AI). Fallback email domains use `voco.live`. User-facing copy updates must use "Voco".
- **Skill sync is mandatory.** When modifying any system covered by a skill, read the skill first, make code changes, then update the skill to reflect the new state. Phase 59 mandatorily updates `auth-database-multitenancy`, `dashboard-crm-system`, `voice-call-architecture`, `payment-architecture` (per CONTEXT.md canonical_refs).
- **Supabase client types are 3-way** (browser / server / service-role). New routes must pick the right one. RPCs from Python agent use service-role.
- **Tenant-id child pattern + RLS** is the multi-tenancy invariant. Every new table must replicate the policy shape from `004_leads_crm.sql`.

## Standard Stack

The phase is a refactor inside an existing stack. No new libraries are introduced; the stack is already locked by prior phases.

### Core (verified in-repo)
| Component | Version / Source | Purpose |
|-----------|------------------|---------|
| Supabase Postgres + RLS | existing (50+ migrations) | DB + tenant isolation | [VERIFIED: `supabase/migrations/` glob] |
| `@supabase/supabase-js` service-role client | `src/lib/supabase.js` | Server-side service-role writes | [VERIFIED: referenced in skill + `src/lib/leads.js`] |
| `@supabase/ssr` cookie-based | `src/lib/supabase-server.js` | API route auth context (`getTenantId()`) | [VERIFIED] |
| `@supabase/supabase-js` browser | `src/lib/supabase-browser.js` | Realtime subscriptions on dashboard | [VERIFIED] |
| Next.js App Router API routes | existing | `/api/{customers,jobs,inquiries}/*` | [VERIFIED] |
| Python LiveKit agent | separate repo `lerboi/livekit_agent`, deployed Railway | Post-call write path | [CITED: CLAUDE.md + MEMORY.md reference_retell_ws_server.md] |
| shadcn/ui + Tailwind | existing tokens | Customer detail modal, Merge dialog | [VERIFIED in dashboard-crm-system skill] |

### Supporting (new for this phase)
| Library / Util | Purpose | Notes |
|----------------|---------|-------|
| **E.164 normalization util** | Customer dedup key | **NEW FILE needed.** No `src/lib/phone*` exists today [VERIFIED: glob returned no files]. Create `src/lib/phone/normalize.js` using `libphonenumber-js` (lightweight). Python agent already has `_normalize_phone` in `src/webhook/` per ROUTE-06 — can mirror or port logic. |
| **7-day undo scheduler** | Merge undo | No scheduled job infra needed beyond a cron that optionally hard-deletes rows where `merged_at < now() - interval '7 days'`. Soft-delete column + query filter is sufficient. |

**Version verification:** `libphonenumber-js` — verify current stable with `npm view libphonenumber-js version` at task time. `[ASSUMED]` current major is ^1.10.x based on training.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Full library `libphonenumber-js` | `google-libphonenumber` (heavier) or hand-roll regex | libphonenumber-js is ~140KB metadata, tree-shakeable; hand-roll is brittle across SG/US/CA. |
| Single RPC `record_call_outcome` | Python-side find-or-create + insert | D-14 already picked RPC for atomicity; don't revisit. |

**Installation:**
```bash
npm install libphonenumber-js
```
Python agent: reuse existing `_normalize_phone` in `livekit-agent/src/webhook/` — no new Python dep.

## Architecture Patterns

### Recommended Project Structure
```
supabase/migrations/
└── 053_customers_jobs_inquiries.sql    # single big-bang migration (see Wave 1)

src/lib/
├── phone/
│   └── normalize.js                    # NEW — E.164 wrapper around libphonenumber-js
├── customers.js                        # NEW — business logic (merge, undo, lifetime value calc)
├── jobs.js                             # NEW — job list queries (replaces src/lib/leads.js)
└── inquiries.js                        # NEW

src/app/api/
├── customers/
│   ├── route.js                        # GET list, POST create (rare — mostly auto-created by RPC)
│   └── [id]/
│       ├── route.js                    # GET/PATCH/DELETE single customer
│       ├── merge/route.js              # POST {target_id} — merge flow
│       └── unmerge/route.js            # POST — 7-day undo
├── jobs/
│   ├── route.js                        # GET list (replaces /api/leads)
│   └── [id]/route.js                   # GET detail, PATCH status/revenue
├── inquiries/
│   ├── route.js                        # GET list
│   └── [id]/
│       ├── route.js                    # GET, PATCH status
│       └── convert/route.js            # POST — manual inquiry → job
└── leads/                              # DELETE entire folder in Wave 4

src/app/dashboard/
├── jobs/page.js                        # REWRITE (currently queries leads — now queries jobs via new API)
├── inquiries/page.js                   # NEW
└── customers/
    └── [id]/page.js                    # NEW — sticky header + 3 tabs

src/components/dashboard/
├── CustomerDetailHeader.jsx            # NEW — name/phone/stats/badges
├── CustomerEditModal.jsx               # NEW — D-18 full CRUD modal
├── MergeCustomerDialog.jsx             # NEW — typeahead + preview + confirm
├── JobFlyout.jsx                       # RENAMED from LeadFlyout (scoped to jobs)
├── InquiryFlyout.jsx                   # NEW — offline convert/lost buttons
└── LeadFlyout.jsx                      # DELETE after split
```

### Pattern 1: Migration + Backfill in Single File
**What:** One SQL file (053) creates new tables, runs backfill INSERTs, adds FKs to invoices/activity_log, drops old tables.
**When to use:** Big-bang cutover on pre-prod DB (D-01, D-02).
**Example skeleton:**
```sql
-- 053_customers_jobs_inquiries.sql
BEGIN;

-- 1. Create customers, jobs, inquiries, customer_calls, job_calls
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_e164 text NOT NULL,
  name text,
  default_address text,
  email text,
  notes text,
  tags text[] NOT NULL DEFAULT '{}',
  merged_into uuid REFERENCES customers(id) ON DELETE SET NULL,
  merged_at timestamptz,
  lifetime_value numeric(12,2) NOT NULL DEFAULT 0,  -- denormalized or computed — see Pitfall 3
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone_e164)
);

CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,  -- D-06 strict 1:1
  originated_as_inquiry_id uuid REFERENCES inquiries(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','completed','paid','cancelled','lost')),
  urgency text NOT NULL DEFAULT 'routine'
    CHECK (urgency IN ('emergency','routine','urgent')),  -- match appointments post-036
  revenue_amount numeric(10,2),
  is_vip boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id)  -- enforce 1:1
);

CREATE TABLE inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  job_type text,
  service_address text,
  urgency text NOT NULL DEFAULT 'routine'
    CHECK (urgency IN ('emergency','routine','urgent')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','converted','lost')),
  converted_to_job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customer_calls (
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  PRIMARY KEY (customer_id, call_id)
);

CREATE TABLE job_calls (
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  PRIMARY KEY (job_id, call_id)
);

-- 2. Indexes (Claude's discretion — beyond the obvious uniques)
CREATE INDEX idx_customers_tenant_phone ON customers(tenant_id, phone_e164) WHERE merged_into IS NULL;
CREATE INDEX idx_jobs_tenant_status_created ON jobs(tenant_id, status, created_at DESC);
CREATE INDEX idx_jobs_customer ON jobs(customer_id);
CREATE INDEX idx_inquiries_tenant_status_created ON inquiries(tenant_id, status, created_at DESC);
CREATE INDEX idx_inquiries_customer ON inquiries(customer_id);

-- 3. RLS: mirror leads pattern from 004
-- (repeat for all 5 new tables)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_tenant_own" ON customers
  FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));
CREATE POLICY "service_role_all_customers" ON customers FOR ALL USING (auth.role() = 'service_role');
-- ... repeat for jobs, inquiries, customer_calls, job_calls

-- 4. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE customers, jobs, inquiries;
ALTER TABLE customers REPLICA IDENTITY FULL;
ALTER TABLE jobs REPLICA IDENTITY FULL;
ALTER TABLE inquiries REPLICA IDENTITY FULL;

-- 5. Backfill from leads
-- 5a. Customers: one row per unique (tenant_id, normalized from_number)
INSERT INTO customers (tenant_id, phone_e164, name, default_address, created_at, updated_at)
SELECT
  tenant_id,
  from_number,  -- ASSUMES already E.164 in existing leads; verify and re-normalize if not
  (array_agg(caller_name ORDER BY created_at DESC) FILTER (WHERE caller_name IS NOT NULL))[1],
  (array_agg(service_address ORDER BY created_at DESC) FILTER (WHERE service_address IS NOT NULL))[1],
  MIN(created_at),
  MAX(updated_at)
FROM leads
GROUP BY tenant_id, from_number;

-- 5b. Jobs: one row per lead with appointment_id
INSERT INTO jobs (tenant_id, customer_id, appointment_id, status, urgency, revenue_amount, created_at, updated_at)
SELECT
  l.tenant_id,
  c.id,
  l.appointment_id,
  CASE l.status
    WHEN 'new' THEN 'scheduled'   -- edge: appointment_id present but status still 'new' shouldn't exist but be safe
    WHEN 'booked' THEN 'scheduled'
    WHEN 'completed' THEN 'completed'
    WHEN 'paid' THEN 'paid'
    WHEN 'lost' THEN 'lost'
    ELSE 'scheduled'
  END,
  l.urgency,
  l.revenue_amount,
  l.created_at,
  l.updated_at
FROM leads l
JOIN customers c ON c.tenant_id = l.tenant_id AND c.phone_e164 = l.from_number
WHERE l.appointment_id IS NOT NULL;

-- 5c. Inquiries: one row per lead WITHOUT appointment_id
INSERT INTO inquiries (tenant_id, customer_id, job_type, service_address, urgency, status, created_at, updated_at)
SELECT
  l.tenant_id, c.id, l.job_type, l.service_address, l.urgency,
  CASE l.status WHEN 'lost' THEN 'lost' ELSE 'open' END,
  l.created_at, l.updated_at
FROM leads l
JOIN customers c ON c.tenant_id = l.tenant_id AND c.phone_e164 = l.from_number
WHERE l.appointment_id IS NULL;

-- 5d. customer_calls + job_calls from lead_calls
INSERT INTO customer_calls (customer_id, call_id)
SELECT DISTINCT c.id, lc.call_id
FROM lead_calls lc
JOIN leads l ON l.id = lc.lead_id
JOIN customers c ON c.tenant_id = l.tenant_id AND c.phone_e164 = l.from_number;

INSERT INTO job_calls (job_id, call_id)
SELECT j.id, lc.call_id
FROM lead_calls lc
JOIN leads l ON l.id = lc.lead_id AND l.appointment_id IS NOT NULL
JOIN jobs j ON j.appointment_id = l.appointment_id;

-- 6. Invoice FK swap (D-11)
ALTER TABLE invoices ADD COLUMN job_id uuid REFERENCES jobs(id) ON DELETE SET NULL;
UPDATE invoices i
SET job_id = j.id
FROM leads l JOIN jobs j ON j.appointment_id = l.appointment_id
WHERE i.lead_id = l.id;
-- Only NOT NULL the column AFTER verifying backfill — some invoices may lack a lead_id (ad-hoc).
-- If such rows exist, plan must decide: (a) set to fake job, (b) allow NULL for backfilled ad-hoc only, (c) error.
-- Recommend: keep NULLABLE in 053, add CHECK or NOT NULL in follow-up 054 once surveyed.
ALTER TABLE invoices DROP COLUMN lead_id;

-- 7. activity_log three-FK rewrite (D-12, D-13)
ALTER TABLE activity_log
  ADD COLUMN customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  ADD COLUMN job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  ADD COLUMN inquiry_id uuid REFERENCES inquiries(id) ON DELETE SET NULL;
UPDATE activity_log a
SET
  customer_id = c.id,
  job_id = CASE WHEN l.appointment_id IS NOT NULL THEN j.id ELSE NULL END,
  inquiry_id = CASE WHEN l.appointment_id IS NULL THEN i.id ELSE NULL END
FROM leads l
LEFT JOIN customers c ON c.tenant_id = l.tenant_id AND c.phone_e164 = l.from_number
LEFT JOIN jobs j ON j.appointment_id = l.appointment_id
LEFT JOIN inquiries i ON i.tenant_id = l.tenant_id AND i.customer_id = c.id AND i.created_at = l.created_at
WHERE a.lead_id = l.id;
-- Set customer_id NOT NULL only after verifying backfill covered 100% of rows
ALTER TABLE activity_log ALTER COLUMN customer_id SET NOT NULL;
ALTER TABLE activity_log DROP COLUMN lead_id;

-- 8. Drop legacy tables
DROP TABLE lead_calls;
DROP TABLE leads;

-- 9. record_call_outcome RPC (D-14)
CREATE OR REPLACE FUNCTION record_call_outcome(
  p_tenant_id uuid,
  p_phone_e164 text,
  p_caller_name text,
  p_service_address text,
  p_appointment_id uuid,
  p_urgency text,
  p_call_id uuid,
  p_job_type text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id uuid;
  v_job_id uuid;
  v_inquiry_id uuid;
BEGIN
  INSERT INTO customers (tenant_id, phone_e164, name, default_address)
  VALUES (p_tenant_id, p_phone_e164, p_caller_name, p_service_address)
  ON CONFLICT (tenant_id, phone_e164) DO UPDATE
    SET name = COALESCE(EXCLUDED.name, customers.name),
        default_address = COALESCE(EXCLUDED.default_address, customers.default_address),
        updated_at = now()
  RETURNING id INTO v_customer_id;

  IF p_appointment_id IS NOT NULL THEN
    INSERT INTO jobs (tenant_id, customer_id, appointment_id, urgency)
    VALUES (p_tenant_id, v_customer_id, p_appointment_id, p_urgency)
    RETURNING id INTO v_job_id;
  ELSE
    INSERT INTO inquiries (tenant_id, customer_id, job_type, service_address, urgency)
    VALUES (p_tenant_id, v_customer_id, p_job_type, p_service_address, p_urgency)
    RETURNING id INTO v_inquiry_id;
  END IF;

  INSERT INTO customer_calls (customer_id, call_id) VALUES (v_customer_id, p_call_id)
  ON CONFLICT DO NOTHING;
  IF v_job_id IS NOT NULL THEN
    INSERT INTO job_calls (job_id, call_id) VALUES (v_job_id, p_call_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'customer_id', v_customer_id,
    'job_id', v_job_id,
    'inquiry_id', v_inquiry_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION record_call_outcome(uuid, text, text, text, uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_call_outcome(uuid, text, text, text, uuid, text, uuid, text) TO service_role;

COMMIT;
```

### Pattern 2: Customer Merge with 7-day Undo (D-19)
**What:** Soft-delete source (`merged_into`, `merged_at`), repoint all child rows, hide source from queries.
**When to use:** Owner clicks Merge in Customer detail header overflow menu.
**Example:**
```js
// src/lib/customers.js
export async function mergeCustomer({ tenantId, sourceId, targetId }) {
  const supabase = getServiceRoleClient();
  // 1. Verify both belong to tenant (RLS + explicit guard)
  // 2. Repoint children — single transaction
  const { error } = await supabase.rpc('merge_customer', {
    p_tenant_id: tenantId,
    p_source_id: sourceId,
    p_target_id: targetId,
  });
  if (error) throw error;
  // RPC internally:
  //   UPDATE jobs SET customer_id = target WHERE customer_id = source;
  //   UPDATE inquiries SET customer_id = target WHERE customer_id = source;
  //   UPDATE activity_log SET customer_id = target WHERE customer_id = source;
  //   UPDATE customer_calls SET customer_id = target WHERE customer_id = source ON CONFLICT DO NOTHING;
  //   UPDATE invoices i SET ... (indirect via jobs — already repointed)
  //   UPDATE customers SET merged_into = target, merged_at = now() WHERE id = source;
}

// Undo: within 7 days, clear merged_into and reverse-repoint. Store a `merge_log` JSON snapshot
// inside customers.merge_snapshot JSONB column (or separate merge_log table) so undo knows what to move back.
```

Recommend: add `merge_snapshot jsonb` column on `customers` (nullable) storing the list of repointed child IDs at merge time, so undo can reverse exactly those rows (rather than blanket UPDATE).

### Pattern 3: Dashboard Realtime Per-tab
**What:** Each dashboard page subscribes to its own `postgres_changes` channel, filtered by `tenant_id` or `customer_id`.
**Example (pseudo, pattern per `src/app/dashboard/jobs/page.js`):**
```js
// Jobs tab
supabase.channel('jobs')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `tenant_id=eq.${tenantId}` }, handler)
  .subscribe();

// Customer detail page — 3 subscriptions
supabase.channel(`customer-${id}`)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customers', filter: `id=eq.${id}` }, headerHandler)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `customer_id=eq.${id}` }, jobsHandler)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'inquiries', filter: `customer_id=eq.${id}` }, inquiriesHandler)
  .subscribe();
```

### Anti-Patterns to Avoid

- **Don't use polymorphic `entity_type + entity_id` on activity_log.** Rejected in discussion — loses FK integrity. Three explicit FKs is locked (D-12).
- **Don't keep a `leads` compatibility view.** D-01 + D-03 picked clean break. A view would retain old Realtime subscriptions pointing at a dead concept.
- **Don't make `jobs.appointment_id` nullable.** D-06 is strict 1:1. Nullable = drifts back toward lead semantics.
- **Don't forget `UNIQUE(appointment_id)` on jobs.** Without it, a stray double-insert would create two Jobs for one appointment — exactly the bug this phase exists to prevent.
- **Don't hand-roll phone normalization.** Use `libphonenumber-js`; SG/US/CA all have edge cases (SG 8-digit local, US NANP, CA area codes overlapping US).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| E.164 normalization | regex or string manipulation | `libphonenumber-js` `parsePhoneNumber().format('E.164')` | SG/US/CA country rules, extension parsing, leading-zero trimming all handled. |
| Atomic customer upsert + child insert | Multiple Python round-trips | `record_call_outcome` RPC | D-14 already mandates. Single transaction = no race. |
| Merge repoint | Parallel UPDATEs in app code | `merge_customer` RPC (transactional) | Partial-failure recovery is painful otherwise. |
| Realtime broadcast | Custom WebSocket server | Supabase `ALTER PUBLICATION supabase_realtime ADD TABLE` + `REPLICA IDENTITY FULL` | Pattern already proven in migrations 004, 041, 043. |
| Soft-delete + 7-day purge | Cron polling row-by-row | `merged_into`/`merged_at` columns + filter in all `SELECT`s (`WHERE merged_into IS NULL`) + optional cron hard-delete after 7 days | Query-filter is cheap; hard delete is optional cleanup. |

**Key insight:** Every new piece of logic in this phase has a clear precedent in existing migrations. The phase is a restructuring, not a new system. Avoid inventing new infrastructure.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | (1) `leads` table rows — split into customers/jobs/inquiries by migration 053. (2) `lead_calls` rows — split into customer_calls/job_calls. (3) `activity_log.lead_id` FK column — rewritten to 3 FKs. (4) `invoices.lead_id` FK column — rewritten to `job_id`. | SQL backfill in migration 053 (covered in Pattern 1). Idempotent via `ON CONFLICT`. |
| **Live service config** | None — no external service stores the literal string "leads" in a way that breaks if the DB table vanishes. n8n / Datadog not in use here. Stripe customer metadata uses `tenant_id`, not `lead_id`. | None. |
| **OS-registered state** | None. No Windows Task Scheduler / pm2 / systemd units reference `leads` by name (verified: voice agent uses Railway; Next.js on Vercel). | None. |
| **Secrets/env vars** | None — no env var references `LEAD_*` or `leads` as a literal. | None. |
| **Build artifacts / installed packages** | (1) Python agent deploy on Railway — the agent's code currently calls `createOrMergeLead`-equivalent logic; old image stays running until redeploy. (2) Next.js build caches no long-lived artifact referencing `leads`. | Lockstep deploy (D-04). Plan must sequence: DB migration → Next.js deploy → Python agent deploy (or both simultaneously with brief outage tolerance, since it's dev). |

**The canonical question:** After every file and the DB is updated, what runtime systems still have "lead" cached/stored/registered? **Answer: only the running Python agent process on Railway.** Redeploy = fixed.

## Common Pitfalls

### Pitfall 1: `invoices` rows without a resolvable `job_id` during backfill
**What goes wrong:** Some invoices may have `lead_id = NULL` (manually created, not tied to a booking) or point to leads whose `appointment_id` is NULL (invoice attached to an inquiry — current schema allows this).
**Why it happens:** Phase 33 allowed manual invoice creation without a lead. The current schema on `invoices.lead_id` is `ON DELETE SET NULL`, not NOT NULL.
**How to avoid:** In migration 053, **do NOT** `ALTER COLUMN job_id SET NOT NULL` immediately. Instead:
1. Add `job_id` as NULLABLE.
2. Run backfill.
3. Count rows where `job_id IS NULL AND lead_id IS NOT NULL` — these are the "inquiry had an invoice" edge case. Plan must decide: create a phantom job? Leave NULL and allow ad-hoc invoices? D-11 says `NOT NULL` — the plan needs to either create backfill jobs for these or explicitly relax D-11 to `job_id NULLABLE`.
4. Flag this to discuss-phase if count is non-zero.
**Warning signs:** `SELECT COUNT(*) FROM invoices WHERE lead_id IS NOT NULL` at migration time exceeds the count of jobs created from leads with `appointment_id IS NOT NULL`.

### Pitfall 2: Phone format drift between existing `leads.from_number` and new E.164 normalization
**What goes wrong:** If any existing `leads.from_number` is not already in E.164 (e.g., `"5551234"` instead of `"+15551234567"`), the backfill `GROUP BY from_number` will not dedup correctly across format variants.
**Why it happens:** Call routing (Phase 39) normalizes via `_normalize_phone` in Python; the Next.js-side insert path uses raw Twilio `From` which should be E.164. But there's no guarantee.
**How to avoid:** Before migration, run an audit SQL: `SELECT from_number, regexp_matches(from_number, '^\+[1-9]\d{6,14}$') FROM leads WHERE regexp_matches IS NULL;` — anything not matching E.164 gets manually normalized in a pre-migration cleanup step.
**Warning signs:** Customers.count > expected distinct phones after backfill.

### Pitfall 3: Lifetime value + outstanding balance on Customer header — live compute vs denormalized
**What goes wrong:** Customer header shows `lifetime_value` and `outstanding_balance`. If denormalized on `customers`, every invoice status change must trigger a recompute. If live-computed, every customer page load runs aggregate queries.
**How to avoid:** Recommend **live-computed** via a Postgres view or a dedicated RPC `get_customer_stats(customer_id)` at detail-page render. At dev-phase volumes, aggregate SELECT over `jobs` + `invoices` is cheap. Revisit only if p95 > 200ms.
**Warning signs:** None at current volumes; the risk is premature denormalization.

### Pitfall 4: Realtime subscription on Customer detail page triggers on unrelated tenant rows
**What goes wrong:** `supabase.channel(...).on('postgres_changes', { table: 'jobs', filter: 'customer_id=eq.${id}' })` — if filter is malformed, you get ALL jobs across the tenant.
**How to avoid:** Verify `filter` prop is exactly `customer_id=eq.<uuid>` (no quotes, no braces). Test with two customers to confirm isolation.
**Warning signs:** Customer detail page updates when an unrelated customer gets a new job.

### Pitfall 5: Python agent + Next.js deploy skew
**What goes wrong:** If Python deploys first, it tries to call `record_call_outcome` RPC that doesn't exist yet. If Next.js deploys first, dashboard shows customers/jobs but Python still writes to dead `leads` table.
**How to avoid:** Deploy order in plan:
1. Merge DB migration (creates tables + RPC; old `leads` still exists until step 3).
2. Deploy Next.js (reads new tables; `/api/leads` now 404).
3. Deploy Python agent (writes via new RPC).
4. Re-run migration 053 step 8 (`DROP TABLE leads`) — or split migration into 059 (create + backfill, keep old) and 061 (drop old) for safety.
**Warning signs:** Calls silently failing between step 2 and step 3.
**Mitigation:** Split migration — 059 (create + backfill, keep `leads`/`lead_calls` in place) and 061 (drop legacy tables) as two separate files, applied with deploy in between.

### Pitfall 6: Existing `appointments.caller_phone` not normalized — breaks dedup alignment
**What goes wrong:** `appointments.caller_phone` is written by the booking RPC from raw call data; it may not match the customer's `phone_e164`. If we ever re-derive customer from appointment, mismatches surface.
**How to avoid:** Do NOT key off `appointments.caller_phone` post-migration. Always go through `jobs.customer_id` → `customers.phone_e164`. The `appointments.caller_phone` becomes a display-only denormalized copy.
**Warning signs:** Two customers for the same phone after repeat calls.

## Code Examples

### Example 1: Python agent — swap `createOrMergeLead` for `record_call_outcome`
```python
# livekit-agent/src/post_call/write_outcome.py (new file)
async def record_outcome(supabase, tenant_id, phone, call_id, appointment_id=None, ...):
    # Replaces the current 2-3 round-trip find-or-create-lead + insert-lead_calls pattern
    result = await supabase.rpc('record_call_outcome', {
        'p_tenant_id': tenant_id,
        'p_phone_e164': normalize_e164(phone),  # reuse existing _normalize_phone
        'p_caller_name': caller_name,
        'p_service_address': service_address,
        'p_appointment_id': appointment_id,
        'p_urgency': urgency,
        'p_call_id': call_id,
        'p_job_type': job_type,
    }).execute()
    return result.data  # {customer_id, job_id?, inquiry_id?}
```

### Example 2: Dashboard Jobs tab query (rewrite of `src/app/api/leads/route.js`)
```js
// src/app/api/jobs/route.js
export async function GET(request) {
  const tenantId = await getTenantId();
  const supabase = await getServerSupabase();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  let query = supabase
    .from('jobs')
    .select(`
      id, status, urgency, revenue_amount, is_vip, created_at,
      customer:customers!inner(id, name, phone_e164, default_address),
      appointment:appointments!inner(id, start_time, end_time, service_address, status),
      calls:job_calls(call:calls(id, recording_url, duration_seconds, urgency_classification))
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `leads` table, 1 row per call/booking | Three-entity split (Customer/Job/Inquiry) | Phase 59 (this phase) | Matches Jobber/HCP/ServiceTitan mental model. Unblocks v6.0 Phase 55/56 customer-context enrichment. |
| `createOrMergeLead` in `src/lib/leads.js` | `record_call_outcome` RPC | Phase 59 | Atomic, single round-trip. |
| `invoices.lead_id` | `invoices.job_id NOT NULL` (with backfill caveat, see Pitfall 1) | Phase 59 | Per-job revenue attribution. |

**Deprecated/outdated (to remove in Phase 59):**
- `src/lib/leads.js` → delete; replace with `src/lib/customers.js`, `src/lib/jobs.js`, `src/lib/inquiries.js`.
- `/api/leads/*` → delete entire folder.
- `LeadFlyout.jsx`, `LeadCard.jsx` — rename/split into Job and Inquiry variants.
- `supabase/migrations/004_leads_crm.sql` — stays in repo (immutable migration history), but all tables it created are dropped.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `libphonenumber-js` is current recommended E.164 library | Standard Stack / Don't Hand-Roll | LOW — any modern phone parser works; easy swap. |
| A2 | All existing `leads.from_number` values are already E.164 | Pitfall 2 | MEDIUM — if wrong, dedup creates duplicate customers. Mitigated by pre-migration audit SQL. |
| A3 | No existing invoices have `lead_id` pointing to an inquiry-only lead (`appointment_id IS NULL`) | Pitfall 1 | MEDIUM — if non-zero, D-11's NOT NULL constraint can't be enforced. Mitigated by deferred NOT NULL + count audit. |
| A4 | `libphonenumber-js` version `^1.10.x` current | Standard Stack | LOW — verify with `npm view` at task time. |
| A5 | Python agent's `_normalize_phone` produces identical output to `libphonenumber-js.format('E.164')` for SG/US/CA | Pattern 1 / Pitfall 2 | MEDIUM — if outputs diverge, agent writes don't dedup against UI-created customers. Add cross-validation test in Wave 0. |
| A6 | Dashboard volume at dev-phase is low enough that live-computed `lifetime_value` is fine (no denormalization) | Pitfall 3 | LOW — at worst, a future migration adds a denormalized column. |
| A7 | No external service (Datadog, n8n, pm2) references `leads` by name | Runtime State Inventory | LOW — verified project uses Vercel + Railway + Supabase only. |

## Open Questions

1. **Do any existing invoices point to leads with no `appointment_id`?**
   - What we know: `invoices.lead_id ON DELETE SET NULL` allows manual invoices. Schema doesn't prevent invoice-for-inquiry.
   - What's unclear: Whether such rows exist in dev data.
   - Recommendation: Plan must include a pre-migration SELECT count. If >0, either create phantom jobs or relax D-11 to NULLABLE (escalate to discuss-phase).

2. **Is there a `merge_audit` requirement for the 7-day undo?**
   - What we know: Deferred ideas list "Migration audit log — not needed in dev-phase".
   - What's unclear: But undo needs to know *what* was repointed.
   - Recommendation: Store a `merge_snapshot JSONB` column on `customers` (nullable) with the affected child-row IDs at merge time. Not a separate audit table — just enough state to reverse.

3. **Should `customer_calls` / `job_calls` be Realtime-published?**
   - What we know: D-15 explicitly lists customers/jobs/inquiries only. CONTEXT marks this as Claude's discretion.
   - Recommendation: **No.** Derived data; dashboard reads them in a joined query, not via live subscription.

4. **Backfill batching — single transaction or chunked?**
   - Recommendation per Claude's discretion: single transaction. Dev-phase data volume is small; chunked adds complexity without benefit.

5. **What happens to the chatbot knowledge corpus (`src/lib/chatbot-knowledge/leads.md`)?**
   - What we know: The corpus still uses "leads" terminology [VERIFIED: grep found `src/lib/chatbot-knowledge/leads.md`].
   - Recommendation: Rename/split into `customers.md`, `jobs.md`, `inquiries.md`. Include in Wave 3 or Wave 4 of the plan. This is mandatory per CONTEXT canonical_refs ("Dashboard chatbot knowledge corpus ... needs reframe").

## Environment Availability

No new external dependencies introduced. Existing stack (Supabase, Next.js, Python LiveKit on Railway, `libphonenumber-js` via npm) all already in use or trivially installable.

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| `libphonenumber-js` | E.164 normalization | To install | `^1.10.x` [ASSUMED] | None (hand-roll rejected — see Don't Hand-Roll). |
| Supabase CLI (for migrations) | Migration 053 | Existing workflow | — | — |
| Python LiveKit agent deploy on Railway | Post-call write path | Active | — | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (Next.js) | Vitest (per existing `package.json` scripts — verify at Wave 0) [ASSUMED; confirm via `cat package.json`] |
| Framework (Python agent) | pytest (confirmed in MEMORY reference_retell_ws_server + existing `livekit-agent/tests/webhook/test_schedule.py` per ROUTE-04) |
| Config file (Next.js) | `vitest.config.*` or `jest.config.*` — Wave 0 task to confirm |
| Quick run command (Next.js) | `npm run test -- <file>` or `npx vitest run <file>` |
| Full suite command (Next.js) | `npm run test` |
| Full suite command (Python) | `pytest tests/` inside livekit-agent repo |
| DB migration test | Apply 053 to ephemeral Supabase instance, run SELECT count assertions |
| Phase gate | All unit + integration tests green, manual smoke-test of call → customer upsert → job creation |

### Phase Requirements → Test Map

| Req / Decision | Behavior | Test Type | Automated Command | File Exists? |
|----------------|----------|-----------|-------------------|--------------|
| D-05 (customer dedup) | Two calls from same phone → one customer row | integration (DB) | `pytest tests/db/test_record_call_outcome.py::test_dedup_by_phone` | ❌ Wave 0 |
| D-06 (job = appointment) | Insert job without appointment_id → CHECK fails | unit (SQL) | `psql -f tests/db/test_jobs_constraints.sql` | ❌ Wave 0 |
| D-07 (inquiry enum) | Inquiry with invalid status → CHECK fails | unit (SQL) | same file | ❌ Wave 0 |
| D-10 (same-call auto-convert) | record_call_outcome with appointment_id → job + no inquiry | integration | `pytest tests/db/test_record_call_outcome.py::test_auto_convert` | ❌ Wave 0 |
| D-11 (invoice.job_id) | Backfill populates job_id for all invoices where lead had appointment | integration | `pytest tests/migrations/test_059_backfill.py::test_invoices_repointed` | ❌ Wave 0 |
| D-12/D-13 (activity_log) | Backfill populates customer_id + (job_id XOR inquiry_id) | integration | same file, different test | ❌ Wave 0 |
| D-14 (RPC atomicity) | Simulated failure mid-RPC rolls back customer insert | integration | `pytest tests/db/test_record_call_outcome.py::test_transaction_rollback` | ❌ Wave 0 |
| D-15 (Realtime) | INSERT on jobs triggers subscription payload | integration (e2e) | `npx vitest run tests/realtime/jobs.test.js` | ❌ Wave 0 |
| D-16 (customer_calls/job_calls) | Single RPC inserts both junction rows | integration | same as D-14 | ❌ Wave 0 |
| D-18 (edit modal) | PATCH /api/customers/[id] updates all fields except phone | unit (API) | `npx vitest run tests/api/customers.test.js` | ❌ Wave 0 |
| D-19 (merge + undo) | Merge repoints jobs/inquiries/invoices; undo reverses within 7d | integration | `pytest tests/db/test_merge_customer.py` | ❌ Wave 0 |
| Jobs tab parity | GET /api/jobs returns shape matching former /api/leads (minus lead-isms) | API snapshot | `npx vitest run tests/api/jobs-list.test.js` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <changed-file>` (Next.js) or `pytest <changed-file>` (Python).
- **Per wave merge:** `npm run test` + `pytest` (full suites).
- **Phase gate:** Full suites green + manual smoke test: dev-env call flow → verify customer row + job row appear live on dashboard.

### Wave 0 Gaps
- [ ] `package.json` — confirm test framework + add `"test": "..."` script if missing.
- [ ] `tests/db/test_record_call_outcome.py` (or `.test.js` equivalent) — RPC contract tests.
- [ ] `tests/db/test_jobs_constraints.sql` — schema constraint tests.
- [ ] `tests/migrations/test_059_backfill.py` — backfill assertions.
- [ ] `tests/api/customers.test.js` + `tests/api/jobs-list.test.js` + `tests/api/inquiries-list.test.js` — route contract tests.
- [ ] `tests/realtime/jobs.test.js` — Realtime smoke.
- [ ] `tests/db/test_merge_customer.py` — merge + undo.
- [ ] `src/lib/phone/normalize.js` + companion test — E.164 contract matches Python agent's `_normalize_phone`.
- [ ] Pre-migration audit SQL in `supabase/migrations/059_audit.sql` (runs SELECTs, not DDL — documents expected pre-state).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing Supabase Auth + `getTenantId()` middleware. No changes. |
| V3 Session Management | no | No session changes. |
| V4 Access Control | yes | **CRITICAL.** Every new table (customers, jobs, inquiries, customer_calls, job_calls) MUST have `tenant_id` + RLS `tenant_own` policy mirroring `004_leads_crm.sql`. Missing RLS = cross-tenant data leak. |
| V5 Input Validation | yes | E.164 validation on phone input (libphonenumber-js); status enum CHECK constraints; max length on name/address/notes. |
| V6 Cryptography | no | No new crypto. Phone numbers are PII but not encrypted at rest (existing posture). |

### Known Threat Patterns for Next.js + Supabase RLS stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant customer read via forged `customer_id` in URL | Information Disclosure | RLS tenant policy on `customers`; API route also explicit `.eq('tenant_id', tenantId)` as defense-in-depth. |
| Merge another tenant's customer into yours | Tampering | RLS on `/api/customers/[id]/merge` service-role route must explicitly verify BOTH source and target belong to caller's tenant BEFORE calling the RPC. |
| RPC `record_call_outcome` called by unauthorized client | Elevation of Privilege | `REVOKE EXECUTE FROM PUBLIC; GRANT TO service_role;` — same lockdown as migrations 027 and 033. |
| Phone number as PII in logs | Information Disclosure | Review new routes for `console.log(phone)`; existing practice (per migrations) is to log only `tenant_id` + row id. |
| Soft-delete bypass (owner sees merged customer) | Information Disclosure (minor) | All customer SELECT queries filter `WHERE merged_into IS NULL` by default. Unmerge API is the only exception. |

## Sources

### Primary (HIGH confidence — in-repo, directly verified)
- `.planning/phases/59-customer-job-model-separation-split-leads-into-customers-ded/59-CONTEXT.md` — all 19 locked decisions
- `.planning/phases/59-customer-job-model-separation-split-leads-into-customers-ded/59-DISCUSSION-LOG.md` — rejected alternatives
- `.planning/ROADMAP.md` line 822 — Phase 59 goal + dependency on v6.0
- `.planning/STATE.md` — v6.0 still in dev, no prod users
- `supabase/migrations/004_leads_crm.sql` — current leads/lead_calls/activity_log schema being refactored
- `supabase/migrations/003_scheduling.sql` — appointments table (Job's 1:1 partner) + book_appointment_atomic pattern for RPC design
- `supabase/migrations/029_invoice_schema.sql` — current `invoices.lead_id` FK target
- `supabase/migrations/043_appointments_realtime.sql` — Realtime publication pattern
- `supabase/migrations/027_lock_rpc_functions.sql` + `033_lock_counter_functions.sql` — RPC REVOKE/GRANT lockdown pattern
- `src/lib/leads.js` — current `createOrMergeLead` logic (to be replaced)
- `.claude/skills/dashboard-crm-system/SKILL.md` — current Jobs tab + LeadFlyout + Realtime architecture
- `.claude/skills/auth-database-multitenancy/SKILL.md` — 3 Supabase clients + RLS patterns + full migration trail
- `CLAUDE.md` — brand name, skill sync mandate

### Secondary (MEDIUM — inferred from grep but not fully read)
- `src/app/dashboard/jobs/page.js` — Jobs tab current query (exists; rewrite target)
- `src/app/api/leads/route.js` — current list API (replace target)
- `src/lib/chatbot-knowledge/leads.md` — chatbot corpus requiring reframe

### Tertiary (LOW — training data, flag for Wave 0 verification)
- `libphonenumber-js` current version + API — verify with `npm view libphonenumber-js` at Wave 0 [A4]
- Python agent's `_normalize_phone` exact output vs libphonenumber-js — verify via cross-validation test [A5]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all in-repo, verified
- Architecture patterns: HIGH — migration 053 skeleton is derivative of proven 004/003/029 patterns
- Pitfalls: HIGH — 6 pitfalls each traceable to specific data-model evidence
- Assumptions: 7 logged, 3 MEDIUM risk (flag to discuss-phase if they surface)

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (30 days — stable stack, no fast-moving external deps)
