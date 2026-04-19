# Phase 58: Setup checklist final wiring + skills + telemetry + UAT + Phase 51 polish absorption — Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Close out the v6.0 Jobber/Xero integration surface and ship the deferred v5.0 polish budget in one coordinated phase. Three concerns land on the same dashboard pages and share this phase:

1. **Setup checklist final wiring** — Tighten `connect_jobber` + `connect_xero` completion detection from "row exists" to "row exists AND no error_state", flip failed connections back to incomplete with Reconnect-needed affordance, keep manual dismiss working.
2. **Telemetry + skill documentation** — Instrument the integration read path (per-fetch writes to `last_context_fetch_at` + `activity_log` `integration_fetch` events), validate the pre-call parallel-lookup latency budget called out in STATE.md line 97, author a new `integrations-jobber-xero` skill file as a full architectural reference, and do a full rewrite of `voice-call-architecture` + `dashboard-crm-system` using the `skill-creator` skill.
3. **End-to-end UAT + Phase 51 polish absorption** — Split UAT into automated tests (detection logic, token refresh, webhook invalidation, telemetry writes) + owner manual UAT (connect flow, real test call with customer context, reconnect banner). Apply POLISH-01..05 as a full dashboard sweep across leads, calls, calendar, analytics, integrations, settings, jobs.

**Out of scope:** No changes to the Python agent's `fetchCustomerByPhone` implementations beyond adding telemetry writes. No new providers. No Voco→Jobber push (stays in Phase 62). No backfill of historical fetches into the activity_log. No Sentry/observability-platform wiring beyond existing Sentry calls.

</domain>

<decisions>
## Implementation Decisions

### Checklist Completion Semantics
- **D-01:** `connect_xero` / `connect_jobber` show complete only when a matching `accounting_credentials` row exists **AND** `error_state IS NULL`. Failed connections flip the checklist item back to incomplete.
- **D-02:** When `error_state` is set (token refresh failed): checklist item flips to incomplete with a red-dot badge and "Reconnect needed" subtitle. `href` stays `/dashboard/more/integrations` where the existing reconnect banner (Phase 55) handles the actual reconnect. Item returns to complete when a successful OAuth callback or refresh clears `error_state`.
- **D-03:** Per-item manual dismiss stays honoured via the existing `checklist_overrides.{item_id}.dismissed = true` pattern — same behavior as the other 12 checklist items. Owners who don't use Jobber/Xero can hide both.
- **D-04:** Detection logic extends `deriveChecklistItems` / `fetchChecklistState` in `src/app/api/setup-checklist/route.js` directly — one-file change, no new helper layer. Add `.is('error_state', null)` (or equivalent) to the existing `accounting_credentials` count queries (route.js:259-268).

### Telemetry Depth + Surface
- **D-05:** Python livekit_agent writes `NOW()` to `accounting_credentials.last_context_fetch_at` after each **successful** `fetchCustomerByPhone` call. Service-role Supabase write from the Python adapter layer (`src/integrations/xero.py`, `src/integrations/jobber.py`). No column added for failed-fetch timestamp — failure is tracked via `error_state` + Sentry.
- **D-06:** Per-fetch telemetry events (duration, cache hit/miss, row counts) logged to the existing `activity_log` table with `action = 'integration_fetch'` and `meta` JSONB = `{ provider, duration_ms, cache_hit, counts: { customers, invoices, jobs }, phone_e164 }`. Zero schema change; reuses existing RLS and tooling. Retention follows current `activity_log` policy (no new retention decisions in this phase).
- **D-07:** Latency validation scope = **pre-call parallel lookup budget** (STATE.md line 97 open question). Measure p50/p95/p99 duration for the concurrent VIP + leads-history + Jobber + Xero lookup during call setup. Target ≤2.5s p95. Capture numbers in UAT.md and in a new `58-TELEMETRY-REPORT.md` artifact.
- **D-08:** Owner-facing telemetry on the integrations card = **Last-synced timestamp only** (reuses `last_context_fetch_at`, same pattern Xero already uses). Duration/cache-hit-rate stays Claude-facing / ops-only (`activity_log` query).

### Skill File Structure
- **D-09:** One consolidated skill: `integrations-jobber-xero`. Shared OAuth/caching/agent-injection sections up top, per-provider sections for divergent pieces (Xero REST vs Jobber GraphQL, OAuth scopes, webhook topic routing). Scope = **full architectural reference** — OAuth + refresh + HMAC state + refresh locks (Migration 058), caching layer (Next.js 16 `'use cache'` + `cacheTag` + why XeroAdapter uses module-level cached fn not class method), webhook handlers (HMAC verify, intent-verify, per-phone `revalidateTag`), Python agent injection (service-role Supabase reads → adapter → `customer_context` + `check_customer_account` tool), dashboard UI contract (`BusinessIntegrationsClient` 4-state machine, reconnect banner, setup checklist wiring), telemetry (from D-05/D-06).
- **D-10:** Do a **full rewrite** of `voice-call-architecture` and `dashboard-crm-system` skills in this phase, using the `skill-creator` skill to drive the rewrite. Don't just add cross-reference pointers — the skills have drifted across v5.0 + v6.0 work and this is the milestone-close opportunity to bring them current. Cross-reference the new `integrations-jobber-xero` skill from both.
- **D-11:** Add `integrations-jobber-xero` as a new row in the **Core Application Skills** table in `CLAUDE.md`, matching the format of the 8 existing skill entries (Covers / Read this when you need to...).

### UAT + Ship Gate
- **D-12:** UAT takes both forms: **automated** (Jest + integration tests) for detection logic, token refresh, webhook invalidation, telemetry writes; **owner manual** (UAT.md with numbered scenarios) for connect/disconnect/reconnect flow, real test call with a known-customer phone number verifying customer_context usage, reconnect banner appearance after forced refresh failure.
- **D-13:** Required failure-mode coverage: (a) **Token refresh failure** — force refresh-token invalidation in sandbox, confirm `error_state` set, reconnect banner renders, checklist item flips incomplete with red dot, successful reconnect clears `error_state`. (b) **Webhook miss** — simulate dropped webhook for jobber-schedule-mirror, confirm poll-fallback cron (Phase 57) fills the gap. (c) **Latency budget** — instrument pre-call parallel lookup, record real p50/p95/p99 numbers, assert ≤2.5s p95. (Concurrent refresh race explicitly NOT required — already covered by `tests/integrations/refresh-lock.test.js`.)
- **D-14:** UAT tracking = **UAT.md with pass/fail checklist** (Phase 56/57 pattern). Owner walks each scenario, checks off each one, marks phase verified when all pass. No screenshot/recording requirement for this phase.
- **D-15:** Ship gate = **all UAT scenarios pass AND all automated tests green** (CI). Latency budget report documented with real numbers in `58-TELEMETRY-REPORT.md`. Then `/gsd:verify-work 58` runs, then `/gsd:complete-milestone v6.0`.

### Polish Budget Scope (POLISH-01..05)
- **D-16:** Apply to **full dashboard surface** per v5.0 REQ literal — leads, calls, calendar, analytics, integrations, settings, jobs (the seven list/data pages). Not limited to v6.0-touched pages. This is the explicit v5.0 polish debt absorption.
- **D-17:** POLISH-01 (empty states): every list/data page with no data shows icon + headline + primary CTA. Reuse or mirror `EmptyStateLeads` pattern.
- **D-18:** POLISH-02 (loading skeletons): layout-matching skeletons on data fetches, no blank flashes. Prevent CLS.
- **D-19:** POLISH-03 (focus rings): `focus-visible` rings via design-token focus color across all interactive elements (buttons, inputs, nav items, pill filters).
- **D-20:** POLISH-04 (inline error + retry): data-fetch failures render an error state with a Retry button, not frozen UI.
- **D-21:** POLISH-05 (async button states): save/send/sync actions show spinner + disabled state during pending operations.

### Claude's Discretion
- Planner chooses wave plan / plan count for Phase 58 (likely ~6-8 plans: detection wiring, telemetry instrumentation, latency measurement, new skill authoring, two skill rewrites, UAT harness, polish sweep).
- Exact p50/p95/p99 measurement technique (client-side `performance.now()` wrap vs server-side `activity_log` aggregation) — planner picks based on where the lookup actually runs.
- Which specific pages get each polish item first if the sweep has to be split across plans — planner orders by UX impact.
- Skeleton component shape (per-page bespoke vs generic shadcn-style `Skeleton`) — keep consistent with existing patterns in `src/components`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Upstream Phase Context
- `.planning/phases/55-xero-read-side-integration-caller-context/55-CONTEXT.md` — Xero OAuth, `fetchCustomerByPhone`, caching, reconnect banner, `error_state` pattern.
- `.planning/phases/56-jobber-read-side-integration-customer-context-clients-jobs-invoices/56-CONTEXT.md` — Jobber OAuth + GraphQL + `JobberAdapter` contract, HMAC webhook, `external_account_id` pattern.
- `.planning/phases/57-jobber-schedule-mirror-read-only-voco-as-overlay-ux/57-CONTEXT.md` — Jobber visit mirroring, overlay UX, poll-fallback cron.

### Requirements
- `.planning/REQUIREMENTS.md` §"Setup Checklist + Skills + Telemetry (Phase 58)" — CHECKLIST-01, CHECKLIST-02, CTX-01, CTX-02, CTX-03.
- `.planning/REQUIREMENTS.md` §"v5.0 Phase 51 Polish Absorbed (Phase 58 tail)" — POLISH-01..05.

### Roadmap
- `.planning/ROADMAP.md` §"Phase 58: Setup checklist final wiring + skills + telemetry + UAT + Phase 51 polish absorption" — goal, dependencies, requirement mapping.

### Existing Architecture Skills (READ before planning)
- `.claude/skills/voice-call-architecture/SKILL.md` — LiveKit agent, tool execution, post-call pipeline. WILL BE REWRITTEN in this phase (D-10).
- `.claude/skills/dashboard-crm-system/SKILL.md` — dashboard pages, lead lifecycle, design tokens. WILL BE REWRITTEN in this phase (D-10).
- `.claude/skills/auth-database-multitenancy/SKILL.md` — all 58 migrations, tenant isolation, service-role vs proxy clients.
- `.claude/skills/payment-architecture/SKILL.md` — Stripe integration (telemetry pattern reference for activity_log).
- `.claude/skills/skill-creator/SKILL.md` — drives the full-rewrite workflow for D-10.

### Code References
- `src/app/api/setup-checklist/route.js` — checklist derivation (D-04 extends `fetchChecklistState` + `deriveChecklistItems`).
- `src/app/dashboard/more/integrations/page.js` — integrations page shell.
- `src/components/dashboard/BusinessIntegrationsClient.jsx` — 4-state provider card (reconnect banner lives here).
- `src/lib/integrations/status.js` — `getIntegrationStatus` with `'use cache'` + `cacheTag`.
- `src/lib/integrations/adapter.js` — shared adapter contract.
- `src/app/api/webhooks/xero/route.js` + `src/app/api/webhooks/jobber/route.js` — HMAC verify + per-phone `revalidateTag`.
- `livekit_agent/src/integrations/xero.py` + `livekit_agent/src/integrations/jobber.py` — Python adapters (D-05 adds telemetry write).
- `supabase/migrations/052_integrations_schema.sql` — `last_context_fetch_at` column.
- `supabase/migrations/053_xero_error_state.sql` — `error_state` column + partial index.
- `supabase/migrations/058_oauth_refresh_locks.sql` — refresh lock pattern (already covered by `tests/integrations/refresh-lock.test.js`).
- `src/components/dashboard/EmptyStateLeads.jsx` — reference pattern for POLISH-01.

### Open Questions from STATE
- `.planning/STATE.md` line 97: "Multiple parallel phone-based lookups during call setup (VIP + leads history + Jobber + Xero) need telemetry to confirm latency budget — Phase 58 deliverable." → Closed by D-07 + D-13.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Setup checklist derivation**: `deriveChecklistItems` + `fetchChecklistState` in `src/app/api/setup-checklist/route.js` — pure function + data fetcher, extend here for D-04.
- **Integrations page + cards**: `src/app/dashboard/more/integrations/page.js` + `BusinessIntegrationsClient.jsx` — 4-state machine and reconnect banner already render. D-08 adds last-synced timestamp display; otherwise unchanged.
- **Telemetry host**: `activity_log` table with `action` + `meta` JSONB — reuse for D-06; no migration needed.
- **EmptyStateLeads + skeleton/focus patterns**: 15 dashboard components already use skeleton + focus-visible patterns. POLISH sweep extends these to the full seven list/data pages rather than inventing new patterns.
- **skill-creator skill**: drives rewrite workflow for D-10.

### Established Patterns
- **error_state column semantics** (Migration 053): NULL = healthy, non-null = degraded. Xero reconnect flow already uses this — Jobber picks up the same pattern.
- **Python service-role Supabase writes**: `livekit_agent/src/integrations/*.py` already read credentials via service-role; D-05 adds a write to the same path.
- **activity_log event logging**: Phases 48/49 established `action` + `meta` convention — D-06 extends.
- **Next.js 16 caching**: `'use cache'` + `cacheTag` + `revalidateTag` on webhooks — already set up for Xero/Jobber; telemetry must not invalidate cache.
- **Per-item dismiss**: `checklist_overrides.{item_id}.dismissed` JSONB in `tenants` row — reused as-is for D-03.

### Integration Points
- Checklist derivation (`route.js`) — single file hosts D-04.
- Python adapter layer (`src/integrations/{xero,jobber}.py`) — hosts D-05 telemetry writes.
- `activity_log` write path — hosts D-06 integration_fetch events.
- `BusinessIntegrationsClient` — hosts D-08 last-synced display.
- Seven dashboard pages — POLISH sweep targets.
- `CLAUDE.md` Core Application Skills table — D-11 row addition.

</code_context>

<specifics>
## Specific Ideas

- Telemetry schema mirrors how Xero's `last_context_fetch_at` is already structured — no new column, reuse the 052 migration.
- Latency budget 2.5s p95 (from STATE.md line 97) — not an arbitrary number; it's the explicit v6.0 assumption being validated.
- Full skill rewrites via `skill-creator` — user explicitly called this out as the right workflow for D-10.
- Polish sweep is the milestone-close polish pass, not a preview of a later phase. Ship quality at v6.0 close rather than carry debt into v7.0.

</specifics>

<deferred>
## Deferred Ideas

- **Sentry/observability platform wiring** beyond current Sentry usage — not in this phase. Telemetry goes to `activity_log`, not to a third-party platform.
- **Dedicated `integrations_telemetry` table** — rejected in D-06 in favor of `activity_log` reuse. If `activity_log` volume becomes a problem, split later.
- **Timestamp + health-indicator dot on integrations card** — rejected in D-08 in favor of timestamp-only. Revisit if owners report wanting more signal.
- **Screenshot/recording UAT evidence** — rejected in D-14 in favor of pass/fail checklist. Can be added later if audit requires.
- **Analytics empty-state copy tuning** — applied during POLISH-01 sweep but no dedicated copy-review pass. If empty states feel generic, schedule a copy pass in v7.0.
- **Wave plan / rollout order for polish items** — planner's call, not a context decision.
- **Phase 51 polish items 06-12** (POLISH-06..12) — explicitly out of scope. Only POLISH-01..05 were absorbed per ROADMAP line 218. The remaining polish items stay in their v5.0 Phase 51 pending state.

</deferred>

---

*Phase: 58-setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption*
*Context gathered: 2026-04-19*
