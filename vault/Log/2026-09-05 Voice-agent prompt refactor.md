---
type: log
date: 2026-09-05
status: record
description: "2026-09-05 voice-agent system-prompt refactor (naturalness + concision for gpt-4.1-mini + ElevenLabs Flash v2.5): rewrote src/prompt.py in livekit-agent, ~8.0k→~7.0k tokens (13% smaller), example-led voice layer, all functionality/tool contracts/safety tokens preserved, 634 tests green (1 pre-existing VIP fail). MERGED to livekit-agent main 0c01df1 + pushed (Railway auto-deploying); skill synced in homeservice_agent 8c87b27; live UAT still pending"
source: "Claude memory note project_2026_09_05_prompt_refactor.md"
migrated: 2026-11-23
tags: [voco/log]
---

# 2026-09-05 Voice-agent prompt refactor
**Request:** refactor the AI-receptionist system prompt to sound more natural, keep all
functionality + required data + tool calls. Research the model/setup first.

**Setup (confirmed):** OpenAI gpt-4.1-mini (non-reasoning, parallel_tool_calls=False,
max_completion_tokens=500, per-tenant prompt cache, no temp) + Deepgram nova-3 language=multi
+ ElevenLabs eleven_flash_v2_5 (speed 1.08). Greeting spoken deterministically before turn 1.

**Research (subagent, sources cited in-session):** GPT-4.1 follows instructions literally and
resolves conflicts by POSITION (last wins) → fewer/sharper rules, convert "NEVER X" walls to
positive + `if X then Y`, put must-wins top AND bottom, don't default to CAPS/MUST. Tool schemas
belong in the API tools field (LiveKit already does), tool-usage rules in the tool description,
never hard-mandate "always call a tool" (causes hallucinated args). LiveKit: plain text only,
1-3 sentences, one question/turn, show-don't-tell with examples. **Flash v2.5: text
normalization is OFF by default (latency) → the LLM must spell out all numbers/dates/money/
addresses; punctuation is the only prosody control (commas/periods/"?"; ellipsis for a beat,
more consistent than dashes); no CAPS-emphasis, no v3 audio tags; <break> at most once/turn.**

**What I did (src/prompt.py, livekit-agent repo):** full concision+naturalness pass.
- Identity → real Role & Objective; added "never narrate your plan/reasoning/tool names aloud"
  (persistence reframed for voice; gpt-4.1-mini is non-reasoning). Dropped the duplicate
  UNMISTAKABLE INVARIANT (OUTCOME WORDS + FINAL still own anti-fabrication).
- Voice section: removed the banned-stock-phrase wall, kept/added register EXAMPLES + an
  "invite the answer, don't fire a bare question" cue; kept the spell-out-numbers block verbatim
  (Flash normalization-off); pause guidance moved to commas/ellipsis.
- Compressed address-validation, name-use, tool-narration, ending, corrections, language,
  info-gathering preamble, booking intro, decline — WITHOUT dropping any pinned safety token.

**Invariants preserved (the ~165 prompt tests are the functional spec):** reserved words +
3pm/WRONG example (OUTCOME WORDS), verdict=validated tokens + 6 address prohibitions + STATE
names (ADDRESS VALIDATION), 9/10-min bounds + WRONG/RIGHT + no session.say (ENDING), >=14 unique
tool fillers + "never emit a tool call without speaking first" (TOOL NARRATION), name-once +
Forbidden patterns, STT anti-hallucination ("STT errors of English or Spanish audio",
German/French/Italian, "NOT consent to switch", "audio cut out"), availability tool-routing +
readback + NO DOUBLE-BOOKING, cache-aware ordering, EN/ES single-line-diff collapse. Two tests
I briefly tripped and fixed by restoring exact tokens: call-duration needs brand "Voco" in the
example; booking SCHEDULING needs "→ check_slot now / check_day now / next_available_days now".

**Size:** 32045→27922 chars, ~8011→~6980 tokens (13% smaller). Not "half" — the remaining bulk
is genuine safety/tool spec the user said to keep; I did NOT cut functionality to hit a number.

**State:** user reaffirmed "push everything to main", so the branch was fast-forward MERGED to
livekit-agent **main (0c01df1)** and pushed — Railway auto-deploys from main, so this is now the
LIVE prompt for real calls; the merged branch was deleted (local+remote). Skill changelog synced
in homeservice_agent **main 8c87b27** (also dropped a stale .claude/worktrees gitlink). LIVE UAT
via the admin test console (now fixed, see [[2026-09-05 Test console mic picker]]) is still
pending — listen to a couple of calls and tune if anything sounds off. Full research + assessment are in this session's transcript.
Related: [[LiveKit gotcha - session.say needs TTS on RealtimeModel sessions]], [[feedback_livekit_prompt_philosophy]] (now
stale re Gemini — model is gpt-4.1-mini).
