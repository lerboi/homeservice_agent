---
phase: 60
slug: voice-prompt-polish-name-once-and-single-question-address-intake
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 60 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> **Nature of this phase:** prompt-and-string changes in the separate `livekit_agent/` Railway repo. Automated unit-testing surface is minimal for audio-LLM behavior; live UAT calls with scripted personas are the validation canon. Automated grep/assembled-prompt checks supplement for D-15 and D-16.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `pytest` for any existing Python unit tests in `livekit_agent/tests/` (string assertions on tool returns, pure-function logic). Live-call UAT via scripted personas for behavioral verification. |
| **Config file** | `livekit_agent/pyproject.toml` → `[tool.pytest.ini_options]` (confirm in Wave 0 — cross-repo) |
| **Quick run command** | `pytest livekit_agent/tests/ -x --tb=short` (from agent repo root) |
| **Full suite command** | `pytest livekit_agent/tests/` + 7 scripted live UAT calls on Railway + 24h Sentry review |
| **Estimated runtime** | pytest: ~30s · live UAT cycle: ~45min (7 personas × ~5min each + Sentry review) |

---

## Sampling Rate

- **After every task commit:** Run `pytest livekit_agent/tests/ -x --tb=short` (prompt-only phase has minimal unit-test surface; quick feedback on any string-assertion regressions from D-16 tool-return rewrites)
- **After every plan wave:** Run full `pytest livekit_agent/tests/` + assembled-prompt grep checks (D-15 anti-hallucination rule placement; D-16 state+directive format across all tool returns)
- **Before `/gsd-verify-work`:** All 7 UAT personas pass on a live Railway deploy + 24h Sentry review for regression signals (no new `tool_call_cancelled` or parrot-loop spikes) + `voice-call-architecture/SKILL.md` text matches shipped code
- **Max feedback latency:** ~30s for automated layer; UAT cadence is per-wave (not per-task) because live calls are expensive

---

## Per-Task Verification Map

Populated by the planner. Each task in `60-XX-PLAN.md` must map its D-XX decision(s) to a row here with the automated command or UAT persona reference.

| Task ID | Plan | Wave | Decision | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| 60-01-XX | 01 | 1 | D-01..D-05 | — | No vocative use mid-call; readback once before booking | manual (UAT 1) | — | ❌ W0 | ⬜ pending |
| 60-01-XX | 01 | 1 | D-06..D-08 | — | Single-question opener; one targeted follow-up per missing piece | manual (UAT 1,2,3) | — | ❌ W0 | ⬜ pending |
| 60-01-XX | 01 | 1 | D-09, D-10 | — | Accept correction + re-read corrected full address | manual (UAT 3) | — | ❌ W0 | ⬜ pending |
| 60-01-XX | 01 | 1 | D-15 | — | Anti-hallucination rules in first 30 lines; no VAD-redundant guidance | automated (grep) | `grep -A 5 "OUTCOME WORDS\|TOOL NARRATION" livekit_agent/src/prompt.py \| head -30` | ✅ | ⬜ pending |
| 60-02-XX | 02 | 1 | D-11, D-12 | — | capture_lead description + readback parity | manual (UAT 6) | — | ❌ W0 | ⬜ pending |
| 60-02-XX | 02 | 1 | D-16 | T7 (PII via tool return) | All tool returns in strict STATE+DIRECTIVE format | automated (grep) | `grep -rn "return " livekit_agent/src/tools/*.py \| grep -v "STATE:\|^.*#"` returns zero speakable-English rows | ✅ | ⬜ pending |
| 60-03-XX | 03 | 2 | D-13, D-14 | — | Spanish mirrors all English rules; user-reviewed | manual (UAT 7) | — | ❌ W0 | ⬜ pending |
| 60-03-XX | 03 | 2 | skill sync | — | voice-call-architecture/SKILL.md reflects shipped prompt/tool rules | automated (grep) | `grep -F "name vocative" .claude/skills/voice-call-architecture/SKILL.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs filled in by the planner; row order is illustrative.*

---

## Wave 0 Requirements

- [ ] **Inventory `livekit_agent/tests/` for tool-return assertions** — `grep -rn "Booking confirmed\|slot is available\|lead captured\|address=" livekit_agent/tests/` — if any results, update the affected test files in the same commit as the tool-return rewrite (D-16).
- [ ] **Document UAT personas 1–7** — scripted call scripts land in `livekit_agent/docs/uat/phase-60-personas.md` (or equivalent). Personas 1–3 are sketched in CONTEXT.md §Validation; personas 4–7 are new gaps:
  - Persona 1 — Culturally diverse name + clear address (baseline for D-01, D-02, D-06)
  - Persona 2 — Casual one-breath address (D-06, D-07)
  - Persona 3 — Mid-readback correction (D-05, D-09, D-10)
  - Persona 4 — Caller invites name use ("you can call me Sam") (D-03)
  - Persona 5 — Caller refuses name (D-04)
  - Persona 6 — Caller declines to book — decline path (D-11, D-12)
  - Persona 7 — Spanish caller (D-13)
- [ ] **Sentry query playbook** — document the Sentry query(ies) for `tool_call_cancelled` and "tool return text spoken verbatim" (parrot-loop) signals so the UAT reviewer knows what to look for post-deploy.
- [ ] **Confirm `livekit_agent/` repo access** — the executor must verify the separate repo is git-clonable/pushable from the execution environment. Phase 60's code changes do NOT land in `homeservice_agent/`.
- [ ] **Pytest config discovery** — confirm `livekit_agent/pyproject.toml` has `[tool.pytest.ini_options]` (or equivalent). If no pytest config exists, flag as a prerequisite.

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| Name not used vocatively mid-call | D-01 | Audio-LLM behavior not deterministically assertable in unit tests | UAT persona 1: listen for any "Thanks, {name}" / "Okay {name}" before the booking readback — fail if present |
| Readback occurs exactly once before booking tool fires | D-02 | Temporal ordering across model utterance + tool invocation | UAT persona 1: confirm name + address read aloud in the same turn, then `book_appointment` fires; no earlier vocative use |
| Caller-invited name use is honored naturally | D-03 | Requires subjective naturalness judgment | UAT persona 4: after "you can call me Sam", AI uses name at natural moments (not every turn); fail if AI ignores the invitation |
| No-name path does not block booking | D-04 | End-to-end path; DB row verification | UAT persona 5: refuse name; booking completes; DB `appointments.caller_name` is null/empty |
| Low-confidence pronunciation handled via CORRECTIONS | D-05 | Audio + model correction loop | UAT persona 3: mispronunciation on readback → caller corrects → AI accepts + re-reads corrected full |
| Single-question opener (verbatim or close) | D-06 | Audio behavior | UAT personas 1, 2, 3: opener is "What's the address where you need the service?" or very close; NOT a three-part enumeration |
| One targeted follow-up per missing piece | D-07 | Audio behavior | UAT persona 2: caller gives only postal area → AI asks for street (single targeted Q), not a shopping list |
| Corrections re-read corrected full address | D-09, D-10 | Audio behavior loop | UAT persona 3: caller corrects mid-readback → AI accepts + re-reads full; corrects again → loops |
| capture_lead decline-path parity | D-11, D-12 | Behavior across branch | UAT persona 6: declines to book → AI still does single-question intake + readback before `capture_lead` fires |
| Spanish mirror works end-to-end | D-13 | Audio + locale | UAT persona 7: Spanish caller; all 16 decisions hold in Spanish |
| Zero new hallucination signals post-deploy | overall | Requires 24h observation window | Sentry query playbook (Wave 0) — 24h after Railway deploy, no new `tool_call_cancelled` or parrot-loop flags attributable to Phase 60 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependency mapped
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify step (grep checks on D-15, D-16 bridge the otherwise manual D-01..D-14)
- [ ] Wave 0 covers all MISSING references (UAT persona docs, Sentry playbook, cross-repo access, pytest config discovery)
- [ ] No watch-mode flags in commands
- [ ] Feedback latency < 30s for automated layer; per-wave cadence for UAT
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 gaps are closed

**Approval:** pending
