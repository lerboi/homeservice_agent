---
phase: 44-ai-voice-selection
plan: "03"
subsystem: voice-agent
tags: [voice, gemini, livekit, ai-voice-selection, python-agent]
dependency_graph:
  requires: ["44-01"]
  provides: ["VOICE-SEL-07", "VOICE-SEL-08"]
  affects: ["livekit-agent/src/agent.py", "voice-call-architecture skill"]
tech_stack:
  added: []
  patterns: ["tenant.get('ai_voice') override before VOICE_MAP fallback"]
key_files:
  created: []
  modified:
    - "C:/Users/leheh/.Projects/livekit-agent/src/agent.py"
    - ".claude/skills/voice-call-architecture/SKILL.md"
decisions:
  - "ai_voice override uses tenant.get('ai_voice') if tenant else None guard to handle failed tenant lookups safely"
  - "Voice resolution is 3-tier: tenant.ai_voice -> VOICE_MAP[tone_preset] -> 'Kore' default"
  - "No change to VOICE_MAP constant or RealtimeModel call — only the voice_name assignment changes"
metrics:
  duration: "5 minutes"
  completed: "2026-04-10T20:38:23Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 44 Plan 03: Agent Voice Override Summary

## One-Liner

Added 2-line ai_voice override to livekit-agent that reads `tenant.ai_voice` at call time and uses it directly as the Gemini voice name, falling back to `VOICE_MAP[tone_preset]` when NULL.

## What Was Built

Completed the end-to-end voice selection flow (D-14, D-15). The LiveKit Python agent now reads the `ai_voice` column from the tenants table and passes it to Gemini's `RealtimeModel` as the `voice` parameter. This wire completes the chain: DB column (Plan 01) + UI picker (Plan 02) + agent override (this plan).

### Voice Resolution Logic

```python
# Use explicitly selected voice if set, else fall back to tone-based mapping (Phase 44: AI Voice Selection)
ai_voice = tenant.get("ai_voice") if tenant else None
voice_name = ai_voice if ai_voice else VOICE_MAP.get(tone_preset, "Kore")
```

Priority order:
1. `tenant.ai_voice` — explicit user selection from the AI Voice Settings dashboard
2. `VOICE_MAP[tone_preset]` — tone-based fallback (professional/friendly/local_expert)
3. `"Kore"` — final default if both are missing

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Agent voice override | e60c350 (livekit-agent) | src/agent.py |
| 2 | Update voice-call-architecture skill | 605db2a (homeservice_agent) | .claude/skills/voice-call-architecture/SKILL.md |

## Verification

- Python syntax check: `ast.parse()` passes
- `ai_voice = tenant.get("ai_voice") if tenant else None` present in agent.py
- `voice_name = ai_voice if ai_voice else VOICE_MAP.get(tone_preset, "Kore")` present in agent.py
- Old single-line `voice_name = VOICE_MAP.get(tone_preset, "Kore")` removed
- VOICE_MAP constant unchanged
- `voice=voice_name` in RealtimeModel call unchanged
- SKILL.md contains 5 occurrences of "ai_voice" (verification: `grep -c "ai_voice" SKILL.md` = 5)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — the agent change is fully wired. The `ai_voice` column reads from the tenants table which was added in Plan 01.

## Self-Check: PASSED

- `C:/Users/leheh/.Projects/livekit-agent/src/agent.py` — modified (confirmed by grep output)
- `C:/Users/leheh/.Projects/homeservice_agent/.claude/skills/voice-call-architecture/SKILL.md` — modified (confirmed by grep output)
- Task 1 commit `e60c350` exists in livekit-agent repo
- Task 2 commit `605db2a` exists in homeservice_agent repo
