# Phase 58: Setup checklist final wiring + skills + telemetry + UAT + Phase 51 polish absorption — Research

**Researched:** 2026-04-20
**Domain:** Full-stack (Next.js checklist API + Python LiveKit agent telemetry + skill-file rewrites + dashboard polish sweep)
**Confidence:** HIGH overall; two HIGH-impact corrections documented in Section B and Section E.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-21, all LOCKED)

**Checklist completion semantics:**
- **D-01** `connect_xero` / `connect_jobber` are complete only when `accounting_credentials` row exists AND `error_state IS NULL`.
- **D-02** `error_state` set → red-dot badge + "Reconnect needed" subtitle; `href` stays `/dashboard/more/integrations`; clears when OAuth callback or refresh nulls `error_state`.
- **D-03** Per-item manual dismiss honoured via existing `checklist_overrides.{item_id}.dismissed` pattern.
- **D-04** Detection extends `deriveChecklistItems` / `fetchChecklistState` in `src/app/api/setup-checklist/route.js` directly — one-file change, add `.is('error_state', null)` to the two existing `accounting_credentials` count queries (route.js:259-268).

**Telemetry depth + surface:**
- **D-05** Python livekit_agent writes `NOW()` to `accounting_credentials.last_context_fetch_at` after each successful `fetchCustomerByPhone`. Service-role from Python adapter (`src/integrations/xero.py` + `jobber.py`). No column for failed-fetch timestamp.
- **D-06** Per-fetch events logged to `activity_log` with `action = 'integration_fetch'`, `meta` JSONB = `{ provider, duration_ms, cache_hit, counts: { customers, invoices, jobs }, phone_e164 }`. CONTEXT says "zero schema change". ⚠ See Section B risk — actual column names are `event_type` + `metadata`, not `action` + `meta`. Planner must pick one of three reconciliation paths.
- **D-07** Latency validation scope = pre-call parallel lookup budget. Measure p50/p95/p99 for concurrent VIP + leads-history + Jobber + Xero lookup. Target ≤2.5s p95. Capture in UAT.md + new `58-TELEMETRY-REPORT.md`.
- **D-08** Owner-facing telemetry = Last-synced timestamp only (reuses `last_context_fetch_at` already rendered for Xero in Phase 55 Plan 05). Duration/cache-hit rate stays ops-only.

**Skill file structure:**
- **D-09** One consolidated skill `integrations-jobber-xero` — full architectural reference (OAuth + refresh + HMAC state + refresh locks migration 058, caching + webhook invalidation, Python agent injection, dashboard UI contract, telemetry).
- **D-10** Full rewrite of `voice-call-architecture` and `dashboard-crm-system` using `skill-creator` skill. Don't just add cross-refs — both have drifted across v5.0 + v6.0.
- **D-11** Add `integrations-jobber-xero` as new row in CLAUDE.md Core Application Skills table (8 existing rows, Covers / Read this when format).

**UAT + ship gate:**
- **D-12** UAT = automated (Jest detection logic, token refresh, webhook invalidation, telemetry writes) + owner-manual (UAT.md numbered scenarios for connect/disconnect/reconnect + real test call with known-customer phone + reconnect banner after forced refresh failure).
- **D-13** Coverage: (a) token refresh failure (both providers) → error_state → banner + checklist flip → reconnect clears; (b) webhook miss + poll-fallback cron; (c) latency budget p50/p95/p99 ≤ 2.5s p95. Concurrent refresh race NOT required (covered by `refresh-lock.test.js`).
- **D-14** UAT.md with pass/fail checklist (Phase 56/57 pattern). No screenshot requirement.
- **D-15** Ship gate = all UAT scenarios pass + all automated tests green, latency in `58-TELEMETRY-REPORT.md`, then `/gsd:verify-work 58`, then `/gsd:complete-milestone v6.0`.

**Polish budget scope:**
- **D-16** Apply to seven list/data pages — leads, calls, calendar, analytics, integrations, settings, jobs. Full v5.0 debt absorption. ⚠ See Section E — `leads` and `analytics` no longer exist as routes. Planner must reinterpret to the 7 current pages.
- **D-17** POLISH-01 empty states with icon + headline + primary CTA, mirror `EmptyStateLeads` pattern.
- **D-18** POLISH-02 layout-matching skeletons on data fetches, prevent CLS.
- **D-19** POLISH-03 `focus-visible` rings via design-token focus colour across all interactive elements.
- **D-20** POLISH-04 inline error + Retry button.
- **D-21** POLISH-05 async button spinner + disabled state during pending.

### Claude's Discretion
- Wave plan / plan count (~6-8 plans likely).
- p50/p95/p99 measurement technique (client-side `performance.now()` vs server-side `activity_log` aggregation) — planner picks based on where the lookup runs.
- Ordering of polish items across pages if split across plans.
- Skeleton component shape (bespoke vs shadcn `Skeleton`) — existing `src/components/ui/skeleton.jsx` already shadcn-style.

### Deferred Ideas (OUT OF SCOPE)
- Sentry/observability platform wiring beyond current usage.
- Dedicated `integrations_telemetry` table.
- Timestamp + health-indicator dot (timestamp-only locked).
- Screenshot/recording UAT evidence.
- Wave plan / rollout order for polish items (planner's call, not a context decision).
- POLISH-06..12 (explicitly stay in Phase 51 pending).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHECKLIST-01 | `connect_jobber` and `connect_xero` appear in setup-checklist; auto-detected via `accounting_credentials` presence | Section A — current route.js:259-268 counts rows but doesn't filter on `error_state`; D-04 one-line diff |
| CHECKLIST-02 | Connection cards live in `/dashboard/more/integrations`, follow CalendarSyncCard pattern | Section A — already shipped in Phase 55 + 56 (`BusinessIntegrationsClient.jsx`); this phase only tweaks detection semantics |
| CTX-01 | Telemetry to `accounting_credentials.last_context_fetch_at` + activity_log fetch duration + cache hit rate | Section B — `last_context_fetch_at` already written by Python (P55/P56). D-06 activity_log write is NEW but column-name conflict |
| CTX-02 | New skill `integrations-jobber-xero` documenting OAuth, refresh, caching, agent injection, checklist, webhook invalidation | Section C — new skill scaffold + frontmatter template from existing skills |
| CTX-03 | `voice-call-architecture` + `dashboard-crm-system` skills updated; CLAUDE.md references new skill | Section C — drift inventory (both ~900-1333 lines); skill-creator workflow is iterative eval-based |
| POLISH-01..05 | Empty states, skeletons, focus rings, error+retry, async button pending | Section E — seven-page list reinterpretation + primitive audit |
</phase_requirements>

## Executive Summary

1. **Checklist wiring is a trivial one-file diff** — D-04 is correct: `route.js:259-268` already runs two count-only queries, adding `.is('error_state', null)` to both is mechanical. The `deriveChecklistItems` function at `route.js:183-184` already reads `counts.xeroConnected` + `counts.jobberConnected`. Red-dot + subtitle requires extending the item-shape returned from `deriveChecklistItems` (add `has_error: boolean` field) AND the client render path (`SetupChecklist` accordion component). `[VERIFIED: src/app/api/setup-checklist/route.js read in full]`

2. **CRITICAL — activity_log schema mismatch.** CONTEXT D-06 prescribes `action` and `meta` columns. The real table (migration 004 line 76-83) has `event_type` and `metadata`. Current writers in `src/lib/leads.js:72-76,176-180` use the real names. Planner MUST reconcile: (a) use real names (write `event_type='integration_fetch'`, `metadata=<jsonb>`), (b) add a `WHEN 004_MIGRATE_CTX_SCHEMA` style migration to rename, or (c) add `action`/`meta` as generated columns. Option (a) is lowest-risk and preserves CONTEXT's "zero schema change" constraint. `[VERIFIED: supabase/migrations/004_leads_crm.sql:74-96 + src/lib/leads.js:72-180 grep]`

3. **Latency measurement surface lives in Python, not Next.js.** Per v6.0 Decision ("LiveKit agent fetches Jobber/Xero directly via Python"), the parallel phone-based lookup is in `livekit_agent/src/agent.py _run_db_queries` (lines 352-395) plus pre-session Xero/Jobber fetches. The "VIP + leads history" lookup is in `livekit_agent/src/webhook/twilio_routes.py _is_vip_caller` (webhook path, not agent). These run on **different processes**: VIP check is pre-SIP-dispatch on the webhook; Xero+Jobber+intake run inside the agent entrypoint. A single clock-boundary p50/p95/p99 therefore requires log correlation across both surfaces or an in-agent "parallel fanout" wrapper. Recommend: measure only the in-agent lookup (subscription + intake + call-insert + Xero + Jobber = the `asyncio.gather`) against the 2.5s budget. `[VERIFIED: livekit-agent/src/agent.py:352-395 read]`

4. **Python Xero + Jobber already write `last_context_fetch_at` today.** Both `fetch_xero_customer_by_phone` (xero.py:149-165 `_touch_last_context_fetch_at`) and `fetch_jobber_customer_by_phone` (jobber.py:211-227 `_touch_last_context_fetch_at`) persist the timestamp on success. D-05 is therefore NO-OP for Python writes — the work already shipped in Phase 55/56. What's NEW for D-05: confirm write ordering relative to D-06's `activity_log` insert (single transaction vs. two separate writes) and add a tiny assertion test. `[VERIFIED: livekit-agent/src/integrations/xero.py:408 + jobber.py:474]`

5. **Skill-creator is designed for iterative evaluation, not batch rewrites.** The skill's documented loop is draft → test → eval-viewer → iterate. For a full rewrite of 900+/1333+ line skills, the realistic invocation is: (1) capture current pain points (drift inventory), (2) write new draft directly guided by the existing structure, (3) OPTIONALLY use the eval viewer with 2-3 test prompts to spot-check triggering. The user's "full rewrite via skill-creator" likely means "follow skill-creator's writing conventions + progressive disclosure" rather than "run the complete eval loop". Planner should clarify during wave 2 kickoff. `[VERIFIED: .claude/skills/skill-creator/SKILL.md read]`

6. **Seven-page list has two dead entries.** CONTEXT lists "leads, calls, calendar, analytics, integrations, settings, jobs". Reality: `/dashboard/leads` → renamed to `/dashboard/jobs` in Phase 52 (308 redirect); `/dashboard/analytics` → deleted entirely in Phase 49. The actual seven current dashboard data pages are: **jobs, calls, calendar, integrations, settings, services, more (sub-pages)**. Planner MUST decide the target seven; recommend `jobs, calls, calendar, integrations, services, more/billing, more/call-routing` OR keep "settings" abstract = `more/*` subpages as a group. `[VERIFIED: find src/app/dashboard -name page.js]`

7. **Polish primitives are partially in place.** `<Skeleton>` (shadcn-style) exists at `src/components/ui/skeleton.jsx`. `EmptyStateLeads` + `EmptyStateCalendar` exist in `src/components/dashboard/`. Focus-ring token is `focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1` per `src/lib/design-tokens.js:35`. **No generic `<ErrorState retry={...}>` component exists** — must be authored. Async button pending is ad-hoc (e.g., `BusinessIntegrationsClient.jsx:271-275` uses `Loader2 animate-spin` + `disabled`); no shared `<AsyncButton>` primitive. `[VERIFIED: grep + read]`

8. **Existing test suite is substantial.** 9 integration tests in `tests/integrations/` (Jobber adapter/cache/fetch/phone-match/refresh; Xero cache/fetch/phone-match; refresh-lock). Two setup-checklist tests already exist at `tests/api/setup-checklist-{xero,jobber}.test.js` — these need extension for the error_state branch. Jest runner: `npm test` (experimental-vm-modules flag, passWithNoTests). `[VERIFIED: ls tests/integrations, tests/api]`

---

## A. Checklist Wiring (D-01..D-04)

### A.1 Current State of `src/app/api/setup-checklist/route.js`

| Concern | Location | Current Behaviour | Phase 58 Change |
|---------|----------|-------------------|-----------------|
| Function `fetchChecklistState` | lines 213-301 | Parallel `Promise.allSettled` over 8 queries including two `.from('accounting_credentials').select('id', { count: 'exact', head: true }).eq('provider', …)` at lines 259-268 | Add `.is('error_state', null)` to both Xero + Jobber queries |
| Derived count extraction | lines 285-289 | `xeroConnected = count > 0`; `jobberConnected = count > 0` | **No change** — just the count filter above |
| Function `deriveChecklistItems` | lines 149-209 | Reads `counts.xeroConnected`, `counts.jobberConnected` at lines 183-184 | Add `has_error` passthrough from state → item (see A.3) |
| Item metadata | `ITEM_META` lines 102-113 | `title: 'Connect Xero/Jobber'`, `description: 'Let your AI…'`, `href: '/dashboard/more/integrations'` | **No change to href** (D-02); description stays. Red-dot/subtitle is render-time |
| Override handling | line 192 | `if (override.dismissed === true) continue;` — dismissed items filtered out | **No change** (D-03 confirms reuse verbatim) |

### A.2 Existing "Degraded" Precedent

`[VERIFIED: route.js full read]` — No existing checklist item carries a "degraded / needs attention" sub-state. Every item is binary complete/incomplete. The red-dot + "Reconnect needed" subtitle is **a new UI pattern for this phase**.

**Implication:** `deriveChecklistItems` must pass through a new field (e.g. `has_error: bool`, `error_subtitle: string | null`) on each item, and the client render path (which is outside the API — see A.4) must render the red dot when present.

### A.3 Exact Diff Sketch

```js
// route.js ~259-268 — add error_state filter
supabase
  .from('accounting_credentials')
  .select('id', { count: 'exact', head: true })
  .eq('tenant_id', tenantId)
  .eq('provider', 'xero')
  .is('error_state', null),     // ADD THIS LINE

supabase
  .from('accounting_credentials')
  .select('id', { count: 'exact', head: true })
  .eq('tenant_id', tenantId)
  .eq('provider', 'jobber')
  .is('error_state', null),     // ADD THIS LINE
```

For the red-dot + subtitle, a **second pair** of queries is needed (to distinguish "no row at all" from "row with error_state"). Recommended:

```js
// ADD two more queries — count rows with error_state SET
supabase
  .from('accounting_credentials')
  .select('id', { count: 'exact', head: true })
  .eq('tenant_id', tenantId)
  .eq('provider', 'xero')
  .not('error_state', 'is', null),

// same for jobber
```

Then `deriveChecklistItems` receives `xeroHasError`, `jobberHasError` and returns `{ ...item, has_error: true, error_subtitle: 'Reconnect needed' }` for those two IDs when the flag is set (and `complete: false`, which already follows from D-01's filter).

⚠ `[VERIFIED: Supabase PostgREST]` `.is('error_state', null)` IS the correct syntax to filter for IS NULL — documented as "Checking for null values" in Supabase JS client docs.

### A.4 Client Render Path

**Grep target:** `import.*setup-checklist` or `useSetupChecklist`.

The checklist is rendered by Phase 48 `SetupChecklist` accordion component (per `dashboard-crm-system` SKILL.md line 10 metadata). Actual render file likely `src/components/dashboard/SetupChecklist.jsx` or similar. **Planner MUST open this file** (research did not extract it; low priority since content is short once located). The red-dot + subtitle is rendered there, reading the new `has_error` / `error_subtitle` from the API response.

### A.5 Item Manual Dismiss (D-03)

`[VERIFIED: route.js:190-192]` — The `overrides[id].dismissed === true` branch filters out the item entirely (line 192: `if (override.dismissed === true) continue;`). Works identically for `connect_xero` and `connect_jobber` today (they're in `THEME_GROUPS.voice` per lines 25-33). D-03 is already satisfied; no change required.

---

## B. Telemetry Instrumentation (D-05..D-08)

### B.1 Python Write Sites

`[VERIFIED: livekit-agent/src/integrations/xero.py:149-165, 408]`

```python
# xero.py:149-165 — already exists
async def _touch_last_context_fetch_at(cred_id: str) -> None:
    """Telemetry seed — updates last_context_fetch_at on successful fetch."""
    from ..supabase_client import get_supabase_admin
    def _update() -> None:
        admin = get_supabase_admin()
        (admin.table("accounting_credentials")
            .update({"last_context_fetch_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", cred_id).execute())
    try:
        await asyncio.to_thread(_update)
    except Exception: pass  # telemetry — silent on failure

# Called at xero.py:408 after _get_outstanding_balance + _get_recent_invoices succeed
await _touch_last_context_fetch_at(cred["id"])
```

`[VERIFIED: livekit-agent/src/integrations/jobber.py:211-227, 474]` — Identical pattern for Jobber.

**D-05 ASSESSMENT:** The write ALREADY ships. This deliverable is functionally no-op for Python. What remains:
1. Confirm behavior on first-call-after-disconnect (i.e., `cred is None` branch never reaches `_touch_last_context_fetch_at`, which is correct).
2. Add unit-test coverage asserting the UPDATE statement is issued on success + not issued on failure.

### B.2 `activity_log` Schema — CRITICAL MISMATCH

`[VERIFIED: supabase/migrations/004_leads_crm.sql:74-96]`

```sql
CREATE TABLE activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type  text NOT NULL,          -- NOT "action"
  lead_id     uuid REFERENCES leads(id) ON DELETE SET NULL,
  metadata    jsonb,                  -- NOT "meta"
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

`[VERIFIED: src/lib/leads.js:72-76, 176-180]` — Existing writers use `event_type` and `metadata`:

```js
await supabase.from('activity_log').insert({
  tenant_id: tenantId,
  event_type: 'lead_created',      // NOT action
  lead_id: newLead.id,
  metadata: { caller_name, job_type, urgency }   // NOT meta
});
```

CONTEXT D-06 says: `action = 'integration_fetch'`, `meta = { provider, duration_ms, cache_hit, counts, phone_e164 }`.

**Reconciliation options (planner must pick, surface in 58-PLAN):**

| Option | Change | Risk |
|--------|--------|------|
| (a) Use real names | Write `event_type='integration_fetch'`, `metadata=<jsonb>` | ✅ Zero schema change (honours CONTEXT constraint). Recommend this. |
| (b) Add column aliases | New migration adds `action` + `meta` as generated columns / views | ❌ Violates CONTEXT "zero schema change"; duplicates data |
| (c) Rename columns | Migration renames `event_type` → `action`, `metadata` → `meta` | ❌ Breaks every existing reader; large blast radius |

**Recommendation: Option (a).** Treat CONTEXT D-06 column names as terminology ambiguity from context-gathering; preserve wire format, use real DB column names.

### B.3 Latency Measurement Surface

The "pre-call parallel lookup" question from STATE.md line 97 needs scoping because the lookups run on two different services:

| Lookup | Where | When | Clock |
|--------|-------|------|-------|
| VIP check (`_is_vip_caller`) | `livekit-agent/src/webhook/twilio_routes.py` | FastAPI webhook (Railway port 8080), pre-SIP-dispatch | Twilio webhook round-trip |
| Leads history (`check_caller_history`) | `livekit-agent/src/tools/check_caller_history.py` (P55) | Tool call during agent session, NOT pre-call | Per tool-call |
| Xero context | `livekit-agent/src/integrations/xero.py :: fetch_xero_context_bounded` | `_run_db_queries` OR pre-session (D-08 from Phase 55) | 800ms budget per Phase 55 D-04 |
| Jobber context | `livekit-agent/src/integrations/jobber.py` | Same as Xero | 800ms budget |
| Subscription + intake + call-insert | `livekit-agent/src/agent.py:352-395` `_run_db_queries` | `asyncio.gather(sub_task, intake_task, call_task, …)` | Inside agent entrypoint |

`[VERIFIED: livekit-agent/src/agent.py:352-395]` — Today, `_run_db_queries` runs `asyncio.gather(sub_task, intake_task, call_task, return_exceptions=True)` at line 395. The P55 Xero fetch is stated (line 391-393 comment) to happen **before** session.start (pre-session), not inside `_run_db_queries`.

**Recommended measurement boundary for D-07:**

> **Start of `asyncio.gather` for the concurrent fan-out → end of `asyncio.gather`** in the agent entrypoint's pre-session lookup.

This is the honest "parallel phone-based lookup" as described in STATE.md line 97. The VIP check happens earlier (webhook), the check_caller_history is a tool call (not pre-call), so neither belongs in the budget.

**Instrumentation mechanics:**
- Wrap the gather with `time.perf_counter()` before / after.
- Emit one activity_log row per call with `event_type='integration_fetch_fanout'`, `metadata={call_id, duration_ms, per_task_ms: {xero, jobber, intake, sub, call_insert}}`.
- The D-06 per-provider rows remain separate (inside `fetch_xero_customer_by_phone` / `fetch_jobber_customer_by_phone`).

**Aggregation:** simple SQL in `58-TELEMETRY-REPORT.md`:
```sql
SELECT
  percentile_cont(0.5) WITHIN GROUP (ORDER BY (metadata->>'duration_ms')::int)  AS p50,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY (metadata->>'duration_ms')::int) AS p95,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY (metadata->>'duration_ms')::int) AS p99
FROM activity_log
WHERE event_type = 'integration_fetch_fanout'
  AND created_at > now() - interval '24 hours';
```

### B.4 Owner-Facing Last-Synced (D-08)

`[VERIFIED: src/components/dashboard/BusinessIntegrationsClient.jsx:217-219, 255-259]` — The card already renders `Last synced X ago` via `formatDistanceToNow(parseISO(lastFetch))` when `row?.last_context_fetch_at` is present. Shipped in Phase 55. For Jobber, the same pattern fires automatically from `initialStatus?.jobber?.last_context_fetch_at`. **D-08 is a no-op for Jobber** as long as the integrations page loader passes `last_context_fetch_at` in `initialStatus.jobber`.

**Planner action:** Verify the loader at `src/app/dashboard/more/integrations/page.js` selects `last_context_fetch_at` for Jobber rows. If yes, D-08 is shipped; if no, 1-line select extension.

### B.5 Race/Concurrency Notes

- `_touch_last_context_fetch_at` does NOT read-then-write — it's a blind UPDATE. No race with Next.js side.
- The new `activity_log` insert (D-06) is an INSERT with a fresh UUID PK; no conflict possible.
- **Ordering:** `_touch_last_context_fetch_at` is currently the last async call before returning `shaped` (xero.py:408, jobber.py:474). D-06's `activity_log` insert could run in parallel with it via `asyncio.gather` to avoid double-latency. Recommend: `await asyncio.gather(_touch_last_context_fetch_at(cred_id), _emit_activity_log(...))`.

---

## C. Skill Files (D-09..D-11)

### C.1 skill-creator Invocation Model

`[VERIFIED: .claude/skills/skill-creator/SKILL.md read in full]`

skill-creator is a **workflow skill with an iterative eval loop**, not a one-shot rewrite tool. Its documented flow:

1. **Capture Intent** — interview user, extract what / when / output format / test cases.
2. **Write SKILL.md** — frontmatter (name, description, compatibility) + body.
3. **Run test prompts** — spawn subagents with-skill + baseline, save outputs in `<skill-name>-workspace/iteration-N/`.
4. **Review via HTML viewer** (`eval-viewer/generate_review.py`) — user leaves feedback.
5. **Iterate** — rewrite, re-test, repeat.

**For Phase 58's rewrite of 900+ / 1333+ line skills, the realistic invocation is:**

- Step 1 (Capture) — **skip the interview**; drift inventory + CONTEXT already codify intent.
- Step 2 (Write) — **do this**; follow skill-creator's progressive-disclosure principle (<500 lines ideal, bundled references for overflow).
- Steps 3-5 (eval loop) — **optional**. User's "full rewrite via skill-creator" probably means "follow the conventions", not "burn 5 iterations of subagent evals on a static reference doc". Planner should clarify in Wave 2 kickoff; if the user wants full evals, 2-3 test prompts like "How does the voice-call post-call pipeline work?" / "Where is `book_appointment` registered?" are sufficient to validate triggering.

**Progressive disclosure for 1333-line skill:**
- SKILL.md body = high-level architecture + pointers (<500 lines).
- `references/` = deep-dive per subsystem (post-call, prompt building, tools, webhooks, Xero/Jobber integration injection points).

### C.2 Drift Inventory — `voice-call-architecture/SKILL.md`

`[VERIFIED: voice-call-architecture/SKILL.md header (line 10) read; 916 total lines]`

**Latest last-updated** in the header: `2026-04-19 (Phase 60)`. The header has been incrementally appended across Phases 39, 40, 46, and 60 but NOT fully rewritten. Known drift relative to v5.0/v6.0:

| Subsystem | Drift likely / confirmed |
|-----------|-------------------------|
| Pre-session Xero context fetch (Phase 55 D-08) | Mentioned in line-10 header but not integrated into the body's "Architecture Overview" flow diagram |
| Pre-session Jobber context fetch (Phase 56) | Appended to header but may not be reflected in the full body |
| `integrations/xero.py` + `integrations/jobber.py` modules | New in Phase 55/56 — need a new "Integrations Layer" section in the body |
| `check_customer_account` tool (Phase 55/56) | Probably in header, possibly not in body's tool enumeration |
| Phase 60 prompt restructure (name-once, single-question address, STATE+DIRECTIVE format for 5 tools) | Just landed; header is current but body needs full review |
| Gemini VAD tuning (backlog 999.2, RealtimeInputConfig with LOW sensitivity) | Header mentions it; body may not |
| `_booking_succeeded` stamping (Phase 46 + 48.1 revenue-recovery) | Likely in body but worth audit |
| `telemetry to activity_log` (Phase 58) | Will be NEW — rewrite must include the integration_fetch event pattern |

**Rewrite approach:** Collapse the 10+ header-change paragraphs (currently a single ~1000-word run-on at line 10) into a single 2-line "Last updated: 2026-04-20 — Phase 58" line. Migrate historical "Previous:" paragraphs to a separate `references/phase-history.md`.

### C.3 Drift Inventory — `dashboard-crm-system/SKILL.md`

`[VERIFIED: dashboard-crm-system/SKILL.md header line 10 read; 1333 total lines]`

| Subsystem | Drift likely / confirmed |
|-----------|-------------------------|
| Leads → Jobs rename (Phase 52) | Captured in header (2026-04-17 update) — probably in body |
| `/dashboard/analytics` removal (Phase 49) | Captured in header — probably in body |
| Phase 48 SetupChecklist accordion with themes | Referenced in line 10; depth of body coverage unclear |
| Phase 55 Business Integrations card (Xero Connect/Reconnect/Disconnect, 4 states, `error_state`, reconnect banner) | **Probably missing from body** — this is a major dashboard system and Phase 55 was the add |
| Phase 56 same for Jobber | Same as above |
| Phase 57 JobberBookableUsersSection in integrations card | New; likely missing |
| Phase 57 JobberCopyBanner on calendar | Likely missing |
| Phase 57 "From Jobber" overlay pills + AppointmentFlyout flyout changes | Likely missing |
| Phase 58 checklist red-dot + reconnect-needed subtitle | Will be NEW |
| Phase 58 POLISH-01..05 primitives (empty states, skeletons, focus, error+retry, async buttons) | Will be NEW — probably deserves its own `references/polish-patterns.md` |

### C.4 Existing Skill Frontmatter Template

`[VERIFIED: voice-call-architecture/SKILL.md + dashboard-crm-system/SKILL.md + payment-architecture (referenced) all use identical shape]`

```yaml
---
name: <kebab-case-name>
description: "<long single-quoted paragraph — what the skill covers + 'Use this skill when…' clauses. Pushy / explicit triggering.>"
---

# <Title> — Complete Reference

This document is the single source of truth for <system>. Read this before making any changes to <system>.

**Last updated**: <date> (<summary of most recent phase>)

---

## Architecture Overview
…
```

No existing skill declares `compatibility:` in frontmatter, so CONTEXT's new skill can skip it.

### C.5 New Skill Scaffold — `integrations-jobber-xero/SKILL.md`

Recommended structure (follows skill-creator progressive disclosure + matches existing skill patterns):

```
.claude/skills/integrations-jobber-xero/
├── SKILL.md                       # ~400 lines: high-level architecture + pointers
├── references/
│   ├── oauth-flows.md             # OAuth + refresh + refresh locks (migration 058) + error_state
│   ├── caching.md                 # Next.js 16 'use cache' + cacheTag + webhook revalidateTag
│   ├── webhooks.md                # /api/webhooks/{xero,jobber} — HMAC, intent-verify, per-phone invalidation, topic routing
│   ├── python-agent-injection.md  # pre-session fetch, _run_db_queries, check_customer_account tool, STATE+DIRECTIVE
│   ├── dashboard-ui.md            # BusinessIntegrationsClient 4-state, reconnect banner, setup checklist
│   └── telemetry.md               # last_context_fetch_at + activity_log integration_fetch events (Phase 58)
```

### C.6 CLAUDE.md Table Row (D-11)

`[VERIFIED: CLAUDE.md lines 28-37]` — The table has EXACTLY three columns: `| Skill | Covers | Read this when you need to... |`. Rows look like:

```md
| `payment-architecture` | Stripe Checkout Sessions (onboarding + upgrade), webhook handler (9 event types, history table, idempotency), Billing Meters overage, … | ...modify Stripe integration, change checkout flow, update subscription handling, debug webhooks, adjust overage billing, change pricing, or touch the billing dashboard |
```

**New row (D-11 draft):**
```md
| `integrations-jobber-xero` | Xero (REST, xero-node SDK) + Jobber (GraphQL, graphql-request) OAuth/refresh/refresh-locks (migrations 052/053/054/058), shared `src/lib/integrations/` module, webhook HMAC + intent-verify + per-phone cacheTag invalidation, Python agent pre-session context fetch (`livekit_agent/src/integrations/{xero,jobber}.py`), `check_customer_account` tool, BusinessIntegrationsClient 4-state card + reconnect banner, setup checklist wiring, telemetry (`last_context_fetch_at` + `activity_log` `integration_fetch` events) | ...modify Xero or Jobber OAuth, debug webhook delivery, change caching or cacheTag invalidation, touch the Python agent's customer-context injection, update BusinessIntegrationsClient, debug setup-checklist Reconnect flow, or investigate integration latency |
```

CLAUDE.md also references an explicit skill count — line 41 says "**all 50 DB migrations**". v6.0 has migration 058, so the skill count has drifted to 58. Not a D-11 requirement, but planner may want to update as a drive-by in the same commit.

---

## D. UAT + Automated Tests (D-12..D-15)

### D.1 Existing Test Infrastructure

`[VERIFIED: tests/integrations/ + tests/api/ ls; package.json read]`

```
tests/integrations/
  jobber/                        # subdir — likely per-scenario shards
  jobber.adapter.test.js
  jobber.cache.test.js
  jobber.fetch.test.js
  jobber.phone-match.test.js
  jobber.refresh.test.js         ← covers refresh-token rotation (D-13a coverage)
  refresh-lock.test.js           ← covers migration 058 OAuth refresh locks (CONTEXT says drop from D-13)
  xero.cache.test.js
  xero.fetch.test.js
  xero.phone-match.test.js

tests/api/
  setup-checklist-jobber.test.js ← existing, needs error_state branch extension
  setup-checklist-xero.test.js   ← existing, needs error_state branch extension

tests/webhooks/                  ← not verified in research; planner should confirm Xero + Jobber webhook tests exist
```

Runner: `npm test` → `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests`.
Integration scope: `npm run test:integration` → `tests/integration/` (note: singular, different from `tests/integrations/`).

**Test shape for setup-checklist-xero (current, at tests/api/setup-checklist-xero.test.js:33-45):** Calls `deriveChecklistItems(baseTenant, { xeroConnected: true })`, asserts `items.find(…).complete === true`. Extension shape for Phase 58:

```js
it('connect_xero is incomplete when error_state is set', () => {
  const items = deriveChecklistItems(baseTenant, { xeroConnected: false, xeroHasError: true });
  const xero = items.find((i) => i.id === 'connect_xero');
  expect(xero.complete).toBe(false);
  expect(xero.has_error).toBe(true);
});
```

### D.2 UAT.md Pattern

`[VERIFIED: .planning/phases/57-jobber-schedule-mirror-.../57-UAT.md read]`

Canonical shape:
```md
---
status: complete
phase: <phase-slug>
source: [57-01-SUMMARY.md, …]
started: <iso>
updated: <iso>
---

## Current Test
[none — UAT complete]

## Tests

### 1. <name>
expected: <one-line expected behaviour>
result: pass | fail | skipped
notes: |
  Optional multi-line notes, root-cause, workarounds.

…

## Summary
total: N
passed: P
issues: I
pending: 0
skipped: S
```

File lives at `.planning/phases/58-.../58-UAT.md`. Phase 56 uses identical shape.

### D.3 Latency Artifact

CONTEXT D-07/D-15 require `58-TELEMETRY-REPORT.md`. No existing precedent phase uses this exact filename (Phases 55-57 don't ship one). Planner invents the shape — recommendation:

```md
# Phase 58 Telemetry Report

**Collected:** <date range>
**Sample size:** N calls

## Pre-call parallel lookup latency

| Percentile | Duration (ms) | Budget | Status |
|------------|---------------|--------|--------|
| p50        | …             | —      | —      |
| p95        | …             | 2500   | ✅ / ❌ |
| p99        | …             | —      | —      |

## Per-provider breakdown
| Provider | p50 | p95 | Miss rate | Cache hit rate |
| Xero    | … | … | … | … |
| Jobber  | … | … | … | … |

## Methodology
<SQL or Python snippet used; activity_log event_type; date range>
```

### D.4 D-13 Coverage Map

| Failure mode | Automated test location | Manual UAT |
|--------------|-------------------------|-----------|
| (a) Token-refresh failure | Extend `jobber.refresh.test.js` + new `xero.refresh.test.js` mirroring it; assert `error_state='token_refresh_failed'` write; new `tests/api/setup-checklist-{xero,jobber}-error-state.test.js` | Scenario in UAT.md: force refresh_token revoke at sandbox → owner sees reconnect banner → checklist flips → reconnect clears |
| (b) Webhook miss / poll-fallback | Already covered by Phase 57 poll cron tests — planner confirms, extends if gap | UAT scenario: drop webhook (disable endpoint in sandbox), confirm Phase 57 `/api/cron/renew-calendar-channels` refills |
| (c) Latency budget | New test harness invoking `asyncio.gather` on mocked Xero/Jobber with fake-but-realistic latency; assert p95 < 2.5s via `activity_log` query against staging sample | UAT scenario: run 10 real test calls, query `activity_log`, paste p50/p95/p99 into report |

---

## E. POLISH-01..05 Sweep (D-16..D-21)

### E.1 Seven-Page Path Resolution — CORRECTED

`[VERIFIED: find src/app/dashboard -maxdepth 3 -name page.js]`

CONTEXT's list = `leads, calls, calendar, analytics, integrations, settings, jobs`. Reality as of 2026-04-20:

| CONTEXT entry | Reality | Real path |
|---------------|---------|-----------|
| leads | **Renamed in Phase 52 → jobs** (308 redirect in next.config.js) | `src/app/dashboard/jobs/page.js` |
| jobs | Same page as "leads" (duplicate) | `src/app/dashboard/jobs/page.js` |
| calls | Exists | `src/app/dashboard/calls/page.js` |
| calendar | Exists | `src/app/dashboard/calendar/page.js` |
| analytics | **Deleted entirely in Phase 49** | — (route 404s) |
| integrations | Exists | `src/app/dashboard/more/integrations/page.js` |
| settings | Exists (older page — `/dashboard/settings/page.js`) | `src/app/dashboard/settings/page.js` |

**Reinterpretation required.** The v5.0 REQ text (REQUIREMENTS.md:644) says "leads, calls, calendar, analytics" — four specific pages for POLISH-01 "empty states". CONTEXT D-16 expands to seven. Given the rename + analytics deletion, the realistic seven list/data pages are:

**Recommended seven (planner confirms):**
1. `/dashboard/jobs` — list of jobs (was leads)
2. `/dashboard/calls` — list of calls
3. `/dashboard/calendar` — calendar grid
4. `/dashboard/more/integrations` — integrations cards
5. `/dashboard/services` — services list
6. `/dashboard/settings` — settings panel
7. `/dashboard/more/billing` — billing dashboard with usage meter

Or alternative, replacing settings + billing with two more sub-pages:

- `/dashboard/more/notifications`
- `/dashboard/more/call-routing`

**Planner MUST decide.** Flag for user during plan review.

### E.2 Existing Polish Primitives

| Primitive | Status | Location |
|-----------|--------|----------|
| Empty state pattern (icon + headline + CTA) | ✅ Exists for 2 pages | `src/components/dashboard/EmptyStateLeads.jsx`, `EmptyStateCalendar.jsx` |
| Skeleton component (shadcn-style) | ✅ Exists | `src/components/ui/skeleton.jsx` — `<div className="animate-pulse rounded-md bg-accent">` |
| Page-level loading.js (Next.js convention) | ✅ Partial | `src/app/dashboard/loading.js`, `jobs/loading.js`, `calls/loading.js`, `invoices/loading.js` — other pages missing |
| Focus-visible ring token | ✅ Exists | `src/lib/design-tokens.js:35` → `focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1` |
| Inline error + Retry | ❌ **No shared component** | Ad-hoc per page. Need to author `src/components/ui/error-state.jsx` |
| Async button pending state | ❌ Ad-hoc | Pattern lives in individual components (e.g. BusinessIntegrationsClient.jsx:271-310). No shared `<AsyncButton>` / hook. |

### E.3 EmptyStateLeads Prop Shape

`[VERIFIED: src/components/dashboard/EmptyStateLeads.jsx read in full]`

```jsx
// 18-line component, no props today — icon + copy + CTA hardcoded.
// For reuse, refactor to prop-based:
export function EmptyState({ Icon, headline, description, ctaLabel, ctaHref }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/30 mb-4" aria-hidden="true" />
      <h2 className="text-base font-semibold text-foreground mb-2">{headline}</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      <Button asChild><Link href={ctaHref}>{ctaLabel}</Link></Button>
    </div>
  );
}
```

Recommend Phase 58 extracts `EmptyState` as a generic primitive under `src/components/ui/empty-state.jsx`, then rewrites `EmptyStateLeads` + `EmptyStateCalendar` to use it, then adds new empty states for the remaining 5 pages.

### E.4 Focus-Ring Token

`[VERIFIED: src/lib/design-tokens.js line 35]`

```js
ring: 'focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1',
```

Note: uses `focus:` not `focus-visible:` — **D-19 explicitly calls for `focus-visible`**. Planner must update this token or add a sibling. Recommendation: replace `focus:` → `focus-visible:` everywhere (keyboard-only reveal, not on mouse-click). This is a global token change; potentially a standalone plan item.

### E.5 Async Button Pending Pattern

`[VERIFIED: BusinessIntegrationsClient.jsx:271-328 read]`

Current ad-hoc shape:
```jsx
<Button disabled={isConnecting}>
  {isConnecting ? (
    <><Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" /> Connecting…</>
  ) : (
    'Connect'
  )}
</Button>
```

Recommended Phase 58 primitive: `src/components/ui/async-button.jsx`:
```jsx
export function AsyncButton({ pending, pendingLabel, children, ...rest }) {
  return (
    <Button disabled={pending} {...rest}>
      {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
```

Keep existing ad-hoc call sites (low-blast-radius approach) OR refactor call sites progressively. Scope is the planner's call under D-21.

### E.6 Inline Error + Retry

**No existing component.** Must author. Recommendation: `src/components/ui/error-state.jsx`:
```jsx
export function ErrorState({ error, onRetry, label = 'Try again' }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center py-16 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive/70 mb-3" aria-hidden="true" />
      <p className="text-sm text-foreground mb-1">Something went wrong</p>
      <p className="text-xs text-muted-foreground max-w-sm mb-4">{error?.message ?? 'Please retry.'}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{label}</Button>}
    </div>
  );
}
```

---

## Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R1 | activity_log column-name mismatch (CONTEXT D-06 vs real schema) | HIGH (already exists) | HIGH (planner writes wrong column names → runtime error) | **This research flags it.** Planner uses Option (a) in B.2 — write `event_type` + `metadata`, note the wire-format conformance in the PLAN. |
| R2 | Python service-role write contention | LOW | LOW | `_touch_last_context_fetch_at` is a blind UPDATE by PK; `activity_log` insert uses fresh UUID. No read-then-write paths. Parallelize via `asyncio.gather`. |
| R3 | skill-creator full-eval loop is unrealistically heavy for 1333-line rewrite | MEDIUM | MEDIUM (could burn a day of agent compute) | Scope to "follow conventions"; clarify with user in Wave 2 kickoff. If full evals desired, restrict to 2-3 test prompts. |
| R4 | "Seven pages" list includes non-existent routes (analytics, leads) | HIGH (already exists) | MEDIUM (scope drift) | **This research flags it.** Planner surfaces reinterpretation in Wave 1 kickoff; user confirms the seven. |
| R5 | Global focus-visible token change regresses existing UI (token used elsewhere) | MEDIUM | MEDIUM | Stage the change: add `ring_visible` token alongside `ring`; migrate callers in a separate plan. |
| R6 | Red-dot + subtitle render path not yet in scope — unknown component file | MEDIUM | LOW (1 extra file read at plan time) | Planner opens `src/components/dashboard/SetupChecklist*.jsx` during plan kickoff; adjust if structure differs from assumption. |
| R7 | Empty-state primitive refactor (extracting `EmptyState` from `EmptyStateLeads`) breaks existing callers | LOW | LOW | Keep old file as thin re-export; new callers use new primitive. |
| R8 | Latency p95 measurement samples insufficient on staging | MEDIUM | HIGH (can't ship phase without real numbers) | Plan bakes in a "run 20 real test calls over 48h" step; staging sample required before ship gate. |
| R9 | Dashboard polish sweep accidentally regresses Phase 49 dark-mode palette | MEDIUM | MEDIUM | Every new primitive (`EmptyState`, `ErrorState`, `AsyncButton`) uses only semantic tokens (`bg-background`, `text-foreground`, `text-muted-foreground`); NO hardcoded `bg-white`/`bg-stone-*`. |
| R10 | POLISH-03 `focus:` → `focus-visible:` migration misses ad-hoc `focus:` classes sprinkled across dashboard components | HIGH | LOW (keyboard-only UX paper-cut) | Grep `focus:ring` across `src/components/dashboard` and `src/app/dashboard` post-migration; sweep any strays. |

---

## Validation Architecture

> workflow.nyquist_validation is enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 (via `--experimental-vm-modules` for ESM) |
| Config file | none at root (Jest finds `jest.config.*` or uses package.json defaults; project uses CommonJS-style ESM) |
| Quick run command | `npm test <path-pattern>` |
| Full suite command | `npm test` |
| Integration scope | `npm run test:integration` → `tests/integration/` (singular) |
| Python side | Tests in `tests/` dir of `livekit-agent` repo — pytest (not verified in this research; planner confirms) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| CHECKLIST-01 | Xero/Jobber auto-detect = row exists AND error_state IS NULL | unit | `npm test tests/api/setup-checklist-xero.test.js` | ✅ extend |
| CHECKLIST-01 | Same for Jobber | unit | `npm test tests/api/setup-checklist-jobber.test.js` | ✅ extend |
| CHECKLIST-01 | Red-dot shows when `error_state` SET | unit | new `tests/api/setup-checklist-error-state.test.js` | ❌ Wave 0 |
| CHECKLIST-02 | BusinessIntegrationsClient renders card + reconnect banner | integration | `npm test tests/components/BusinessIntegrationsClient.test.jsx` (RTL) | ❌ Wave 0 (if not present) |
| CTX-01 | `last_context_fetch_at` written on Xero success | unit (Python) | `pytest livekit-agent/tests/integrations/test_xero_telemetry.py` | ❌ Wave 0 |
| CTX-01 | `last_context_fetch_at` written on Jobber success | unit (Python) | `pytest livekit-agent/tests/integrations/test_jobber_telemetry.py` | ❌ Wave 0 |
| CTX-01 | `activity_log` row written with correct shape | unit (Python) | same files | ❌ Wave 0 |
| CTX-01 | `activity_log` NOT written on failure | unit (Python) | same files | ❌ Wave 0 |
| CTX-02 | `integrations-jobber-xero/SKILL.md` exists with valid frontmatter | smoke | `node -e "…YAML validate…"` or spot-check | ❌ Wave 0 |
| CTX-03 | `voice-call-architecture` + `dashboard-crm-system` reference new skill | smoke | grep `integrations-jobber-xero` in both SKILL.md files | ❌ inline |
| CTX-03 | CLAUDE.md includes new row | smoke | grep `integrations-jobber-xero` in CLAUDE.md | ❌ inline |
| POLISH-01 | 7 pages render empty state when no data | integration (RTL) | `npm test tests/components/EmptyState.test.jsx` + per-page smoke | ❌ Wave 0 |
| POLISH-02 | 7 pages render skeleton during loading | manual-only (visual regression) + Next.js `loading.js` presence check | `ls src/app/dashboard/**/loading.js` | partial |
| POLISH-03 | focus-visible ring renders on Tab | manual or Playwright | Playwright keyboard-walk scenario in UAT.md | ❌ manual |
| POLISH-04 | Inline error state + Retry renders on fetch failure | integration (mock fetch failure) | `npm test tests/components/ErrorState.test.jsx` | ❌ Wave 0 |
| POLISH-05 | AsyncButton disables + shows spinner during pending | unit (RTL) | `npm test tests/components/AsyncButton.test.jsx` | ❌ Wave 0 |
| D-07 latency | p95 ≤ 2.5s on pre-call fanout | manual UAT + SQL | Post-call: run `SELECT percentile_cont(0.95)…` against staging activity_log | manual |
| D-13a token-refresh failure | error_state flips + reconnect flow | integration | Extend `tests/integrations/{xero,jobber}.refresh.test.js` | ✅ extend |

### Sampling Rate
- **Per task commit:** `npm test <changed-path>` (scoped, < 10s)
- **Per wave merge:** `npm test` + `pytest livekit-agent/tests/integrations/` (< 2 min)
- **Phase gate:** Full suite green + UAT.md all pass + `58-TELEMETRY-REPORT.md` with real numbers before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/api/setup-checklist-error-state.test.js` — covers CHECKLIST-01 error branch
- [ ] `livekit-agent/tests/integrations/test_xero_telemetry.py` — covers CTX-01 Xero side
- [ ] `livekit-agent/tests/integrations/test_jobber_telemetry.py` — covers CTX-01 Jobber side
- [ ] `src/components/ui/empty-state.jsx` + its test — covers POLISH-01 primitive
- [ ] `src/components/ui/error-state.jsx` + its test — covers POLISH-04
- [ ] `src/components/ui/async-button.jsx` + its test — covers POLISH-05
- [ ] `58-UAT.md` scaffold with 15+ scenarios (D-13 + POLISH visual checks + skill file spot checks)
- [ ] `58-TELEMETRY-REPORT.md` scaffold with sample SQL + placeholder table

### Validation Mode per Decision

| Decision | Validation |
|----------|-----------|
| D-01, D-04 checklist filter | Unit test: `deriveChecklistItems({ xeroConnected: false, xeroHasError: true }) → complete=false, has_error=true` |
| D-02 red-dot UI | RTL component test + manual UAT scenario |
| D-03 manual dismiss | Existing test asserts `override.dismissed=true` filters out — no new test needed |
| D-05 Python write | Unit test mocks `get_supabase_admin`, asserts `.update({last_context_fetch_at: …})` called once after successful fetch, zero times on failure |
| D-06 activity_log insert | Unit test asserts insert with `event_type='integration_fetch'` + metadata shape per spec |
| D-07 latency | Real staging measurement, captured in `58-TELEMETRY-REPORT.md`, asserted via SQL percentile query |
| D-08 last-synced UI | Existing Phase 55 test covers Xero; extend RTL test for Jobber card |
| D-09 new skill file | Smoke: file exists, frontmatter valid, body mentions OAuth+caching+webhook+agent+UI+telemetry |
| D-10 skill rewrites | Smoke: each file's `Last updated` matches Phase 58 date; manual review (no objective metric) |
| D-11 CLAUDE.md row | Smoke: grep new row slug |
| D-12..D-15 UAT | UAT.md pass/fail checklist; ship gate = all pass |
| D-13 token refresh | Extend existing `*.refresh.test.js`; add manual sandbox scenario in UAT.md |
| D-16..D-21 polish | POLISH-01/04/05 via component tests; POLISH-02/03 via Next.js `loading.js` presence + Playwright keyboard walk-through OR manual UAT |

---

## Plan Shape Recommendation

**Recommended 7-plan partition (planner confirms):**

| Wave | Plan | Deliverable | Dep |
|------|------|------------|-----|
| **Wave 0** | **58-00-PLAN** | Test scaffolds (Wave 0 gaps above) + UAT.md + TELEMETRY-REPORT.md skeletons | — |
| **Wave 1 (parallel)** | **58-01-PLAN** | Checklist wiring: `route.js` filter + new `has_error` field + client render + extend 2 existing tests + new error-state test (D-01..D-04) | Wave 0 |
| | **58-02-PLAN** | Telemetry: Python `activity_log` insert in both adapters; latency wrapper around `asyncio.gather` in agent.py; unit tests (D-05, D-06, D-07) | Wave 0 |
| **Wave 2 (parallel)** | **58-03-PLAN** | New `integrations-jobber-xero` skill file + references/ subdir (D-09) | Wave 1 |
| | **58-04-PLAN** | Rewrite `voice-call-architecture` SKILL.md with progressive disclosure (D-10) | Wave 1 |
| | **58-05-PLAN** | Rewrite `dashboard-crm-system` SKILL.md with progressive disclosure (D-10) + CLAUDE.md row update (D-11) | Wave 1 |
| **Wave 3 (parallel)** | **58-06-PLAN** | POLISH primitives (EmptyState, ErrorState, AsyncButton) + focus-visible token migration + 7-page sweep (D-16..D-21) | Wave 1 |
| **Wave 4** | **58-07-PLAN** | UAT execution + TELEMETRY-REPORT fill-in + ship gate (D-12..D-15) | Waves 1-3 |

Wave 2 skill rewrites can run fully in parallel (3 independent file surfaces). Wave 3 polish sweep is independent of everything except Wave 0 test scaffolds.

---

## Open Questions

1. **Q: Does CONTEXT D-06's `action`/`meta` wording override the actual DB column names `event_type`/`metadata`?**
   - Recommendation: NO. Preserve real column names; treat `action`/`meta` in CONTEXT as semantic-level wire-format description. Flag in PLAN.
   - **Needs user confirmation at plan review.**

2. **Q: Seven-page target list for POLISH sweep — user picks?**
   - Recommendation: `jobs, calls, calendar, more/integrations, services, settings, more/billing`.
   - **Needs user confirmation at plan review.**

3. **Q: skill-creator full eval loop OR "follow conventions" for D-10?**
   - Recommendation: follow conventions (save ~4-6 hours of subagent runtime per skill).
   - **Needs user confirmation at Wave 2 kickoff.**

4. **Q: Does the red-dot client render live in `SetupChecklist.jsx` (Phase 48 accordion)? If yes, confirm file path during Wave 1 kickoff.**
   - Research did not extract this file. Planner should open the file during 58-01 planning.

5. **Q: Does the `BusinessIntegrationsClient` loader page (`src/app/dashboard/more/integrations/page.js`) select `last_context_fetch_at` for Jobber today? If no, D-08 needs a 1-line select extension.**
   - Not verified in this research. Low-cost planner check during 58-02.

6. **Q: `focus:` → `focus-visible:` migration scope — global token change or per-component opt-in?**
   - Recommendation: global token change + one-plan sweep (better UX, atomically consistent).
   - **Surface tradeoff in PLAN.**

7. **Q: Python agent tests — is pytest already set up in livekit-agent repo?**
   - Not verified. Wave 0 deliverable includes confirming pytest infra or scaffolding it.

8. **Q: Should `58-TELEMETRY-REPORT.md` be a committed artifact or a one-off report?**
   - CONTEXT D-15 implies committed (ship-gate artifact).
   - Recommendation: commit it. Live in phase dir.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The checklist client render lives in `src/components/dashboard/SetupChecklist.jsx` (or similar) — Phase 48 accordion component | A.4 | LOW — planner discovers actual file in one grep |
| A2 | Webhook tests for Xero + Jobber exist at `tests/webhooks/` or similar | D.1 | LOW — planner lists dir during 58-02 planning |
| A3 | livekit-agent repo has a `tests/` dir with pytest config | D.1 | MEDIUM — if absent, Wave 0 must scaffold pytest |
| A4 | POLISH-03 `focus-visible:` is genuinely keyboard-only (not broken in current browsers) | E.4 | LOW — supported in all modern browsers |
| A5 | The integrations page loader selects `last_context_fetch_at` for Jobber already (Phase 56 shipped) | B.4 | LOW — 1-line fix if not |

All other claims are tagged `[VERIFIED: …]` inline.

---

## Sources

### Primary (HIGH confidence)
- `src/app/api/setup-checklist/route.js` — full read
- `livekit-agent/src/integrations/xero.py` — full read (478 lines)
- `livekit-agent/src/integrations/jobber.py` — full read (479 lines)
- `livekit-agent/src/agent.py` — lines 340-460 (`_run_db_queries` region)
- `src/components/dashboard/BusinessIntegrationsClient.jsx` — full read (396 lines)
- `src/components/dashboard/EmptyStateLeads.jsx` — full read (19 lines)
- `src/components/ui/skeleton.jsx` — full read (16 lines)
- `supabase/migrations/004_leads_crm.sql` — activity_log region (lines 73-103)
- `supabase/migrations/053_xero_error_state.sql` — error_state column definition
- `supabase/migrations/` file list (via ls) — confirms 058 migrations exist
- `.claude/skills/skill-creator/SKILL.md` — full read (485 lines)
- `.claude/skills/voice-call-architecture/SKILL.md` — frontmatter + header paragraph (line 10) + line count
- `.claude/skills/dashboard-crm-system/SKILL.md` — frontmatter + header paragraph (line 10) + line count
- `CLAUDE.md` — full read (47 lines)
- `package.json` — full read
- `src/lib/design-tokens.js` — `ring` token line
- `src/lib/leads.js` — `activity_log` writer pattern (grep + context)
- `.planning/phases/57-.../57-UAT.md` — UAT.md canonical shape
- `.planning/phases/58-.../58-CONTEXT.md` — all 21 locked decisions
- `.planning/REQUIREMENTS.md` — CHECKLIST-01/02, CTX-01/02/03, POLISH-01..05
- `.planning/STATE.md` — line 97 latency open question context
- `.planning/ROADMAP.md` — Phase 58 section (via grep)

### Secondary (MEDIUM confidence)
- Supabase PostgREST `.is(column, null)` — standard IS NULL filter syntax (documented pattern across the codebase)
- shadcn/ui Skeleton — standard progressive-disclosure primitive

### Tertiary (LOW confidence)
- None — all claims verified against code or project docs.

---

## Metadata

**Confidence breakdown:**
- Checklist wiring: HIGH — single-file diff, exact line numbers verified.
- Telemetry instrumentation: HIGH — Python write sites already shipped; `activity_log` schema audit surfaced CRITICAL mismatch.
- Latency surface: HIGH — `_run_db_queries` location verified; measurement boundary argued from evidence.
- Skill files: MEDIUM-HIGH — skill-creator workflow understood; drift inventory is presumptive (didn't read full 1333 lines).
- UAT + tests: HIGH — existing test shape verified, extension pattern clear.
- POLISH sweep: HIGH — primitive audit verified; seven-page mismatch surfaced; new component shapes drafted.

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (30 days — codebase moves fast; re-verify activity_log schema and polish primitives before Wave 3 execution if delayed past that)

## RESEARCH COMPLETE
