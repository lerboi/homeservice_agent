---
phase: 61
slug: google-maps-address-validation-and-structured-address-storage
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-25
updated: 2026-04-25
---

# Phase 61 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Filled in during planning by `gsd-planner` from RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (livekit_agent/tests/) + supabase CLI for migration verify |
| **Config file** | C:/Users/leheh/.Projects/livekit-agent/pyproject.toml `[tool.pytest.ini_options]` |
| **Quick run command** | `cd C:/Users/leheh/.Projects/livekit-agent && pytest tests/test_google_maps.py tests/test_book_appointment_validation.py tests/test_capture_lead_validation.py tests/test_prompt_address_validation_rule.py tests/test_tool_descriptions_validation_precondition.py -x` |
| **Full suite command** | `cd C:/Users/leheh/.Projects/livekit-agent && pytest -x --deselect tests/webhook/test_routes.py::test_incoming_call_vip_lead` |
| **Migration verify** | `cd C:/Users/leheh/.Projects/homeservice_agent && supabase migration list \| grep 062_phase61_address_validation` |
| **Estimated runtime** | ~10s quick / ~45s full |

---

## Sampling Rate

- **After every task commit:** Run quick command
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green AND migration applied AND UAT signed off
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement (D-XX) | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|--------------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 | 01 | 1 | D-F1', D-F2, D-F3', D-C2' | T-61-01,02,04 | CHECK enum + RLS + signed RPC | grep migration file | `grep -q "address_validation_verdict" supabase/migrations/062_phase61_address_validation.sql` | ✅ after Plan 01 | ⬜ pending |
| 01-T2 | 01 | 1 | D-F1', D-F2, D-C2' | T-61-04 | Migration applied to remote | supabase CLI | `supabase migration list \| grep 062_phase61_address_validation` | ✅ after push | ⬜ pending |
| 02-T1 | 02 | 1 | D-A1, D-A3, D-C1, D-C3, D-D1 | (Wave 0 RED) | Tests describe contract | pytest (must FAIL) | `pytest tests/test_google_maps.py 2>&1 \| grep -E "ModuleNotFoundError\|ImportError"` | ✅ after Wave 0 | ⬜ pending |
| 02-T2 | 02 | 1 | D-A1, D-A2, D-A3, D-C1, D-C2', D-C3, D-D1 | T-61-08-14 | All Wave 0 tests GREEN | pytest | `cd C:/Users/leheh/.Projects/livekit-agent && pytest tests/test_google_maps.py -x` | ✅ after impl | ⬜ pending |
| 03-T1 | 03 | 2 | D-B1, D-B2, D-D3', D-E2 (book) | T-61-15-19 | Pre-check before slot lock | pytest + grep | `pytest tests/test_book_appointment_validation.py -x && grep -q "BOOKED \[verdict=validated\]" livekit-agent/src/tools/book_appointment.py` | ✅ after Plan 03-T1 | ⬜ pending |
| 03-T2 | 03 | 2 | D-B4, D-D3', D-E2 (capture_lead) | T-61-15,16 | Symmetric pre-check | pytest + grep | `pytest tests/test_capture_lead_validation.py -x && grep -q "LEAD CAPTURED \[verdict=validated\]" livekit-agent/src/tools/capture_lead.py` | ✅ after Plan 03-T2 | ⬜ pending |
| 04-T1 | 04 | 3 | D-E1, D-E3 | T-61-20 | EN+ES CRITICAL RULE + tool desc | pytest | `pytest tests/test_prompt_address_validation_rule.py tests/test_tool_descriptions_validation_precondition.py -x` | ✅ after Plan 04-T1 | ⬜ pending |
| 04-T2 | 04 | 3 | (skill update mandate) | T-61-22 | SKILL.md drift mitigation | grep | `grep -q "Phase 61" .claude/skills/voice-call-architecture/SKILL.md && grep -q "062_phase61_address_validation" .claude/skills/auth-database-multitenancy/SKILL.md` | ✅ after Plan 04-T2 | ⬜ pending |
| 04-T3 | 04 | 3 | D-B3, D-E3, D-G3 | T-61-23,24 | Production audio + DB row | manual UAT (4 calls) | (manual — see Plan 04 Task 3 instructions) | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Test stubs and fixtures the planner schedules in Wave 0 before any implementation tasks. Plan 02 Task 1 = Wave 0 (RED phase).*

- [x] `livekit-agent/tests/test_google_maps.py` — 17+ tests across verdict mapper (5), components mapper (4), country_code source (1), HTTP error paths (4), Sentry gate (2), telemetry (1), public API shape (1)
- [x] `livekit-agent/tests/conftest.py` — `gmaps_fixture` shared fixture loading from `tests/fixtures/gmaps_responses/`
- [x] `livekit-agent/tests/fixtures/gmaps_responses/` — 8 recorded API responses: us_confirmed, us_confirm_with_corrections, us_fix_required, ca_confirmed, sg_hdb_confirmed, sg_hdb_subpremise_missing, unsupported_region_de, quota_exceeded_429
- [x] `livekit-agent/pyproject.toml` — `httpx>=0.27,<1` added to `[project] dependencies` (Pitfall 8 mitigation)

(Wave 0 also feeds Plans 03 and 04 — the test files for book_appointment_validation, capture_lead_validation, prompt_address_validation_rule, and tool_descriptions_validation_precondition are written in their respective plan tasks per TDD ordering, but the shared fixtures and conftest established in Plan 02 Wave 0 unblock them.)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live test call validates real address — confirmed branch | D-B1, D-B3 | LiveKit voice agent + real Twilio + real Google Maps API key + real audio | Plan 04 Task 3 Call 1 — speak known-good address; agent reads back normalized form as fact |
| Live test call validates real address — confirmed_with_changes branch | D-B3 | Same | Plan 04 Task 3 Call 2 — speak misspelled or partial address; agent reads back corrected form + invites confirmation ("I have it as X — is that right?") |
| Live test call validates real address — unconfirmed branch + anti-hallucination | D-B3, D-E3 | Same + transcript review | Plan 04 Task 3 Call 3 — speak gibberish address; agent must read back caller's words AND must not use any of the 6 prohibited phrases ("validated", "verified", "confirmed against Google", "found your address", "looked up your address", "matches our records") |
| Live test call Spanish locale | D-E3 ES mirror | Spanish audio | Plan 04 Task 3 Call 4 — caller speaks Spanish; agent applies the rule in Spanish (no `validado`/`verificado` claims unless verdict supports) |
| Sentry pages only on verdict='error' | D-A3, D-C3 | Live error injection + Sentry dashboard | Plan 04 Task 3 (optional) — temporarily set GOOGLE_MAPS_API_KEY=garbage on Railway, place call, verify ONE Sentry event with component=google_maps_validate; restore env var; verify no Sentry page on subsequent unsupported_region call |
| gmaps_validate_events row per validate | D-C2' | Production DB inspection | Plan 04 Task 3 — after 4 calls: `SELECT verdict, latency_ms, region_code, created_at FROM gmaps_validate_events ORDER BY created_at DESC LIMIT 10` returns one row per validate attempt |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task has either pytest OR grep verify; only Plan 04 Task 3 is manual UAT, and it gates the phase close)
- [x] Wave 0 covers all MISSING references (Plan 02 Task 1 establishes fixtures + conftest before any code lands)
- [x] No watch-mode flags
- [x] Feedback latency < 60s (quick command targets ~10s; full suite ~45s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (planner — 2026-04-25)
