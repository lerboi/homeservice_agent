---
type: system
system: Voice Agent
status: historical
description: "Tools - Phase 63 generate_reply regression and SDK patch (Gemini era). Covers: Phase 63.1 — generate_reply regression fix (Gemini 3.1 + plugins-google 1.5.6); Phase 63.2 — LiveKit SDK patch upgrade 1.5.6 → 1.5.7 (hygiene + dry run)"
source: .claude/skills/voice-call-architecture/SKILL.md § 5. Tools (10 in-process)
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# Tools (10 in-process) (part 4 of 4)

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

### Phase 63.1 — generate_reply regression fix (Gemini 3.1 + plugins-google 1.5.6)

> ⚠️ **SUPERSEDED by Phase 65 (gpt-realtime-2 migration).** This worked around
> Gemini 3.1 capability-gating `generate_reply` closed (which forced the
> separate-TTS greeting + pre-session intake injection). gpt-realtime-2
> supports `generate_reply`, so the greeting is native again. The **pre-session
> intake-injection pattern still holds** (intake text goes into the initial
> `build_system_prompt(...)`), but the `test_no_generate_reply_in_src` guard was
> deleted in the migration. Retained as debugging history.

**What broke.** On the Phase 63 upgrade to `livekit-agents==1.5.6` +
`livekit-plugins-google==1.5.6`, `RealtimeModel` for
`gemini-3.1-flash-live-preview` began silently capability-dropping any
`session.generate_reply(...)` call. Plugin warning + error logs:
`generate_reply is not compatible with 'gemini-3.1-flash-live-preview'`
and `failed to generate a reply: generate_reply is not compatible`.
User-visible symptom: the agent never spoke the greeting, and tenant
intake questions were never injected. The caller had to speak first
for any agent turn to be emitted.

**Root cause.** The 1.5.6 google plugin guards `generate_reply` on a
per-model capability matrix; `gemini-3.1-flash-live-preview` is marked
incompatible. Unlike the 1.5.1 + git `43d3734` pin (which supported
it), the 1.5.6 mainline no-ops these calls rather than raising — they
fail silently at runtime with only warnings, so tests and imports pass
but live calls regress.

**Fix shape (Plans 02 + 03).** Two-part hybrid:

- **Plan 02 — `src/agent.py`.** Both `session.generate_reply(...)` call
  sites deleted (intake injection L702-717 + greeting L754-758). The
  intake_questions Supabase fetch was hoisted OUT of `_run_db_queries`
  (parallel gather) and INTO the pre-session construction block
  (mirroring the existing Xero/Jobber customer_context pattern), so
  the fetched list is threaded through
  `build_system_prompt(intake_questions=intake_questions_text)` and
  arrives in Gemini's initial `instructions=system_prompt` payload.
  `session_ready = asyncio.Event()` + `.set()` + `.wait()` fully
  removed as dead code. `_run_db_queries` result-unpacking converted
  from index-based (`results[N]`) to named tuple unpacking to prevent
  reindex bugs.
- **Plan 03 — `src/prompt.py`.** `_build_greeting_section` extended
  append-only with a `FIRST TURN:` / `PRIMER TURNO:` block prepended
  to the existing `OPENING:` / `APERTURA:` structure (both locale
  branches, USTED register). Outcome-shaped (describes what the
  caller hears, not a mechanical instruction sequence) — no verbatim
  script strings like `"Thank you for calling"` / `"Gracias por
  llamar"`. The replacement mechanism is the Gemini server VAD:
  with `system_prompt` now containing a "the FIRST thing the caller
  hears is a warm, branded greeting" directive, the VAD firing on the
  caller's first audio frame elicits the greeting organically.

**Regression guard.** `tests/test_no_generate_reply_in_src.py` — pure
stdlib regex scan of `src/**/*.py` (skipping `__pycache__`) for
`\bgenerate_reply\s*\(` with leading-`#` comment skip. Failure message
embeds `file:lineno:line_content` and documents the 1.5.6+3.1 silent-
drop failure mode so future regressions are caught at test time rather
than in production. Paired with 6 `tests/test_prompt_greeting_directive.py`
RED→GREEN tests locking the EN+ES directive contract at the
`_build_greeting_section` section surface (scoped, not full-prompt, to
avoid false positives from Phase 60.3 Plan 03
`_build_call_duration_section`'s `"Thank you for calling Voco"` WRONG-
example teaching string).

**Commits (livekit-agent branch `phase-63.1-generate-reply-fix` →
merged to `main` via `--no-ff` merge commit `bc4befd`):**

| SHA     | Plan | Message |
|---------|------|---------|
| `943c9d9` | 01 | `test(63.1): RED tests for greeting directive + intake audit` |
| `dab383e` | 01 | `test(63.1): RED grep-guard against session.generate_reply( in src/` |
| `3e43bb3` | 02 | `fix(63.1): hoist intake_questions fetch pre-session; delete intake-side generate_reply` |
| `823aab3` | 02 | `fix(63.1): delete greeting-side generate_reply + session_ready.set (grep-guard GREEN)` |
| `cc5e43a` | 03 | `fix(63.1): outcome-shaped first-turn greeting directive in _build_greeting_section (EN+ES)` |
| `bc4befd` | 04 | `merge(63.1): generate_reply regression fix` (--no-ff, preserves all Phase 60.4 + Phase 63 D-08 SHAs) |

**Test suite status at phase close.** 254 passed, 1 pre-existing
deferred VIP failure (`test_incoming_call_vip_lead`, tracked since
Plan 60.3-01 in `deferred-items.md`). All 6 greeting-directive tests
GREEN post-Plan-03; grep-guard GREEN on post-merge main.

**Live UAT disposition.** Plan 04 Task 2 (live UAT call on Railway
preview) was **skipped by explicit user directive** in favor of
direct merge-to-main + prod Railway auto-deploy. D-09 #1 (zero
`generate_reply is not compatible` warnings) verified offline via
grep-guard test; D-09 #2 (agent speaks first) verification deferred
to the next live call on prod. See
`.planning/phases/63.1-gemini-3-generate-reply-regression-fix/63.1-UAT.md`
for the exact disposition record.

**Applies to any future 1.5.6 + Gemini-3.x data-injection need.** The
generalizable pattern this phase establishes:

- Needed tenant/caller-specific data injected at call start → fetch
  it pre-`session.start()` and include it in the initial
  `build_system_prompt(...)` payload via a new kwarg.
- Needed the agent to speak first / open with a specific shape →
  encode it as an outcome-shaped directive in the relevant prompt
  section; rely on Gemini server VAD (`silence_duration_ms`) firing
  on first caller audio to elicit the turn.
- Needed a regression guard against future `session.generate_reply(`
  creep → extend `tests/test_no_generate_reply_in_src.py` or mirror
  its pure-stdlib regex-scan pattern.

**Plans 63.1-01 through 63.1-04 full documentation** — see
`.planning/phases/63.1-gemini-3-generate-reply-regression-fix/`
(context, research, per-plan SUMMARY, UAT, phase rollup).

### Phase 63.2 — LiveKit SDK patch upgrade 1.5.6 → 1.5.7 (hygiene + dry run)

**What shipped.** Pure patch-version bump in
`livekit-agent/pyproject.toml`: all four livekit-* pins moved from
`==1.5.6` to `==1.5.7` (released 2026-04-30). Zero `src/` files
modified — the audit-driven D-05 zero-forced-edits thesis held.

**Upstream contents of 1.5.7 (per PyPI release notes):**

1. `fix(gemini live): use parameters instead of parameters_json_schema for raw schema function tools`
2. `fix: realtime reply generation after interruption`

**Why neither fix forced a code edit (2026-05-05 audit).** Fix #1
does not apply: all four `@function_tool(raw_schema=...)` call sites
(`book_appointment.py:251`, `check_slot.py:70`, `check_day.py:53`,
`next_available_days.py:43`) already use the standard JSON Schema
`parameters` key; zero references to `parameters_json_schema` exist
in `src/`. Fix #2 has no code dependency: the agent has no custom
interruption-recovery path — only one `@session.on("agent_false_interruption")`
diagnostic log handler at `src/agent.py:582-586`. Reply-after-
interruption is fully delegated to Gemini server VAD + the SDK's
internal handling.

**Honest framing.** This is a **hygiene patch bump**, not a behavior
fix. Motivations: (a) staying current with upstream patch fixes for
bug-class reduction we don't yet know about, (b) dry-run muscle-
memory before the next material upgrade. The SegmentSynchronizer
cutoff race (`_SegmentSynchronizerImpl.playback_finished called
before text/audio input is done`) and the `server cancelled tool
calls` warnings remain byte-identical at 1.5.7 — tracked separately
for a future phase, NOT this one's scope.

**Branch + merge protocol (D-02 / D-10).** Cut feature branch
`phase-63.2-livekit-1.5.7` from `livekit-agent/main` tip
(`187d207`), single-commit pin bump (`8850b4f`), Railway preview
green + one UAT call to `+14783755631` (SG tenant `+65XXXXXXXX`)
booking confirmed end-to-end with `check_availability` →
`book_appointment` → Google Calendar event. User issued `merge`
verdict; merged via `--no-ff` to `livekit-agent/main` as commit
`d3b1f0a` (`fix(63.2): merge 1.5.7 patch upgrade`). All 12 D-04
preserved SHAs (Phase 60.4 + 63 + 63.1 + Phase-64-revert) verified
present on post-merge main.

**Local preflight (Task 2).** Clean `pip uninstall` + `pip install
--no-cache-dir -e .` resolved all four packages from
`site-packages` (NOT a stale git-builds cache — Pitfall 3 mitigated
the same way Phase 63 did). RealtimeModel boot-smoke green; the
benign `'gemini-3.1-flash-live-preview' has limited mid-session
update support` capability-hint console line still fires at 1.5.7,
confirming PR #5413 capability routing remains active. Grep-guard
`tests/test_no_generate_reply_in_src.py` GREEN.

**Pytest deviation note.** Plan authored against expected baseline
"254 passed / 1 failed" (Phase 60.4 era). Actual at execute time
was "9 failed, 284 passed, 2 collection errors" — drift caused by
codebase advancing through Phase 61 / 61.1 / Phase 64-revert
between plan-authoring (2026-05-05) and execute. Executor verified
all 9 failures + 2 collection errors are pre-existing on the 1.5.6
baseline by rolling the venv back to 1.5.6 and re-running the same
five test files; identical failures. None are 1.5.7-induced.
Pre-existing baseline failures logged to `deferred-items.md`
(Rule 1 scope-boundary path) — D-05, D-06, D-07 all hold.

**Commit (livekit-agent branch `phase-63.2-livekit-1.5.7` →
merged to `main` via `--no-ff` merge commit `d3b1f0a`):**

| SHA       | Plan | Message |
|-----------|------|---------|
| `8850b4f` | 01   | `fix(63.2): bump livekit-* pins to 1.5.7 patch release` |
| `d3b1f0a` | 01   | `fix(63.2): merge 1.5.7 patch upgrade` (--no-ff, preserves all 12 D-04 SHAs) |

**Pyproject.toml comment block at 1.5.7 (lines 7-12):**

```toml
# Pinned at 1.5.7 (2026-04-30) — patch bump on top of Phase 63's 1.5.6 mainline.
# 1.5.7 picks up: gemini-live raw-schema parameters fix + realtime reply-after-interruption fix.
# See .planning/phases/63.2-livekit-sdk-patch-1-5-7/63.2-CONTEXT.md (audit confirms neither fix forces src/ edits in this stack).
"livekit-agents==1.5.7",
"livekit-plugins-google==1.5.7",
"livekit-plugins-silero==1.5.7",
"livekit-plugins-turn-detector==1.5.7",
```

**Hygiene-bump pattern established for future patch releases.**
Single-commit pin-only branch, ~30-min checkpoint cycle, Railway
preview gate, one UAT call before `--no-ff` merge. The pattern is
valid for any future patch (1.5.8, 1.5.9) where upstream changelog
inspection + `src/` audit shows zero forced edits. If any future
patch *does* force a code edit, the branch grows scope or splits
into a follow-up — this branch's thesis stays "pure pin bump".

**Date.** Merged 2026-05-05.

**Plan 63.2-01 full documentation** — see
`.planning/phases/63.2-livekit-sdk-patch-1-5-7/`
(context, plan, HUMAN-UAT, per-plan SUMMARY, phase rollup).

---
