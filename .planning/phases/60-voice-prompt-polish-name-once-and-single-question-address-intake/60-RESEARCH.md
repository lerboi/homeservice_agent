# Phase 60: Voice prompt polish — name-once + single-question address intake — Research

**Researched:** 2026-04-19
**Domain:** Prompt engineering for a Gemini 3.1 Flash Live realtime-audio receptionist (LiveKit agent, Railway deployment)
**Confidence:** HIGH (prompt structure, tool-return semantics, Spanish surface — all confirmed from shipped Phase 30 summaries + `voice-call-architecture` SKILL.md); MEDIUM on external "name vocative" academic literature (none found at the Gemini-Flash-Live tier; reasoning is grounded in the pinned-stack's documented behavior).

## Summary

Phase 60 is a **surgical prompt-engineering phase** against the `livekit_agent/` Python repo (Railway). It does not touch the Next.js codebase except to update the `voice-call-architecture` skill file at phase tail. The two behavior changes (name-vocative suppression; single-question address opener) and one structural pass (light audit + tool-return rewrite to state+directive format) are all prompt-only — tool *signatures* and *behavior* are unchanged.

The existing Phase 30 prompt structure is **well-suited as a substrate**. Phase 30 already established the canonical patterns Phase 60 relies on: `OUTCOME WORDS — CRITICAL RULE`, `TOOL NARRATION — CRITICAL RULE`, `CORRECTIONS` (with the "caller's correction is ALWAYS correct" phrasing), and `INFO GATHERING` with ordered flexibility. The skill documents that the current prompt already instructs the AI to adapt to whatever the caller volunteers first — Phase 60 tightens this into a single-question opener rather than rewriting the mental model. Similarly, the "silent context" discipline proven on `check_caller_history` (look up, use silently, never mention) is the same discipline Phase 60 applies to the captured name.

The **tool-return rewrite (D-16) is the highest-leverage intervention** in the phase. The SKILL.md notes multiple prior fixes to return strings where Gemini read them verbatim ("parrot loop") — e.g. the `check_availability` return leaking earliest/latest times that the AI then mined to fabricate specific slots. Rewriting every tool return to strict `state + directive` format (no speakable English, no invitations to read aloud) closes this class of bug across all 5 tools in one pass.

**Primary recommendation:** Treat Phase 60 as three sequenced commits: (1) `prompt.py` edits for name-vocative + single-question address (Change A + B), (2) `tools/*.py` return-string rewrites to state+directive format (D-16), (3) `es.json` mirror + skill file update. Keep Phase 30's section ordering intact; add surgical lines, do not refactor.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Name vocative rules**
- **D-01:** Default rule — AI does **not** use the caller's name vocatively during the call ("Thanks, Jia En" / "Okay Jia En" is prohibited). Name is captured early per the existing required-before-tools rule and stored silently.
- **D-02:** Authoritative readback — AI reads the name back exactly **once**, at booking confirmation, together with the address, immediately before `book_appointment` fires. Required on every booking (no conditional skip) unless the caller never provided a name (see D-04).
- **D-03:** Caller-requested override — if the caller explicitly invites name use (e.g., "please call me Jia En", "you can call me X", "I go by Y"), the AI **may** use the name naturally for the rest of the call. Rule is outcome-framed; the prompt does **not** enumerate trigger phrases.
- **D-04:** No name captured — if the caller refuses or the model can't capture a name, the AI proceeds without. The name portion of the readback is skipped; the DB stores empty/null. Booking is **not** blocked.
- **D-05:** Low-confidence pronunciation — no special branch. Standard readback; the existing `CORRECTIONS` rule handles mispronunciations. Do not add extra verification lines for spelled-out names.

**Address intake (single-question framing)**
- **D-06:** Opening question — "What's the address where you need the service?" (verbatim or very close). Single open question replaces the current three-part walkthrough.
- **D-07:** Incomplete openings — AI extracts whatever the caller volunteered (postal area, street, unit, etc.) and asks exactly **one** targeted follow-up for the specific missing piece. No mechanical three-part walkthrough. Loop one piece at a time until enough to validate.
- **D-08:** Minimum capture — outcome-framed rule: "capture enough for us to find the place." Prompt does **not** enumerate a rigid field list. The downstream Phase 61 validator (Google Maps) defines what "enough" is in practice (typically street + postal; unit optional).

**Booking readback and corrections**
- **D-09:** Corrections protocol — rely on the existing Phase 30 `CORRECTIONS` rule ("the caller's correction is ALWAYS correct"). Add one line to the readback section: "If the caller corrects any part of the readback, accept the correction and re-read the corrected full address." No new corrections framework.
- **D-10:** Post-correction behavior — after accepting a correction, AI re-reads the **corrected full address** before proceeding to book. If the caller corrects again, loop (accept → re-read full) until the caller stops correcting. Same rule applies to name corrections during the readback.

**capture_lead tool parity (decline path)**
- **D-11:** capture_lead description — update the tool description string so Gemini reads the same single-question intake rules on the decline path as on the booking path. Tool signature and behavior are **unchanged**.
- **D-12:** capture_lead readback — same single-authoritative-readback rule as booking: name + address read back once before `capture_lead` fires. Decline path reaches parity with booking path for verification.

**Spanish (es.json) parity**
- **D-13:** Spanish mirror — D-01 through D-12 are applied to the Spanish prompt surface (`messages/es.json`). Same rules, localized phrasing. No rule is dropped or diluted for Spanish.
- **D-14:** Authoring — Claude drafts the Spanish phrasings; user reviews before commit. No machine translation without review.

**Structural pass**
- **D-15:** Scope — **light audit**. Verify (a) anti-hallucination rules (`OUTCOME WORDS — CRITICAL RULE`, `TOOL NARRATION — CRITICAL RULE`) still sit near the top of the prompt, (b) no VAD-redundant guidance ("let the caller finish", "don't talk over") has crept back in, (c) the configured persona tone still reads as distinct (Zephyr/Aoede/Achird). Fix inline **only** if something is clearly broken; otherwise leave the Phase 30 structure alone.
- **D-16:** Tool-return strings — rewrite **all** tool returns across `livekit_agent/src/tools/*.py` (`book_appointment`, `capture_lead`, `transfer_call`, `check_availability`, `check_caller_history`, plus any others) to strict state+directive format. No natural-English confirmations that invite the parrot loop where Gemini skips the tool and speaks the string directly.

### Claude's Discretion
- Exact wording of every prompt section (outcome-framed rules, not scripts).
- Specific Spanish phrasings (user reviews before commit — D-14).
- Where and how to encode "capture enough for us to find the place" without enumerating fields (D-08).
- Exact form of the one-line correction instruction added to the readback section (D-09).
- Whether the tool-return rewrite (D-16) is one commit or one commit per tool file.
- Exact on-air utterance for the readback (e.g., order of name vs. address, contraction style) — as long as it honors D-01, D-02, D-12.

### Deferred Ideas (OUT OF SCOPE)
- **Travel buffer / zone detection using Phase 61's lat/lng** — acknowledged as a secondary benefit of Phase 61 but delivered in a later phase. Not Phase 60's concern.
- **Full tool-signature parity between `book_appointment` and `capture_lead`** — D-11 and D-12 reach description-level parity only. Signature alignment (same fields, same shapes) is a larger refactor deferred to a future phase.
- **Configurable "use vocative by default" tenant setting** — a tenant might want to preserve the current vocative style. Out of scope for Phase 60; revisit if tenant feedback requests it.
- **Voice sample-based pronunciation feedback loop** — using caller audio to correct pronunciation before readback. Speculative; out of scope.
- **Dashboard surface for the prompt behavior changes** — no dashboard UI changes in Phase 60. If tenant-facing copy needs to reflect the new "we'll confirm once at booking" behavior, that's a marketing/docs update, not a phase item.
- **Retell-era prompt files** (`C:/Users/leheh/.Projects/Retell-ws-server/agent-prompt.js`) — Phase 30 was on the Retell stack; Phase 60 is on Gemini/LiveKit. No action needed on the old Retell prompt.

---

## Project Constraints (from CLAUDE.md)

- **Brand is Voco.** Not HomeService AI. Fallback email domains use `voco.live`. Applies to any string the AI might speak.
- **Keep skills in sync.** Before modifying code covered by a skill, read the skill; after changes, update the skill. Phase 60 touches the voice system — `.claude/skills/voice-call-architecture/SKILL.md` **must** be updated at phase tail. This is a locked deliverable, not optional. [CITED: CLAUDE.md §Rules]
- Skill-file location: `.claude/skills/voice-call-architecture/SKILL.md` (uppercase).
- Tech stack for the voice system: Twilio SIP + LiveKit + Gemini 3.1 Flash Live (Python agent on Railway). Confirmed in SKILL.md line 22.

---

## Phase Requirements

CONTEXT.md states explicitly: "no REQ-IDs map to this phase; CONTEXT decisions serve as the requirement set." The traceability row in REQUIREMENTS.md for Phase 60 is absent; decisions D-01..D-16 are the canonical requirement set. The planner should map each plan-level task to one or more D-XX IDs.

| ID | Description | Research Support |
|----|-------------|------------------|
| D-01..D-05 | Name-vocative suppression + readback-once behavior | Substrate: Phase 30's `INFO GATHERING` NAMES subsection (capture + cultural awareness); `CORRECTIONS` rule covers D-05. Change A is an additive rule, not a rewrite. |
| D-06..D-08 | Single-question address opener + outcome-framed minimum fields | Substrate: Phase 30's INFO GATHERING already says "order is NOT forced — adapts to whatever the caller volunteers first" (SKILL.md §4 section 8, line 364). D-06 formalizes the opener; D-07/D-08 remove the enumerated three-field list. |
| D-09, D-10 | Corrections-during-readback one-liner | Substrate: Phase 30 `CORRECTIONS` is already a top-level section (SKILL.md §4 section 3). D-09 adds one reinforcing line inside the booking-readback block, not a new section. |
| D-11, D-12 | capture_lead description + readback parity with booking | capture_lead is a separately registered tool (`src/tools/capture_lead.py`, SKILL.md §5); its description string is the enforcement surface on the decline path. |
| D-13, D-14 | Spanish `messages/es.json` mirror with user review | `src/messages/es.json` exists and mirrors en.json at the `agent.*` + `notifications.*` key level (SKILL.md §4 end). |
| D-15 | Light structural audit; verify anti-hallucination + no VAD-redundant lines | Phase 30 Plan 02 summary confirms the structure shipped; SKILL.md §4 §2 confirms VAD-redundant lines were already stripped. Re-verification, not rewrite. |
| D-16 | Rewrite all tool-return strings to state+directive format | SKILL.md §5 documents per-tool returns; §1 line 10 documents the prior parrot-loop fix on `check_availability`. D-16 generalizes that fix across all 5 tools. |

---

## Standard Stack

This is a **prompt-engineering phase on a pinned stack**. No libraries are added or upgraded. The "stack" is the locked versions of the voice-agent runtime.

### Core (DO NOT REGRESS — pinned)

| Component | Version | Purpose | Why Pinned |
|-----------|---------|---------|------------|
| `livekit-agents` | `==1.5.1` | Agent framework (AgentSession, Agent, WorkerOptions, cli) | [VERIFIED: SKILL.md §1 line 183] 1.5.2 added a required 7th `per_response_tool_choice` field to `RealtimeCapabilities`; the pinned Gemini plugin constructs with 6 and TypeErrors on 1.5.2. |
| `livekit-plugins-google` | git `43d3734` | Gemini 3.1 Flash Live `RealtimeModel` + `send_realtime_input` A2A branch | [VERIFIED: SKILL.md §1 lines 194-202] ONLY version that supports `session.generate_reply()` with `gemini-3.1-flash-live-preview`. PyPI 1.5.2+ raises `RealtimeError` for this model. |
| `livekit-plugins-silero` | `==1.5.1` | ML model dep (download-files only) | [VERIFIED: SKILL.md §1 line 200] Monorepo sibling of livekit-agents; 1.5.2 wheel declares `livekit-agents>=1.5.2` so must be pinned in lockstep. |
| `livekit-plugins-turn-detector` | `==1.5.1` | ML model dep | Same lockstep rationale. |
| `gemini-3.1-flash-live-preview` | (via Google API) | Realtime audio-to-audio model | Native audio-to-audio; no separate STT/TTS. Server VAD owns turn-taking. |

### Supporting (relevant to Phase 60's scope)

| Component | Role in Phase 60 | Notes |
|-----------|------------------|-------|
| `messages/en.json` + `messages/es.json` | Templated strings the AI may utter | Two top-level keys: `agent.*` (recording_disclosure, language_clarification, capture_name, etc.) and `notifications.*` (booking_confirmation, recovery_sms_*). [VERIFIED: SKILL.md §4 end] |
| `build_system_prompt(...)` | Central assembly function | Signature: `(locale, *, business_name, onboarding_complete, tone_preset, intake_questions, country, working_hours, tenant_timezone)` — [VERIFIED: SKILL.md §4 line 351] |

### Alternatives Considered

| Instead of | Could Use | Why Not |
|------------|-----------|---------|
| Prompt-only enforcement of "no vocative" | SDK-level constraint | Pinned stack has no `per_response_tool_choice` and no output-token filtering. Prompt is the **only** surface. [CITED: CONTEXT.md code_context] |
| Rewriting INFO GATHERING from scratch | Leave Phase 30 structure intact | D-15 explicitly requires **light audit only**; rewrite invites regression across unrelated sections. |
| Script-style rules ("say exactly: 'What's the address...'") | Outcome-framed rules | SKILL.md §10 + Phase 30 patterns consistently favor outcome-framed ("capture enough to find the place") over scripts. Gemini adapts better. |

**Installation:** N/A — no dependency changes in this phase. Do not add packages. Do not bump pins. Any diff to `pyproject.toml` is out-of-scope and must be rejected during plan review.

**Version verification:** All pins already shipped in production (Phase 55 UAT + backlog 999.2 resolved, 2026-04-18) — [VERIFIED: STATE.md]. No `npm view` / `pip index` checks needed; Phase 60 changes no dependencies.

---

## Architecture Patterns

### Recommended File-Level Structure (unchanged from Phase 30)

```
livekit_agent/                              # separate Railway-deployed repo (NOT in this Next.js repo)
├── src/
│   ├── prompt.py                           # <-- primary change surface (Change A + B + D-15 audit)
│   │   ├── build_system_prompt(...)        #     assembly; do not rewrite
│   │   ├── _build_identity_section         #     D-15 audit: persona still distinct
│   │   ├── _build_voice_behavior_section   #     D-15 audit: no VAD-redundant lines
│   │   ├── _build_corrections_section      #     Phase 30 section; D-09/D-10 reinforces here
│   │   ├── _build_opening_section          #     unchanged
│   │   ├── _build_info_gathering_section   #     <-- Change A (D-01..D-05) + Change B (D-06..D-08) land here (~L295-337)
│   │   └── _build_booking_section          #     <-- D-02 readback phrasing + D-09 correction line
│   ├── tools/
│   │   ├── book_appointment.py             # <-- D-16 return rewrite + readback alignment in description
│   │   ├── capture_lead.py                 # <-- D-11 description + D-12 readback + D-16 return
│   │   ├── transfer_call.py                # <-- D-16 return only
│   │   ├── check_availability.py           # <-- D-16 return only (partial rewrite already shipped; audit + tighten)
│   │   └── check_caller_history.py         # <-- D-16 return only
│   └── messages/
│       ├── en.json                         # <-- any templated strings referenced by changed prompt sections
│       └── es.json                         # <-- D-13 mirror; D-14 requires user review

.claude/skills/voice-call-architecture/SKILL.md   # <-- update at phase tail per CLAUDE.md + D-15 context
```

### Pattern 1: Additive surgical edits, not section rewrites
**What:** Add lines to existing Phase 30 sections rather than rewriting the section.
**When to use:** Whenever a decision ID reinforces an existing Phase 30 section (D-05, D-09, D-10 all reinforce `CORRECTIONS`).
**Why:** The audio-attention budget for Gemini is finite; Phase 30's section order was tuned across multiple UAT cycles. Rewriting risks losing attention weight on rules that are already landing correctly (e.g. urgency suppression, "never read out times for vague windows").

**Example (D-09 one-line addition to booking readback):**
```
# Before (Phase 30)
AFTER BOOKING: confirm full details, ask if anything else before wrapping.

# After (Phase 60)
BEFORE BOOKING: read back the caller's name (if captured) and full service address in one utterance, then wait.
If the caller corrects any part, accept the correction and re-read the corrected full line before calling the tool.
AFTER BOOKING: confirm full details, ask if anything else before wrapping.
```

### Pattern 2: Outcome-framed rules, never scripts
**What:** Tell the AI the *outcome* it must produce, not the words to produce it.
**When to use:** Every rule in D-01 through D-12.
**Why:** [VERIFIED: CONTEXT.md code_context + SKILL.md §10] — Gemini 3.1 adapts better to "capture enough for us to find the place" than to an enumerated field list; same for "do not address the caller by name" vs. "never say 'Thanks, [name]'".

**Example (D-01):**
```
# Bad (script-like, exhaustively enumerates surface forms)
Do not say "Thanks, [name]", "Okay [name]", "Alright [name]", "Got it, [name]", ...

# Good (outcome-framed)
Do not address the caller by name during the call. The single exception is the booking readback
(or if the caller explicitly invites name use — see override rule below).
```

### Pattern 3: Tool returns as strict state+directive strings
**What:** Tool returns are **machine-readable status codes + instructions to the AI**, never natural English.
**When to use:** Every tool return (D-16 applies to all 5).
**Why:** [VERIFIED: SKILL.md §1 line 10] — the pre-fix `check_availability` return leaked "earliest slot at 9 AM, latest at 5 PM" and Gemini spoke it verbatim to fabricate times. The canonical fix is to return `"STATE: available | DIRECTIVE: confirm the slot with the caller and call book_appointment"` (model-facing, not caller-facing).

**Example (D-16, book_appointment success):**
```python
# Bad (parrot-loop bait)
return f"Booked! The appointment is confirmed for Thursday at 2 PM at 123 Main Street."

# Good (state + directive)
return (
    "STATE: booking_succeeded | "
    "DIRECTIVE: confirm verbally to the caller using the name and address you already read back; "
    "then ask if there is anything else before ending the call. "
    "Do not restate times from this message — use the readback you already spoke."
)
```

### Pattern 4: Silent-context discipline for captured fields
**What:** A field the AI has captured (name, prior history) may be used for tool parameters and readback, but **must not** be surfaced mid-utterance.
**When to use:** Name (D-01), repeat-caller history (already established for `check_caller_history`).
**Why:** [VERIFIED: SKILL.md §5 `check_caller_history` + §10 "Silent repeat caller context"] — Voco has a shipped precedent for this pattern. D-01 is an extension, not a new paradigm.

### Anti-Patterns to Avoid

- **Adding VAD-redundant guidance** — any line like "let the caller finish", "don't interrupt", "wait for them to stop talking" duplicates what the configured server VAD (LOW sens, 400ms prefix, 1000ms silence) already does. [VERIFIED: SKILL.md §3 lines 240-272] Wasted attention; D-15 audits for this.
- **Enumerating trigger phrases for the name-override (D-03)** — CONTEXT explicitly forbids this. Gemini generalizes better from "if the caller invites you to use their name" than from a list.
- **Enumerating the minimum address field set (D-08)** — same rationale. The Phase 61 Google Maps validator defines "enough" empirically (typically street + postal; unit optional). The prompt must not lock in a field list that drifts from the validator.
- **Reinstating "Greeting includes the caller's name"** — this is the exact behavior being removed. Verify the opening-line section does not land the caller's name in the greeting.
- **Tool return strings that are speakable English** — D-16 forbids. Any `return f"Your appointment is confirmed..."` is a parrot-loop bait and must become state+directive.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting name-override trigger phrases | Regex matcher in `prompt.py` or `tools/` | Outcome-framed rule in prompt (D-03) | Gemini's in-model semantic classifier is stronger and multilingual; regex is brittle across the 6 supported languages + Singlish code-switching. |
| Detecting "enough address to validate" | Python field-count gate in `book_appointment` | Leave the gate to Phase 61's Google Maps validator | D-08 explicitly defers "enough" to the downstream validator. Encoding a field list here re-creates coupling Phase 61 is designed to own. |
| Enforcing "read back once" | Counter in `deps` that blocks re-readback | Prompt rule + caller behavior | Counter would misfire on corrections (each correction legitimately re-reads). |
| New corrections framework | Multi-step correction FSM | Phase 30 `CORRECTIONS` + one-line D-09 reinforcement | Phase 30's rule already handles the canonical case. D-09 adds surgical placement, not new mechanics. |
| Spanish translation automation | Machine-translation pipeline at build time | Claude drafts, user reviews (D-14) | Culturally-correct Spanish phrasing (esp. SG-context-free, US/Latino-context-aware) needs human judgment. |
| Tool return parsing | Structured parser in the agent framework | Inline `"STATE: x | DIRECTIVE: y"` strings | Phase 30 already established this convention; the AI reads the state + directive directly. No parser needed. |

**Key insight:** Phase 60 is a **rules-on-prompt** phase. The temptation to encode rules in Python (detection, gating, counting) is precisely what D-15's outcome-framed-over-script preference rules out. Every enforcement lives in the prompt; code is untouched except for tool-description and tool-return strings.

---

## Runtime State Inventory

Phase 60 is a **prompt-only refinement**. No renames, no migrations, no refactors that leave orphan runtime state. Explicitly:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None. DB rows produced by `book_appointment` / `capture_lead` continue to use the same columns (`service_address`, `postal_code`, `street_name`, `caller_name`). No schema change, no data migration. The name-readback behavior change writes **identical** fields as today. | None. |
| Live service config | None. No n8n, no Datadog tags, no Tailscale ACL changes. The pinned Gemini model + LiveKit worker config is untouched. | None. |
| OS-registered state | None. No Windows tasks, no launchd, no systemd units. Railway deployment pulls from the `livekit_agent/` git repo on push. | None. |
| Secrets / env vars | None. No new secrets, no renamed env var. `GOOGLE_API_KEY`, `TWILIO_*`, `SUPABASE_*` — all unchanged. | None. |
| Build artifacts | None. `pyproject.toml` is not modified. No new Python packages, no egg-info regeneration. | None. |

**The canonical question** — *After every file is updated, what runtime systems still have the old behavior cached?* — **Answer: none.** Gemini is stateless per-call; each inbound call pulls a fresh system prompt from `build_system_prompt(...)`. The moment Railway redeploys the `livekit_agent/` image, the next call uses the new prompt.

**One implicit consequence worth flagging for the planner:** in-flight calls at deploy time will finish under the *old* prompt (the session's `instructions` are snapshot at `RealtimeModel.__init__`). This is not a bug; it is the expected rollout behavior. Validation should happen on calls that start **after** the deploy.

---

## Common Pitfalls

### Pitfall 1: Regressing Phase 30's hoisted anti-hallucination rules
**What goes wrong:** While editing INFO GATHERING, a well-meaning cleanup moves `OUTCOME WORDS — CRITICAL RULE` or `TOOL NARRATION — CRITICAL RULE` further down, or reformats them to look like bullets in a larger list, dropping their attention weight.
**Why it happens:** Phase 60 is a "polish" phase — the temptation to tidy adjacent sections is high.
**How to avoid:** D-15's audit is explicit: **leave critical-rule positioning alone** unless demonstrably broken. Before committing `prompt.py`, diff-check that the first 30 non-blank lines of the assembled prompt still begin with the anti-hallucination rules.
**Warning signs:** A post-deploy Sentry spike in "tool_call_cancelled" events, or UAT shows the AI listing times for vague windows again (the parrot-loop symptom).

### Pitfall 2: Adding a VAD-redundant line under the guise of "address intake clarity"
**What goes wrong:** In softening D-07's "one follow-up at a time", a line like "wait for the caller to finish before asking" creeps in. This duplicates server VAD. Wasted attention, and it historically correlates with the `_SegmentSynchronizerImpl.playback_finished called before text/audio input is done` warning.
**Why it happens:** Writing prompts that read naturally to humans pulls toward polite-conversation verbiage that the SDK already handles.
**How to avoid:** D-15 explicitly audits for this. Lines about turn-taking, interruption, or waiting belong in `agent.py`'s `RealtimeInputConfig`, not in the prompt.
**Warning signs:** Any prompt diff adding the words "finish", "interrupt", "wait for", or "let them" in the INFO GATHERING or VOICE BEHAVIOR sections.

### Pitfall 3: The tool-return parrot loop (D-16 — the whole reason for D-16)
**What goes wrong:** Tool return string reads like something a human would say to a caller. Gemini skips invoking the tool again and speaks the string instead, or folds it into its own utterance verbatim.
**Why it happens:** Natural-English returns feel ergonomic when writing Python; the AI treats them as additional context and may surface them.
**How to avoid:** Every return must begin `STATE:` and contain a `DIRECTIVE:` aimed at the AI, phrased in imperative voice to the model (not the caller). Unit-test by reading each return aloud — if it *could* be said to a caller, rewrite it.
**Warning signs:** [VERIFIED: SKILL.md §1 line 10] the prior `check_availability` bug where the AI said "the earliest slot is 9 AM" mirrors exactly what the return string contained — this is the canonical sign. Run a live UAT test call that deliberately triggers each tool (check_availability, book_appointment, transfer_call, capture_lead, check_caller_history) and listen for the AI reading return strings.

### Pitfall 4: Spanish drift from English
**What goes wrong:** Claude drafts Spanish that is close to literal translation, but drops a rule ("do not use name vocatively") because the Spanish phrasing would sound unnatural.
**Why it happens:** D-14 requires user review; Claude may pre-soften to avoid reviewer pushback.
**How to avoid:** Draft Spanish with the **same rule structure** as English (same sections, same rules, same D-IDs represented). User reviews phrasing, not structure. If a rule reads unnaturally in Spanish, surface it to the user in the review step — do not silently drop it.
**Warning signs:** Spanish prompt is shorter than English prompt after the changes. English and Spanish should be the same shape and the same rule count.

### Pitfall 5: The booking-readback name-order ambiguity
**What goes wrong:** The readback says "...for Jia En at 123 Main Street" — caller catches the address error, says "no, it's 125", and the AI re-reads "for Jia En at 125 Main Street". If the caller wanted to also correct the name, the opportunity already passed — they typically correct one thing at a time.
**Why it happens:** Natural speech is sequential; readbacks bundled in one utterance invite single-correction loops.
**How to avoid:** D-10 is explicit: "If the caller corrects again, loop (accept → re-read full) until the caller stops correcting." The prompt must instruct: after any correction, the re-read is the **full corrected line** — both name and address — so a subsequent correction can still be volunteered.
**Warning signs:** UAT test 3 (mid-readback correction persona) fails because the AI stops re-reading after the first correction is accepted.

### Pitfall 6: Caller declines to give a name, and the prompt assumes a name is present
**What goes wrong:** D-04 allows no-name booking, but the prompt's readback template reads "...for {name} at {address}" — with empty name, this becomes "...for at 123 Main..." or worse, triggers the AI to ask for the name again, in violation of D-04.
**Why it happens:** Templates tend to assume presence.
**How to avoid:** The prompt must instruct, in outcome frame: "If no name was captured, read back only the address." Do not introduce a Jinja-style optional field in a template string; let the AI compose.
**Warning signs:** Any UAT persona that refuses to give a name encounters a stutter or repeat-ask.

### Pitfall 7: Skill-file update drifts from actual prompt
**What goes wrong:** `prompt.py` is edited; `SKILL.md` is not updated — or vice versa, the skill is updated with aspirational text that does not match the code.
**Why it happens:** The phase-tail skill update is the last task; fatigue leads to copy-paste shortcuts.
**How to avoid:** CLAUDE.md's "Keep skills in sync" rule is a hard requirement. Include a Wave 0 / final-wave task that **reads the updated `prompt.py` + `tools/*.py` and writes the SKILL.md delta diff from that source of truth**, not from the plan doc.
**Warning signs:** SKILL.md contains prompt-section text that does not appear in the assembled prompt from `build_system_prompt(...)`.

---

## Code Examples

All examples below are **illustrative patterns**, not verbatim prescriptions. Claude's discretion (per CONTEXT.md) covers exact wording.

### Example 1: Name-vocative rule (D-01 + D-03, outcome-framed)

```python
# In prompt.py, inside _build_info_gathering_section or a new _build_name_vocative_section
# (preferred: small sub-block inside INFO GATHERING, next to the existing NAMES subsection)

def _build_name_vocative_section() -> str:
    return textwrap.dedent("""
    NAME USE DURING THE CALL:
    - Capture the caller's name early and use it silently for records. Do not address the caller by
      name mid-call (no "Thanks, Jia En" or "Okay Jia En"). The sole exception is the booking readback.
    - If the caller explicitly invites you to use their name (e.g., they say "you can call me X" or
      "please call me X"), you may use their name naturally for the rest of the call.
    - If no name was captured (caller declined or couldn't be understood), proceed without one. Skip
      the name part of the booking readback.
    """).strip()
```

### Example 2: Single-question address opener (D-06, D-07, D-08 — outcome-framed)

```python
# Replaces the current three-part walkthrough in _build_info_gathering_section (CONTEXT.md L295-337 block)

def _build_address_intake_section() -> str:
    return textwrap.dedent("""
    SERVICE ADDRESS:
    - Ask one natural question: "What's the address where you need the service?"
    - Extract whatever the caller volunteered (street, postal area, unit, block, etc.).
    - If something is missing that we'd need to find the place, ask exactly one targeted follow-up for
      the specific missing piece. Loop one piece at a time. Never run a mechanical walkthrough.
    - Capture enough for us to find the place. Do not recite a list of fields to the caller.
    """).strip()
```

### Example 3: Booking readback with correction reinforcement (D-02, D-09, D-10)

```python
# Inside _build_booking_section, BEFORE BOOKING subsection

def _build_booking_readback_section() -> str:
    return textwrap.dedent("""
    BEFORE BOOKING — READBACK (mandatory):
    - Read back the caller's name (if captured) and the full service address in one utterance.
      This is the single authoritative verification moment for both.
    - If the caller corrects any part, accept the correction (the caller's correction is ALWAYS
      correct) and re-read the corrected full line before calling book_appointment. If they correct
      again, loop — accept, re-read the full corrected line — until they stop correcting.
    - If no name was captured, read back only the address.
    """).strip()
```

### Example 4: Tool return in strict state+directive format (D-16)

```python
# src/tools/book_appointment.py — success branch

# BEFORE (parrot-loop bait)
return (
    f"Booking confirmed for {caller_name} at {service_address} "
    f"on {slot_start.strftime('%A at %I:%M %p')}."
)

# AFTER (state + directive)
return (
    "STATE: booking_succeeded | "
    f"DIRECTIVE: confirm verbally to the caller using the name and address from your readback; "
    f"do not restate the time — the caller already heard it during the slot offer. "
    f"Ask if there is anything else before wrapping up."
)
```

### Example 5: `capture_lead` description parity with `book_appointment` (D-11)

```python
# src/tools/capture_lead.py — tool description

# BEFORE (three-field intake language)
description = (
    "Capture the caller's information when they decline to book. Required: name. "
    "Collect: phone, street_name, unit_number, postal_code, job_type, notes."
)

# AFTER (single-question intake + readback-before-call parity)
description = (
    "Capture the caller's information when they decline to book. "
    "Before calling this tool, gather the caller's name, issue, and service address using the same "
    "single-question address rule as the booking path (ask one natural question; loop one follow-up "
    "at a time; capture enough to find the place). Then read back the name (if captured) and full "
    "address once. Call this tool only after the readback is confirmed."
)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact on Phase 60 |
|--------------|------------------|--------------|--------------------|
| Mechanical three-part address walkthrough ("What's your street? ... postal code? ... unit?") | Single natural opener + targeted one-at-a-time follow-ups | Phase 60 (this phase) | Change B; D-06..D-08. |
| Repeated vocative name use across the call ("Thanks, Jia En ... Okay Jia En") | Silent capture, single readback at booking | Phase 60 (this phase) | Change A; D-01..D-05. Directly addresses culturally-diverse-name mispronunciation compounding. |
| Tool returns as natural English | State+directive model-facing strings | Phase 30 (established) + Phase 60 (generalized to all 5 tools via D-16) | Partial precedent exists on `check_availability` (fixed per SKILL.md §1 L10). D-16 generalizes. |
| Prompt-level turn-taking ("let the caller finish") | Server VAD owns turn-taking | Backlog 999.2 fix (2026-04-18) — LOW sens, 400ms prefix, 1000ms silence | [VERIFIED: SKILL.md §3] D-15 audits for regressions into prompt-level turn-taking guidance. |
| `per_response_tool_choice` SDK-level forcing | Prompt-level tool-use enforcement only | Stack pin on `livekit-plugins-google@43d3734` | [CITED: CONTEXT.md code_context] The prompt is the only enforcement surface for tool-use claims; D-16 tightens it. |

**Deprecated / outdated:**
- Retell-era `agent-prompt.js` in `C:/Users/leheh/.Projects/Retell-ws-server/` — **do not touch**. Phase 30 was on Retell; Phase 60 is on LiveKit/Gemini. Explicitly out of scope per CONTEXT.md `<deferred>`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `_build_info_gathering_section` is at approximately L295-337 of `prompt.py` | Standard Stack / File map | CONTEXT.md states the range "as of snapshot date". If the file has drifted, the planner must re-locate the section; no behavioral risk. |
| A2 | `messages/es.json` mirrors `en.json` at the `agent.*` / `notifications.*` key level | Spanish parity | [VERIFIED: SKILL.md §4 end] confirms both files exist with two top-level sections. If additional section keys have been added in Spanish but not English (or vice versa), the mirror step needs a key-diff pass before authoring. LOW risk — surfaces at plan time, not execution time. |
| A3 | The D-16 rewrite can be safely landed as one commit per tool file (or one combined commit) without breaking tests | D-16 scope | Tests in `livekit_agent/tests/` exist but are not documented in the skill file. If a test asserts on exact return-string text, the rewrite must update tests in the same commit. MEDIUM risk — addressed in Wave 0 by reading test files. |
| A4 | The `capture_lead` tool description is a plain string accessible to Gemini via the tool registration path — updating it takes effect on next deploy with no plumbing changes | D-11 | [VERIFIED: SKILL.md §5] confirms tools use `@function_tool` decorator pattern; description is a standard kwarg. LOW risk. |
| A5 | No tenant currently relies on the vocative-name behavior in a way that a prompt-level change would functionally break | D-01 | CONTEXT.md `<deferred>` lists "configurable vocative setting" as deferred, implicitly accepting that the default change ships to all tenants. LOW risk for the current dev-phase user base (still no real users per STATE.md). |
| A6 | The Spanish "override" phrasings (D-03 parallel) are idiomatic enough that Gemini will detect them — e.g., "puede llamarme X", "me dicen X" — without an enumerated trigger list | D-03, D-13 | Gemini 3.1 is multilingual at the pretrain level. MEDIUM confidence; user review (D-14) is the safety net. |
| A7 | The `send_realtime_input(text=prompt)` A2A branch on the pinned plugin handles prompt updates on session start (i.e., Phase 60's new prompt text flows through without plugin changes) | Stack | [VERIFIED: SKILL.md §1 line 196] confirms the plugin path is the only one that supports `generate_reply()` for this model; prompt text is passed as `instructions` to `RealtimeModel.__init__`. HIGH confidence. |
| A8 | UAT validation via scripted personas on live Railway calls is the accepted validation surface for prompt changes in this project | Validation | [VERIFIED: STATE.md mentions UAT calls for Phase 55 + backlog 999.1/999.2 fixes]. HIGH confidence — this is the shipped pattern. |

**Surface for discuss-phase / planner attention:** A3 (tests) and A6 (Spanish override idioms) are the two assumptions most likely to require explicit confirmation before plan execution.

---

## Open Questions

1. **Do existing Python tests in `livekit_agent/tests/` assert on exact tool-return-string text?**
   - What we know: Tests exist (Phase 55 UAT referenced integration tests). Nothing in the skill file documents assertion patterns.
   - What's unclear: Whether D-16's string rewrites will break tests.
   - Recommendation: Wave 0 task — `grep -r "STATE:\|DIRECTIVE:\|Booking confirmed\|slot is available" livekit_agent/tests/`; if assertions exist, update in same commit. If none exist, flag to user for test-coverage backfill (out of this phase, but actionable follow-up).

2. **Does the Phase 61 Google Maps validator require any specific field shape or key names that Phase 60's prompt should surface verbatim?**
   - What we know: Phase 61 CONTEXT.md §"Current state of address handling" lists the existing fields (`street_name`, `postal_code`, `unit_number`, combined into `service_address`). Phase 61 adds `formatted_address`, `place_id`, `latitude`, `longitude`, `address_components`, `address_validation_verdict`.
   - What's unclear: Whether Phase 61 expects Phase 60 to already prompt for "unit" explicitly (since `unit_number` remains optional in Phase 61 as well).
   - Recommendation: Leave D-08 as outcome-framed ("enough to find the place"). Phase 61's validator accepts whatever the AI captured and normalizes; explicitly enumerating "unit" in the prompt creates fragile coupling. Phase 61 handles unit-sensitivity itself.

3. **Should the readback utterance (D-02) say the name first or the address first?**
   - What we know: Claude's discretion per CONTEXT.md. No locked order.
   - What's unclear: Whether one order produces better correction rates in live calls.
   - Recommendation: Default to "name first, then address" because names are shorter and a caller is more likely to correct name before address (lower correction-confusion on long addresses). User may override in discuss.

4. **Which Spanish reviewer + what's the review cadence (D-14)?**
   - What we know: D-14 says "user reviews before commit". Nothing is documented about the review process — sync-async, inline or in a follow-up session.
   - What's unclear: Whether the Spanish phrasing is reviewed in a separate turn from the English commit, or in the same session before any commit.
   - Recommendation: Plan the Spanish mirror as a **separate commit after English** so the user can review the diff in isolation; mark the commit as "pending user review" in the wave gate.

5. **Does `end_call.py` have a return string that needs rewriting under D-16?**
   - What we know: [VERIFIED: SKILL.md §5] `end_call` returns "a space character immediately" then sleeps + removes participant.
   - What's unclear: Whether that return qualifies as a "tool-return string" under D-16.
   - Recommendation: Treat as a no-op for D-16 — a space character is neither speakable English nor a parrot-loop risk. Confirm in plan; if the plan discovers different code, reclassify.

6. **Is there a Sentry tag / filter for "prompt-caused" issues (e.g., parrot-loop, vocative regressions) that UAT should watch?**
   - What we know: Sentry is wired (`SENTRY_DSN` env var); post-call pipeline runs triage + logging.
   - What's unclear: Whether there's a pre-built Sentry query for "AI spoke tool-return-verbatim" or similar signals.
   - Recommendation: If no pre-built query exists, Wave 0 includes "document a Sentry search" rather than building a new integration. Reviewing call transcripts after UAT for the specific regressions is sufficient validation for a prompt-only phase.

---

## Environment Availability

Phase 60 is a code/config change in a separate repo; no new external dependencies are introduced. However, for validation (scripted live test calls):

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Railway deployment (livekit_agent) | Live UAT calls | Assumed yes (Phase 57 UAT ran on Railway) | Current | Staging Railway env if production is blocked |
| Twilio phone number + tenant | Live UAT calls | Assumed yes (Phase 27 + 57 UAT patterns) | E.164 | Dev tenant with provisioned SG/US number |
| Sentry | Post-UAT review for regressions | Yes (`SENTRY_DSN` in env) | — | Direct log inspection on Railway |
| LiveKit Cloud | Routing SIP → agent | Yes | — | No viable fallback; blocks UAT |

**Missing dependencies with no fallback:** None identified. The deployed pinned stack is the validation environment.
**Missing dependencies with fallback:** None identified.

No new external dependencies are introduced by Phase 60. Phase 61 (next) introduces `GOOGLE_MAPS_API_KEY` — that is Phase 61's concern, not Phase 60's.

---

## Validation Architecture

Per `.planning/config.json` — `workflow.nyquist_validation: true`. This section is required; the planner will copy it into VALIDATION.md.

### Test Framework

Phase 60 is **prompt-and-string** changes. Automated unit testing is limited for audio-LLM behavior; live UAT calls are the validation canon.

| Property | Value |
|----------|-------|
| Framework | `pytest` for any Python unit tests that already exist in `livekit_agent/tests/` (covers pure-function logic, not prompt behavior). Live-call UAT via scripted personas for behavioral verification. |
| Config file | `livekit_agent/pyproject.toml` (pytest config likely under `[tool.pytest.ini_options]`) — confirm in Wave 0 |
| Quick run command | `pytest livekit_agent/tests/ -x --tb=short` (from agent repo root) — for any string-assertion coverage |
| Full suite command | `pytest livekit_agent/tests/` + **3 scripted live UAT calls** + Sentry post-call review |
| Phase gate | All three UAT personas pass; zero new Sentry "tool_call_cancelled" or parrot-loop signals in the 24h after deploy |

### Phase Requirements → Test Map

| D-ID | Behavior | Test Type | Automated Command | Wave 0 Action |
|------|----------|-----------|-------------------|---------------|
| D-01 | AI does not address caller by name mid-call | manual-only (UAT persona 1) | — | Document persona 1 script: culturally-diverse name + clear address; listen for any vocative use before readback |
| D-02 | Name + address read back once before booking tool fires | manual-only (UAT persona 1) | — | Same persona 1; listen for exactly one readback immediately before tool call |
| D-03 | Caller-invited name use is honored | manual-only (UAT persona 4 — add) | — | Document new persona 4: "you can call me Sam", then listen for natural name use after |
| D-04 | No-name path proceeds without blocking | manual-only (UAT persona 5 — add) | — | Document persona 5: refuses to give name; booking still completes; DB row has null/empty name |
| D-05 | Low-confidence pronunciation handled by CORRECTIONS | manual-only (UAT persona 3) | — | Persona 3 corrects mispronunciation during readback; AI accepts + re-reads |
| D-06 | Single-question opener | manual-only (UAT personas 1 + 2 + 3) | — | Listen for "What's the address where you need the service?" (verbatim or very close); NOT a three-part walkthrough |
| D-07 | One targeted follow-up for missing piece | manual-only (UAT persona 2) | — | Persona 2 gives only postal area → AI asks for street (not a shopping list) |
| D-08 | Minimum-capture outcome rule | automated (indirect) + manual | Phase 61 validator run on UAT call transcripts in a follow-up phase | For Phase 60: confirm the AI does not enumerate fields to the caller |
| D-09, D-10 | Corrections during readback | manual-only (UAT persona 3) | — | Persona 3 corrects once mid-readback; AI accepts + re-reads full; corrects again; loops |
| D-11 | `capture_lead` description parity | manual-only (UAT persona 6 — add decline path) | — | Persona 6 declines to book; AI still does single-question intake + readback before `capture_lead` fires |
| D-12 | `capture_lead` readback parity | same as D-11 | — | Listen for readback immediately before tool call |
| D-13, D-14 | Spanish mirror with user review | manual-only (UAT persona 7 — add, Spanish) | — | Spanish persona 1: AI switches to Spanish on explicit request, single-question intake, readback once, same rules |
| D-15 | Structural integrity audit | automated (grep check) | `grep -A 5 "OUTCOME WORDS\|TOOL NARRATION" livekit_agent/src/prompt.py \| head -30` | Confirm anti-hallucination rules still appear in first 30 lines of assembled prompt; confirm no "let the caller finish" / "don't interrupt" / "wait for them" strings added |
| D-16 | Tool returns in state+directive format | automated (grep check) + manual | `grep -rn "return " livekit_agent/src/tools/*.py \| grep -v "STATE:\|^.*#"` returns zero speakable-English returns | Any flagged return must become state+directive or be justified (e.g., `end_call`'s space character) |

### Sampling Rate

- **Per task commit:** `pytest livekit_agent/tests/ -x --tb=short` (fast; prompt-only phase has minimal unit-test surface)
- **Per wave merge:** full `pytest livekit_agent/tests/` + assembled-prompt grep checks (see D-15, D-16 commands above)
- **Phase gate:** **All 7 UAT personas pass** on a live Railway deploy + 24-hour Sentry review for regression signals + skill file cross-check (SKILL.md text matches `prompt.py` + `tools/*.py` behavior)

### Wave 0 Gaps

- [ ] **Inventory `livekit_agent/tests/` for tool-return assertions** — `grep -rn "Booking confirmed\|slot is available\|lead captured" livekit_agent/tests/` — if any results, update in same commit as the tool rewrite.
- [ ] **Document UAT personas 1–7** — scripted call scripts for culturally-diverse name + clear address (1); casual one-breath address (2); mid-readback correction (3); caller invites name use (4, D-03); caller refuses name (5, D-04); caller declines to book (6, D-11/D-12); Spanish caller (7, D-13). Persona 1–3 are in CONTEXT.md §Validation; 4–7 are gaps.
- [ ] **Sentry search playbook** — document the Sentry query for "tool_call_cancelled" + "tool-return verbatim" signals so UAT reviewer knows what to look for post-deploy.
- [ ] **Confirm `livekit_agent/` repo access** — the planner should verify the separate repo is git-clonable/pushable from the execution environment; Phase 60's code changes do NOT land in `homeservice_agent/`.

---

## Security Domain

`security_enforcement` defaults to enabled. Phase 60 is a prompt/string change with **no new auth, data-handling, or cryptographic surface**. Brief analysis:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Tenant auth is upstream (SIP trunk + Supabase); Phase 60 does not touch it |
| V3 Session Management | no | LiveKit Agent session lifecycle is untouched |
| V4 Access Control | no | Tools already use service-role Supabase with tenant-scoped queries; Phase 60 does not modify scopes |
| V5 Input Validation | yes (read-only) | Prompt text is authored by humans/Claude, shipped via git; no user input flows into the prompt at runtime. The **tool parameter surface is unchanged** (signatures frozen per CONTEXT.md). The single runtime-input consideration: caller-volunteered address strings flow into existing DB columns exactly as today — no new injection surface. |
| V6 Cryptography | no | No new crypto |
| V7 Error Handling & Logging | yes (minor) | Tool-return rewrites may need Sentry-logging review if any current return is used by post-call triage as a signal (confirmed it is not — triage operates on transcript text, not tool returns) |

### Known Threat Patterns for Prompt-Engineering Phases

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via caller-spoken content | Tampering | Existing pattern: caller speech is captured as tool parameters (`caller_name`, `street_name`, etc.), not interpolated into the system prompt. Phase 60 preserves this. No new interpolation points added. |
| Data exfiltration via tool-return to caller | Information Disclosure | D-16 directly mitigates: returns become machine-facing state+directives, not caller-facing English. Reduces exfil surface (AI less likely to read internal IDs, DB hints, etc. from return strings). |
| Impersonation via unverified name use | Spoofing | D-01/D-02 reduce "name weight" in the call. The readback at booking is the verification moment. This is **better** than the pre-Phase-60 repeated-vocative behavior, which compounded any misheard name across the whole call. |
| PII logging | Information Disclosure | Existing post-call pipeline logs transcripts to DB. Phase 60 does not change what is logged. The readback-at-booking change means names are spoken **once fewer time** per call — a modest PII reduction, not a new exposure. |
| Spanish locale bypass | Tampering (low risk) | D-13 ensures Spanish has the same rules as English; D-14 ensures review. No "Spanish is weaker" surface introduced. |

**Conclusion:** Security-neutral phase. The tool-return rewrite (D-16) is net-positive for V7. No controls to add; no controls to remove.

---

## Sources

### Primary (HIGH confidence)

- `.planning/phases/60-voice-prompt-polish-name-once-and-single-question-address-intake/60-CONTEXT.md` — 16 locked decisions, pinned-stack constraints, canonical file refs
- `.planning/phases/30-voice-agent-prompt-optimization/30-CONTEXT.md` — Phase 30 foundational decisions (D-01..D-06)
- `.planning/phases/30-voice-agent-prompt-optimization/30-01-SUMMARY.md` through `30-03-SUMMARY.md` — what shipped in Phase 30
- `.planning/phases/61-google-maps-address-validation-and-structured-address-storage/61-CONTEXT.md` — downstream consumer of D-08's minimum-fields rule
- `.claude/skills/voice-call-architecture/SKILL.md` — complete current architecture reference (prompt section ordering, tool inventory, pinned-stack rationale, VAD config, post-call pipeline)
- `.planning/STATE.md` — confirmed phase 999.1/999.2 fixes already shipped (urgency normalization, VAD tuning); confirms pinned versions are live
- `./CLAUDE.md` — "Keep skills in sync" rule; brand = Voco
- `.planning/config.json` — `nyquist_validation: true`; confirms Validation Architecture section is required

### Secondary (MEDIUM confidence)

- `.planning/ROADMAP.md` (Phase 60 row) — confirms Phase 60 is prompt-surface-only; Phase 61 follows as GMaps validation
- `.planning/REQUIREMENTS.md` — confirmed via grep that no REQ-IDs map to Phase 60 (as stated in CONTEXT.md)

### Tertiary (LOW confidence — verified not authoritative for this phase)

- WebSearch 2026 — "Gemini realtime audio LLM prompt engineering vocative name" — returned general prompt-engineering guidance but no Gemini 3.1 Flash Live-specific guidance on vocative suppression. Used only to confirm that the industry has no counter-consensus on the "read back once at confirmation" pattern; a banking voice-agent example explicitly uses the same pattern ([How I Built a Voice-First AI Banking Agent with Gemini Live and Google ADK](https://ayushm4489.medium.com/how-i-built-a-voice-first-ai-banking-agent-with-gemini-live-and-google-adk-0ecb4cdf8002)).
- WebSearch 2026 — "voice AI receptionist prompt read back name address confirmation once pattern" — returned Gemini Flash Live marketing material ([Gemini Audio — Google DeepMind](https://deepmind.google/models/gemini-audio/)), no authoritative pattern. Confirms the prompt-engineering approach in Phase 60 is consistent with published industry examples.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Phase boundary + locked decisions | HIGH | CONTEXT.md is fully specified; 16 decisions are explicit |
| Prompt section architecture | HIGH | Phase 30 summaries + SKILL.md §4 describe current ordering verbatim |
| Tool-return parrot-loop mitigation | HIGH | SKILL.md §1 L10 documents the canonical prior fix; D-16 generalizes |
| Pinned-stack constraints | HIGH | SKILL.md §1 documents pin rationale; STATE.md confirms versions live |
| Spanish parity mechanics | MEDIUM | SKILL.md confirms `es.json` structure; the idiomatic Spanish for D-03 override phrases is A6 (assumed until user review) |
| Test-suite impact of D-16 | MEDIUM | Tests exist but assertion patterns are not documented in the skill — Wave 0 grep resolves |
| Sentry signal playbook | LOW | Sentry exists but no pre-built queries documented for parrot-loop / vocative regressions — document during plan |

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (30 days; stable domain — prompt-engineering conventions on a pinned stack do not change fast). If Phase 61 or 62 ships before Phase 60, re-verify that the `livekit_agent/src/tools/` surface matches the file map here; otherwise no re-research needed.
