---
phase: 27
slug: country-aware-onboarding-and-number-provisioning
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification + grep-based acceptance criteria |
| **Config file** | none |
| **Quick run command** | `grep -r "owner_name\|country" src/app/onboarding/ src/app/api/onboarding/` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick grep verification
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full build must pass
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 27-01-01 | 01 | 1 | DB schema | migration | `grep "phone_inventory" supabase/migrations/` | ❌ W0 | ⬜ pending |
| 27-01-02 | 01 | 1 | RPC function | migration | `grep "assign_sg_number" supabase/migrations/` | ❌ W0 | ⬜ pending |
| 27-02-01 | 02 | 1 | Contact→Details | grep | `grep "Your Details" src/app/onboarding/` | ❌ W0 | ⬜ pending |
| 27-02-02 | 02 | 1 | Country field | grep | `grep "country" src/app/onboarding/contact/` | ❌ W0 | ⬜ pending |
| 27-03-01 | 03 | 2 | Provisioning | grep | `grep "phone_inventory\|phoneNumber.create" src/app/api/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SG availability badge updates on country select | D-06/D-07 | Real-time UI interaction | Select SG in dropdown, verify count badge appears |
| Waitlist form blocks onboarding when SG full | D-08 | Requires empty inventory state | Set all SG numbers to assigned, attempt onboarding |
| Phone auto-prefix changes on country switch | D-04 | UI interaction | Switch between SG/US/CA, verify prefix changes |
| Number provisioned after checkout | D-10 | Requires Stripe test checkout | Complete checkout, verify number assigned in DB |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
