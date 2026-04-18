# Phase 56: Jobber read-side integration — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 56-CONTEXT.md — this log preserves alternatives considered.

**Date:** 2026-04-18
**Phase:** 56-jobber-read-side-integration-customer-context-clients-jobs-invoices
**Areas discussed:** recentJobs shape, Jobber+Xero merge strategy, webhook subscription scope, phone match source

---

## Q1 — `recentJobs` shape

| Option | Description | Selected |
|--------|-------------|----------|
| Last 3 jobs, any status, by updatedAt | Simple, covers ~80% but misses upcoming-visit prominence for callers with active work mixed with stale archived jobs | |
| Last 3 completed jobs only | Cleaner "history" view but breaks the #1 call reason (active jobs) | |
| Split: 1 active + 2 most recent completed | First refinement; too rigid for commercial power users with many active jobs | |
| Up to 4 items (active-first weighted) + `active_jobs_count` hint | Second refinement; added a count signal so agent knows when to call the tool | |
| Up to 4 jobs, each with `{jobNumber, title, status, startAt, endAt, nextVisitDate}`, sorted `[future nextVisitDate ASC, then updatedAt DESC]`, no pre-bucketing | ✓ |

**Final choice:** Up to 4 jobs with full status + date fields, sorted upcoming-visit-first then updatedAt desc. No pre-bucketing into "active"/"completed" categories in our adapter code.

**Reasoning:** Jobber's 8-status taxonomy (`upcoming`, `today`, `action_required`, `late`, `on_hold`, `unscheduled`, `requires_invoicing`, `archived`) makes "active" an arbitrary code-level decision. Emitting status verbatim defers interpretation to the prompt + model. The `active_jobs_count` hint from the earlier refinement was dropped — with only 4 entries, the agent can see saturation and invoke `check_customer_account()` if the caller references a job not in view. Simpler query, no hardcoded taxonomy in our code, agent has full signal.

---

## Q2 — Jobber + Xero merge strategy when both connected

| Option | Description | Selected |
|--------|-------------|----------|
| Jobber-only block in prompt, tool merges on explicit ask | Caller "discovers" Xero data mid-call via tool, creating an unpredictable fact surface | |
| Single merged block with field-level preferences (Jobber ops, Xero payments) | ✓ |
| Two separate blocks: "Jobber:" and "Xero:" sub-sections | Two overlapping STATE surfaces with potentially divergent figures; Gemini picks one and fabricates fluently | |

**Final choice:** Field-level merge with source annotations. Jobber wins `client` / `recentJobs` / `lastVisitDate`; Xero wins `outstandingBalance` / `lastPaymentDate`. One unified STATE block, each field has one authoritative source, provenance markers (`(Jobber)`, `(Xero)`) for model awareness without inviting recitation.

**Reasoning:** The LiveKit prompt philosophy prohibits exposing Gemini to conflicting figures for the same fact — the model will speak one of them fluently and wrongly, and no amount of prompting can reconcile a data-layer ambiguity at inference time. Field-level merge collapses every field to a single value. The provenance markers live in STATE but are prohibited by the DIRECTIVE from being spoken. This is the only merge shape compatible with the philosophy's anti-hallucination rule.

**Real-world backing:** Jobber is home-service operations truth; Xero is bank-feed-reconciled payment truth. When both are connected, Jobber invoices typically sync TO Xero nightly, meaning Xero's `outstandingBalance` is often ahead of Jobber's by hours. A customer who paid yesterday and whose accountant reconciled this morning will have Jobber showing $500 owed and Xero showing $0. Field-level merge delivers the correct "$0 (Xero)" to the caller.

---

## Q3 — Webhook subscription scope

| Option | Description | Selected |
|--------|-------------|----------|
| CLIENT + JOB + INVOICE only (defer VISIT to P57) | Creates a ≤5-min staleness window on `lastVisitDate` — exactly the UX failure this phase prevents | |
| CLIENT + JOB + INVOICE + VISIT_COMPLETE + VISIT_UPDATE in P56; P57 extends same handler | ✓ |

**Final choice:** Subscribe to all 5 event types in P56. P57 extends the existing handler to additionally write visits into `calendar_events`; no second endpoint, no second HMAC key.

**Reasoning:** The prompt cannot self-correct stale STATE. If `lastVisitDate` in context is 3 days old because cache didn't invalidate on a just-completed visit, Gemini will speak the stale date. Closing the staleness window at the source (webhook → `revalidateTag`) is the only defense, and the philosophy makes freshness load-bearing. Subscribing to VISIT in P56 adds one event-type branch to the handler for immediate UX benefit; P57 extends cleanly without architectural duplication.

**Secondary consideration:** Jobber may or may not bump `Job.updatedAt` when a child `Visit` mutates — if it does, JOB_UPDATE implicitly covers visit freshness, but Jobber's documentation is inconsistent on this. Subscribing to VISIT directly is the safe default; worst case is trivial redundancy, best case closes the window.

---

## Q4 — Phone match source

| Option | Description | Selected |
|--------|-------------|----------|
| `client.phones[]` only, with E.164 normalization on our side | ✓ |
| `client.phones[]` + `client.properties[].phones[]` | Requires synthetic join; Jobber's schema doesn't put phones at property level | |
| `client.phones[]` + billingAddress phone | Jobber's address objects don't carry phone fields | |

**Final choice:** `client.phones[]` only. Normalize both sides to E.164 via `libphonenumber` during the GraphQL result filter.

**Reasoning:** Jobber's data model puts phones at the Client level. Properties and addresses don't own phone fields — options 2 and 3 would require synthetic joins across entities that don't store phones. Normalization on our side is necessary because Jobber stores phones free-form (`"(555) 123-4567"`, `"555-1234"`, `"+1 555 123 4567"` all valid in the same field).

**Additional consideration:** Simpler match logic = fewer false positives. A false-positive match would inject a wrong customer's STATE into the prompt — the worst possible hallucination vector. Commercial property-manager edge cases (phone at property level) are the minority for home-service and introduce UX ambiguity ("which property is this caller associated with?") that exceeds this phase's scope. Missing those cases degrades to `customer_context` omission (agent treats as new caller, safe default), which is the correct fallback.

---

## Claude's Discretion (deferred to planner)

- Exact GraphQL query shape — fields, edge counts, pagination
- `libphonenumber` package choice on Next.js side (`libphonenumber-js` vs `google-libphonenumber`)
- Python phone normalization — reuse `_normalize_phone` from existing `src/lib/phone.py` or add `phonenumbers` dep
- Webhook subscription registration mechanism — auto on OAuth callback vs manual via Jobber UI
- `error_state` column reuse (dedicated vs JSONB — depends on what P55 migration 053 chose)
- Ordering of `recentInvoices` reference array
- Source annotation token-economy optimization — `(Jobber)` vs `(J)` if prompt budget tightens
- Merge helper location on Python side — `src/lib/customer_context.py` vs inline in `_run_db_queries`
- Jobber rate-limit degradation tuning

## Deferred Ideas

- Jobber multi-account picker
- Jobber rate-limit back-off layer
- Jobber client-creation on caller match-fail
- Cross-provider client deduplication UI
- Telemetry on Jobber/Xero discrepancy rate
- Webhook subscription to additional Jobber event types (QUOTE_*, REQUEST_*)
- Webhook signature key rotation
- Shared `customer_context.py` between Python and Node
- Agent awareness of Jobber connection state during conversation
- Multi-tenant phone collision
- Non-E.164 Jobber phone format fallback

## External Research

None during discussion — surfaced from prior phase context (P55) and Jobber API public docs referenced in ROADMAP.
