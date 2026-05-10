# PLAN 1 — Slot-Availability Hallucination

**Source call:** AJ_y3YJBQ7HakJd (UM7he2Up5sdt)
**Severity:** caller-visible — agent confidently claimed slots that did not exist twice in one call
**Honest framing up-front:** Pure prompt fixes are *documented to be insufficient* for this failure mode on native-audio Gemini (see B-docs §4 + Issue #1894). The plan below combines the strongest documented prompt patterns we don't already use **and** a structural placeholder-injection layer (the only documented mitigation that actually works on this class of model, per OpenAI Realtime engineering). Each piece is annotated with what it does and does not solve.

---

## 1. What was observed

From transcript + log cross-reference (see initial diagnosis):

| Caller | Agent | Tool call grounding |
|---|---|---|
| "Do you have any slots today?" | "It looks like **we do have slots available today**, is there a specific hour you were hoping for?" | None — first `check_day` fired ~90s later, returned `STATE:day_empty` |
| "Monday 8 a.m." | "It looks like **that slot is available on Monday**." | None until *after* the agent had already attempted `book_appointment` twice with bogus tokens. `check_slot` for Monday 8 AM eventually returned `STATE:day_empty` |
| Booking attempt 1 | `book_appointment(slot_token='2026-05-11T08:00:00+08:00\|2026-05-11T09:00:00+08:00\|plumbing\|Leroy\|...')` | Gemini synthesized a structured pseudo-token |
| Booking attempt 2 | `book_appointment(slot_token='p_02c0c7a5-c5d9-450f-90e6-6df7902d7e08')` | Gemini fabricated a UUID-shaped token (real format is `slot_xxxxxxxx`, 8 hex) |

Both fabrications were rejected by `book_appointment` token-resolution (A-codebase §1, lines 315–371). The token-format defense worked. The deeper bug is **Gemini calling `book_appointment` at all without a real `check_slot`**, and **Gemini speaking confident availability claims with no tool grounding.**

## 2. Root cause — three converging factors

### 2a. Architectural — native-audio Gemini hallucinates tool-grounded facts

[GitHub Issue python-genai #1894](https://github.com/googleapis/python-genai/issues/1894) reproduces this exact pattern on Gemini 2.5 Flash Native Audio. Closed by Google as **"not planned"**. Workarounds tested in the issue:

- **`BLOCKING` mode** — eliminates hallucination but produces dead air (UX failure).
- **`WHEN_IDLE` scheduling** — failed to prevent initial false responses.
- **"DO NOT speculate" instructions** — *explicitly tested in the issue, ineffective*.

Gemini 3.1 Flash Live shares the native-audio architecture; Google's launch post for 3.1 cites a 90.8% ComplexFuncBench Audio score (B-docs §4a) — i.e. ~1 in 10 tool-using turns is documented to be wrong. **This is a known model-class limitation, not a prompting deficit.**

### 2b. Prompt is already maximal — adding more "DO NOT" wording will not help

The current prompt (A-codebase §1) already contains:

- An *unmistakable invariant* in `_build_identity_section`: *"You may never speak a specific clock time, date, or the words 'available', 'not available', 'booked', 'confirmed', or 'all set' unless a tool returned that exact fact in this turn."*
- A full **OUTCOME WORDS** section enumerating reserved words and the failure-mode example: *"Caller: 'How about 3pm?' You: 'Let me check on 3pm for you.' [no tool call] 'Yes, 3pm tomorrow is available.' — WRONG."*
- An explicit **AVAILABILITY RULES** subsection requiring `check_slot` / `check_day` / `next_available_days` selection.
- A tool-narration rule forbidding times in fillers.

The call transcript shows the agent violated *every one* of these. Adding more directive prose is the textbook "directive prompt + silence license = deadlock" trap (memory `feedback_directive_prompt_silence_deadlock`).

### 2c. No forced-function-calling escape hatch on Gemini Live

`tool_config.function_calling_config.mode=ANY` exists in standard Gemini API but is **not exposed on the Live API** (B-docs §2). Gemini 3.1 Flash Live additionally drops `NON_BLOCKING`. So we cannot make the SDK refuse to let Gemini speak — that lever does not exist.

## 3. Documented best-practice fixes (in priority order)

### Fix A — Structural placeholder injection on hallucination detect *(OpenAI's documented pattern, only known reliable mitigation)*

This is the production fix used by OpenAI for the same bug class on `gpt-4o-realtime` (B-docs §4d). OpenAI's Realtime engineering blog: *"the model sometimes hallucinates the content of a nonexistent function response... [we use] server-injected placeholder responses."*

**Mechanism in our stack:**

We already have the unconditional `update_chat_ctx` + `FunctionCallOutput` path (memory `reference_livekit_update_chat_ctx_tool_results`). Same path used for cascade-recovery. We add a *forward-direction* injection: if Gemini speaks an availability-shaped utterance and the chat context has no matching `STATE:slot_*` or `STATE:day_*` from the most recent tool turn, treat it as a hallucination and inject.

**Detection signal options** (need to pick one):

1. **Post-turn transcript scan.** On `conversation_item_added` for an agent turn, regex-match availability-shaped utterances (`r'\b(available|not available|booked|all set|that slot is open|we have (a |any )?slots?)\b'`). Then check if the most recent tool message in `chat_ctx` carries a `STATE:slot_ok` or `STATE:slot_taken` or `STATE:day_*` for any time mentioned in the agent utterance. If no match: inject a synthetic `FunctionCallOutput` containing `STATE:hallucination_correction | DIRECTIVE: you have not yet checked any specific availability — call check_slot or check_day before answering. Apologize and retract the prior availability claim.` Gemini will see this on the next turn and self-correct.
2. **Pre-speech intercept** via `agent_false_interruption` listener. We already have a stub at agent.py line ~681. This is *less reliable* — by the time we know the model is speaking nonsense, the audio has already played.

**Recommended:** option 1, post-turn correction. It's bounded, observable, and uses only documented LiveKit primitives (`session.on("conversation_item_added")` + `update_chat_ctx`).

**Limitations:**
- Caller hears the wrong claim once before correction. UX-wise this is mitigated by a self-retracting follow-up turn ("Actually let me double-check that — one moment.") which our existing `STATE+DIRECTIVE` pattern can render.
- Regex is brittle. Mitigation: keep the regex narrow and OUTCOME-WORD aligned (`available|not available|booked|confirmed|all set|see you (tomorrow|at|on)`), since these are the same words the prompt already prohibits.

**Sources:** OpenAI Realtime developer notes ([developers.openai.com/blog/realtime-api](https://developers.openai.com/blog/realtime-api)). Memory `reference_livekit_update_chat_ctx_tool_results`.

---

### Fix B — Tool-description forcing on `check_slot` / `check_day` *(community pattern, Gemini-specific)*

Gemini conditions strongly on tool-description text (B-docs §2 community workaround section). The current `check_slot.py` description (A-codebase §1) reads:

> "Speak a short filler phrase first ('Let me pull that up real quick'), then invoke in the same turn. This tool's return is a state+directive string — do not read it aloud."

This documents *how to call*, not *when to call*. Add an explicit invocation condition aligned with Google's published Live API best-practices template (B-docs §1, *"Invocation Condition"* example):

> `Invocation Condition: Call this tool whenever the caller asks about a specific time, date, or asks any availability question ("any slots?", "what about tomorrow?", "5 PM works?"). Do NOT answer availability questions from memory; always invoke this tool first.`

Same addition for `check_day` and `next_available_days`. Wording is **outcome-phrased** ("Call this tool whenever...") not directive ("you must call X before Y") — passes the silence-deadlock memory test.

**Limitation:** Issue #1894 explicitly tested invocation-condition prose and showed mixed results on native audio. Combined with Fix A this is reinforcing, not load-bearing.

**Source:** Google Live API best practices ([ai.google.dev/gemini-api/docs/live-api/best-practices](https://ai.google.dev/gemini-api/docs/live-api/best-practices)).

---

### Fix C — Schema-level slot_token defense hardening *(community pattern + Vapi guidance)*

**Current state (A-codebase §1):** `register_slot_token` mints `"slot_" + secrets.token_hex(4)` (8 hex chars). 600s TTL. The format is opaque and unguessable in principle. The error path returns:

> `STATE:booking_invalid reason=missing_slot_fields | DIRECTIVE:apologize briefly; call check_slot again for the time the caller wants, then call book_appointment with the slot_token returned in the STATE line.`

This DIRECTIVE *describes the slot_token field by name*. Per OpenAI Realtime guide (C-best-practices §3d):

> "Do not blame the user or expose raw tool errors."

And Vapi guide ([docs.vapi.ai/prompting-guide](https://docs.vapi.ai/prompting-guide), C-best-practices §3a): *"Do not modify or attempt to correct user input parameters."*

**Proposal:**

1. **Shorten TTL from 600s → 120s.** The full call duration in this transcript was 263s; tokens valid for 10 minutes give Gemini a long window in which a fabricated structured token might match a registered token by accident. 120s covers normal "check, confirm, readback, book" without giving stale context. Single-call hard ceiling.
2. **Generic `STATE:slot_invalid` on token-resolution failure**, no DIRECTIVE pointing at the slot_token field. New string:
   > `STATE:slot_invalid | DIRECTIVE:do not retry book_appointment. Apologize, call check_slot for the time the caller wants, then book again.`

   Removes the format hint that "the field exists and is named slot_token."
3. **Optional but cheap: HMAC-sign tokens**. Instead of `secrets.token_hex(4)`, generate `slot_` + base32(HMAC(call_id|start_ts|end_ts, secret))[:8]. Enables stateless verification — but our current registry-based approach is already correct, so this is "nice to have" not "load-bearing."

**Limitation:** Schema defenses prevent successful fabricated bookings (already working — both attempts in this call were rejected). They don't prevent the *speech* hallucination, which is the user-visible bug. Pair with Fix A.

**Sources:** C-best-practices §3a, §3b, §3d.

---

### Fix D — STATE+DIRECTIVE consistency for `book_appointment` returns *(internal consistency cleanup)*

A-codebase §1 last paragraph: `book_appointment` success returns use `BOOKED [verdict=...]:` prefix, **not** `STATE:` — these strings are prose-shaped directives that don't follow the project's STATE+DIRECTIVE contract. Failure paths use `STATE:`. The mismatch means cascade-recovery can replay failure states cleanly but success states are inconsistent (and Gemini may treat the prose as speakable English).

**Proposal:** rewrite all three `BOOKED [verdict=...]` returns to `STATE:booking_success verdict=... formatted_address=... slot_speech=... | DIRECTIVE:...` shape.

**Why it matters for hallucination:** the existing `BOOKED [verdict=unvalidated]` path was hit twice in this call's pre-cascade path. If the agent reads any of that prose into the audio channel, the caller hears tool-protocol leakage (cf. [livekit/agents Issue #2174](https://github.com/livekit/agents/issues/2174), B-docs §4c).

**Limitation:** stylistic; smallest impact of the four fixes.

---

## 4. What I am explicitly *not* recommending (and why)

| Idea | Why not |
|---|---|
| Add more "DO NOT" wording to the prompt | Issue #1894 explicitly tested; ineffective on native audio |
| Switch to BLOCKING-only function calling | Already BLOCKING on Gemini 3.1; not the lever |
| Set `tool_choice=ANY` / forced function calling | Not exposed on Gemini Live API (B-docs §2) |
| Mid-session prompt updates when hallucination detected | `mutable_chat_context=False` on 3.1 (memory + B-docs §problem 2) |
| Numbered-step Vapi-style scripts | Vapi runs on text LLMs; pattern doesn't transfer to native audio (C-best-practices §1 Pattern D) |
| Switch off native audio (Gemini 2.5 cascaded mode) | Out of scope; native-audio voice quality is a deliberate product choice |

## 5. Implementation order

Do Fix B first (cheapest, lowest-risk), then Fix C (still no behavior change for happy path), then Fix A (the actual fix), then Fix D last (cleanup).

| Step | File | Change | Risk |
|---|---|---|---|
| 1 | `src/tools/check_slot.py` `check_day.py` `next_available_days.py` | Add `Invocation Condition:` paragraph to the description block | Low — text-only |
| 2a | `src/tools/_availability_lib.py` | Lower `SLOT_TOKEN_TTL_S` 600 → 120 | Low — no normal call exceeds 120s slot-to-book |
| 2b | `src/tools/book_appointment.py` | Rewrite `STATE:booking_invalid reason=missing_slot_fields` and `reason=malformed_slot_iso` to a single `STATE:slot_invalid` with no field hints | Low |
| 3 | `src/agent.py` + new `src/lib/hallucination_guard.py` | New `conversation_item_added` listener that scans agent turns for OUTCOME WORDS without matching tool grounding; injects `STATE:hallucination_correction` `FunctionCallOutput` via `update_chat_ctx` | Medium — new code path; needs feature flag + careful rollout |
| 4 | `src/tools/book_appointment.py` | Convert all `BOOKED [verdict=...]` returns to `STATE:booking_success ... \| DIRECTIVE:...` shape; update prompt's `_build_address_validation_section` references | Low — stylistic |

Each step ships as its own atomic commit. Step 3 ships behind a `HALLUCINATION_GUARD_ENABLED` env var so it can be toggled off if the regex fires false positives.

## 6. Validation

For each step, the test gate is the *next test call after deploy*:

- After step 1: tool calls happen reliably for the patterns in the description (caller asks day/time → tool fires).
- After step 2: a fabricated `slot_token` returns `STATE:slot_invalid` and Gemini does not retry without check_slot.
- After step 3: log a `[hallucination_guard] injected correction tool=check_slot trigger='available'` line on detect; verify in Railway log that the next agent turn apologizes and fires the right tool.
- After step 4: transcript lines do not contain `BOOKED` prose tokens.

## 7. Open questions for the user before code

1. **Fix A regex scope.** Should we fire on `available|not available|booked|all set|confirmed` only, or also include `we have slots`, `that works`, `that's free`? Wider net = more false positives, narrower = more false negatives. Recommend starting narrow.
2. **Fix A trigger latency.** OpenAI's pattern fires *during* the audio playback (interrupt + inject). Our pattern fires post-turn (after `conversation_item_added`). Acceptable, or do we want to research interrupt-mid-utterance?
3. **Step 4 scope.** Do we touch only `book_appointment` or do all tools simultaneously to enforce the STATE+DIRECTIVE contract uniformly? (next_available_days, check_caller_history, etc. — most already conform.)

## 8. References

- A-codebase.md §1 (current prompt + tool wiring)
- B-docs.md §1 (Google Live API best-practices, invocation conditions)
- C-best-practices.md §1 Pattern A + Pattern C, §2 (no `tool_choice=ANY`), §3 (slot-token defenses), §4 (Issue #1894 acknowledged-not-planned)
- Memory: `feedback_livekit_prompt_philosophy`, `feedback_directive_prompt_silence_deadlock`, `reference_livekit_update_chat_ctx_tool_results`
