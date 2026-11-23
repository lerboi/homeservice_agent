---
type: reference
date: 2026-05-06
status: historical
description: "update_chat_ctx tool_results path is UNCONDITIONAL — not gated on mutable_chat_context — works on gemini-3.1-flash-live-preview despite the model being capability-locked closed for conversational turns"
source: "Claude memory note reference_livekit_update_chat_ctx_tool_results.md"
migrated: 2026-11-23
tags: [voco/reference]
---

# LiveKit gotcha - update_chat_ctx tool_results on Gemini 3.1
On `gemini-3.1-flash-live-preview` in livekit-plugins-google 1.5.7:

- `mutable_chat_context = False` (`realtime_api.py:289` — `mutable = "3.1" not in model`).
- `mutable_instructions = False` (same calculation).
- `auto_tool_reply_generation = True` (always, all models).
- `generate_reply()` is gate-blocked at `realtime_api.py:707-715` — emits warning and returns failed Future. **Do not use on 3.1.**
- `session.say()` fails on `AgentSession(llm=RealtimeModel)` without TTS (separate memory).

**The unlock for cascade-recovery:** `update_chat_ctx()` at `realtime_api.py:587-642` has a split design — the `mutable_chat_context=False` gate at line 628 only blocks the conversational-turns half. The `tool_results` send at lines 637-638 fires UNCONDITIONALLY:

```python
# Pseudocode of the relevant branch:
if turns:                          # conversational portion
    if not capabilities.mutable_chat_context:
        return  # blocked on 3.1
    self._send_client_event(LiveClientContent(turns=...))

if tool_results:                   # tool-output portion
    self._send_client_event(tool_results)  # ← UNCONDITIONAL — works on 3.1
```

This means: on 3.1 you CAN replay a tool's output to Gemini at runtime by constructing a synthetic `FunctionCallOutput` and calling `update_chat_ctx` with it — even though you cannot inject a synthetic user turn or update instructions.

**When this matters:**
- Recovery from server-cancelled tool calls (Gemini-server stalls TTS on tool result; user speech triggers VAD cancel; regeneration loses tool context). Replay before re-enabling input.
- Any Phase 61.x / 64-related work where you need to refresh Gemini's view of tool state without a session restart.

**Access pattern:** the underlying `RealtimeSession` is reachable via `session._activity._rt_session` in 1.5.7 (private API; planner should confirm exact accessor at implementation time and prefer a public hook if one exists).

**Validated:** Phase 61.3 research pass, 2026-05-06, against installed SDK at `C:/Users/leheh/AppData/Roaming/Python/Python313/site-packages/livekit/plugins/google/realtime/realtime_api.py`. Re-verify if SDK pin moves past 1.5.7.
