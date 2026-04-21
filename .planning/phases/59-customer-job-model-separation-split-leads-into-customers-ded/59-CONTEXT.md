# Phase 59: Customer/Job model separation - Context

**Gathered:** 2026-04-17 (initial) · **Revised:** 2026-04-21 (full re-discussion — reconciled with plans, expanded merge audit, added backfill rules)
**Status:** Ready for planning

<domain>
## Phase Boundary

Refactor the current single-table `leads` model (1 row per call session, 1:1 with appointment) into three explicit entities — **Customers** (deduped by phone within tenant), **Jobs** (1 row per booked appointment), and **Inquiries** (1 row per unbooked call). Rewrite `/dashboard/jobs` to query the new `jobs` table, add a new `/dashboard/inquiries` tab, add a new `/dashboard/customers/[id]` detail page, repoint invoices and `activity_log` to job/customer FKs, and update the Python LiveKit voice agent's post-call write path. Renumbered from Phase 56 → 59 on 2026-04-17 to resolve a v6.0 numbering collision; depends on v6.0 (Phases 53–58) shipping first.

Out of scope: changes to the Phase 33–35 invoicing UI itself (only FK reattribution), changes to the appointment booking algorithm, cross-tenant customer dedup, customer portal, customer-initiated workflows.

</domain>

<decisions>
## Implementation Decisions

### Migration & cutover
- **D-01 (revised 2026-04-21):** Two-phase cutover — `059_customers_jobs_inquiries.sql` creates `customers`, `jobs`, `inquiries`, `customer_calls`, `job_calls` + RLS + Realtime + backfills from existing `leads`/`appointments`/`lead_calls`; **legacy `leads`/`lead_calls` tables are KEPT** (read-only after 059, no new writes). `061_drop_legacy.sql` drops legacy tables and enforces `activity_log.customer_id NOT NULL`. 061 ships **same PR / same day** as 059, after the Python LiveKit agent is verified writing to the new RPC via a live test call. Reconciles the old big-bang intent with the actual plans (59-02 ships 059, 59-08 ships 061) and the safer deploy story.
- **D-02:** Forward-only migrations. No down scripts. Idempotent backfill. If a backfill bug surfaces, write a corrective migration. Matches existing `supabase/migrations/` style.
- **D-02a (new 2026-04-21):** **New tables only** during the 059→061 window. As soon as 059 ships, all writers (Next.js API routes + Python agent) write exclusively to `customers`/`jobs`/`inquiries`. The legacy `leads`/`lead_calls` tables receive zero new rows — they exist only as the rollback snapshot. **No dual-write.** Keeps code paths clean and avoids drift between tables.
- **D-02b (new 2026-04-21):** **Forward-fix only rollback.** Dev-phase (no real users). If the Python agent deploy fails after 059 applies, the fix is to patch the agent and redeploy — not to revert the migration. PLAN risk section must name this explicitly so the executor doesn't write a phantom rollback migration. Matches D-02 forward-only philosophy.
- **D-03:** API routes split: `/api/leads/*` → `/api/customers/*` + `/api/jobs/*` + `/api/inquiries/*`. All dashboard fetch sites and chatbot tools updated in this phase. No deprecation window — clean break. `/api/leads/*` routes deleted in 59-08 (Wave 4) after Python agent confirmed on new RPC.
- **D-04:** Voice agent (Python LiveKit, separate Railway repo) updated in same phase as the DB cutover. Lockstep deploy required (Next.js + agent). Capture deploy ordering in PLAN risk section: 059 migration → Next.js deploy (new API routes + Realtime subscriptions) → Python agent deploy → verify with live test call → 061 migration drops legacy.

### Entity definitions
- **D-05:** Customer dedup: `UNIQUE(tenant_id, phone_e164)`. Phone normalized to E.164 via `libphonenumber-js` before insert (Node) and parity fixture for Python (Wave 0 plan 59-01). Phone is the dedup key and is **immutable** post-create — to "change" a customer's phone, owner uses Merge. No secondary email/address dedup — deliberately simple.
- **D-06:** Strict Job semantics: `jobs.appointment_id NOT NULL` (1:1 with `appointments`). A row called "Job" always represents booked work. Matches Jobber/Housecall Pro/ServiceTitan industry mental model.
- **D-07:** Separate `inquiries` table for unbooked calls. `inquiries.appointment_id` does not exist. `inquiries.status` enum: `open`, `converted`, `lost` (minimal — intentionally no `follow_up_scheduled` / `unqualified` in V1). Inquiries that become Jobs (same-call conversion) have `status='converted'` + `converted_to_job_id` audit FK.
- **D-07a (new 2026-04-21):** Stale open inquiries stay `open` indefinitely — **owner's responsibility** to convert or mark lost. No cron job, no auto-timeout, no visual staleness flag in V1. Matches the "inbox" mental model. Revisit if owners report cognitive load from the inbox filling up.
- **D-08:** Two top-level dashboard tabs: **Jobs** and **Inquiries**. Sidebar gets two nav items (existing "Jobs" entry stays; new "Inquiries" added below). Bottom-tab bar updated proportionally.
- **D-09:** Distinct status pill sets per tab:
  - **Jobs:** `Scheduled` → `Completed` → `Paid` … (gap) … `Cancelled`, `Lost`
  - **Inquiries:** `Open` → `Converted` … (gap) … `Lost`
  - Phase 49 dark-mode pill palette + Phase 52 Lost-gap visual layout preserved verbatim.
- **D-10:** Inquiry → Job conversion rule: **same-call auto-convert + manual button for offline follow-ups**.
  - Same call: voice agent's `record_call_outcome` RPC creates the inquiry row, then immediately inserts a job (with `originated_as_inquiry_id` audit FK) and marks the inquiry `status='converted'`. Owner sees only the Job. No race conditions (single RPC transaction).
  - Different call: caller phones back about a different problem and books → new Job, old inquiry untouched (still `Open`). No window-based auto-convert — avoids the gas-line-vs-clogged-sink false positive.
  - Offline: owner gets "Convert to Job" + "Mark as Lost" buttons in the inquiry flyout for cases where they texted/called the customer back outside the AI flow.

### Invoice reattribution + activity log
- **D-11:** `invoices.lead_id` → `invoices.job_id NOT NULL`. Backfill: for each existing invoice, find the lead's `appointment_id` → resolve to the new `job_id`. Customer is derivable via `job.customer_id`. Multi-job invoices handled by line items referencing job_id (out of scope for this phase if not already supported).
- **D-12:** `activity_log` schema: `customer_id NOT NULL`, `job_id NULLABLE`, `inquiry_id NULLABLE` (**three explicit FKs, not polymorphic**). Customer-level events (created, contact info changed, merged) have only customer_id. Job-level events (booked, completed, paid) have customer_id + job_id. Inquiry events (opened, converted, lost) have customer_id + inquiry_id. Existing `lead_id` column dropped in 061 after backfill.
- **D-12a (new 2026-04-21):** `activity_log.event_type` is a **strict enum**, not free-form. Starting set: `call_received`, `inquiry_opened`, `inquiry_converted`, `inquiry_lost`, `job_booked`, `job_completed`, `job_paid`, `job_cancelled`, `customer_created`, `customer_updated`, `customer_merged`, `customer_unmerged`, `invoice_created`, `invoice_paid`, `invoice_voided`, `other` (catch-all). Event-specific payload lives in existing/new `metadata` JSONB. Adding new event types requires a migration — deliberate friction keeps analytics sane.
- **D-13:** Backfill rule: every existing `activity_log.lead_id` row → `customer_id` from the lead's resolved customer + `job_id` if the lead had an `appointment_id`, else `inquiry_id`.

### Backfill edge cases (new section 2026-04-21)
- **D-13a:** **Orphan leads** (leads with no `appointment_id`) backfill as **Inquiries with the lead's existing status** (existing `lead.status='open'` → `inquiries.status='open'`; `lost` → `lost`). Preserves full history. Owner cleans up noise post-cutover from the Inquiries tab.
- **D-13b:** **Duplicate-phone leads** (multiple leads share `phone_e164` within a tenant) collapse to **ONE customer per (tenant_id, phone_e164)**. The customer's name/address come from the **most recent** lead (by `created_at DESC`). All duplicate leads' appointments/invoices/activity rows point to that single customer. Consistent with D-05 dedup key.
- **D-13c:** **Test/spam data is NOT filtered** at migration time. Backfill everything as-is. Owner deletes test customers/inquiries from the dashboard post-cutover. Migration does not make quality judgments — simplest, auditable, no risk of dropping real data that looks like test data.

### Voice agent + Realtime
- **D-14:** New Postgres RPC `record_call_outcome(tenant_id, phone, caller_name, service_address, appointment_id, urgency, call_id, ...)` returns `{customer_id, job_id?, inquiry_id?}`. Atomic: UPSERTs customer (by `tenant_id, phone_e164`), updates name/address if provided, then inserts either a job (if `appointment_id` present) or an inquiry. Single round-trip from Python agent. **MUST be documented in `auth-database-multitenancy` and `voice-call-architecture` skill files** (per recurring project preference — DB functions/RPCs/triggers belong in skills or they disappear from the team's mental model).
- **D-15:** Realtime publication: `customers`, `jobs`, `inquiries` all published with `REPLICA IDENTITY FULL`. Mirror current `leads` Realtime pattern. Dashboard Realtime listeners updated:
  - Jobs tab → subscribe to `jobs` filtered by tenant_id
  - Inquiries tab → subscribe to `inquiries` filtered by tenant_id
  - Customer detail page → subscribe to `customers` (single row), `jobs` filtered by customer_id, `inquiries` filtered by customer_id
- **D-16:** `lead_calls` junction → `customer_calls` (n:1 calls→customer) **and** `job_calls` (n:1 calls→job). A call links to one customer always, plus optionally to one job/inquiry. Replaces lead_calls.

### Customer detail page
- **D-17:** Layout: sticky header + 3 tabs (`Activity` | `Jobs` | `Invoices`).
  - Header surfaces: name, phone, default address, lifetime value, outstanding balance, Jobber/Xero context badges (when v6.0 connected — gracefully absent otherwise).
  - Activity tab: unified chronological timeline (calls + booking events + invoice events + notes + inquiry events).
  - Jobs tab: cards with Phase 49 pill palette.
  - Invoices tab: list with paid/unpaid pills (gated by `tenants.features_enabled.invoicing` — Phase 53).
- **D-18:** Editing model: **Full CRUD modal** (Edit button → modal with all customer fields). Fields: name, default address, email, notes, tags. Phone is read-only. Save = single PATCH to `/api/customers/[id]`. Modal pattern matches existing dashboard editing UX (less footgun than inline click-to-edit).
- **D-19:** Merge UI scope: **per-customer "Merge into another" button + 7-day undo + permanent audit table**.
  - Location: secondary action in Customer detail page header overflow menu (not a primary CTA).
  - Flow: typeahead picker for target → preview dialog ("Will move: N jobs, M inquiries, K invoices, L calls. Name 'X' will become 'Y'. Undoable for 7 days.") → confirm.
  - Conflict rule: target wins on name/address/notes/tags using latest `updated_at`.
  - **Soft-delete source:** source.`merged_into = target_id` + `merged_at` timestamp; row hidden from queries. Repointing done via `UPDATE` on jobs/inquiries/invoices/activity_log/customer_calls/job_calls inside a single `merge_customer` RPC transaction.
  - **Undo:** within 7 days, `unmerge_customer` RPC clears `merged_into` and reverse-repoints the rows it originally touched. UnmergeBanner surfaces the undo action on the target customer detail page.
  - **Permanent audit table (new 2026-04-21):** `customer_merge_audit(id, tenant_id, source_customer_id, target_customer_id, merged_by, merged_at, unmerged_at NULLABLE, row_counts JSONB)`. Row inserted by `merge_customer` RPC, updated with `unmerged_at` by `unmerge_customer`. **Retained forever** even after the 7-day undo window expires, so the history of consolidations is always reconstructible. Dashboard surfaces the log inside a "Merges" admin view (admin-only, not linked from normal CRM flows).
  - No global admin merge tool, no field-by-field cherry-pick, no auto-merge — those go to deferred ideas.

### Claude's Discretion
- Indexing strategy on new tables (beyond the obvious `(tenant_id, phone_e164)` UNIQUE and `(tenant_id, status, created_at DESC)` for Jobs/Inquiries lists)
- Exact Activity timeline rendering (icon set, grouping by day vs flat list)
- Modal styling details, typeahead picker component choice (existing or new)
- Backfill batching strategy (single transaction vs chunked) — likely fine to do in one go given dev-phase data volume
- Whether to publish `customer_calls`/`job_calls` to Realtime (likely no — derived data)
- Notification email/SMS template wording adjustments where they currently reference "lead"
- Admin "Merges" view UI details (table, filtering, how to navigate to source/target)

### Folded Todos
None — no todos cross-referenced this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & current state
- `.planning/ROADMAP.md` §"Phase 59: Customer/Job model separation" (line 930) — phase title and dependency
- `.planning/STATE.md` — current milestone (v6.0 complete); Phase 59 is post-v6.0

### Existing DB schema being refactored
- `supabase/migrations/004_leads_crm.sql` — current `leads`, `lead_calls`, `activity_log` definitions, RLS policies, Realtime publication (the table being split)
- `supabase/migrations/003_scheduling.sql` — `appointments` table (Job's 1:1 partner)
- `supabase/migrations/051_features_enabled.sql` — `tenants.features_enabled` JSONB (Invoices tab on Customer page is gated by this)
- `supabase/migrations/` — full migration history; new migrations will be `059` and `061`

### Phase 33–35 invoicing (FK reattribution target)
- Phase 33-35 invoice tables — `invoices.lead_id` is what we're repointing to `job_id`
- Phase 53 feature flag gating — Invoices surface on Customer page must respect `features_enabled.invoicing`

### Frontend surfaces being modified
- `src/app/dashboard/jobs/page.js` — Jobs list page (rewrite to query `jobs` table)
- `src/app/dashboard/leads/[id]/route.js` — existing detail route (relocate or replace)
- `src/app/api/leads/route.js` — existing list API (replace with `/api/jobs`, `/api/inquiries`, `/api/customers`)
- Sidebar + BottomTabBar components — add Inquiries nav item
- LeadFlyout / LeadCard / LeadFilterBar / EmptyStateLeads / HotLeadsTile — split or duplicate for Jobs vs Inquiries
- Dashboard chatbot knowledge corpus (per Phase 52 plan 52-03) — update for new entity model

### Skill files to update (MANDATORY per project convention)
- `.claude/skills/auth-database-multitenancy/SKILL.md` — add `customers`, `jobs`, `inquiries`, `customer_calls`, `job_calls`, `customer_merge_audit` table definitions; document `record_call_outcome` / `merge_customer` / `unmerge_customer` RPCs; document RLS policies; document new Realtime publications; remove `leads` / `lead_calls` from current-table list.
- `.claude/skills/dashboard-crm-system/SKILL.md` — Jobs vs Inquiries separation; Customer detail page; merge flow + admin Merges view; status pill sets per tab; conversion semantics; stale-inquiry owner responsibility.
- `.claude/skills/voice-call-architecture/SKILL.md` — post-call pipeline now calls `record_call_outcome` RPC instead of multiple inserts.
- `.claude/skills/payment-architecture/SKILL.md` — `invoices.job_id` reattribution; downstream effect on usage queries that group by lead.

### Industry references for entity model decisions
- Jobber data model (Request → Quote → Job lifecycle)
- Housecall Pro Estimates → Jobs flow
- ServiceTitan Calls → Jobs creation
(External products — no local file. Capture intent in PLAN; researcher may pull current docs if needed.)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 49 pill palette + Phase 52 Lost-gap layout:** Reuse the existing pill component for both Jobs and Inquiries tabs. Status enums change but visual treatment is identical.
- **Phase 52 reframe pattern:** `/dashboard/leads` → `/dashboard/jobs` was done as a pure UI rename last cycle. The same component file names (`LeadFlyout`, `LeadCard`, etc.) were preserved. Phase 59 needs to actually rename or split these now that the underlying entities differ.
- **Existing Realtime hooks** (Supabase Realtime subscription helpers in `src/lib/supabase/`) — extendable to multi-table subscriptions for the Customer detail page.
- **Phase 53 `features_enabled` gating helpers** (`getTenantFeatures`, `FeatureFlagsProvider`) — used to conditionally render the Invoices tab on the Customer page.
- **Existing E.164 normalization** via `libphonenumber-js` (Node) + parity fixture for Python (Wave 0 plan 59-01).

### Established Patterns
- **3 Supabase client types** (browser/server/service-role) per auth-database-multitenancy skill — new routes must pick the right one. RPCs called from the Python agent use service-role.
- **RLS by tenant** — every new table needs `tenant_id` + matching policies. Mirror the `leads` policy structure exactly: `tenant_own` (auth.uid join through tenants.owner_id) + `service_role_all`.
- **REPLICA IDENTITY FULL + ALTER PUBLICATION supabase_realtime** — required for any Realtime-published table (per Phase 4 / 043_appointments_realtime pattern).
- **Forward-only migrations**, idempotent SQL, named like `NNN_description.sql` — next numbers are `059_customers_jobs_inquiries.sql` and `061_drop_legacy.sql`.
- **Lockstep Next.js + Python agent deploys** — when the agent's write path changes, both must ship together. Capture deploy order in PLAN.
- **SECURITY DEFINER RPCs** — `record_call_outcome`, `merge_customer`, `unmerge_customer` follow the Phase 55 Xero pattern of service-role-only execution.

### Integration Points
- **Voice agent post-call pipeline** (`livekit-agent` repo, `src/post_call/`) — switches from direct lead INSERT to `record_call_outcome` RPC call.
- **v6.0 Phase 55 (Xero) + Phase 56 (Jobber) customer-context lookup** — currently keys off phone. After Phase 59 ships, these lookups can also surface Customer-record fields (lifetime value, last visit) on the agent prompt. Out of scope for Phase 59 itself but unblocked by it.
- **Dashboard chatbot tools** (Phase 37) — knowledge corpus references `leads`; needs reframe to `customers` + `jobs` + `inquiries`.
- **Notification system** (Phase 16, Phase 24, Phase 53) — emails currently reference "lead"; templates need audit.
- **Cron jobs** (`/api/cron/invoice-reminders`, `/api/cron/recurring-invoices`) — already filter by `features_enabled.invoicing` (Phase 53); now also need to query `jobs` instead of `leads` for invoice attribution.

</code_context>

<specifics>
## Specific Ideas

- "Job = booked work" — explicit user instinct, validated against Jobber/Housecall Pro/ServiceTitan industry standard.
- Two-tab nav (Jobs | Inquiries) chosen over inline filter toggle for clarity — owners explicitly switch contexts rather than reasoning about a hidden filter state.
- Same-call auto-convert chosen over "any new appointment for this customer auto-converts" because of the gas-line-vs-clogged-sink scenario: unrelated future bookings should NOT silently mark old inquiries as converted.
- 7-day merge undo added because merge is destructive and the user explicitly raised "what is merge actually for" — signals desire for reversibility.
- Permanent `customer_merge_audit` table added 2026-04-21 because owners may want to reconstruct merge history even after the 7-day undo window has expired — the row_counts JSONB preserves "what this merge touched" in case of legal/audit questions.
- Two-phase 059/061 cutover adopted same day 2026-04-21 because coordinating the Python Railway redeploy with a Next.js deploy is a real failure mode — CONTEXT originally assumed single-PR big-bang, plans drifted to two-phase during planning, this resolves that drift formally.
- Customer page editing chose Full CRUD modal over inline click-to-edit for footgun reduction (consistent with user's general preference for deliberate confirmation flows).

</specifics>

<deferred>
## Deferred Ideas

- **Cross-tenant customer dedup** — out of scope; tenants are isolated by design (multi-tenancy invariant).
- **Customer portal** (customers logging in to see their own jobs/invoices) — separate phase, large surface.
- **Field-by-field merge cherry-pick** (let owner pick name from A, address from B, notes from both) — wait for real-user friction.
- **Global admin merge tool** (`/dashboard/customers/duplicates` showing fuzzy-match candidates) — wait for real-user signal that auto-detection of duplicates would help.
- **Customer tags taxonomy** (predefined VIP/commercial/recurring vs free-form) — start with free-form tags; promote to taxonomy later if needed.
- **Bulk operations** on jobs/inquiries/customers (mass status change, mass merge, etc.) — wait for power-user signal.
- **Customer notes rich text / file attachments** — start with plain text.
- **Phase 56 (v6.0 Jobber) and Phase 55 (Xero) prompt enrichment** with new Customer-record fields (lifetime value, last visit) — unblocked by Phase 59 but a separate prompt-tuning phase.
- **Multi-job invoice line-item UX** — only matters once invoicing flag is on for real users.
- **Inquiry status expansion** (`follow_up_scheduled`, `unqualified`) — deliberately held back; V1 ships with 3-state enum. Revisit if real users report missing states.
- **Auto-timeout on stale open inquiries** — V1 leaves open inquiries alone forever (owner responsibility). Revisit if dashboards start feeling cluttered for power users.
- **Phone-or-email secondary dedup** — V1 is phone-only. Revisit if callers frequently use different numbers for the same household/business.
- **Dual-write or feature-flagged RPC** during 059→061 — deliberately NOT doing this. Dev-phase risk tolerance + same-day window means forward-fix is the rollback. Revisit if Phase 59 ever repeats in production with real users.

### Reviewed Todos (not folded)
None — no todos were surfaced for cross-reference.

</deferred>

---

*Phase: 59-customer-job-model-separation-split-leads-into-customers-ded*
*Context gathered: 2026-04-17*
*Revised: 2026-04-21 (full re-discussion — migration reconciliation, audit table, backfill rules, event_type enum, stale-inquiry policy)*
