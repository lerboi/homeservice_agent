# C — Best Practices: Tool-Grounded Voice Agent Responses

**Research date:** 2026-05-08
**Scope:** Production patterns for preventing tool-result hallucination on Gemini 3.1 Flash Live + LiveKit, with cross-references to OpenAI Realtime, Pipecat, Vapi, GetStream, and DeepMind sources.
**Caveat on the documented failure mode:** Multiple primary sources confirm the bug we're seeing is a known, *Google-acknowledged-then-closed-as-not-planned* defect in native-audio Gemini models, not a prompt skill issue. See section 4.

---

## 1. Tool-grounded response patterns (with sources)

### Pattern A — Phase / state-machine prompts with explicit "Exit when" criteria

**Who uses it:** OpenAI's official Realtime Prompting Guide (gpt-realtime-2 / gpt-5.4 voice agents).

**Shape:** Structure the system prompt as numbered phases. Each phase declares Goal, How to respond, and an Exit-when criterion. The Exit-when is what gates progression — and it's expressed as a tool-result-shaped condition, not a model judgment.

```
## 3) Verify
Goal: Confirm identity and retrieve the account.
How to respond: Once you have email or phone, call lookup_account().
Exit when: Account ID is returned.
```

(quoted from OpenAI Realtime Models Prompting Guide, [developers.openai.com/api/docs/guides/realtime-models-prompting](https://developers.openai.com/api/docs/guides/realtime-models-prompting))

**When it works:** Multi-turn flows with clear phase boundaries (greeting → triage → check availability → book). The Exit-when concrete criterion ("Account ID is returned", "STATE:slot_token=...") gives the model a verifiable handle, not a vibe.

**When it fails:** When the phase boundary is *itself* what the model has to infer — e.g. "caller mentioned a time" is an entity-extraction judgment, and Gemini 3.1 Flash Live is documented to ignore conditional triggers under audio-channel pressure (Google Issue [#1894](https://github.com/googleapis/python-genai/issues/1894), section 4 below).

---

### Pattern B — Tool preambles ("checking that now") instead of mid-tool silence

**Who uses it:** OpenAI Realtime API (`gpt-realtime-2`), and explicitly recommended in the official Voice Agents Prompting guide.

**Shape:**

> "Before any tool call, say one short line like 'I'm checking that now.' Then call the tool immediately."
>
> Approved examples: *"I'll check that order now," "I'll look up your appointment details," "I'll verify that before we make any changes."*
>
> Avoid: *"Let me think," "Hmm," "One moment while I process that."*

(quoted from OpenAI Realtime Models Prompting, [developers.openai.com/api/docs/guides/realtime-models-prompting](https://developers.openai.com/api/docs/guides/realtime-models-prompting))

**When it works:** It moves the model from "speak-or-call" into "speak-then-call" — the preamble is the verbal commitment that a tool call is coming, which structurally pre-empts the "yes, we have slots" hallucination because the model has already committed to "checking" rather than "answering."

**When it fails:** With a directive prompt + silence license, the preamble becomes the *only* output and the model never fires the tool. Documented in this project's memory file `feedback_directive_prompt_silence_deadlock.md`. Mitigation: phrase as outcome ("the caller hears a short check-acknowledgment, then the tool result"), never as license to wait.

---

### Pattern C — Tool-output formatting rule: "result-dependent speech only"

**Who uses it:** OpenAI Realtime Prompting Guide, Tool Output Formatting section.

**Shape:**

> "Do not say an action was completed after the tool call succeeds. [...] Briefly explain what failed in user-friendly language. Do not blame the user or expose raw tool errors."

(quoted from OpenAI Realtime Models Prompting, [developers.openai.com/api/docs/guides/realtime-models-prompting](https://developers.openai.com/api/docs/guides/realtime-models-prompting))

This is the rule that maps cleanly onto our STATE+DIRECTIVE return contract: only the STATE field's contents become speech-able facts, only after it's returned.

**When it works:** As a *speech-channel* hard constraint ("availability claims, prices, names, and dates must come from STATE"). Hard constraints on verifiable claims are in our memory as a *recommended* prompt shape (`feedback_livekit_prompt_philosophy.md`).

**When it fails:** As a process rule ("you must call X before Y") — Gemini 3.1 Flash Live's audio path is documented to under-follow process rules (Issue [#1894](https://github.com/googleapis/python-genai/issues/1894), Issue [#2174](https://github.com/livekit/agents/issues/2174)).

---

### Pattern D — "Intent → summarize → confirm → tool" ordering for write actions

**Who uses it:** OpenAI Realtime Prompting Guide for write/booking operations; Vapi's appointment-setter prompting guide uses a near-identical numbered sequence.

**Shape (OpenAI):**

> "Summarize the intended action before calling the tool. Include the key consequence, such as what will be changed, sent, canceled, ordered, or charged. Ask for confirmation. Do not call the tool until the user clearly confirms."

(quoted from OpenAI Realtime Models Prompting, [developers.openai.com/api/docs/guides/realtime-models-prompting](https://developers.openai.com/api/docs/guides/realtime-models-prompting))

**Shape (Vapi):**

> "4. Trigger the 'fetchSlots' tool and map the result to {{available_slots}}. 5. Ask: 'I have two slots available, {{available_slots}}.'"

(quoted from Vapi Prompting Guide, [docs.vapi.ai/prompting-guide](https://docs.vapi.ai/prompting-guide))

The Vapi pattern is the explicit "tool-then-speak" sequence we want — but note Vapi runs on text LLMs (gpt-4o, Claude) via cascaded ASR→LLM→TTS, not on a native-audio model. The pattern transfers in spirit, not in reliability.

**When it works:** Booking/commit-style flows where there's a natural clarification turn before the action (Vapi's numbered-step format works because the text LLM follows numbered scripts very faithfully).

**When it fails:** On Gemini 3.1 Flash Live in audio-in mode — even with explicit DO NOT instructions, the model emits speculative answers (Issue [#1894](https://github.com/googleapis/python-genai/issues/1894)).

---

### Pattern E — Speculative tool calling with isolated speculation track

**Who uses it:** GetStream voice-agent engineering ([getstream.io/blog/speculative-tool-calling-voice](https://getstream.io/blog/speculative-tool-calling-voice/)).

**Shape:** Fire the tool *speculatively in parallel* with a filler line, but isolate the result so it doesn't contaminate the response unless the LLM explicitly requests it.

> "Track A (The Filler): Immediate conversational acknowledgement sent to TTS. Track B (The Speculation): Silent tool prediction and execution happening in the background. [...] keep speculative results separate from the response generation until the LLM explicitly decides to use them."

(quoted from [getstream.io/blog/speculative-tool-calling-voice](https://getstream.io/blog/speculative-tool-calling-voice/))

**When it works:** When you control the orchestration layer (LiveKit agent process), you can pre-fetch availability when the model first hints at a time, then the *blocking* tool call returns near-instantly because cache is warm. Reduces voice gap; doesn't itself solve hallucination.

**When it fails:** Doesn't address the root failure (model speaking before any tool fires). Useful as a latency cover, not a hallucination defense.

---

## 2. Forced function calling on Gemini Live — definitive answer

**Definitive answer: Gemini 3.1 Flash Live does NOT support `tool_config.function_calling_config.mode=ANY` (forced function calling) at the Live API level.**

Evidence:

1. The standard Gemini API supports four `FunctionCallingConfig` modes — AUTO, VALIDATED, ANY, NONE — with `allowed_function_names` to constrain to a subset. ([ai.google.dev/gemini-api/docs/function-calling](https://ai.google.dev/gemini-api/docs/function-calling)).
2. The Gemini Live API tool-use docs ([ai.google.dev/gemini-api/docs/live-api/tools](https://ai.google.dev/gemini-api/docs/live-api/tools)) only describe basic `function_declarations` in the `tools` list inside `LiveConnectConfig`. There is no documented `tool_config` parameter on Live setup messages.
3. The Vertex Live API capabilities reference ([docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api/configure-gemini-capabilities](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api/configure-gemini-capabilities)) similarly omits any mode/tool_choice fields.
4. Gemini 3.1 Flash Live additionally drops `behavior: NON_BLOCKING` support — function calling is synchronous-only on this model. ([ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview), [ai.google.dev/gemini-api/docs/live-api/capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities)).

**Community workaround:** since `mode=ANY` isn't available, production builders rely on:

- **Tool-description forcing** — write the function description as a guard clause ("Call this tool whenever the caller mentions any specific time, day, or asks about availability — do not answer availability questions without calling this tool first"). Description text is what Gemini actually conditions on.
- **Schema-level invariants** — make the `book_appointment` function require an opaque `slot_token` field that *only* `check_slot` returns, so the model cannot reach the booking tool without going through the check first. (Already partially done in our codebase; the failure case is fabricated tokens, see section 3.)
- **Native-audio fallback to half-cascade** — Several issues (Issue [#1894](https://github.com/googleapis/python-genai/issues/1894), Issue [#2174](https://github.com/livekit/agents/issues/2174)) show builders moving off native audio for tool-heavy flows because forced function calling is unavailable and hallucination cannot be prompted away.

---

## 3. Slot-token fabrication defenses

No single source ships a published "production booking-token" pattern, but converging guidance from the sources I read:

### 3a. Opaque, unguessable, schema-validated tokens

Vapi's prompting guide explicitly says:

> "Do not modify or attempt to correct user input parameters or user input. Pass them directly into the function or tool as given."

(quoted from [docs.vapi.ai/prompting-guide](https://docs.vapi.ai/prompting-guide))

This works only if the token format is genuinely opaque. Structured strings (`slot_2026_05_08_0800_serviceA`) pattern-match for the LLM, which means it can fabricate them. UUIDv4 or HMAC-signed random tokens cannot be fabricated convincingly. **Source:** GetStream's speculative-tool article makes the same point about isolating speculative IDs from the LLM context.

### 3b. Server-side token verification with HMAC

No published source — community pattern from production booking systems. Sign the slot_token server-side (HMAC over `tenant_id|service_id|start_ts`) and reject any token whose signature doesn't verify. The validation error must NOT echo the expected format back to the model — return a generic STATE:slot_invalid that triggers a re-check, not a parser error that teaches the model the format.

### 3c. Single-use tokens with short TTL

No published source for voice specifically — community pattern from idempotency-key flows. Booking tokens expire 60–120 seconds after `check_slot` returns them and are single-use server-side. This bounds the fabrication window and forces a real `check_slot` call on every booking attempt.

### 3d. Don't surface format in tool descriptions or errors

OpenAI's Realtime guide explicitly warns:

> "Do not blame the user or expose raw tool errors."

(quoted from [developers.openai.com/api/docs/guides/realtime-models-prompting](https://developers.openai.com/api/docs/guides/realtime-models-prompting))

Applied to tokens: if `book_appointment` fails because the token is fabricated, return STATE:slot_invalid with no format hint. Never let an error message describe what a valid token looks like — the model will use that hint to forge a better one next time.

---

## 4. Native-audio model hallucination biases

This is the core of the issue and it's *documented*, not a skill problem.

### 4a. Google-acknowledged-then-closed bug for native audio

**[GitHub Issue googleapis/python-genai #1894](https://github.com/googleapis/python-genai/issues/1894)** — "Gemini 2.5 Flash Native Audio Preview 12-2025 - Model Hallucinates Before NON_BLOCKING Tool Results Return."

Reproduction (verbatim from the issue): caller asks "Who is the president?" → model says "Let me check that for you" → calls deepSearch → states "Joe Biden is the president" → tool returns Trump → model corrects.

Closed by Google as **"not planned"** with `p2` priority and a "stale" label. Workarounds documented in the issue:

- **BLOCKING mode** — eliminates hallucination but produces dead-air silence (poor UX).
- **WHEN_IDLE scheduling** — failed to prevent initial false responses.
- **"DO NOT provide speculative answers" instructions** — *explicitly tested, ineffective*.

This bug is on Gemini 2.5 Flash Native Audio. Our model is Gemini 3.1 Flash Live (a different generation), but **3.1 Flash Live shares the native-audio architecture and is described in Google's own release post as a reliability *improvement* — meaning the underlying class of bug is acknowledged.** Google's blog ([blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-live](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-live/)) cites a 90.8% ComplexFuncBench Audio score (i.e. 1-in-10 calls is wrong) as the headline reliability number.

### 4b. Function calling synchronous-only on 3.1

> "Asynchronous function calling is not yet supported in Gemini 3.1 Flash Live. The model will not start responding until you've sent the tool response."

([ai.google.dev/gemini-api/docs/live-api/capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities), confirmed in [ai.google.dev/gemini-api/docs/live-api/tools](https://ai.google.dev/gemini-api/docs/live-api/tools))

**Implication:** the model has only two states — "speak from training/context" or "wait for tool response." There is no "speak the filler while the tool runs" middle ground. So if the model decides to speak about availability without a tool, the tool never fires that turn.

### 4c. LiveKit-side bug confirming model emits literal token strings

**[GitHub Issue livekit/agents #2174](https://github.com/livekit/agents/issues/2174)** — "agent saying words like: 'tools_output' during function-call - gemini real time API." This is a separate failure mode where the model verbalizes tool-protocol tokens, again on Gemini Live, again unmitigated by prompting.

### 4d. Optimistic / confident-completion bias

OpenAI's Realtime Developer Notes ([developers.openai.com/blog/realtime-api](https://developers.openai.com/blog/realtime-api)) explicitly call out the same class of bug for `gpt-4o-realtime`:

> "the model sometimes hallucinates the content of a nonexistent function response."

OpenAI's *production* mitigation: server-injected placeholder responses ("I'm still waiting on that") tuned in experiments. This is not a prompt-level fix — it's a server-injected message that auto-fires when the model starts speaking with a pending function call. Google has no equivalent; we'd have to build it ourselves (LiveKit-side interrupt + injected tool-result reminder).

---

## 5. Recommended pattern for OUR stack

Constraints we have to live with:
- BLOCKING tool calls only (Gemini 3.1 Flash Live).
- `mutable_chat_context=False` — instructions cannot be updated mid-session.
- STATE+DIRECTIVE tool returns (not speakable).
- No `tool_choice=ANY` available on Live API.
- Memory: directive prompts deadlock; outcome-based phrasing > directive; hard constraints fine for verifiable claims; exact phrases fine for prohibitions.

**Pick: Pattern A (state-machine Exit-when) layered with Pattern C (result-dependent speech hard constraint), plus schema defenses from §3.**

### Why these two over the alternatives

- **Pattern A (state-machine with Exit-when criteria)** is the *only* pattern in the corpus that gates progression on a **verifiable condition the model can pattern-match**, not on an inferred caller intent. In our case, the Exit-when for the "discuss availability" phase becomes "the most recent tool message contains STATE:slot_status=...". This is a syntactic check the model can perform on its visible chat context — it's exactly the kind of "verifiable claim" hard constraint our memory says works.
- **Pattern C (result-dependent speech)** maps onto STATE+DIRECTIVE 1:1. We add a single hard prohibition: *"Availability, prices, days, and times must be quoted only from a STATE field in the most recent tool message. If no STATE field is present for the time the caller mentioned, the only allowed response is to call check_slot or check_day."* This is **outcome-phrased** ("must be quoted only from") not directive ("you must call X before Y"), which sidesteps the silence-deadlock memory.

### Why NOT the alternatives

- **Pattern B (tool preambles)** alone: helpful as a co-pattern but insufficient — Issue #1894 explicitly tested "say 'let me check' first" and the model still hallucinated the answer.
- **Pattern D (intent → summarize → confirm)**: works on text LLMs (Vapi); Issue #1894 shows it doesn't work on native-audio Gemini.
- **Pattern E (speculative parallel)**: doesn't fix hallucination, only voice gap. Worth adopting *separately* later for latency.
- **Forced function calling (`mode=ANY`)**: not available on Gemini Live API. Cannot be used.

### Concrete prompt shape (outcome-phrased, no directive trap)

Restated as the system-prompt text we'd add (not a final draft — a target shape):

```
Speech-channel facts rule:
Any availability statement, day/time confirmation, price, or
appointment slot you say to the caller must appear verbatim in
a STATE field of the most recent tool message. If the caller
mentions a specific time or asks about availability and there is
no STATE field covering that time, the next observable agent
behavior is a check_slot or check_day tool call.

Phase: Discuss availability
  Goal: produce a slot_token bound to a real, free time.
  Exit when: STATE:slot_token=... is present in tool output.
  Until exit: time-bound questions are answered only from STATE.
```

This is a hard *speech-channel* constraint (ok per memory), framed by phase Goal and Exit-when (Pattern A), with outcome-phrased behavior expectation ("the next observable behavior is a tool call") rather than directive ("you must call X").

### Schema-side defenses to ship in parallel (from §3)

1. Make `slot_token` a server-signed HMAC over (tenant_id, service_id, start_ts, expiry_ts), 60-second TTL, single-use.
2. Reject fabricated tokens with `STATE:slot_invalid` only — never echo expected format.
3. Add `check_day` tool description: "Call this tool whenever the caller asks about a specific day's availability or mentions any day/time. Do not answer availability questions without calling this tool." (Description-text forcing — community-confirmed Gemini conditions on description text strongly.)
4. Consider OpenAI-style server-side placeholder injection: if the agent emits an availability-shaped utterance with no recent `check_*` tool message in the chat context, interrupt and inject a synthetic user turn ("hold on, can you check that for me?") to force the tool. Memory entry `reference_livekit_update_chat_ctx_tool_results.md` confirms `update_chat_ctx` is unconditional on 3.1, so this injection path is open.

### What's known to NOT work (don't try these again)

- "DO NOT speculate" instructions — tested in Issue #1894, ineffective.
- BLOCKING-only — produces dead air, fails UX (Issue #1894).
- `tool_choice=ANY` — not available on Gemini Live (§2).
- Mid-session prompt updates — `mutable_chat_context=False` (project memory).
- Numbered-step Vapi-style scripts — Vapi runs on text LLMs not native audio; doesn't transfer.

---

## Sources

- [OpenAI — Realtime Models Prompting](https://developers.openai.com/api/docs/guides/realtime-models-prompting)
- [OpenAI — Realtime Prompting Guide (Cookbook)](https://developers.openai.com/cookbook/examples/realtime_prompting_guide)
- [OpenAI — Developer Notes on the Realtime API](https://developers.openai.com/blog/realtime-api)
- [Google — Tool use with Live API](https://ai.google.dev/gemini-api/docs/live-api/tools)
- [Google — Function calling with the Gemini API](https://ai.google.dev/gemini-api/docs/function-calling)
- [Google — Live API capabilities guide](https://ai.google.dev/gemini-api/docs/live-api/capabilities)
- [Google — Gemini 3.1 Flash Live Preview model card](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview)
- [Google — Vertex Live API: configure Gemini capabilities](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api/configure-gemini-capabilities)
- [Google Blog — Gemini 3.1 Flash Live launch post](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-live/)
- [GitHub Issue python-genai #1894 — Native audio hallucinates before tool result](https://github.com/googleapis/python-genai/issues/1894)
- [GitHub Issue livekit/agents #2174 — Agent verbalizes tool-protocol tokens](https://github.com/livekit/agents/issues/2174)
- [LiveKit — Function calling with Voice Agents](https://docs.livekit.io/agents/voice-agent/function-calling/)
- [LiveKit — Prompting voice agents to sound more realistic](https://livekit.com/blog/prompting-voice-agents-to-sound-more-realistic)
- [Vapi — Voice AI Prompting Guide](https://docs.vapi.ai/prompting-guide)
- [GetStream — Speculative Tool Calling for Voice](https://getstream.io/blog/speculative-tool-calling-voice/)
- [kwindla — Advice on Voice Agents (June 2025)](https://gist.github.com/kwindla/f755284ef2b14730e1075c2ac803edcf)
