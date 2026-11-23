---
name: LiveKit agent prompt-editing philosophy
description: How to write/edit prompts for the livekit_agent (Gemini 3.1 Flash Live receptionist) — outcome-based for behavior, hard-constrained for truth claims and tool use, with anti-hallucination rules and tool-return shape requirements
type: feedback
originSessionId: 3111c424-ec77-4e54-99cb-696156a4ea1c
---
When constructing or editing prompts in the livekit_agent (Python receptionist on **Gemini 3.1 Flash Live**, pinned to **livekit-agents `==1.5.1` + livekit-plugins-google git commit `43d3734`**), follow best practices for that exact model and SDK pin — not text-completion conventions, and not features (like `per_response_tool_choice`) that don't exist in the pinned plugin. The prompt is your only enforcement surface; the SDK cannot force tool calls per turn, and the model is free to fabricate fluent outcomes if you don't constrain it.

**For conversational behavior** — info gathering, persona, language switching, decline handling, address verification, transfers — write outcome-oriented guidance. Tell the AI what it should achieve and what information it needs to extract, not exactly what to say. The receptionist must adapt to whatever the caller does (interruptions, out-of-order info, fragments, code-switching, romanized names, vague time windows). Over-scripting flattens both adaptability and persona. Detail constraints and success criteria, never utterances.

**For truth claims and tool prerequisites, be directive.** This is not "if X say Y" scripting — it is constraining a class of claims the model cannot verify on its own. Gemini 3.1 Flash Live hallucinates outcomes fluently in real-time audio: it will say "confirmed", "available", or read out a specific time without ever invoking the tool that produced those facts. Words tied to verifiable state must be prohibited unless a tool result returned them. Anti-hallucination rules belong near the top of the prompt with the same CRITICAL RULE framing as the corrections section, not buried inside the booking section where long-context audio attention drops them.

**Tool descriptions are part of the prompt** — Gemini reads them during generation. Encode hard preconditions in them, not just usage hints.

**Tool returns must be data + directive, not speakable English.** A return like *"Your appointment is confirmed for 3 PM"* invites the model to produce that sentence without ever calling the tool. Shape returns as state + relay instruction (e.g. *"BOOKED: relay confirmation for 3 PM tomorrow at [address], then ask if anything else is needed"*), forcing the model to translate. This breaks the parrot loop that lets it skip the tool entirely.

**Trim dead weight.** Server VAD handles turn-taking — anything about "let the caller finish" or "don't talk over" is wasted attention budget. The pinned plugin uses `send_realtime_input`, not `send_client_content`; do not import patterns that depend on the latter.

**Preserve persona throughout.** The constraints above are guardrails on what the AI can claim, not scripts that flatten the voice. The receptionist should still respond naturally within the configured tone (professional / friendly / local_expert) — outcomes and prohibitions, not utterances.

**Why:** Today's diagnosis (call to Make It AI, 2026-04-13) showed Gemini 3.1 Flash Live ran an entire booking conversation, said "let me get that booked in for you" and read back a 3 PM slot, but never invoked `book_appointment` or `check_availability`. Result: `calls.booking_outcome='not_attempted'`, `leads.status='new'`. The original outcome-only philosophy did not prevent it because the model can verbally "achieve" a booking outcome without doing the work. Tool returns shaped as fluent receptionist sentences (`"Your appointment is confirmed for X"`) actively invited the parrot loop. Lack of `per_response_tool_choice` in the pinned plugin means there is no SDK-side tool-forcing — prompt enforcement is the only lever.

**How to apply:** Before proposing a prompt change, classify the change as (a) conversational behavior → outcome-based, (b) verifiable truth claim or tool precondition → hard prohibition with CRITICAL RULE framing positioned high in the prompt, or (c) tool-return shape → data + directive, not speech. Confirm the SDK pin still matches the assumptions. Confirm no chat-completion-only patterns are creeping in.
