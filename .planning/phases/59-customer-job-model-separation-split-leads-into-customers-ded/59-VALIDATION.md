---
phase: 59
slug: customer-job-model-separation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 59 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Populated by the planner from RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | {to be filled from RESEARCH §Validation Architecture} |
| **Config file** | {path or "none — Wave 0 installs"} |
| **Quick run command** | `{quick command}` |
| **Full suite command** | `{full command}` |
| **Estimated runtime** | ~{N} seconds |

---

## Sampling Rate

- **After every task commit:** Run `{quick run command}`
- **After every plan wave:** Run `{full suite command}`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** {N} seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 59-01-01 | 01 | 0 | REQ-TBD | — | — | unit | `{command}` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Pre-migration audit SQL (invoices without appointment_id; leads.from_number E.164 compliance)
- [ ] `src/lib/phone/normalize.js` (E.164 utility using libphonenumber-js)
- [ ] Test scaffolds for migration backfill, customer dedup, job reattribution

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard Jobs tab parity | REQ-TBD | Visual regression | Compare pre/post migration screenshots of Jobs tab for existing tenant |
| Customer detail page UX | REQ-TBD | Human review of new page | Navigate to /dashboard/customers/{id}, verify calls + jobs + invoices render |
| Voice agent lead attach | REQ-TBD | Requires live SIP call | Place test call, confirm Customer deduped by phone + Job created |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < {N}s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
