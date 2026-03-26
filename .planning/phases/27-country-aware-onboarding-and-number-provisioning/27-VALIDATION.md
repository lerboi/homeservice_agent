---
phase: 27
slug: country-aware-onboarding-and-number-provisioning
status: draft
nyquist_compliant: true
wave_0_complete: true
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
| 27-01-01 | 01 | 1 | DB schema | migration | `grep "phone_inventory" supabase/migrations/` | N/A | pending |
| 27-01-02 | 01 | 1 | RPC function | migration | `grep "assign_sg_number" supabase/migrations/` | N/A | pending |
| 27-02-01 | 02 | 2 | Contact->Details | grep | `grep "Your Details" src/app/onboarding/` | N/A | pending |
| 27-02-02 | 02 | 2 | Country field + SG gate | grep | `grep "country\|409" src/app/api/onboarding/sms-confirm/` | N/A | pending |
| 27-03-01 | 03 | 2 | Provisioning | grep | `grep "incomingPhoneNumbers\|assign_sg_number\|phoneNumber.import" src/app/api/` | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

All tasks have `<automated>` verify commands. No Wave 0 test scaffolding needed — project uses grep-based acceptance criteria and `npm run build` for validation.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SG availability badge updates on country select | D-06/D-07 | Real-time UI interaction | Select SG in dropdown, verify count badge appears |
| Waitlist form blocks onboarding when SG full | D-08 | Requires empty inventory state | Set all SG numbers to assigned, attempt onboarding |
| Phone auto-prefix changes on country switch | D-04 | UI interaction | Switch between SG/US/CA, verify prefix changes |
| Number provisioned after checkout | D-10 | Requires Stripe test checkout | Complete checkout, verify number assigned in DB |
| Server-side 409 on SG with no availability | COUNTRY-03 | Requires empty inventory + API call | Set all SG to assigned, POST to sms-confirm with country=SG, expect 409 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
