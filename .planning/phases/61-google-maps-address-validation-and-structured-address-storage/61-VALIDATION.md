---
phase: 61
slug: google-maps-address-validation-and-structured-address-storage
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
---

# Phase 61 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Filled in during planning by `gsd-planner` from RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (livekit_agent/tests/) |
| **Config file** | livekit_agent/pyproject.toml |
| **Quick run command** | `pytest livekit_agent/tests/test_google_maps.py livekit_agent/tests/test_address_validation.py -x` |
| **Full suite command** | `pytest livekit_agent/tests/` |
| **Estimated runtime** | TBD by planner (~30s expected) |

---

## Sampling Rate

- **After every task commit:** Run quick command
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

*Filled by gsd-planner during plan creation. Each task in each PLAN.md must map here.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Test stubs and fixtures the planner schedules in Wave 0 before any implementation tasks.*

- [ ] `livekit_agent/tests/test_google_maps.py` — fixtures for verdict mapper, address_components mapper, recorded API responses (US confirmed, US confirmed_with_changes, US unconfirmed, CA confirmed, SG HDB, unsupported_region error)
- [ ] `livekit_agent/tests/test_address_validation.py` — integration test stubs for book_appointment + capture_lead pre-check
- [ ] `livekit_agent/tests/conftest.py` — shared mock httpx fixtures for googleapis.com responses

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live test call validates real address | D-B1, D-B3 | LiveKit voice agent + real Twilio + real Google Maps API key | After deploy: place test call, speak a known confirmed address, hear normalized readback per D-B3 confirmed branch; place second call with intentionally misspelled street, hear confirmed_with_changes "I have it as X — is that right?" branch. |
| Sentry alert on validation error only | D-C3 | Requires live error injection + Sentry dashboard inspection | Temporarily set GOOGLE_MAPS_API_KEY to invalid value; place call; verify Sentry receives one event with verdict=error context; verify no Sentry event when verdict=unsupported_region. |
| Anti-hallucination CRITICAL RULE in production | D-E3 | Requires live agent transcript review | Place 5 test calls with various address types; verify transcript shows agent uses verdict-correct language (no "validated"/"verified" phrasing on unconfirmed/error/skipped verdicts). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
