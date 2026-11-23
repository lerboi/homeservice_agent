---
name: Directive prompt + silence license causes deadlock
description: When designing CRITICAL RULE prompt sections for LiveKit + Gemini 3.1 Flash Live, never license silence as a safe fallback in a section that governs an information-gathering loop — the model selects silence and the conversation deadlocks. Phase 61 production regression captured the pattern.
type: feedback
originSessionId: ded7e1b1-2ead-4d13-9a60-0f2654e3d41e
---
# Feedback: Directive Prompt + Silence License Causes Deadlock

**When designing prompt CRITICAL RULE sections for LiveKit + Gemini 3.1
Flash Live (and likely other realtime models), do NOT include "silence
is always acceptable" as an escape hatch in a section that governs an
information-gathering loop. The model selects silence as the safe path
and the conversation deadlocks.**

## The trap (Phase 61 production regression, 2026-05-05)

Phase 61 Plan 04 shipped a `_build_address_validation_section` CRITICAL
RULE that:

1. Prohibited 6 verbatim phrases unless the immediately-preceding tool
   return contained `verdict=validated` or `verdict=validated_with_corrections`.
2. Framed violation as "the worst failure mode in this section."
3. Explicitly licensed silence: *"Silence or a neutral readback is
   always acceptable; false confirmation is not."*

Meanwhile the `book_appointment` tool description told the model to
"call this after the caller has acknowledged the name+address readback."

Result: chicken-and-egg deadlock during info-gathering.
- Agent must read back the address before invoking the tool.
- Rule flags any address-related utterance without a verdict as the
  worst failure.
- Validation only happens INSIDE the tool — there is no verdict yet.
- Silence is the only explicitly-licensed safe fallback.

The model takes the silence path. No tool invocation. No utterance.
First production call: 44 seconds of silence after caller's postal
code, CLIENT_INITIATED disconnect, `outcome=not_attempted`.

## The remediation (Phase 61.1)

1. **Scope the rule explicitly to the moment it governs.** Phase 61.1
   reframed the section to begin with "After book_appointment or
   capture_lead returns, this rule governs how you speak back what
   the tool found." Pre-tool readback is now explicitly licensed as
   the ordinary "I heard you say X, is that right?" exchange — NOT
   subject to the verdict prohibition.
2. **Remove the silence escape hatch.** The line was deleted entirely
   from both EN and ES. Silence in an info-gathering loop is the
   failure mode, not the remedy.
3. **Soften "worst failure mode" framing.** Now reads "after a tool
   return without the verdict to back them up is a serious failure"
   — qualified to the post-tool moment.
4. **Tool description disambiguation.** Both `book_appointment` and
   `capture_lead` descriptions now say the pre-tool readback is the
   ordinary acknowledgment exchange, not a "validated" claim.

## Pre-ship detection heuristics

When reviewing any prompt CRITICAL RULE block before ship, ask:

1. **Does this rule have an explicit silence license?** If yes — does
   the surrounding conversational moment require speech to make
   forward progress (e.g. info-gathering, readback, acknowledgment)?
   If yes — the silence license will deadlock. Remove it.
2. **What conversational moment does this rule govern?** If the
   answer is "the entire turn" or "the entire conversation," the
   scope is too broad. Re-scope to a specific moment (e.g. "after
   tool X returns," "before tool Y is invoked," "during the
   greeting"). The model needs to know WHEN to apply the rule.
3. **Does the rule create a chicken-and-egg with another section
   or a tool description?** Trace every other section AND every
   tool description for state preconditions on the same surface.
   In Phase 61, the verdict prohibition (rule) and the readback
   acknowledgment (tool description) deadlocked at the seam.
4. **Test the rule with a placed UAT call BEFORE shipping** — pure
   prompt-test invariants are necessary but NOT sufficient. The
   Phase 61 Plan 04 had 14 GREEN tests and still deadlocked
   production. The deadlock was a behavioral interaction not
   captured by any single-section invariant.

## Cross-references

- See `feedback_livekit_prompt_philosophy.md` — general philosophy
  (outcome-based, SDK-matched, non-directive).
- See `feedback_deep_verify_before_fix.md` — the trace-every-writer/
  reader rule that catches cross-section deadlocks before ship.
- See `reference_livekit_generate_reply_gemini31.md` — orthogonal
  silence-trap (SDK bug, not prompt-induced).
- Source: `.planning/phases/61.1-phase-61-production-regressions-address-validation-rule-dead/61.1-INCIDENT.md`.
