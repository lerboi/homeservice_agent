---
type: system-index
system: Voice Agent
status: current
repo: livekit-agent (sibling repo) + src/app/api/webhooks, src/app/admin/test-agent
description: "Complete architectural reference for the Voco voice call system — Twilio SIP + LiveKit + cascaded-pipeline Python agent (Phase 66: Deepgram nova-3 STT with language=multi, gpt-4.1-mini LLM, ElevenLabs eleven_flash_v2_5 TTS) deployed on Rail…"
source_skills: [voice-call-architecture]
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# Voice Agent

Up: [[Home]] · [[Systems]]

> **Two agents, one worker (2026-11-24, not yet deployed):** the dedicated appointments agent is described in [[Voice Agent - Appointments agent (verified)]]; the router that picks an agent per call is in [[Decision - One worker runs several agents]]. Every other note here describes the receptionist in `src/agent.py`.

> **Start with:** [[Voice Agent - Scheduling profile and fast LLM path (verified)]] for what is deployed today (most notes below describe the older `home_service` profile), then [[Demo Studio]] for test calls and the sandbox, and [[Scheduling - Booking to calendar on agent calls (verified path)]] for booking and the calendar push. Both were checked against code on 2026-11-23.

> **How to use:** read this index, then open only the notes the task needs. After changing code in this system, update the matching note and set its `verified:` date.

**Status (2026-11-23):** current system. Migrated verbatim from the `voice-call-architecture` skill, which was last synced on 2026-09-09. Notes marked `historical` describe the Gemini and OpenAI-realtime eras and are not in the code any more. The sandbox, booking and calendar-push paths were re-read on 2026-11-23 and are summarised with line references in [[Demo Studio]]. Background: [[Decision - Voice pipeline is a cascade (Deepgram, gpt-4.1-mini, ElevenLabs)]]. Extra note: [[Voice Agent - Call Routing System (owner-first routing, Phase 39-40)]].

## Notes (from `voice-call-architecture`)

| Note | Lines | Status | What is in it |
|---|---|---|---|
| [[Voice Agent - Appointments agent (verified)]] | 120 | current | The dedicated appointments agent (`src/agents/appointments`): routing, its eight tools, the calendar layer, guards, sandbox scope, switches, known gaps. Not migrated from the skill; written from the code on 2026-11-24 |
| [[Voice Agent - Architecture Overview]] | 81 | current | End-to-end flow and main components of Voice Agent. Covers: End-to-end call flow; Service boundaries; Related skills |
| [[Voice Agent - File Map]] | 64 | current | Which files implement Voice Agent and what each one is responsible for. Covers: Agent Repo (`lerboi/livekit_agent`, deployed to Railway); Main Repo (`homeservice_agent`, deployed to Vercel) |
| [[Voice Agent - Agent Service (LiveKit + Phase 66 cascade pipeline)]] | 273 | current | Agent connects — await ctx.connect() joins the LiveKit room. Covers: Connection lifecycle; Call-duration watchdog (2026-06-10); Webhook server boot (Phase 39) + boot preflight (2026-06-12); Critical pin set — livekit-agents + sibling plugins |
| [[Voice Agent - SIP Configuration]] | 16 | current | Three JSON files in livekit-agent/: |
| [[Voice Agent - System Prompt (Phase 60 restructure)]] | 216 | current | System Prompt (Phase 60 restructure). Covers: Tool return format (Phase 60 D-16); Single-English-prompt policy (2026-06-11 — replaces the dual-prompt/D7 locale-parity policy) |
| [[Voice Agent - Tools - check_caller_history, check_slot, check_day, next_available_days]] | 129 | current | Tools - check_caller_history, check_slot, check_day, next_available_days. Covers: check_caller_history — Silent Context; check_slot / check_day / next_available_days — Slot Query (split from check_availability); All-day busy expansion (2026-06-10); check_availability — Slot Query (HISTORICAL — replaced by the split above) |
| [[Voice Agent - Tools - validate_address, book_appointment, capture_lead, check_customer_account]] | 251 | current | Tools - validate_address, book_appointment, capture_lead, check_customer_account. Covers: validate_address — Early Mid-Call Address Validation (2026-06-10); book_appointment — Atomic Booking; capture_lead — Lead Capture; check_customer_account — Re-serve Customer Context |
| [[Voice Agent - Tools - transfer_call, end_call, goodbye cut-off (Phase 60.2-60.3)]] | 221 | current | Tools - transfer_call, end_call, goodbye cut-off (Phase 60.2-60.3). Covers: transfer_call — SIP REFER; end_call — Graceful Termination; Phase 60.2 — Fix H reverted (accepted limitation); Phase 60.3 — Goodbye cut-off diagnosis + prompt audit |
| [[Voice Agent - Post-Call Pipeline]] | 107 | current | Post-Call Pipeline. Covers: Transcript field extraction fallback |
| [[Voice Agent - Triage System]] | 101 | current | Triage System. Covers: Caller-only classification + emergency-first ordering (2026-06-10); Layer 3 service detection — now actually fires (prod-readiness 2026-06) |
| [[Voice Agent - Recording and Transcripts]] | 39 | current | Recording and Transcripts. Covers: Recording — LiveKit Egress; Transcripts |
| [[Voice Agent - Webhook Service (Phase 39 40)]] | 120 | current | Webhook Service (Phase 39 40). Covers: Endpoints; Signature verification; Schedule evaluator; Outbound cap; Priority (VIP) caller check (Phase 46); Database schema additions |
| [[Voice Agent - Phase 58 Telemetry - integration_fetch + integration_fetch_fanout]] | 23 | current | src/lib/telemetry.py shared helpers emit_integration_fetch + |
| [[Voice Agent - Environment Variables]] | 43 | current | Environment variables Voice Agent reads, and where they are set. Covers: Agent service (Railway); Main repo (Vercel) |
| [[Voice Agent - Key Design Decisions]] | 96 | current | Python 3.12 + LiveKit Agents SDK — replaced Node.js; primary SDK with |
| [[Voice Agent - Debugging playbook]] | 38 | current | Symptoms, likely causes and where to look when Voice Agent misbehaves. |
| [[Voice Agent - Test Calls and Admin Web Test Console (2026-08-25)]] | 96 | current | Browser-based testing of the LIVE production agent — no phone call, no Twilio. Covers: Room + dispatch contract; Sandbox gates (`deps["is_test_call"]` / `params["is_test_call"]`); Tenant-surface filters (main repo); Admin console files (main repo); Deployment order |
| [[Voice Agent - Keeping this document updated]] | 13 | current | When modifying any file listed in the File Map, update the relevant |
| [[Voice Agent - Phase 61 - Google Maps Address Validation Integration]] | 150 | current | New module: src/integrations/google_maps.py (412 LOC) — Covers: What changed; Env var; Files; Anti-hallucination invariants locked at the test layer |
| [[Voice Agent - Phase 61.1 - Address-Validation Rule Deadlock Fix + WR-01 02 03 Closeout]] | 81 | current | Phase 61 shipped to production on 2026-05-03 (Plan 04 GREEN, sibling commit Covers: What changed in Phase 61.1; New / updated test invariants; Lesson learned |
| [[Voice Agent - Reference - Phase History]] | 202 | current | Incremental phase milestones absorbed from the prior Last updated header |
| [[Voice Agent - Scope and change history]] | 164 | record | The former voice-call-architecture skill's scope statement, preamble and running 'last updated' change history. Read only when you need to know when or why something changed. |

## Historical notes (no longer in the code; kept for the reasoning)

| Note | Lines | Status | What is in it |
|---|---|---|---|
| [[Voice Agent - OpenAI Realtime Session]] | 99 | historical | gpt-realtime-2 uses OpenAI server-side turn detection. The agent constructs Covers: Turn detection — SemanticVad (Phase 65); Voice resolution (Phase 44 AI Voice Selection); Non-blocking I/O pattern |
| [[Voice Agent - Tools - Phase 63 generate_reply regression and SDK patch (Gemini era)]] | 207 | historical | Tools - Phase 63 generate_reply regression and SDK patch (Gemini era). Covers: Phase 63.1 — generate_reply regression fix (Gemini 3.1 + plugins-google 1.5.6); Phase 63.2 — LiveKit SDK patch upgrade 1.5.6 → 1.5.7 (hygiene + dry run) |
| [[Voice Agent - Phase 61.2 - Gemini-Server Cancellation Cascade Mitigation (2026-05-06)]] | 239 | historical | The first Phase 61 production regression after 61.1 shipped (call Covers: Failure mode — server-side VAD cancellation cascade; Wave 1 fixes (livekit-agent commits 93dd4b5, 1afde0e, 1b636bc, c66e435); Test invariants (`livekit-agent/tests/test_tool_mute_invariants.py`, commit c66e435); D-12 post-fix UAT verdict — gap (call AJ_5NcSoiaZGZTJ); NEW failure mode — slot hallucination after cancellation; NEW finding — Plan 03 listener-missed regression; SDK 1.5.7 note (cross-link to Phase 63.2); Phase 61.3 forward-pointer; Lessons learned; Wave 1 commits (livekit-agent main) |
| [[Voice Agent - Phase 61.3 - Cascade-Recovery via Tool-Result Replay (2026-05-07)]] | 188 | historical | Phase 61.2 contained the cascade (cancellation rate -80%) but did not Covers: Failure mode — regeneration without tool-result context; The mechanism — stall-detection + synthetic FunctionCallOutput replay; The unlock — tool_results send is unconditional; Listener-miss correction (closes 61.2-VERIFICATION.md gap #2); Telemetry (D-08); Test invariants (`livekit-agent/tests/test_cascade_recovery_invariants.py`); D-12 post-fix UAT verdict — call `{UAT_CALL_ID}` (UPDATE POST-UAT); Memory pointer update; Deferred items (closed via re-measurement plan, not separate fixes) |
