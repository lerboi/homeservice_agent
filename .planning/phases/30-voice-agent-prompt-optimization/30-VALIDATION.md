---
phase: 30
slug: voice-agent-prompt-optimization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x / vitest |
| **Config file** | `jest.config.js` or `vitest.config.js` |
| **Quick run command** | `npm test -- --testPathPattern=voice-agent` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern=voice-agent`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 30-01-01 | 01 | 1 | D-05 | unit | `grep -q 'intake_questions' supabase/migrations/018*.sql` | ❌ W0 | ⬜ pending |
| 30-01-02 | 01 | 1 | D-05 | unit | `grep -q 'intakeQuestions\|intake_questions' src/lib/trade-templates.js` | ❌ W0 | ⬜ pending |
| 30-02-01 | 02 | 1 | D-02 | unit | `grep -q 'check_caller_history' src/app/api/webhooks/retell/route.js` | ❌ W0 | ⬜ pending |
| 30-03-01 | 03 | 2 | D-01,D-04,D-06 | manual | Live Retell call test | ❌ W0 | ⬜ pending |
| 30-03-02 | 03 | 2 | D-03 | manual | Transfer failure + callback booking test | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Migration file for `intake_questions` column — verifiable via SQL parse
- [ ] `check_caller_history` handler exists in route.js — verifiable via grep
- [ ] Trade templates extended with intake questions — verifiable via grep

*Existing infrastructure covers most phase requirements. Voice prompt changes require manual live-call testing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Smart slot preference detection | D-01 | Requires live Retell call with natural language | Call with "I prefer mornings", verify AI prioritizes AM slots |
| Repeat caller recognition | D-02 | Requires 2+ calls from same number | Call twice, verify AI acknowledges prior interaction |
| Failed transfer recovery | D-03 | Requires simulating transfer failure | Trigger transfer to unavailable number, verify callback offer |
| Prompt cleanup quality | D-04 | Subjective prompt quality assessment | Review prompt for contradictions, redundancy |
| Trade-specific questions | D-05 | Requires live call to plumber/HVAC/electrician tenant | Call each trade type, verify correct intake questions |
| Post-booking recap flow | D-06 | Requires completing full booking flow | Book appointment, verify recap with date/time/address |

*Voice agent prompt changes are primarily validated through live Retell calls.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
