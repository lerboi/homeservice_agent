---
phase: 25
slug: enforcement-gate-and-billing-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | jest.config.js |
| **Quick run command** | `npx jest --testPathPattern="billing\|enforce" --bail` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern="billing\|enforce" --bail`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 1 | ENFORCE-01 | integration | `npx jest --testPathPattern="enforce"` | ❌ W0 | ⬜ pending |
| 25-01-02 | 01 | 1 | ENFORCE-02 | integration | `npx jest --testPathPattern="enforce"` | ❌ W0 | ⬜ pending |
| 25-02-01 | 02 | 2 | BILLUI-01 | unit | `npx jest --testPathPattern="billing"` | ❌ W0 | ⬜ pending |
| 25-02-02 | 02 | 2 | BILLUI-02 | unit | `npx jest --testPathPattern="billing"` | ❌ W0 | ⬜ pending |
| 25-02-03 | 02 | 2 | BILLUI-03 | unit | `npx jest --testPathPattern="billing"` | ❌ W0 | ⬜ pending |
| 25-02-04 | 02 | 2 | BILLUI-04 | unit | `npx jest --testPathPattern="billing"` | ❌ W0 | ⬜ pending |
| 25-02-05 | 02 | 2 | BILLUI-05 | unit | `npx jest --testPathPattern="billing"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for enforcement gate (handleInbound subscription check)
- [ ] Test stubs for billing dashboard page (plan card, usage meter, invoices)
- [ ] Test stubs for upgrade page (plan selection, checkout creation)
- [ ] Test stubs for trial countdown banner

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Blocked caller hears graceful message | ENFORCE-01 | Requires live Retell call to verify AI agent reads paywall_reason | Place test call to tenant with cancelled subscription, verify caller hears unavailable message |
| Ring gauge overflows at >100% usage | BILLUI-01 | Visual verification of SVG overage rendering | Set calls_used > calls_limit in DB, verify ring gauge shows overage segment |
| Trial banner countdown accuracy | BILLUI-02 | Visual verification across dashboard pages | Set trial_ends_at to 3 days from now, navigate dashboard pages, verify banner shows correct days |
| Stripe Checkout end-to-end | BILLUI-04 | Requires Stripe test mode interaction | Click plan CTA on /billing/upgrade, complete test card checkout, verify redirect to dashboard |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
