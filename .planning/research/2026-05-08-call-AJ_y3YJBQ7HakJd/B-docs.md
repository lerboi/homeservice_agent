# B-docs: Official Documentation Research

**Date:** 2026-05-08
**Call:** AJ_y3YJBQ7HakJd
**Stack under review:** `livekit-agents` 1.5.7, `livekit.plugins.google` 1.5.7, `gemini-3.1-flash-live-preview` over `AgentSession(llm=RealtimeModel(...))`, server-side VAD, BLOCKING function calling.

This report is sourced exclusively from official Google AI / Vertex AI / LiveKit / Google Maps documentation. Where a topic is genuinely undocumented, that is stated explicitly.

---

## Problem 1 — Slot-availability hallucination

### Documented behavior

Google's Live API best-practices guide treats hallucination as a system-instruction problem first, and offers a structured prompt template (persona → conversational rules → guardrails) plus explicit per-tool **invocation conditions** that bind the model's behavior to tool execution. The Live API also supports first-party grounding (e.g., Google Search) but for custom data the canonical grounding mechanism is function calling itself — i.e., the *only* way the agent legitimately knows a slot is available is if a `FunctionResponse` carrying that fact has been sent back into the session.

### Quoted excerpts

> "To get the best performance out of Live API, it's recommended to have a clearly-defined set of system instructions (SIs) that defines the agent persona, conversational rules, and guardrails, in this order."
> — *Live API best practices*, https://ai.google.dev/gemini-api/docs/live-api/best-practices

> "Specify the agent persona... Specify the conversational rules... Add any necessary guardrails."
> — *Live API best practices*, https://ai.google.dev/gemini-api/docs/live-api/best-practices

> "Invocation Condition: Invoke this tool *only after* the client has provided their full name, date of birth, AND state."
> — *Live API best practices* (tool-definition example), https://ai.google.dev/gemini-api/docs/live-api/best-practices

> "If you're still not getting the preferred level of precision, use the word *unmistakably* to guide the model to be precise."
> — *Live API best practices*, https://ai.google.dev/gemini-api/docs/live-api/best-practices

> "In generative AI, grounding is the ability to connect model output to verifiable sources of information. If you provide models with access to specific data sources, then grounding tethers their output to these data and reduces the chances of inventing content."
> — *Grounding overview*, https://cloud.google.com/vertex-ai/generative-ai/docs/grounding/overview

> "Live API supports function calling... function calling lets the Live API interact with external data and programs... after receiving tool calls, the client should respond with a list of FunctionResponse objects using the `session.send_tool_response` method."
> — *Tool use with Live API*, https://ai.google.dev/gemini-api/docs/live-api/tools

> "Function calling executes sequentially by default, meaning execution pauses until the results of each function call are available. This ensures sequential processing, which means you won't be able to continue interacting with the model while the functions are being run."
> — *Tool use with Live API*, https://ai.google.dev/gemini-api/docs/live-api/tools

### What this implies for our stack

Google does not publish a single "anti-hallucination flag" for tool use; their documented mechanism is structural: each tool's docstring/description must contain an explicit **Invocation Condition** that ties phrases the agent might say ("we have slots", "Monday 8am is available") to the precondition that the matching tool was just called and returned. Combined with a guardrail clause in the system instructions ("never state availability or confirm a booking unless `check_slot` / `check_day` / `book_appointment` returned successfully"), this is the only documented pattern. Native-audio Gemini 3.1 has no separate STT/LLM/TTS layer where we could intercept and validate — the constraint must live in the prompt.

---

## Problem 2 — Cascade after BLOCKING tool call

### Documented behavior

Three documented constraints stack to produce the cascade we observe:

1. **Function calling on Gemini 3.1 Flash Live is strictly synchronous and blocking** — the model halts generation until a `FunctionResponse` lands. There is no `NON_BLOCKING` escape hatch on this model.
2. **VAD-driven server cancellation discards pending function calls.** When the server's automatic activity detector fires (or any other server-side cancel happens), the server discards in-flight tool calls and emits a `BidiGenerateContentServerContent` carrying the cancelled IDs. Tool responses sent for those IDs are no longer correlated with an active generation.
3. **Mid-session updates on Gemini 3.1 are heavily restricted.** `send_client_content` is initial-history-only (rejected with WebSocket close 1007 after the first model turn). The LiveKit Google plugin documents that `generate_reply()`, `update_instructions()`, and `update_chat_ctx()` "are not compatible with 3.1 models" and the plugin "logs a warning and the call is ignored."

The "limited mid-session update support" warning surfaced by `livekit.plugins.google` is the LiveKit-side shim for these Google constraints — it is **not** a benign info log: on Gemini 3.1 it means the call did nothing at all.

### Quoted excerpts

> "**Note:** Asynchronous function calling is not yet supported in Gemini 3.1 Flash Live. The model will not start responding until you've sent the tool response."
> — *Tool use with Live API*, https://ai.google.dev/gemini-api/docs/live-api/tools

> "Function calling is sequential only" (Gemini 3.1) vs "Supports asynchronous function calling with `NON_BLOCKING` behavior" (Gemini 2.5).
> — *Live API guide*, https://ai.google.dev/gemini-api/docs/live-guide

> "When VAD detects an interruption, the ongoing generation is canceled and discarded. Only the information already sent to the client is retained in the session history."
> — *Live API capabilities*, https://ai.google.dev/gemini-api/docs/live-api/capabilities

> "The Gemini server then discards any pending function calls and sends a `BidiGenerateContentServerContent` message with the IDs of the canceled calls."
> — *Live API capabilities*, https://ai.google.dev/gemini-api/docs/live-api/capabilities

> "Gemini 3.1 Flash Live Preview restricts `send_client_content` to initial history seeding only (requires setting `initial_history_in_client_content` in session config). To send text updates during the conversation, use `send_realtime_input` instead. After the first model turn, the model rejects `send_client_content` with a 1007 error."
> — *Live API capabilities* and *Gemini 3.1 Flash Live Preview model card*, https://ai.google.dev/gemini-api/docs/live-api/capabilities and https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview

> "`generate_reply()`, `update_instructions()`, and `update_chat_ctx()` are not compatible with 3.1 models." ... "the plugin logs a warning and the call is ignored." ... "Because `update_instructions()` is not supported mid-session, agent handoffs that use `session.update_agent()` are also affected."
> — *Gemini Live API plugin*, https://docs.livekit.io/agents/models/realtime/plugins/gemini/

> "Asynchronous function calling is not supported. The model pauses and waits for your tool response before continuing."
> — *Gemini Live API plugin*, https://docs.livekit.io/agents/models/realtime/plugins/gemini/

> VAD configurable parameters: `start_of_speech_sensitivity`, `end_of_speech_sensitivity`, `prefix_padding_ms`, `silence_duration_ms` under `realtimeInputConfig.automaticActivityDetection`. "VAD can also be disabled entirely by setting `disabled` to `true`." When disabled, "the client is responsible for detecting user speech and sending `activityStart` and `activityEnd` messages at the appropriate times."
> — *Live API capabilities*, https://ai.google.dev/gemini-api/docs/live-api/capabilities

> AgentSession event lifecycle — `agent_state_changed` exposes states `initializing | idle | listening | thinking | speaking`. `function_tools_executed` carries `function_calls`, `function_call_outputs`, `has_tool_reply`, `has_agent_handoff`, plus `cancel_tool_reply()` / `cancel_agent_handoff()` controls. `speech_created` exposes `source` ∈ `{say, generate_reply, tool_response}` and a `SpeechHandle`.
> — *Agent events*, https://docs.livekit.io/agents/build/events/

> Tool return-value contract: "The tool return value is automatically converted to a string before being sent to the LLM." Long-running async tools "run in the background so the agent can keep talking while the tool works." Use `ToolError` to surface error semantics to the LLM.
> — *Function tools*, https://docs.livekit.io/agents/logic/tools/definition

### Undocumented topics (explicitly)

- **No documented behavior** for "client sends a tool response after the server has already cancelled the call." The capabilities guide states only that the server "discards any pending function calls" and emits cancelled IDs; what the model does with a late `FunctionResponse` for a cancelled ID is not specified by Google.
- **No documented stall-detection or recovery pattern.** Neither the Google Live API docs nor the LiveKit Agents docs describe a sanctioned pattern for "agent_state=speaking with no audio frames for N seconds." The `_SegmentSynchronizerImpl.playback_finished called before text/audio input is done` and `received server content but no active generation` strings appear in `livekit-agents` source but are not described in user-facing docs as recoverable conditions.
- **No documented retry pattern for tool-result re-injection.** The LiveKit Google plugin documents that `update_chat_ctx()` is *ignored* on Gemini 3.1, which means our 25 s timeout + `update_chat_ctx`-based re-injection has no Google-blessed equivalent. The `mutable_chat_context` parameter is not present in the public Gemini Live plugin docs.
- **`session.input.set_audio_enabled` is not in the public LiveKit docs we could surface.** The audio docs cover `session.say()`, `session.generate_reply()`, `SpeechHandle`, and *client-side* `room.localParticipant.setMicrophoneEnabled()`, but `session.input` audio gating is undocumented at the agent-session level.

### What this implies for our stack

The cascade is the documented intersection of three product constraints, not a bug we can flag-flip away. Server VAD cancellation explicitly throws away pending tool calls; Gemini 3.1 forbids `send_client_content` after the first model turn; LiveKit's `update_chat_ctx()` is documented as ignored on Gemini 3.1. The canonical Google path for delivering a tool result on Gemini 3.1 Live is `session.send_tool_response()` carrying a `FunctionResponse(id=fc.id, name=fc.name, response={...})` — that is what the Google docs prescribe, and `update_chat_ctx`-based replay is a LiveKit-internal workaround not endorsed in either vendor's docs. Faster stall detection (sub-25 s) and any structural-mute pattern operate entirely outside documented territory; they are valid engineering choices but cannot be cited to a Google or LiveKit doc.

---

## Problem 3 — Address Validation API auth

### Documented behavior

The Address Validation API authenticates requests via a Google Maps Platform **API key** sent on every HTTPS request. There is no separately documented OAuth/service-account auth path for this REST API in the public Address Validation docs; the cloud-setup page is the canonical auth reference and it specifies API keys.

### Quoted excerpts

> "Google Maps Platform secures its products by requiring API keys for authentication and billing purposes."
> — *Address Validation — Get an API key*, https://developers.google.com/maps/documentation/address-validation/get-api-key

> "Include your API key in every Address Validation API request using HTTPS."
> — *Address Validation — Get an API key*, https://developers.google.com/maps/documentation/address-validation/get-api-key

> "create and manage API keys through the Google Cloud Console or the Cloud SDK." ... "restrict your API keys for enhanced security by limiting their usage to specific APIs and IP addresses."
> — *Address Validation — Get an API key*, https://developers.google.com/maps/documentation/address-validation/get-api-key

> Singapore is on the supported-coverage list (alongside Argentina, Austria, Australia, Belgium, Bulgaria, Brazil, Canada, Switzerland, Chile, Colombia, Czechia, Germany, Denmark, Estonia, Spain, Finland, France, UK, Croatia, Hungary, Ireland, India, Japan, Lithuania, Luxembourg, Latvia, Mexico, Malaysia, Netherlands, Norway, New Zealand, Poland, Puerto Rico, Portugal, Sweden, Slovenia, Slovakia, US). "The API does not support dependent territories with unique CLDR codes unless explicitly listed." India and Japan are flagged "preview (pre-GA)"; Singapore is not flagged preview, but `residential`/`commercial` metadata is not populated for SG.
> — *Address Validation — Coverage*, https://developers.google.com/maps/documentation/address-validation/coverage

### What this implies for our stack

`GOOGLE_MAPS_API_KEY` (HTTPS query-param or `X-Goog-Api-Key` header) is the only auth mechanism documented for server-side Address Validation REST calls — no service-account or OAuth path is missing from our setup. Singapore is fully supported (not preview), so SG-based callers can validate addresses with the standard endpoint; the only documented SG caveat is that the response will not carry `residential`/`commercial` flags, which is a data-coverage issue rather than an auth or availability issue.

---

## Cross-cutting findings

1. **Native-audio Gemini 3.1 Live is a deliberately constrained surface.** Compared to Gemini 2.5 Flash Live, the 3.1 model trades feature breadth (no `NON_BLOCKING` tools, no proactive audio, no affective dialog, no mid-session `send_client_content`, no mid-session instruction or chat-context updates via the LiveKit plugin) for native-audio quality. Every documented "limitation" we see is on Google's published differences list — nothing we're hitting is an undocumented bug. (https://ai.google.dev/gemini-api/docs/live-guide, https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview, https://docs.livekit.io/agents/models/realtime/plugins/gemini/)

2. **The canonical Google path for tool results is `session.send_tool_response()` with `FunctionResponse(id, name, response)`.** This is the only path the Google Live API tools doc shows. LiveKit's `update_chat_ctx(...)`-with-appended-`FunctionCallOutput` pattern is not in the Google docs; combined with the LiveKit plugin's own statement that `update_chat_ctx()` is ignored on 3.1, our reliance on it for replay is unsupported by both vendors' docs. (https://ai.google.dev/gemini-api/docs/live-api/tools, https://docs.livekit.io/agents/models/realtime/plugins/gemini/)

3. **Server VAD owns cancellation.** Per Google, VAD-detected interruption cancels the in-flight generation, discards pending function calls, and notifies the client with cancelled IDs. Combined with our server-VAD configuration and Gemini's own EOS detection, this is the most likely trigger for the "speaking with no audio" cascade — the server cancelled, we didn't observe the cancelled-IDs message in time, and our `update_chat_ctx` replay landed in a context the model can no longer accept on 3.1. (https://ai.google.dev/gemini-api/docs/live-api/capabilities)

4. **System instructions are the documented anti-hallucination tool.** Google's best-practices doc explicitly recommends per-tool *Invocation Conditions* and persona/rules/guardrails ordering. There is no documented post-hoc validator for native-audio — the prompt has to do this work. (https://ai.google.dev/gemini-api/docs/live-api/best-practices)

5. **Address Validation auth is unambiguous.** API key only, Singapore is on the supported list and is not preview-flagged. (https://developers.google.com/maps/documentation/address-validation/get-api-key, https://developers.google.com/maps/documentation/address-validation/coverage)

---

## Source index

- Google AI — Live API guide: https://ai.google.dev/gemini-api/docs/live-guide
- Google AI — Live API tools: https://ai.google.dev/gemini-api/docs/live-api/tools (formerly /docs/live-tools)
- Google AI — Live API capabilities: https://ai.google.dev/gemini-api/docs/live-api/capabilities
- Google AI — Live API best practices: https://ai.google.dev/gemini-api/docs/live-api/best-practices
- Google AI — Live API session management: https://ai.google.dev/gemini-api/docs/live-session
- Google AI — Gemini 3.1 Flash Live Preview model card: https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview
- Google Cloud — Grounding overview: https://cloud.google.com/vertex-ai/generative-ai/docs/grounding/overview
- LiveKit — Gemini Live API plugin: https://docs.livekit.io/agents/models/realtime/plugins/gemini/
- LiveKit — Function tools: https://docs.livekit.io/agents/logic/tools/definition
- LiveKit — Agent events: https://docs.livekit.io/agents/build/events/
- Google Maps — Address Validation, Get an API key: https://developers.google.com/maps/documentation/address-validation/get-api-key
- Google Maps — Address Validation, Coverage: https://developers.google.com/maps/documentation/address-validation/coverage
