---
phase: 44
slug: ai-voice-selection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 44 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest |
| **Config file** | `jest.config.js` (root) |
| **Quick run command** | `npx jest tests/unit/ai-voice-settings.test.js -x` |
| **Full suite command** | `npx jest --no-coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest tests/unit/ai-voice-settings.test.js -x`
- **After every plan wave:** Run `npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 44-01-01 | 01 | 1 | DB migration + API route + tests | unit (TDD) | `npx jest tests/unit/ai-voice-settings.test.js -x` | ❌ W0 (created in task) | ⬜ pending |
| 44-01-02 | 01 | 1 | Audio placeholder files | file check | `ls -la public/audio/voices/*.mp3 \| wc -l` | N/A | ⬜ pending |
| 44-01-03 | 01 | 1 | Skill sync (auth-database) | grep check | `grep -c "ai_voice" .claude/skills/auth-database-multitenancy/SKILL.md` | N/A | ⬜ pending |
| 44-02-01 | 02 | 2 | VoicePickerSection UI + integration | build | `npx next build 2>&1 \| tail -20` | N/A | ⬜ pending |
| 44-02-02 | 02 | 2 | Visual checkpoint | manual | human verification in browser | N/A | ⬜ pending |
| 44-03-01 | 03 | 2 | Agent voice override | syntax | `python -c "import ast; ast.parse(...)"` | N/A | ⬜ pending |
| 44-03-02 | 03 | 2 | Skill sync (voice-call) | grep check | `grep -c "ai_voice" .claude/skills/voice-call-architecture/SKILL.md` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/ai-voice-settings.test.js` — unit tests for PATCH route validation logic
- [ ] `public/audio/voices/aoede.mp3` (and 5 others) — placeholder silent audio files so the UI loads without 404s during development

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Audio mutual exclusion | D-08 | UI interaction — requires browser playback | Play voice A, then play voice B; verify A stops |
| Voice card selection + save | D-11/D-12 | UI interaction — requires browser | Click card, click Save Voice, verify toast "Voice updated" |
| Agent voice override (ai_voice set) | D-14 | Cross-repo Python agent on Railway | Make test call after setting ai_voice; verify voice matches |
| Agent voice override (NULL fallback) | D-15 | Cross-repo Python agent on Railway | Clear ai_voice; make test call; verify tone-based voice used |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
