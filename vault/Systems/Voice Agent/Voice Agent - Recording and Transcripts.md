---
type: system
system: Voice Agent
status: current
description: "Recording and Transcripts. Covers: Recording — LiveKit Egress; Transcripts"
source: ".claude/skills/voice-call-architecture/SKILL.md § 8. Recording & Transcripts"
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# Recording and Transcripts

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

### Recording — LiveKit Egress

```python
await lk.egress.start_room_composite_egress(
    api.RoomCompositeEgressRequest(
        room_name=call_id, audio_only=True,
        file_outputs=[api.EncodedFileOutput(
            file_type=api.EncodedFileType.OGG,
            filepath=f"{tenant_id}/{call_id}.ogg",
            s3=api.S3Upload(...),
        )],
    )
)
```

- Storage: Supabase Storage `call-recordings` bucket via S3.
- Format: OGG audio-only.
- Path: `{tenant_id}/{call_id}.ogg`.
- **Early path persistence**: `recording_storage_path` written to calls
  row at egress start (not only post-call) as safety net.
- Lifecycle: starts after DB task completes (needs `call_uuid`), stops
  on session close.

### Transcripts

Collected via `conversation_item_added` session events.
`transcript_text` (string) + `transcript_structured` (JSONB array of
`{role, content, timestamp}` — `timestamp` added 2026-09-04 P0.2).
**2026-09-04 P0.1:** the same handler logs one `[agent] turn_metrics call=
role= eot_delay= transcription_delay= llm_ttft= tts_ttfb=` line per turn,
read from `event.item.metrics` (livekit-agents 1.5.7 `MetricsReport`
TypedDict — user turns carry `end_of_turn_delay` (the endpointing wait) /
`transcription_delay`, assistant turns `llm_node_ttft` / `tts_node_ttfb`;
`.get()` because keys are optional). This is the per-stage latency
attribution the call-experience plan is measured with; the handler is
try/except-wrapped so logging can never break transcript capture.

---
