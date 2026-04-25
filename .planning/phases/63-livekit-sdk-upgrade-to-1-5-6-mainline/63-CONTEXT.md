---
phase: 63
parent_phase: 60.4 (paused pending this phase)
status: ready-for-planning
created: 2026-04-24
source: conversational research (2026-04-24) — upstream package inventory + GitHub PR inspection; no /gsd:discuss-phase round run (all decisions locked inline during the research conversation that produced this phase).
---

# Phase 63: LiveKit SDK upgrade to 1.5.6 mainline — Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Pure dependency-version migration in `C:\Users\leheh\.Projects\livekit-agent\` (cross-repo — same workflow as Phases 60.2 / 60.3 / 60.4). Move off the abandoned experimental `livekit-plugins-google@43d3734` (branch `A2A_ONLY_MODELS`) onto the current mainline release pair `(livekit-agents==1.5.6, livekit-plugins-google==1.5.6)` released 2026-04-22. No feature additions. No prompt.py edits. No tool-signature changes. No dashboard / homeservice_agent-repo work.

**Why now, not deferred:** The current pin is a commit on a branch upstream rejected (PRs #5238/#5251/#5262 closed unmerged; upstream chose capability-based routing via `mutable_*` in PR #5413). No security fixes, Gemini-API tracking, or bug fixes will reach us there. Phase 60.4's remaining UAT plans (04/05/06) are blocked by the `_SegmentSynchronizerImpl.playback_finished text_done=false` race causing mid-speech cutoffs (UAT call `2xCyyKAduZiY`, 2026-04-23 18:54). Upgrading to mainline is the only path to fixes.

**Definition of "done":**
1. `livekit-agent/pyproject.toml` pins both packages at `==1.5.6`.
2. `src/agent.py` `RealtimeModel(...)` constructs successfully on boot — no `TypeError`, no `ValidationError`, no capability-mismatch boot crash.
3. Gemini 3.1 Flash Live (`gemini-3.1-flash-live-preview`) is the active model (verified in Railway log).
4. All 6 in-process tools (`check_availability`, `book_appointment`, `capture_lead`, `check_caller_history`, `check_customer_account`, `transfer_call`, `end_call`) still register and can be invoked by Gemini.
5. Existing Python test suite passes (`pytest`) — in particular `tests/test_slot_token_handoff.py` (16 tests) and the Stream A/B language/TZ tests shipped in Phase 60.4.
6. One UAT call on the SG tenant `+14783755631 / +6587528516` successfully completes a booking end-to-end (`check_availability` → `book_appointment` → Google Calendar event) without cutoff warnings.

**Out of scope — LOCKED:**
- No feature additions.
- No edits to `src/prompt.py`, `src/tools/*.py` (beyond what API changes force), or any homeservice_agent-repo file.
- No `_handle_tool_call_cancellation` monkeypatch — that's a separate phase even if the SDK upgrade doesn't fix it.
- No pre-TTS speech interception guardrail — separate phase.
- No UAT of Phase 60.4 Plans 04/05/06 — this phase's UAT is the Phase 63 smoke test only; 60.4 resume happens AFTER this ships.
- No downgrade path exploration ("what if we upgraded to 1.5.3 only?") — target is 1.5.6, the latest stable, because backing off to 1.5.3 just to avoid 1.5.4/1.5.5 changes buys nothing and leaves us behind future fixes.

</domain>

<decisions>
## Implementation Decisions

### D-01: Target pair — `(livekit-agents==1.5.6, livekit-plugins-google==1.5.6)`, released 2026-04-22.
Confirmed via PyPI lookup during conversational research (2026-04-24). `livekit-plugins-google` 1.5.6 declares `livekit-agents>=1.5.6` in its pyproject.toml — both must move together. No newer release exists as of 2026-04-24.

### D-02: Execute on a feature branch — never directly on `livekit-agent/main`.
Branch name: `phase-63-livekit-sdk-upgrade`. Merge to main only after:
(a) local `pytest` passes,
(b) one Railway preview deploy runs cleanly (agent boots, processes register, no `TypeError` at `RealtimeModel(...)` construction),
(c) one UAT call succeeds end-to-end.

**Rationale:** A boot-time breakage on `main` crash-loops the Railway service, taking the tenant's inbound number offline. The upgrade involves cross-package API changes where we cannot fully predict breaking surfaces. Branch-first is non-negotiable.

### D-03: Pure version bump, no opportunistic refactors.
`pyproject.toml` change is the only version edit. Any `src/agent.py` or `src/tools/*.py` edit is permitted ONLY if required to make the new API happy. No "while we're in here" cleanups, no tools refactor, no prompt edits, no telemetry additions.

**Rationale:** Mixing an SDK migration with a refactor makes rollback ambiguous when something breaks. Keep the diff tight; future refactors are future-phase work.

### D-04: Preserve all Phase 60.4 inline fixes that already shipped to livekit-agent/main.
The following commits are production-valid and must survive the migration unchanged:
- `c2482f8` — Plan 60.4-01 Stream A TZ hardening (Google Calendar `timeZone` field + UTC fallback + `_ensure_utc_iso` WARN). API-independent.
- `1df5223` — Plan 60.4-02 Stream B STT language pinning (`language=` kwarg on `RealtimeModel`). Kwarg MAY be renamed in 1.5.6 — if so, adjust; else preserve.
- `b46851b` — Slot-cache prefetch (`_run_db_queries` extended). Plugin-independent.
- `5e48273` — `slot_token` structural handoff (`check_availability` → `book_appointment` via `deps["_slot_tokens"]`). Plugin-independent.
- `e580f14` — Stripped hallucinated `slot_a1b2c3d4` example from docstring + added `_last_offered_token` fallback. Plugin-independent.
- `68828d7` — Gemini 3 sampling alignment: removed `temperature=0.3`, raised `thinking_level` to `"low"`, hoisted UNMISTAKABLE INVARIANT to IDENTITY section, added TOOL NARRATION rule 6 prohibiting specific-time filler. `ThinkingConfig` kwarg format may shift in 1.5.6 — verify during audit.
- `87d6883` — `voice_resolved` diagnostic log. Plain `logger.info`, independent.

No refactor of these fixes. If a 1.5.6 API change forces a signature update (e.g., `ThinkingConfig` moved), update the call site to preserve the same semantics — don't delete the fix.

### D-05: Verify (don't assume) the plugin's new surface for each kwarg we currently pass.
`src/agent.py` L375-L394 passes to `RealtimeModel(...)`:
- `model="gemini-3.1-flash-live-preview"` — verify accepted in 1.5.6 (PR #5233 merged 2026-03-27 says yes).
- `voice=voice_name` — voice name enum/string: verify unchanged.
- `language=_locale_to_bcp47(locale)` — verify kwarg name (may be `language_code`, `languages`, or similar on mainline).
- `instructions=system_prompt` — verify kwarg name (some plugin versions renamed to `system_instruction`).
- `realtime_input_config=RealtimeInputConfig(automatic_activity_detection=AutomaticActivityDetection(...))` — verify the config class still exists and kwarg names are preserved.
- `thinking_config=genai_types.ThinkingConfig(thinking_level="low", include_thoughts=False)` — verify ThinkingConfig import path and field names.

RESEARCH step: resolve all 6 kwargs against the 1.5.6 source before planning the code edits. Record any renames in PLAN and apply minimal edits.

### D-06: Verify the `function_tool` decorator and `RunContext` API have not changed.
All 6 tools in `src/tools/*.py` use `@function_tool(name=..., description=...)` and take `context: RunContext` as first arg. If either changed in 1.5.6, the entire tool layer breaks. Verify during RESEARCH.

### D-07: Verify `AgentSession(llm=model)` construction and `@session.on(...)` event signatures.
`src/agent.py` uses `AgentSession(llm=model)` at L389 and several `@session.on("conversation_item_added")` / `"error"` etc. event handlers. If session API changed, these all need updating. Verify during RESEARCH.

### D-08: Verify plugin imports.
Current code imports from `livekit.plugins.google.realtime` (`google.realtime.RealtimeModel`) and `google.genai.types` for `ThinkingConfig`, `RealtimeInputConfig`, etc. Confirm both are the recommended import paths on 1.5.6. If moved, rewrite imports.

### D-09: Must-pass acceptance gates on the phase-63 branch, before merging to livekit-agent/main.
1. `pytest tests/` — zero failures (tolerating the pre-existing VIP test failure flagged in memory note `project_vip_caller_routing.md`).
2. `python -c "from src.agent import entrypoint"` — imports cleanly.
3. Local `python -c "from src.prompt import build_system_prompt; p = build_system_prompt(...); print(len(p))"` — prompt still renders.
4. Railway preview deploy SUCCESS (not FAILED).
5. Agent registers with LiveKit (`registered worker` log line).
6. One UAT call on `+14783755631` completes: greeting plays, `check_availability` fires and returns STATE line, `book_appointment` fires (or hits the no-match case cleanly), agent ends call.
7. No `TypeError`, `ValidationError`, or `AttributeError` in Railway logs for that call.
8. Zero `_SegmentSynchronizerImpl.playback_finished called before text/audio input is done` warnings in the call's logs — **this is the HOPE gate**; if it still fires, the upgrade succeeded but we didn't get the cutoff fix (still a valid outcome; 60.4 resume on the new base, and a follow-up investigation phase handles the cutoff).

### D-10: Rollback plan.
`git checkout main && git push origin main --force-with-lease` is NOT the rollback. Proper rollback = merge a revert PR that restores the 1.5.1 / 43d3734 pins and the pre-upgrade `agent.py` code. Branch tip to revert to: current `livekit-agent/main` HEAD (= commit `87d6883` at the time of writing). If Railway preview fails, abort the branch and do not merge. If Railway preview passes but UAT fails, revert in a separate PR; do not leave a broken main.

### D-11: Cross-repo handoff — only touches `livekit-agent/`.
All work in `C:\Users\leheh\.Projects\livekit-agent\`. No files in `C:\Users\leheh\.Projects\homeservice_agent\` change EXCEPT `.planning/phases/63-*` artifacts (PLAN.md, RESEARCH.md, SUMMARY.md, etc.) and `.planning/ROADMAP.md` / `.planning/STATE.md` on phase close. GSD `sub_repos: []` is unchanged — handle manually per HANDOFF-doc convention.

### D-12: Commit discipline.
livekit-agent commits use `--no-verify` per memory note `project_phase_60_4_paused.md`. Message prefix: `fix(63):` for code changes, `docs(63):` for artifacts. Single atomic commit for the version bump + required API edits (or split if the edit is substantial — researcher's call).

### D-13: `_handle_tool_call_cancellation` noop stays noop — out of scope for 63.
Even if the plugin in 1.5.6 still has the noop cancellation handler, do not monkeypatch here. If the `text_done=false` race persists after the upgrade, a separate follow-up phase owns that work.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Upstream sources

- GitHub: `livekit/agents` repo — https://github.com/livekit/agents. Plugin lives at `livekit-plugins/livekit-plugins-google/`.
- GitHub release tags: `livekit-agents@1.5.6` and `livekit-plugins-google@1.5.6` — https://github.com/livekit/agents/releases
- PR #5233 — initial `gemini-3.1-flash-live-preview` support (merged 2026-03-27, shipped 1.5.2).
- PR #5413 — **critical** tool-response fix for Gemini 3.1 using `mutable_*` capability guards (merged 2026-04-11, shipped 1.5.3). This is the fix we most want.
- PR #5286 — `generate_reply` warning for Gemini 3.1 (merged 2026-03-31, shipped 1.5.2).
- Abandoned / closed PRs (do NOT revive): #5238, #5251, #5262 (the `A2A_ONLY_MODELS` frozenset approach).

### Files we currently maintain in livekit-agent — must still work after upgrade

- `livekit-agent/src/agent.py` — tenant lookup, customer-context fetch, `RealtimeModel` construction (L375-L394), `AgentSession`, event handlers, `_run_db_queries`, `_slot_cache` prefetch, `voice_resolved` log line.
- `livekit-agent/src/prompt.py` — `build_system_prompt` and all `_build_*_section` builders. **Not touched in this phase** but must keep rendering.
- `livekit-agent/src/tools/check_availability.py` — `@function_tool` signature, slot_token registration, STATE+DIRECTIVE return.
- `livekit-agent/src/tools/book_appointment.py` — slot_token resolution, `_last_offered_token` fallback, legacy ISO path, `_ensure_utc_iso`.
- `livekit-agent/src/tools/end_call.py`, `capture_lead.py`, `check_caller_history.py`, `check_customer_account.py`, `transfer_call.py` — all still need to register.
- `livekit-agent/pyproject.toml` — dependency pins change here.
- `livekit-agent/tests/test_slot_token_handoff.py` — 16 tests, must still pass.

### Research inputs from conversation (2026-04-24, pre-phase-creation)

- Conversational research agent returned: latest pair is 1.5.6 + 1.5.6, released 2026-04-22; `gemini-3.1-flash-live-preview` supported since 1.5.2; critical tool fix in 1.5.3; `per_response_tool_choice` 7-field blocker was a misread (not required).
- Conversational research also confirmed no released fix for `_SegmentSynchronizerImpl.playback_finished text_done=false`. Hope-gate only; if it's still broken after upgrade, we still want the other fixes.

### Memory-note invariants (from user's auto-memory)

- `feedback_livekit_prompt_philosophy.md` — LiveKit prompts are outcome-based, not directive. Phase 63 doesn't touch prompt.py, but any incidental prompt-builder change must honor this.
- `reference_livekit_session_say_no_tts.md` — `session.say()` fails on `AgentSession(llm=RealtimeModel)` without TTS on 1.5.1. Verify whether this changes on 1.5.6. If it does NOT, the memory note stays valid. If it DOES (unlikely — architectural), update the memory.
- `feedback_deep_verify_before_fix.md` — trace writer/reader impact before proposing a fix.

</canonical_refs>

<specifics>
## Specific Ideas

- The `pyproject.toml` change is trivial; the meaningful engineering is the kwarg audit.
- Start RESEARCH by cloning the 1.5.6 tag and `grep -rn "class RealtimeModel"` + `grep -rn "def __init__"` on the google plugin to read the real construction surface. Don't trust release notes alone.
- Check `livekit-plugins-google@1.5.6/livekit/plugins/google/realtime/realtime_api.py` for `_SegmentSynchronizerImpl` — if the class is still there with the same failure path, the cutoff issue is unfixed at 1.5.6 and we document that finding.
- `pytest` locally BEFORE pushing to the branch; catches boot-time TypeErrors early.
- Railway preview: push to branch, wait for deploy status. If SUCCESS, monitor logs for `registered worker` line before placing a UAT call.
</specifics>

<deferred>
## Deferred Ideas (explicitly NOT Phase 63)

- **Tool-call cancellation recovery.** `_handle_tool_call_cancellation` is a noop upstream. If 1.5.6 still has it as a noop, a follow-up phase monkeypatches / subclasses it with a recovery `generate_reply`. Not here.
- **Pre-TTS speech interception guardrail.** Blocks outcome-word speech when no tool result returned in the same turn. Wave 2b in the earlier conversation. Separate phase (possibly 64) after Phase 63 + 60.4 resume ship.
- **Filler-loop circuit breaker.** Track same-STATE-returned count; at ≥3, force `transfer_call`. Future production-readiness phase.
- **Save-time config validation.** Dashboard-side `working_hours` / `tenant_timezone` / `slot_duration_mins` validators. Dashboard-repo work, not livekit-agent.
- **Synthetic canary calls.** Nightly scripted call per tenant. Infrastructure phase.

</deferred>

---

*Phase: 63-livekit-sdk-upgrade-to-1-5-6-mainline*
*Context written: 2026-04-24, derived inline from conversational research rather than /gsd:discuss-phase — all 13 decisions locked above are the same ones discussed with the user in-session and confirmed proceed.*
