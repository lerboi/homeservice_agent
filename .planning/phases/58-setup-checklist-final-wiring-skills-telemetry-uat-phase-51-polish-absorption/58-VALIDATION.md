---
phase: 58
slug: setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-20
---

# Phase 58 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 58-RESEARCH.md §Validation Architecture. Planner completes the per-task map after assigning task IDs.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Next.js)** | Jest 29.7 (`--experimental-vm-modules` for ESM) |
| **Framework (Python agent)** | pytest (Wave 0 confirms or scaffolds in `livekit_agent/tests/`) |
| **Config file** | No root Jest config; Jest resolves via `package.json` defaults |
| **Quick run command** | `npm test <path-pattern>` |
| **Full suite command** | `npm test` (JS) + `pytest livekit_agent/tests/integrations/` (Python) |
| **Integration scope** | `npm run test:integration` → `tests/integration/` |
| **Estimated runtime (full)** | ~120 seconds (JS + Python combined) |
| **Estimated runtime (scoped)** | <10 seconds per changed-path run |

---

## Sampling Rate

- **After every task commit:** `npm test <changed-path>` (scoped, < 10s)
- **After every plan wave:** `npm test` + `pytest livekit_agent/tests/integrations/` (< 2 min)
- **Before `/gsd:verify-work 58`:** Full suite green + UAT.md all scenarios pass + `58-TELEMETRY-REPORT.md` with real p50/p95/p99 numbers
- **Max feedback latency:** 10 seconds (scoped); 120 seconds (full)

---

## Per-Task Verification Map

> Planner fills in Task IDs after plan creation. Seed rows from research requirement map:

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| CHECKLIST-01 | Xero detect = row exists AND `error_state IS NULL` | unit | `npm test tests/api/setup-checklist-xero.test.js` | ✅ extend | ⬜ pending |
| CHECKLIST-01 | Jobber detect = row exists AND `error_state IS NULL` | unit | `npm test tests/api/setup-checklist-jobber.test.js` | ✅ extend | ⬜ pending |
| CHECKLIST-01 | Red-dot flip when `error_state` set | unit | `npm test tests/api/setup-checklist-error-state.test.js` | ❌ W0 | ⬜ pending |
| CHECKLIST-02 | `BusinessIntegrationsClient` card + reconnect banner | integration (RTL) | `npm test tests/components/BusinessIntegrationsClient.test.jsx` | ❌ W0 | ⬜ pending |
| CTX-01 | `last_context_fetch_at` write on Xero success | unit (Python) | `pytest livekit_agent/tests/integrations/test_xero_telemetry.py` | ❌ W0 | ⬜ pending |
| CTX-01 | `last_context_fetch_at` write on Jobber success | unit (Python) | `pytest livekit_agent/tests/integrations/test_jobber_telemetry.py` | ❌ W0 | ⬜ pending |
| CTX-01 | `activity_log` row shape correct (event_type + metadata) | unit (Python) | same files above | ❌ W0 | ⬜ pending |
| CTX-01 | `activity_log` NOT written on fetch failure | unit (Python) | same files above | ❌ W0 | ⬜ pending |
| CTX-02 | `integrations-jobber-xero/SKILL.md` exists + valid frontmatter | smoke | grep + YAML parse | ❌ W0 | ⬜ pending |
| CTX-03 | `voice-call-architecture` + `dashboard-crm-system` reference new skill | smoke | `grep integrations-jobber-xero .claude/skills/{voice-call-architecture,dashboard-crm-system}/SKILL.md` | ❌ inline | ⬜ pending |
| CTX-03 | `CLAUDE.md` includes new skill row | smoke | `grep integrations-jobber-xero CLAUDE.md` | ❌ inline | ⬜ pending |
| POLISH-01 | 7 pages render empty state when no data | integration (RTL) | `npm test tests/components/EmptyState.test.jsx` + per-page smoke | ❌ W0 | ⬜ pending |
| POLISH-02 | 7 pages render skeleton during loading | presence check + manual | `ls src/app/dashboard/**/loading.js` + UAT visual | partial | ⬜ pending |
| POLISH-03 | `focus-visible` ring renders on Tab across all interactive elements | Playwright OR manual | Playwright keyboard walk OR UAT.md scenario | ❌ manual | ⬜ pending |
| POLISH-04 | Inline error + Retry on fetch failure | integration (RTL with mocked fetch) | `npm test tests/components/ErrorState.test.jsx` | ❌ W0 | ⬜ pending |
| POLISH-05 | AsyncButton disables + spinner during pending | unit (RTL) | `npm test tests/components/AsyncButton.test.jsx` | ❌ W0 | ⬜ pending |
| D-07 latency | p95 ≤ 2.5s on pre-call fanout | manual UAT + SQL | `SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY (metadata->>'duration_ms')::int) FROM activity_log WHERE event_type='integration_fetch'` | manual | ⬜ pending |
| D-13a | Token-refresh failure → `error_state` flips → checklist incomplete → reconnect clears | integration | extend `tests/integrations/{xero,jobber}.refresh.test.js` | ✅ extend | ⬜ pending |
| D-13b | Webhook miss → poll-fallback cron fills gap (Phase 57) | manual | UAT.md scenario | ❌ manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/api/setup-checklist-error-state.test.js` — CHECKLIST-01 error-state branch
- [ ] `livekit_agent/tests/integrations/test_xero_telemetry.py` — CTX-01 Xero side (Python)
- [ ] `livekit_agent/tests/integrations/test_jobber_telemetry.py` — CTX-01 Jobber side (Python)
- [ ] `tests/components/BusinessIntegrationsClient.test.jsx` — CHECKLIST-02 card + banner render
- [ ] `src/components/ui/empty-state.jsx` + `tests/components/EmptyState.test.jsx` — POLISH-01 primitive
- [ ] `src/components/ui/error-state.jsx` + `tests/components/ErrorState.test.jsx` — POLISH-04 primitive
- [ ] `src/components/ui/async-button.jsx` + `tests/components/AsyncButton.test.jsx` — POLISH-05 primitive
- [ ] `58-UAT.md` scaffold (pass/fail checklist with 15+ scenarios — Phase 57 pattern)
- [ ] `58-TELEMETRY-REPORT.md` scaffold (SQL queries + placeholder p50/p95/p99 table)
- [ ] Confirm pytest config present in `livekit_agent/` OR scaffold pytest infra (pyproject.toml / tests/__init__.py / conftest.py)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live Xero reconnect flow | CHECKLIST-01 | Requires real OAuth sandbox token | UAT.md: disconnect → forced 400 on refresh → checklist flips to red-dot → Reconnect CTA works → `error_state` cleared |
| Live Jobber reconnect flow | CHECKLIST-01 | Requires real OAuth sandbox token | Same as Xero scenario, Jobber side |
| Real test call customer context | CTX-01 | Voice call E2E — SIP + LiveKit + Gemini | UAT.md: dial test number with known-Xero customer → confirm `customer_context` tool returns data → verify `last_context_fetch_at` updated |
| p95 latency ≤ 2.5s | D-07 | Real call traffic required | UAT.md: run 20 test calls in staging → SQL aggregate → record in `58-TELEMETRY-REPORT.md` |
| Webhook miss → poll fallback | D-13b | Requires simulated webhook drop | UAT.md: stop webhook consumer → trigger Jobber schedule change → confirm poll cron backfills within window |
| POLISH-03 focus-visible ring | POLISH-03 | Keyboard-only interaction, cross-browser | UAT.md: Tab through every page, verify ring visible on each interactive element; mouse-click same elements, verify no ring |
| Skill rewrite quality (D-10) | CTX-03 | No objective metric — narrative correctness | UAT.md: spot-check each rewritten skill references current architecture (no drift from v6.0 reality) |
| CLAUDE.md row added | CTX-03 | One-line grep, but reviewer confirms formatting matches existing 8 rows | UAT.md: visual diff |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s (scoped) / 120s (full)
- [ ] UAT.md scenarios all pass before ship gate
- [ ] `58-TELEMETRY-REPORT.md` contains real p50/p95/p99 numbers
- [ ] `nyquist_compliant: true` set in frontmatter after planner completes per-task map

**Approval:** pending
