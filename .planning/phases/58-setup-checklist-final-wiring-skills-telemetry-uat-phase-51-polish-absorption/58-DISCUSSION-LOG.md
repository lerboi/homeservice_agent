# Phase 58: Setup checklist final wiring + skills + telemetry + UAT + polish absorption — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 58-setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption
**Areas discussed:** Polish scope, Checklist completion semantics, Telemetry depth + surface, Skill file structure, UAT scope + depth

---

## Polish Budget Scope (pre-agreed before area selection)

| Option | Description | Selected |
|--------|-------------|----------|
| Full dashboard sweep (v5.0 REQ literal) | POLISH-01..05 across leads, calls, calendar, analytics, integrations, settings, jobs | ✓ |
| v6.0-touched pages only | Smaller scope, only pages v6.0 rewrote | |
| Audit then decide | Scope to worst offenders after quick audit | |

**User's choice:** Full dashboard sweep
**Notes:** v5.0 REQ text treated as literal — absorb the full polish debt rather than defer.

---

## Checklist Completion Semantics

### When should connect_xero / connect_jobber show as complete?

| Option | Description | Selected |
|--------|-------------|----------|
| Row exists (current) | Any accounting_credentials row = complete | |
| Row exists + no error_state | Credentials healthy AND token-refresh hasn't failed | ✓ |
| Row exists + recent successful fetch | last_context_fetch_at within 30 days | |

**User's choice:** Row exists + no error_state
**Notes:** Matches the reconnect banner logic already on the integrations card.

### What happens when error_state is set?

| Option | Description | Selected |
|--------|-------------|----------|
| Flip to incomplete + red dot + "Reconnect needed" | Visible nudge, href stays pointed at /dashboard/more/integrations | ✓ |
| Stay complete, show warning | Preserves "I already did this" feel, but owners may tune out | |
| Hide from checklist entirely | Cleanest, but hides a real problem | |

**User's choice:** Flip to incomplete + red dot
**Notes:** Consistent with Xero reconnect banner surface.

### Should owners be able to manually dismiss connect_xero / connect_jobber?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — honour existing dismiss override | Same pattern as other 12 checklist items | ✓ |
| No — integrations are optional, never show if not wanted | Requires a new opt-in mechanism | |
| Yes, but auto-dismiss if feature disabled | Couples to Phase 53 feature flag | |

**User's choice:** Yes — honour existing dismiss override

### Where does completion detection code live?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend deriveChecklistItems in setup-checklist route | One-file change, matches existing pattern | ✓ |
| Helper in src/lib/integrations/status.js | More layers; overkill for 2 lines | |
| You decide | Planner picks | |

**User's choice:** Extend deriveChecklistItems in setup-checklist route

---

## Telemetry Depth + Surface

### What gets written to last_context_fetch_at and how?

| Option | Description | Selected |
|--------|-------------|----------|
| Write on every successful fetch | Python livekit_agent writes NOW() after successful fetchCustomerByPhone | ✓ |
| Write on every fetch attempt (success + failure) | Requires a separate last_context_fetch_error column | |
| Write from Next.js webhook path only | Doesn't capture call-time fetches | |

**User's choice:** Write on every successful fetch

### Where do per-fetch telemetry events go?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse activity_log table | action='integration_fetch' + meta JSONB | ✓ |
| New integrations_telemetry table | Dedicated table with migration + RLS + retention | |
| Log-only (Sentry breadcrumbs + structured logs) | Zero DB load, no dashboard queryability | |

**User's choice:** Reuse activity_log table

### Which latency budget do we validate in this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-call parallel lookup budget | VIP + leads history + Jobber + Xero during call setup (STATE.md L97) | ✓ |
| All of it — pre-call + in-call + cache refresh | Comprehensive but much more surface | |
| Dashboard cache hit rate only | Narrow scope; skips call-path validation | |

**User's choice:** Pre-call parallel lookup budget
**Notes:** Closes the STATE.md line 97 open question.

### Do owners see any telemetry on the integrations card?

| Option | Description | Selected |
|--------|-------------|----------|
| Last-synced timestamp only | Reuses last_context_fetch_at, same pattern Xero already uses | ✓ |
| Timestamp + health indicator dot | Requires aggregation query on card path | |
| Nothing owner-facing | Simpler; no new UI commitments | |

**User's choice:** Last-synced timestamp only

---

## Skill File Structure

### How is the new integrations skill structured?

| Option | Description | Selected |
|--------|-------------|----------|
| Single skill: integrations-jobber-xero | Combined skill with shared + per-provider sections | ✓ |
| Two skills: integrations-jobber + integrations-xero | Duplicates OAuth + caching pattern docs | |
| Three skills: shared foundation + per-provider | Full DRY but skill-hunting burden | |

**User's choice:** Single skill: integrations-jobber-xero

### What's in scope for the integrations-jobber-xero skill?

| Option | Description | Selected |
|--------|-------------|----------|
| Full architectural reference | OAuth + caching + webhooks + Python agent + dashboard UI + telemetry | ✓ |
| Backend + agent only | Excludes dashboard UI | |
| Integration mechanics only (minimal) | Just OAuth + caching + webhooks | |

**User's choice:** Full architectural reference
**Notes:** Matches the voice-call-architecture / dashboard-crm-system structure.

### How do voice-call-architecture and dashboard-crm-system skills get updated?

| Option | Description | Selected |
|--------|-------------|----------|
| Cross-reference pointers only | Quick to maintain, no drift | |
| Full absorption — copy relevant sections | Self-contained skills but high drift | |
| Rewrite both skills fully in this phase | Bigger scope, deeper payoff | ✓ |

**User's choice:** Rewrite both skills fully in this phase
**Notes:** User added — "ensure to use skill-creator skill" for the rewrite.

### How does CLAUDE.md reference the new skill?

| Option | Description | Selected |
|--------|-------------|----------|
| Add row to Core Application Skills table | Matches existing 8-skill format | ✓ |
| New section: Business Integrations | Reorganizes CLAUDE.md | |
| Inline note only | Less discoverable | |

**User's choice:** Add row to Core Application Skills table

---

## UAT Scope + Depth

### What shape does Phase 58 UAT take?

| Option | Description | Selected |
|--------|-------------|----------|
| Owner manual UAT only | Hand-tested scenarios, Phase 56/57 pattern | |
| Automated tests only | Misses UX-flavor issues | |
| Both — automated where possible, manual where not | Split clearly in UAT.md | ✓ |

**User's choice:** Both

### Which failure modes must be covered?

| Option | Description | Selected |
|--------|-------------|----------|
| Token refresh failure | Force refresh-token invalidation, verify error_state + banner + checklist flip | ✓ |
| Webhook miss | Verify poll cron fills the gap | ✓ |
| Concurrent refresh race | Already covered by tests/integrations/refresh-lock.test.js | |
| Latency budget | Measure p50/p95/p99 pre-call parallel lookup (STATE L97) | ✓ |

**User's choice:** Token refresh + Webhook miss + Latency budget
**Notes:** Concurrent refresh race explicitly dropped — existing test suffices.

### How does owner UAT get tracked / verified?

| Option | Description | Selected |
|--------|-------------|----------|
| UAT.md with pass/fail checklist | Phase 56/57 pattern | ✓ |
| UAT.md + screenshot/recording evidence | Higher audit bar | |
| Live-call recording review | Strongest real-world signal, slowest | |

**User's choice:** UAT.md with pass/fail checklist

### Phase 58 ships when...

| Option | Description | Selected |
|--------|-------------|----------|
| All UAT scenarios pass + all tests green | Standard gate, then verify-work + complete-milestone | ✓ |
| Automated tests green is enough | Faster ship; owner catches UX issues post-ship | |
| UAT pass + 7-day soak in production | Slowest milestone close | |

**User's choice:** All UAT scenarios pass + all tests green

---

## Claude's Discretion

- Planner chooses wave plan / plan count (~6-8 plans expected).
- Exact p50/p95/p99 measurement technique (client-side vs server-side).
- Per-page polish item ordering if sweep splits across plans.
- Skeleton component shape (bespoke vs generic).

## Deferred Ideas

- Sentry/observability platform wiring beyond current Sentry usage.
- Dedicated integrations_telemetry table (rejected in favor of activity_log).
- Health-indicator dot on integrations card (rejected in favor of timestamp-only).
- Screenshot/recording UAT evidence (rejected for pass/fail checklist).
- Phase 51 polish items 06-12 (out of scope — only 01-05 absorbed per ROADMAP).
