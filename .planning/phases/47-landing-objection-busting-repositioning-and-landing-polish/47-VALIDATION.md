---
phase: 47
slug: landing-objection-busting-repositioning-and-landing-polish
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-13
last_updated: 2026-04-13
---

# Phase 47 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7.0 (already present in package.json) |
| **Config file** | `package.json` (test script uses `--experimental-vm-modules node_modules/jest-cli/bin/jest.js`) |
| **Quick run command** | `npm test -- tests/unit/landing-sections.test.js --passWithNoTests` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10–15s (landing-sections.test.js is file-read assertions, no DOM render) |

---

## Sampling Rate

- **After every task commit:** `npm test -- tests/unit/landing-sections.test.js --passWithNoTests` (fast feedback, <5s)
- **After every plan wave:** `npm test` (full suite)
- **Before `/gsd:verify-work`:** Full suite green + `npm run build` succeeds
- **Max feedback latency:** 15 seconds per quick run

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 47-01-T1 | 01 | 1 | (Wave 0 infra) | presence | `test -f src/components/ui/accordion.jsx && grep -l AccordionTrigger src/components/ui/accordion.jsx` | ⬜ | ⬜ pending |
| 47-01-T2 | 01 | 1 | (Wave 0 test scaffold) | smoke | `npm test -- tests/unit/landing-sections.test.js --passWithNoTests` | ⬜ | ⬜ pending |
| 47-01-T3 | 01 | 1 | (Wave 0 API + audio docs) | smoke | `npm test -- tests/unit/public-chat-api.test.js` | ⬜ | ⬜ pending |
| 47-02-T1 | 02 | 2 | REPOS-03 | smoke | `npm test -- tests/unit/landing-sections.test.js -t "AfterTheCallStrip"` | ⬜ | ⬜ pending |
| 47-02-T2 | 02 | 2 | OBJ-06 | smoke | `npm test -- tests/unit/landing-sections.test.js -t "IdentitySection"` | ⬜ | ⬜ pending |
| 47-02-T3 | 02 | 2 | REPOS-04 | smoke | `npm test -- tests/unit/landing-sections.test.js -t "OwnerControlPullQuote"` | ⬜ | ⬜ pending |
| 47-03-T1 | 03 | 2 | OBJ-02 (audio island) | smoke | `npm test -- tests/unit/landing-sections.test.js -t "AudioPlayerCard"` | ⬜ | ⬜ pending |
| 47-03-T2 | 03 | 2 | OBJ-02/03/04/05/08/09 | smoke | `npm test -- tests/unit/landing-sections.test.js -t "PracticalObjectionsGrid"` | ⬜ | ⬜ pending |
| 47-04-T1 | 04 | 2 | OBJ-01 (chat widget) | smoke | `npm test -- tests/unit/landing-sections.test.js -t "FAQChatWidget"` | ⬜ | ⬜ pending |
| 47-04-T2 | 04 | 2 | OBJ-01 (accordion) | smoke | `npm test -- tests/unit/landing-sections.test.js -t "FAQSection"` | ⬜ | ⬜ pending |
| 47-05-T1 | 05 | 3 | REPOS-01, REPOS-02 | smoke | `npm test -- tests/unit/landing-sections.test.js -t "Hero copy\|FinalCTA copy"` | ⬜ | ⬜ pending |
| 47-05-T2 | 05 | 3 | (page.js wiring) | build | `npm run build` | ⬜ | ⬜ pending |
| 47-05-T3 | 05 | 3 | (skill sync) | grep | `grep -c "AfterTheCallStrip\|IdentitySection\|PracticalObjectionsGrid\|OwnerControlPullQuote\|FAQSection\|FAQChatWidget\|AudioPlayerCard" .claude/skills/public-site-i18n/SKILL.md` | ⬜ | ⬜ pending |
| 47-05-T4 | 05 | 3 | POLISH-11, POLISH-12 | manual | Human visual verification checkpoint | ⬜ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Populated by planner during plan creation; refined by Nyquist auditor.*

### Requirement → Task Map (coverage matrix)

| Requirement | Plan | Task(s) | Verification |
|-------------|------|---------|--------------|
| OBJ-01 | 04 | T1 (chat), T2 (accordion) | smoke tests for 7 questions + chat POST URL + Pitfall guards |
| OBJ-02 | 03 | T1 (audio island), T2 (grid card) | Audio source, pause-coordination, 85% stat, aria-labels |
| OBJ-03 | 03 | T2 | "$260,400" appears in grid |
| OBJ-04 | 03 | T2 | "Forward"/"hours"/"live" + "4m 12s" chip |
| OBJ-05 | 03 | T2 | escalation/record/rules keywords + ShieldCheck icons |
| OBJ-06 | 02 | T2 | IdentitySection: no defensive copy, complement framing |
| OBJ-08 | 03 | T2 | Before/after labels in grid card |
| OBJ-09 | 03 | T2 | 5 Lucide trade icons (Wrench, Thermometer, Zap, Hammer, HardHat) |
| REPOS-01 | 05 | T1 | Hero H1 no longer says "Let Voco Handle"; complement framing present; RotatingText preserved |
| REPOS-02 | 05 | T1 | FinalCTA subtitle contains "your rules" or "your schedule" |
| REPOS-03 | 02 | T1 | AfterTheCallStrip: 5 items, neutral id, Server Component |
| REPOS-04 | 02 | T3 | OwnerControlPullQuote: dark bg + quote with "rules"/"follows" |
| POLISH-11 | 02, 03, 04 | multiple | AnimatedSection usage grep in each new component |
| POLISH-12 | 05 | T4 | Manual 375px responsive check in human verification |

---

## Wave 0 Requirements

Wave 0 is contained in **Plan 01** and gates all downstream plans:

- [ ] `npx shadcn add accordion` — creates `src/components/ui/accordion.jsx` (consumed by Plan 04 FAQSection)
- [ ] `tests/unit/landing-sections.test.js` scaffolded with describe blocks + `it.todo` for each Phase 47 section (filled in progressively by Plans 02/03/04/05)
- [ ] `tests/unit/public-chat-api.test.js` confirms `/api/public-chat` POST handler is importable
- [ ] `public/audio/README.md` documents `demo-intro.mp3` as OBJ-02's approved audio source and records the `window.__vocoPlayingAudio` singleton rule

All Wave 0 items are captured as Plan 01's three tasks.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ScrollLinePath copper wave still aligns after AfterTheCallStrip insertion | REPOS-03 | Visual SVG geometry — no automatable DOM assertion that matches "the wave looks right" | Load `/`, scroll from hero to SocialProof, confirm copper sine wave renders without gaps or misaligned dots at Features/Testimonials anchors |
| Card hover lift + orange border glow | OBJ-02/03/04/05/08/09 | CSS transitions visual-only | Hover each of 6 cards at 1440px, confirm `-translate-y-1` + orange tint shadow |
| Accordion expand/collapse animation | OBJ-01 | Radix animation visual | Click each of 7 FAQ items, confirm smooth expand; confirm only one open at a time |
| Chat widget end-to-end | OBJ-01 + D-11 | Requires live Groq API call; unit test only asserts import | Type "how much does Voco cost?", hit send, confirm reply arrives within ~3s |
| OBJ-02 audio pause coordination | OBJ-02 + Pitfall 6 | Tests HeroDemoBlock ↔ AudioPlayerCard interaction | Start hero demo, scroll to OBJ-02 card, click play — confirm hero demo pauses automatically |
| Reduced-motion compliance | POLISH-11 | OS-level setting affects client behavior | Enable OS "reduce motion", reload `/`, confirm AnimatedSection fade-ups do not animate |
| 375px horizontal scroll check | POLISH-12 | Visual viewport testing | Chrome DevTools → 375px viewport → scroll full page → confirm no horizontal scrollbar |
| Background rhythm adjacency | UI-SPEC background table | Visual color adjacency | Scroll entire page, confirm no two same-color sections are adjacent (exception: dark OwnerControlPullQuote + dark FinalCTA, intentional) |

All manual checks are consolidated into Plan 05 Task 4 (human verification checkpoint).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (smoke test grows progressively across plans)
- [x] Wave 0 covers all MISSING references (accordion component, test scaffolds, audio path doc)
- [x] No watch-mode flags
- [x] Feedback latency &lt; 15 seconds for `npm test -- tests/unit/landing-sections.test.js --passWithNoTests`
- [ ] `nyquist_compliant: true` — set after Wave 0 (Plan 01) executes and all `it.todo` entries are addressed by downstream plans

**Approval:** planned (pending execution)
