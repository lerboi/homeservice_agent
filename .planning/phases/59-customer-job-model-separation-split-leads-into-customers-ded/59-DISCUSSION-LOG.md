# Phase 59: Customer/Job model separation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 59-customer-job-model-separation
**Areas discussed:** Migration & cutover; Entity definitions (Customer + Job + Inquiry); Invoice reattribution + voice agent + activity log; Customer detail page

**Pre-discussion roadmap fix:** Renumbered from Phase 56 → 59 because v6.0 already had a Phase 56 (Jobber read-side integration). Empty phase directory `git mv`'d. ROADMAP.md updated (depends now on Phase 58 / v6.0 complete).

---

## Migration & cutover

### Cutover strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Big-bang: new tables + drop leads | Single migration creates customers/jobs/inquiries, backfills, drops leads. High blast radius, clean end state. | ✓ |
| Dual-write window | Two-phase rollout, voice agent writes both old + new tables temporarily. | |
| Keep `leads` as SQL view | New tables source-of-truth, leads becomes a view. INSTEAD OF triggers + Realtime caveats. | |
| Rename leads→customers | Cheapest. ALTER TABLE leads RENAME, drop appointment_id, appointments=jobs implicitly. | |

**Rationale:** Safe because v6.0 is still dev-phase with no prod users at risk. Cleanest end state for the v6.0 Jobber/Xero customer-context lookups.

### Rollback strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Forward-only fix; idempotent migrations | Standard supabase/migrations style; fix bugs with corrective migrations. | ✓ |
| Snapshot leads table to leads_archive | CREATE TABLE leads_archive AS SELECT * FROM leads before drop. | |
| Reversible migration with down script | Recreate leads from customers+jobs. | |

### API route reorganization

| Option | Description | Selected |
|--------|-------------|----------|
| Split: /api/customers/* + /api/jobs/* (+ /api/inquiries/*) | Mirror new entities. Highest churn, best long-term. | ✓ |
| Keep /api/leads/* paths, return job-shaped data | Less file churn but confusing naming. | |
| Add /api/jobs/*, deprecate /api/leads/* | Both work for one phase. | |

### Voice agent write path

| Option | Description | Selected |
|--------|-------------|----------|
| Update agent in same phase | Big-bang consistent. Lockstep deploy required. | ✓ |
| DB trigger compat shim (leads_compat) | Decouples deploys; permanent DB complexity. | |
| Block phase on agent rewrite first | Agent first as separate PR, then DB cutover. | |

---

## Entity definitions

### Customer dedup rule

| Option | Description | Selected |
|--------|-------------|----------|
| Normalized E.164 phone only | UNIQUE(tenant_id, phone_e164). Manual merge for edge cases. | ✓ |
| Phone + last-name match | Both must match. Brittle when name varies. | |
| Phone primary, allow split/merge UI | Phone is dedup key; UI lets owner split/merge. | |

### Job entity definition

| Option | Description | Selected |
|--------|-------------|----------|
| Job exists per call attempt, appointment optional | Matches current `leads` semantics. | |
| Job ONLY on appointment booked + separate inquiries table | Industry standard (Jobber/HCP/ServiceTitan). | ✓ |
| Job per call with optional appointment_id | One job per `lead_calls` row. | |

**User clarification request:** "Which option/design provides the best UI/UX usable in the real world?" Answered with Jobber/HCP/ServiceTitan industry comparison; user picked the strict-Job + separate-inquiries shape.

### Default Jobs view + inquiry toggle

| Option | Description | Selected |
|--------|-------------|----------|
| Default booked-only; persistent toggle 'Show inquiries' | Sticky filter; inline visual marker for inquiries. | |
| Default everything; toggle to 'Hide inquiries' | Backwards-compat with current behavior. | |
| Two separate tabs: Jobs | Inquiries | Explicit context switch in nav. | ✓ |

### Status pill placement

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct pill sets per tab | Jobs: Scheduled/Completed/Paid/Cancelled/Lost. Inquiries: Open/Converted/Lost. | ✓ |
| Shared pill set with tab-specific filtering | Phase 52 set; pills mean different things per tab. | |
| Lifecycle pills (continuous) | Single enum spans both tables. | |

**User clarification request:** "Best UI/UX in the real world?" Answered with the conversation-continuity rule (gas-line vs clogged-sink scenario) before re-asking conversion rule.

### Inquiry → Job conversion

| Option | Description | Selected |
|--------|-------------|----------|
| Same-call auto-convert + manual button for offline | Voice path zero-friction; offline owner gets explicit control. | ✓ |
| Same-call auto-convert only | Strictest; owner creates Job from scratch for offline follow-ups. | |
| Always manual convert | Owner must click Convert even for AI bookings. Reject. | |

---

## Invoice reattribution + voice agent + activity log

### Invoice FK target

| Option | Description | Selected |
|--------|-------------|----------|
| Invoice → job_id NOT NULL | Per-job revenue attribution; customer derivable via job. | ✓ |
| Invoice → customer_id only | Allows ad-hoc invoices not tied to a job. | |
| Both: invoice has customer_id AND job_id | Redundant but explicit. | |

### Activity log target

| Option | Description | Selected |
|--------|-------------|----------|
| customer_id NOT NULL + job_id NULLABLE + inquiry_id NULLABLE | Three explicit FKs. Customer/Job/Inquiry events all expressible. | ✓ |
| Polymorphic: entity_type + entity_id | Loses FK integrity. | |
| Job-keyed only | Drops customer-level events. | |

### Voice agent write flow

| Option | Description | Selected |
|--------|-------------|----------|
| find-or-create customer, then create job/inquiry | Pure SQL, multiple round-trips from Python. | |
| Postgres RPC `record_call_outcome` for atomicity | Single round-trip, transactional. **Document RPC in skill files.** | ✓ |
| Edge Function reconciles raw call data | Async queue; latency + failure modes. | |

**User note:** "You can do Option 2, just ensure to document the DB code in the skill file or somewhere reachable so that we can keep track of the DB functions etc." Saved to user-feedback memory.

### Realtime publication

| Option | Description | Selected |
|--------|-------------|----------|
| Publish customers + jobs + inquiries | Three publications; per-tab subscriptions. | ✓ |
| Publish jobs + inquiries only | Skip customers (rarely changes). | |
| Single dashboard_events view | Views can't be Realtime-published; would need denormalized table. | |

---

## Customer detail page

### Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Header + 3 tabs: Activity / Jobs / Invoices | Sticky header with stats; inquiries surface inside Activity. | ✓ |
| Single scrollable page (no tabs) | Mixed timeline; breaks for power users. | |
| Sidebar + main: stats sidebar, jobs in main | Single-tab feel; harder to scan invoices. | |

### Editing model

| Option | Description | Selected |
|--------|-------------|----------|
| Name, address, notes, tags inline click-to-edit | Optimistic UI; phone immutable. | |
| Name + notes only | Minimal scope. | |
| Full CRUD modal | Edit button → modal with all fields. Lower error rate. | ✓ |

### Merge UI scope

| Option | Description | Selected |
|--------|-------------|----------|
| Ship scoped merge (no undo) | Per-customer button + preview + confirm + repoint + delete. | |
| Ship merge + 7-day undo | Soft-delete source for 7 days; reverse-repoint on undo. | ✓ |
| Defer merge entirely | Wait for real-user feedback. | |

**User clarification request:** "What actually is this merge for? Is it for 2 jobs with the same number?" Answered with scenarios (same person on different phones, number changes, owner-pre-created records). Re-asked scope; user picked merge-with-undo.

---

## Claude's Discretion

- Indexing strategy beyond obvious uniques + tenant/status/created_at
- Activity timeline rendering details
- Modal styling and typeahead picker component choice
- Backfill batching strategy
- Whether to publish customer_calls / job_calls to Realtime
- Notification email/SMS template wording adjustments

## Deferred Ideas

- Cross-tenant customer dedup, customer portal, customer-initiated workflows
- Field-by-field merge cherry-pick, global admin merge tool, auto-merge
- Customer tags taxonomy (start free-form)
- Bulk operations
- Rich-text notes / file attachments on customer
- v6.0 Jobber/Xero prompt enrichment with new Customer fields
- Multi-job invoice line-item UX
- Migration audit log

---

# Re-discussion — 2026-04-21

**Context at re-entry:** CONTEXT.md with 19 locked decisions existed; 8 plans already created. User chose "Full re-discussion" to revisit every area. One known conflict surfaced at entry: CONTEXT D-01 (big-bang) diverged from plans 59-02/59-08 + roadmap (two-phase 053a/053b).

**Areas re-opened:** Migration cutover; Activity log FK shape; Inquiry conversion + lifecycle; Merge flow + dedup; Backfill edge cases.

## Migration cutover (revised)

### Big-bang vs two-phase

| Option | Description | Selected |
|--------|-------------|----------|
| Two-phase 053a/053b (recommended) | 053a creates + backfills + keeps legacy; 053b drops after Python agent verified. Matches drifted plans + roadmap. | ✓ |
| Big-bang single migration | Original D-01 stance. | |
| Two-phase + tenant feature flag | Gradual rollout. Overkill for dev-phase. | |

**Resolves the conflict.** D-01 rewritten in CONTEXT to reflect two-phase.

### Legacy window

| Option | Description | Selected |
|--------|-------------|----------|
| Same PR / same day | 053a → agent redeploy → test call → 053b same day. Safety harness. | ✓ |
| One release cycle (days) | 1-3 day soak. | |
| Skip | N/A (big-bang not chosen). | |

### Dual-write during 053a→053b

| Option | Description | Selected |
|--------|-------------|----------|
| New tables only | 053a redirects ALL writers to new tables; old leads kept read-only. | ✓ |
| Dual-write | Both tables receive writes. More drift risk. | |
| Snapshot-only old table | Old frozen at migration time. | |

**New D-02a captures this.**

### Rollback if Python deploy fails after 053a

| Option | Description | Selected |
|--------|-------------|----------|
| Forward-fix only | Dev-phase, no real users. Fix agent, redeploy. | ✓ |
| Revert migration 053a | Reverse migration. Expensive to write. | |
| Feature flag on RPC | Python falls back to legacy INSERT. More complexity. | |

**New D-02b captures this. Will be called out explicitly in PLAN risk section.**

## Activity log FK shape (revised)

### FK structure

| Option | Description | Selected |
|--------|-------------|----------|
| Three explicit FKs (D-12 as-is) | customer_id NOT NULL + job_id NULLABLE + inquiry_id NULLABLE. | ✓ |
| Polymorphic (entity_type + entity_id) | Loses FK integrity. | |
| Three explicit FKs + extra_refs JSONB | Belt-and-suspenders. | |

**D-12 confirmed verbatim.**

### Event naming

| Option | Description | Selected |
|--------|-------------|----------|
| Strict enum event_type | Starting set with 'other' catch-all. | ✓ |
| Free-form text + category | Flexible, weaker analytics. | |
| Claude's discretion | Default to enum + metadata. | |

**New D-12a captures the enum contract.** Adding new events requires a migration — deliberate friction.

## Inquiry conversion + lifecycle (revised)

### Auto-convert scope

| Option | Description | Selected |
|--------|-------------|----------|
| Same-call only (D-10 as-is) | Only inside the single-RPC transaction. | ✓ |
| Same-call + owner-triggered batch | Dashboard "attach inquiry to job" action. | |
| Window-based auto-convert | Silent heuristic mutation. Rejected (gas-line-vs-clogged-sink). | |

**D-10 confirmed.**

### Status enum

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: open / converted / lost (D-07 as-is) | Three states. Inbox pattern. | ✓ |
| + follow_up_scheduled | Intermediate state after owner contact. | |
| + unqualified | Spam/wrong-number bucket. | |
| Both expansions | Five states. | |

**D-07 confirmed.** Expansions moved to Deferred.

### Stale inquiries

| Option | Description | Selected |
|--------|-------------|----------|
| Nothing — owner's responsibility | Inbox mental model. | ✓ |
| Auto-mark lost after N days | Silent mutation. | |
| Visual staleness only | Dim/flag without status change. | |

**New D-07a captures owner-responsibility stance.**

## Merge flow + dedup (revised)

### Dedup key

| Option | Description | Selected |
|--------|-------------|----------|
| Phone-only (D-05 as-is) | UNIQUE(tenant_id, phone_e164). Phone immutable. | ✓ |
| + email merge hint banner | Surface suggestion, no auto-merge. | |
| Phone-or-email compound | More coverage, more edge cases. | |
| Mutable phone with audit | Loosens immutability. | |

**D-05 confirmed.** Email secondary dedup moved to Deferred.

### Undo window + audit

| Option | Description | Selected |
|--------|-------------|----------|
| 7 days + permanent audit table | D-19 expanded. customer_merge_audit retained forever. | ✓ |
| 30 days undo + permanent audit | Longer window. | |
| 7 days, no audit table | Simplest, loses history past 7 days. | |
| Claude's discretion | Default to 7-day + audit. | |

**D-19 expanded** to add `customer_merge_audit` table with row_counts JSONB, admin-only "Merges" view.

### Merge operation

| Option | Description | Selected |
|--------|-------------|----------|
| Soft-delete source + repoint (D-19 as-is) | merged_into + merged_at; UPDATE rows; single RPC. | ✓ |
| Hard-delete source | Undo impossible. | |
| Source visible as alias | "Merged into X" badge. | |

**D-19 confirmed for the repoint mechanism.**

## Backfill edge cases (new)

### Orphan leads (no appointment_id)

| Option | Description | Selected |
|--------|-------------|----------|
| All → Inquiries | Preserve lead's existing status. | ✓ |
| Heuristic split | Classify spam vs real via SQL. | |
| Owner triage after | backfill_review staging table. | |

**New D-13a.**

### Duplicate-phone leads

| Option | Description | Selected |
|--------|-------------|----------|
| Collapse by phone, newest name wins | Group by (tenant_id, phone_e164). Most recent lead's fields used. | ✓ |
| Collapse by phone, union all fields | Merge non-null, can produce weird concatenations. | |
| Keep as duplicates, flag for merge | Owner manually merges post-cutover. | |

**New D-13b.**

### Test/spam data

| Option | Description | Selected |
|--------|-------------|----------|
| Backfill everything | No quality judgments. Owner deletes post-cutover. | ✓ |
| Pre-migration cleanup SQL | Risk of false positives. | |
| Skip — no real test data | Dev tenants minimal. | |

**New D-13c.**

## Deferred added during this session

- Inquiry status expansion (`follow_up_scheduled`, `unqualified`)
- Auto-timeout on stale open inquiries
- Phone-or-email secondary dedup
- Dual-write / feature-flagged RPC during 053a→053b (dev-phase forward-fix suffices)

## Net deltas to plans

Plans 59-01..59-08 mostly survive. Meaningful deltas to surface during `/gsd:plan-phase 59`:
- 59-02 (053a) — now includes explicit "legacy table stays read-only" note
- 59-03 (RPCs) — unchanged; already included merge/unmerge
- 59-03 (RPCs) — ADD customer_merge_audit table + INSERT/UPDATE inside merge/unmerge RPCs
- 59-07 (Customer detail page) — no change required
- 59-08 (053b) — explicit same-day-as-053a timing, event_type enum migration lives here
- New admin "Merges" view — add to 59-07 or split into its own small plan

