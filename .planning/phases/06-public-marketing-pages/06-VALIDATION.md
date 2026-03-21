---
phase: 6
slug: public-marketing-pages
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7.0 |
| **Config file** | `jest.config.js` (root) — `testMatch: ['**/tests/**/*.test.js']` |
| **Quick run command** | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/contact/ --passWithNoTests` |
| **Full suite command** | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/contact/ tests/pricing/ --passWithNoTests`
- **After every plan wave:** Run `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 0 | PAGE-04 | unit | `jest tests/contact/contact-api.test.js` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 0 | PRICE-03 | unit | `jest tests/pricing/pricing-calc.test.js` | ❌ W0 | ⬜ pending |
| 06-xx-xx | xx | 1+ | PAGE-01 | manual | Visual review | N/A | ⬜ pending |
| 06-xx-xx | xx | 1+ | PAGE-02 | manual | Visual review | N/A | ⬜ pending |
| 06-xx-xx | xx | 1+ | PAGE-03 | manual | Visual review | N/A | ⬜ pending |
| 06-xx-xx | xx | 1+ | PRICE-01 | manual | Visual review | N/A | ⬜ pending |
| 06-xx-xx | xx | 1+ | PRICE-02 | manual | Visual review | N/A | ⬜ pending |
| 06-xx-xx | xx | 1+ | PRICE-04 | manual | Visual review | N/A | ⬜ pending |
| 06-xx-xx | xx | 1+ | PRICE-05 | manual | Visual review | N/A | ⬜ pending |
| 06-xx-xx | xx | 1+ | PRICE-06 | manual | Visual review | N/A | ⬜ pending |
| 06-xx-xx | xx | 1+ | PRICE-07 | manual | Visual review | N/A | ⬜ pending |
| 06-xx-xx | xx | 1+ | PAGE-05 | manual | Visual review | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/contact/contact-api.test.js` — stubs for PAGE-04 (honeypot, field validation, Resend dispatch by inquiry type)
- [ ] `tests/pricing/pricing-calc.test.js` — stubs for PRICE-03 (annual price = monthly * 0.8, rounded)
- [ ] `tests/__mocks__/resend.js` — already exists, reuse for contact tests

*Existing infrastructure covers test framework. Only test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Nav links visible on all public pages (desktop + mobile) | PAGE-01 | UI layout — project uses node testEnvironment, no JSDOM | Navigate to /pricing, /about, /contact; verify nav renders; resize to mobile; verify hamburger menu |
| About page renders mission + values | PAGE-02 | Static content page | Navigate to /about; verify sections present |
| Contact page renders form with all fields | PAGE-03 | UI form layout | Navigate to /contact; verify name, email, inquiry type dropdown, message fields |
| Pricing cards show 4 tiers with correct data | PRICE-01 | UI rendering | Navigate to /pricing; verify 4 tier cards visible with names, prices, call volumes |
| Growth tier has "Most Popular" badge | PRICE-02 | Visual badge | Verify Growth card has visible badge |
| Monthly/annual toggle updates prices | PRICE-03 | Client interaction | Click toggle; verify prices change without reload |
| Feature comparison table renders | PRICE-04 | Table layout | Scroll below cards; verify table with features × tiers |
| FAQ accordion expands/collapses | PRICE-05 | Interactive UI | Click FAQ items; verify expand/collapse |
| CTA buttons link to onboarding | PRICE-06/07 | Navigation | Click "Get Started" CTA; verify redirect to onboarding step 1 |
| Contact form submission sends email | PAGE-04 | Email delivery | Submit form; verify acknowledgment toast; check ops inbox |
| SLA text visible on contact page | PAGE-05 | Static text | Navigate to /contact; verify response time text present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
