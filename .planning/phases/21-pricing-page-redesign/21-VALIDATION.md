---
phase: 21
slug: pricing-page-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual visual verification (frontend-only, no unit tests for this phase) |
| **Config file** | N/A |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build && npm run lint` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | SC-1 | build | `npm run build` | ✅ | ⬜ pending |
| 21-01-02 | 01 | 1 | SC-2 | build | `npm run build` | ✅ | ⬜ pending |
| 21-01-03 | 01 | 1 | SC-3 | build | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No new test framework or fixtures needed — this is a pure frontend visual redesign.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dark hero matches landing page energy | SC-1 | Visual design parity | Compare pricing hero to landing HeroSection side-by-side in browser |
| Tier cards copper glow on hover | SC-1 | CSS hover state | Hover each tier card, verify copper border glow and translateY lift |
| Growth card highlighted with ring | SC-1 | Visual distinction | Verify Growth card has visible copper ring and "Most Popular" badge |
| Trial banner visibility | SC-3 | Prominence check | Confirm "14-Day Free Trial" banner visible without scrolling on desktop |
| Enterprise CTA pre-selects sales | SC-4 | Query param pass-through | Click Enterprise "Contact Us", verify contact form inquiry type is "sales" |
| Mobile tier card stacking | SC-8 | Responsive layout | View at 375px viewport, verify cards stack vertically |
| Mobile comparison table scroll | SC-8 | Responsive behavior | View at 375px viewport, verify table scrolls horizontally |
| No money-back or no-CC text | SC-7 | Content removal | Search page for "money-back", "no credit card" — must not appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
