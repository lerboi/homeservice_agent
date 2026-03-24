---
phase: 13
slug: frontend-public-pages-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Visual inspection + Lighthouse CLI + Next.js build |
| **Config file** | next.config.mjs (existing) |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build && npx lighthouse http://localhost:3000 --only-categories=performance --output=json` |
| **Estimated runtime** | ~30 seconds (build), ~60 seconds (with Lighthouse) |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build` + visual inspection of affected pages
- **Before `/gsd:verify-work`:** Full build must succeed, all pages render correctly
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-00-01 | 00 | 0 | D-02 (palette tokens) | build | `npm run build` | ✅ | ⬜ pending |
| 13-01-01 | 01 | 1 | D-07–D-09 (Nav) | build + visual | `npm run build` | ✅ | ⬜ pending |
| 13-01-02 | 01 | 1 | D-10–D-12 (Footer) | build + visual | `npm run build` | ✅ | ⬜ pending |
| 13-02-01 | 02 | 2 | D-18, D-21 (Home sections) | build + visual | `npm run build` | ✅ | ⬜ pending |
| 13-03-01 | 03 | 2 | D-13–D-15 (Pricing) | build + visual | `npm run build` | ✅ | ⬜ pending |
| 13-03-02 | 03 | 2 | D-16 (About) | build + visual | `npm run build` | ✅ | ⬜ pending |
| 13-03-03 | 03 | 2 | D-17 (Contact) | build + visual | `npm run build` | ✅ | ⬜ pending |
| 13-04-01 | 04 | 3 | D-30–D-36 (Auth) | build + visual | `npm run build` | ✅ | ⬜ pending |
| 13-05-01 | 05 | 3 | D-24–D-29 (Mobile) | build + visual | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/app/globals.css` — Add dark palette CSS custom properties (D-02 tokens: --landing-midnight, --landing-charcoal, --landing-light-text, --landing-muted-text)
- [ ] Verify existing AnimatedSection, shadcn components, Framer Motion all still function after token additions

*Existing infrastructure covers build verification. No new test framework needed — this is a visual redesign phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dark palette visual consistency | D-01, D-02, D-03 | Color perception requires human eye | Open each page, verify dark surfaces, copper accents, stone breaks |
| Card hover copper glow | D-05, D-06 | Interactive hover state | Hover over cards on pricing, features — verify warm copper glow, not cold white |
| Nav transparency → solid transition | D-08 | Scroll behavior visual | Load home page, scroll down, verify nav transitions from transparent to solid |
| Footer copper gradient border | D-11 | Subtle visual detail | Scroll to footer, verify thin copper gradient line at top |
| Auth signup vs signin differentiation | D-30–D-33 | Layout comparison | Navigate to signup (split layout) and signin (centered card) — verify visually distinct |
| Mobile fallbacks | D-24–D-29 | Device-specific rendering | Open pages at <768px — verify Spline→gradient, bento→stacked, tabs→accordion |
| Animation subtlety | D-19, D-22 | Subjective quality | Scroll through pages — animations should be noticed subconsciously, not overtly |
| Core Web Vitals | LCP<2.5s, CLS<0.1 | Lighthouse audit | Run Lighthouse on each page, verify performance metrics |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
