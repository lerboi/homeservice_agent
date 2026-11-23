---
type: system
system: Voice Agent
status: current
description: "Phase 61 shipped to production on 2026-05-03 (Plan 04 GREEN, sibling commit Covers: What changed in Phase 61.1; New / updated test invariants; Lesson learned"
source: .claude/skills/voice-call-architecture/SKILL.md § Phase 61.1 — Address-Validation Rule Deadlock Fix + WR-01/02/03 Closeout
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# Phase 61.1 - Address-Validation Rule Deadlock Fix + WR-01 02 03 Closeout

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

Phase 61 shipped to production on 2026-05-03 (Plan 04 GREEN, sibling commit
`590669f`). The first production call after ship (call AJ_ZhhHTywMieAi,
2026-05-05 07:09 UTC, tenant "make it ai", caller +65XXXXXXXX) deadlocked
the agent for 44 seconds after the caller spoke their postal code, ending
in CLIENT_INITIATED disconnect with `outcome=not_attempted`. Diagnosis:
the new `_build_address_validation_section` CRITICAL RULE plus its
explicit "Silence is always acceptable" escape hatch caused a
chicken-and-egg deadlock — the agent had to read back the address to get
acknowledgment before invoking the tool, but the rule flagged any
address-related utterance without a verdict as the worst possible failure,
and silence was the only explicitly-licensed safe fallback. Phase 61.1
fixed this regression and closed the three advisory warnings from
`61-REVIEW.md` (WR-01, WR-02, WR-03).

### What changed in Phase 61.1

- **Prompt reframe (Plan 01):** `_build_address_validation_section`
  EN+ES rewritten so the CRITICAL RULE governs ONLY post-tool speech.
  Pre-tool readback is now explicitly licensed via the substrings
  `After book_appointment or capture_lead returns` (EN) /
  `Después de que book_appointment o capture_lead retorne` (ES),
  paired with `read back what the caller said` (EN) /
  `repita lo que el llamante dijo` (ES). The "Silence or a neutral
  readback is always acceptable" line was REMOVED — the model was
  selecting it as the safe path and breaking the conversation. The
  "worst failure mode in this section" framing was qualified to apply
  only after a tool return. Anti-hallucination guarantee for post-tool
  speech (the original D-E3 invariant) is preserved.

- **Tool descriptions (Plan 01):** `book_appointment.py` description
  changed from `the caller has acknowledged the name+address readback`
  to `the caller has acknowledged the address you heard back from them
  — that pre-tool readback is the ordinary 'I heard you say X, is that
  right?' exchange, not a 'validated' claim`. `capture_lead.py`
  description changed symmetrically. Both stay under the 1024-char
  Pitfall A6 budget.

- **WR-01 fix (Plan 02):** `validate_address_bounded` now skips the
  `gmaps_validate_events` insert with an explicit warn log when
  `tenant_id` is falsy, instead of swallowing the NOT NULL constraint
  violation in a bare except. Restores D-C2' observability semantics
  for early/anonymous calls.

- **WR-02 fix (Plan 02):** `validate_address` short-circuits empty /
  whitespace-only `address_lines` to `verdict=error` BEFORE the HTTP
  call, preventing the 400 INVALID_ARGUMENT misclassification as
  `unsupported_region`. The bounded wrapper's Sentry-on-error gate
  (D-A3) now correctly fires for "we never captured an address" — was
  silently masked as a region-coverage problem.

- **WR-03 closeout (Plan 03):** `voice-call-architecture/SKILL.md` and
  `integrations-jobber-xero/SKILL.md` updated to accurately document
  both tool-return shapes (label form on success, STATE+DIRECTIVE on
  failure). Brittleness watch-item added (a future prompt rev keying
  on the `STATE:` prefix would silently drop the success paths).

### New / updated test invariants

- `tests/test_prompt_address_validation_rule.py::test_both_locales_pre_tool_readback_explicit`
  (replaces `test_both_locales_silence_acceptable`) locks all 8
  reframe substrings (4 must-be-present, 4 must-be-absent) at the
  test layer.
- `tests/test_google_maps.py::test_telemetry_skipped_when_tenant_id_none`
  + `test_telemetry_skipped_when_tenant_id_empty_string` lock WR-01.
- `tests/test_google_maps.py::test_empty_address_lines_short_circuits_to_error`
  + `test_whitespace_only_address_lines_short_circuits_to_error`
  + `test_empty_address_lines_triggers_sentry_via_wrapper` lock WR-02.

### Lesson learned

A directive CRITICAL RULE that explicitly licenses silence as a "safe
fallback" can deadlock the model under Gemini 3.1 Flash Live. The model
takes the safe path. The fix is two-pronged: (a) scope every CRITICAL
RULE explicitly to the conversational moment it governs (NOT the entire
turn, NOT the entire conversation), and (b) NEVER include "silence is
acceptable" as an escape hatch in a section that governs an
information-gathering loop — silence is the failure mode, not the
remedy. See user memory `feedback_directive_prompt_silence_deadlock.md`.

---
