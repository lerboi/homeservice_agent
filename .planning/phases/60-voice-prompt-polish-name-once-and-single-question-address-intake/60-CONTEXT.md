# Phase 60: Voice prompt polish — Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Prompt-only refinements in `livekit_agent/src/prompt.py` (and `messages/en.json` + `messages/es.json` where templated strings are affected), plus tool *description* updates and tool *return string* tightening in `livekit_agent/src/tools/*.py`. No changes to:
- `agent.py` (session wiring, VAD config, voice resolution)
- Tool signatures or tool *behavior* (parameters, atomicity, side effects)
- DB schema, RPCs, Next.js routes, dashboard UI

Two primary behavior changes and one surgical structural pass:
- **Change A** — AI stops re-addressing the caller by name mid-call; reads name back exactly once at booking confirmation (together with the address) as the single authoritative verification moment.
- **Change B** — AI opens address intake with a single natural question ("What's the address where you need the service?"); asks only for specific missing pieces after extracting whatever the caller volunteered.
- **Structural pass** — light audit of Phase 30 structure (anti-hallucination placement, VAD-redundant lines, persona preservation) + rewrite all tool returns to strict state+directive format.

Spanish (`messages/es.json`) mirrors all changes. capture_lead reaches description-level parity.

</domain>

<decisions>
## Implementation Decisions

### Name vocative rules
- **D-01:** Default rule — AI does **not** use the caller's name vocatively during the call ("Thanks, Jia En" / "Okay Jia En" is prohibited). Name is captured early per the existing required-before-tools rule and stored silently.
- **D-02:** Authoritative readback — AI reads the name back exactly **once**, at booking confirmation, together with the address, immediately before `book_appointment` fires. Required on every booking (no conditional skip) unless the caller never provided a name (see D-04).
- **D-03:** Caller-requested override — if the caller explicitly invites name use (e.g., "please call me Jia En", "you can call me X", "I go by Y"), the AI **may** use the name naturally for the rest of the call. Rule is outcome-framed; the prompt does **not** enumerate trigger phrases.
- **D-04:** No name captured — if the caller refuses or the model can't capture a name, the AI proceeds without. The name portion of the readback is skipped; the DB stores empty/null. Booking is **not** blocked.
- **D-05:** Low-confidence pronunciation — no special branch. Standard readback; the existing `CORRECTIONS` rule handles mispronunciations. Do not add extra verification lines for spelled-out names.

### Address intake (single-question framing)
- **D-06:** Opening question — "What's the address where you need the service?" (verbatim or very close). Single open question replaces the current three-part walkthrough.
- **D-07:** Incomplete openings — AI extracts whatever the caller volunteered (postal area, street, unit, etc.) and asks exactly **one** targeted follow-up for the specific missing piece. No mechanical three-part walkthrough. Loop one piece at a time until enough to validate.
- **D-08:** Minimum capture — outcome-framed rule: "capture enough for us to find the place." Prompt does **not** enumerate a rigid field list. The downstream Phase 61 validator (Google Maps) defines what "enough" is in practice (typically street + postal; unit optional).

### Booking readback and corrections
- **D-09:** Corrections protocol — rely on the existing Phase 30 `CORRECTIONS` rule ("the caller's correction is ALWAYS correct"). Add one line to the readback section: "If the caller corrects any part of the readback, accept the correction and re-read the corrected full address." No new corrections framework.
- **D-10:** Post-correction behavior — after accepting a correction, AI re-reads the **corrected full address** before proceeding to book. If the caller corrects again, loop (accept → re-read full) until the caller stops correcting. Same rule applies to name corrections during the readback.

### capture_lead tool parity (decline path)
- **D-11:** capture_lead description — update the tool description string so Gemini reads the same single-question intake rules on the decline path as on the booking path. Tool signature and behavior are **unchanged**.
- **D-12:** capture_lead readback — same single-authoritative-readback rule as booking: name + address read back once before `capture_lead` fires. Decline path reaches parity with booking path for verification.

### Spanish (es.json) parity
- **D-13:** Spanish mirror — D-01 through D-12 are applied to the Spanish prompt surface (`messages/es.json`). Same rules, localized phrasing. No rule is dropped or diluted for Spanish.
- **D-14:** Authoring — Claude drafts the Spanish phrasings; user reviews before commit. No machine translation without review.

### Structural pass
- **D-15:** Scope — **light audit**. Verify (a) anti-hallucination rules (`OUTCOME WORDS — CRITICAL RULE`, `TOOL NARRATION — CRITICAL RULE`) still sit near the top of the prompt, (b) no VAD-redundant guidance ("let the caller finish", "don't talk over") has crept back in, (c) the configured persona tone still reads as distinct (Zephyr/Aoede/Achird). Fix inline **only** if something is clearly broken; otherwise leave the Phase 30 structure alone.
- **D-16:** Tool-return strings — rewrite **all** tool returns across `livekit_agent/src/tools/*.py` (`book_appointment`, `capture_lead`, `transfer_call`, `check_availability`, `check_caller_history`, plus any others) to strict state+directive format. No natural-English confirmations that invite the parrot loop where Gemini skips the tool and speaks the string directly.

### Claude's Discretion
- Exact wording of every prompt section (outcome-framed rules, not scripts).
- Specific Spanish phrasings (user reviews before commit — D-14).
- Where and how to encode "capture enough for us to find the place" without enumerating fields (D-08).
- Exact form of the one-line correction instruction added to the readback section (D-09).
- Whether the tool-return rewrite (D-16) is one commit or one commit per tool file.
- Exact on-air utterance for the readback (e.g., order of name vs. address, contraction style) — as long as it honors D-01, D-02, D-12.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prompt surface (primary changes)
- `livekit_agent/src/prompt.py` — `_build_info_gathering_section` (~L295-337 for current NAME/ADDRESS blocks); `_build_booking_section` for readback placement; identity / voice-behavior sections for the structural audit.
- `livekit_agent/src/messages/en.json` — any template strings referenced by the affected prompt sections.
- `livekit_agent/src/messages/es.json` — same template strings in Spanish (D-13, D-14).

### Tool surface (descriptions + returns)
- `livekit_agent/src/tools/book_appointment.py` — description (readback phrasing alignment) + return string (D-16).
- `livekit_agent/src/tools/capture_lead.py` — description (single-question intake parity, D-11) + return string (D-16).
- `livekit_agent/src/tools/transfer_call.py` — return string rewrite (D-16).
- `livekit_agent/src/tools/check_availability.py` — return string rewrite (D-16).
- `livekit_agent/src/tools/check_caller_history.py` — return string rewrite (D-16).

### Read-only references (for audit, do not modify)
- `livekit_agent/src/agent.py` — VAD config (LOW sens, 400ms prefix, 1000ms silence). Used to confirm no VAD-redundant prompt guidance is warranted.
- `.claude/skills/voice-call-architecture/SKILL.md` — update at phase tail to reflect the new prompt rules (per CLAUDE.md "Keep skills in sync" rule).

### Prior-phase context
- `.planning/phases/30-voice-agent-prompt-optimization/30-CONTEXT.md` — Phase 30 prompt decisions (OUTCOME WORDS, TOOL NARRATION, CORRECTIONS, INFO GATHERING). Phase 60 is a surgical refinement on top of this structure, not a rewrite.
- `.planning/phases/30-voice-agent-prompt-optimization/30-01-SUMMARY.md` / `30-02-SUMMARY.md` / `30-03-SUMMARY.md` — what actually shipped in Phase 30.
- `.planning/phases/61-google-maps-address-validation-and-structured-address-storage/61-CONTEXT.md` — the consumer of the minimum-fields decision (D-08). Phase 60's conversational framing is the substrate Phase 61 plugs into.

### Roadmap
- `.planning/ROADMAP.md` — Phase 60 row. Canonical scope anchor.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 30 prompt sections** (`OUTCOME WORDS — CRITICAL RULE`, `TOOL NARRATION — CRITICAL RULE`, `CORRECTIONS`, `INFO GATHERING`) — reuse as-is; do not rewrite. Phase 60 adds surgical lines, not new sections.
- **Existing `CORRECTIONS` rule** — "the caller's correction is ALWAYS correct" already covers the single-word-correction case. D-09 adds only one reinforcing line near the readback; no new framework.
- **Existing required-name-before-tools rule** — Phase 30's rule forces name capture before any tool call. Phase 60 layers the "capture silently, read back once" rule on top without touching the capture mechanism.

### Established Patterns
- **Outcome-framed rules, not scripts** — Gemini 3.1 Flash Live adapts better to "capture enough to find the place" than to an enumerated field list. Applies to D-03, D-06, D-07, D-08.
- **Critical rules near the top of the prompt** — audio attention budget drops toward the end; truth-claim rules stay hoisted. D-15 verifies this hasn't regressed.
- **Tool returns = state + directive, never speakable English** — prevents the parrot loop where Gemini reads the return string verbatim instead of invoking the tool. D-16 rewrites all tool returns to this pattern.
- **Server VAD owns turn-taking** — LOW sensitivity, 400ms prefix, 1000ms silence (from Phase 999.2 fix in `agent.py`). Any prompt line about "let the caller finish" / "don't interrupt" is wasted attention. D-15 audits for this.
- **Persona tone via voice selection** — `professional` / `friendly` / `local_expert` → Zephyr / Aoede / Achird. Guardrails in Phase 60 constrain *claims*, not *voice*. D-15 verifies persona is still distinct after the pass.

### Integration Points
- **Phase 61 (next) — Google Maps address validation** — consumes the minimum-fields output from D-08. Phase 60's conversational framing is the substrate; Phase 61 plugs in behind it without requiring prompt changes.
- **Phase 62 (next+1) — Jobber write-side push** — downstream of structured-address storage (Phase 61). Not affected by Phase 60.
- **`voice-call-architecture` skill** — updated at phase tail to document the new name-readback and single-question rules.

### Constraints from the pinned stack (do not regress)
- **Pinned versions:** Gemini 3.1 Flash Live + `livekit-plugins-google` git pin `43d3734` + `livekit-agents==1.5.1`. Only combination supporting `session.generate_reply()` for this model. No `per_response_tool_choice` — the prompt is the only tool-use enforcement surface.
- **Branch:** pinned plugin uses the A2A branch (`send_realtime_input`). Do not import patterns from newer `livekit-plugins-google` versions that depend on `send_client_content`.

</code_context>

<specifics>
## Specific Ideas

- **User intent quote (2026-04-19):** "The AI asks, 'What's the address where you need the service?', then it gets the necessary minimum fields it needs to then validate it against Google Maps API in the background, and once it's confirmed and successfully booked, add it directly to the CRM (and the connected Jobber)." — the conversational half of this ask is Phase 60; the technical validation half is Phase 61.
- **Cultural name concern** — the whole point of Change A. Chinese, Malay, Indian, Arabic, romanized names are mispronounced on the first try; Gemini never adapts; repeated vocative use amplifies the TTS mispronunciation across many pronunciations instead of one. The single-readback-at-booking pattern is the explicit correction opportunity.
- **SG vs US/CA mental models** — SG callers naturally lead with postal area ("Jurong West, unit 6-12"); US/CA lead with street ("123 Main Street"). The prompt must handle both without branching. D-06 + D-07 achieve this by letting the caller's opening dictate the flow rather than prescribing an order.
- **Outcome over script** — recurring preference. Every rule above is a directive with a reason, not a verbatim utterance. Applies to D-03 (override detection), D-06 (opening question — verbatim-or-close), D-08 (minimum fields), D-09 (corrections).

</specifics>

<deferred>
## Deferred Ideas

- **Travel buffer / zone detection using Phase 61's lat/lng** — acknowledged as a secondary benefit of Phase 61 but delivered in a later phase. Not Phase 60's concern.
- **Full tool-signature parity between `book_appointment` and `capture_lead`** — D-11 and D-12 reach description-level parity only. Signature alignment (same fields, same shapes) is a larger refactor deferred to a future phase.
- **Configurable "use vocative by default" tenant setting** — a tenant might want to preserve the current vocative style. Out of scope for Phase 60; revisit if tenant feedback requests it.
- **Voice sample-based pronunciation feedback loop** — using caller audio to correct pronunciation before readback. Speculative; out of scope.
- **Dashboard surface for the prompt behavior changes** — no dashboard UI changes in Phase 60. If tenant-facing copy needs to reflect the new "we'll confirm once at booking" behavior, that's a marketing/docs update, not a phase item.
- **Retell-era prompt files** (`C:/Users/leheh/.Projects/Retell-ws-server/agent-prompt.js`) — Phase 30 was on the Retell stack; Phase 60 is on Gemini/LiveKit. No action needed on the old Retell prompt.

</deferred>

---

*Phase: 60-voice-prompt-polish-name-once-and-single-question-address-intake*
*Context gathered: 2026-04-19*
