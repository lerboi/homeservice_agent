---
type: log
date: 2026-08-19
status: record
description: "2026-08-19 voice-agent latency+reliability pass — 7 verified fixes, MERGED+PUSHED to livekit-agent main (a51caec); suite 508/1 pre-existing"
source: "Claude memory note project_2026_08_19_voice_latency_pass.md"
migrated: 2026-11-23
tags: [voco/log]
---

# 2026-08-19 Voice latency and reliability pass
2026-08-19 latency + reliability pass on the livekit-agent repo (sibling at `C:/Users/leheh/.Projects/livekit-agent/`). 2026-08-20: user committed as `6151060`, then merged with the remote's agent-side integrations-v1 flag commits (`6f31733`/`29fc812` — new `src/lib/feature_flags.py` `VOCO_INTEGRATIONS_ENABLED`, fail-closed; context fetch + fanout telemetry + check_customer_account registration gated) and **PUSHED as merge `a51caec`** — Railway deploys from this. Merge resolution kept the local 3-way gather + create_background_task telemetry INSIDE the remote's flag gate; flag-off path smoke-tested (imports clean, 9 tools, no check_customer_account). Every fix was verified against the installed livekit-agents 1.5.7 SDK source before editing. Suite after merge: 508 passed / 1 failed (`test_incoming_call_vip_lead` — the same pre-existing deferred VIP failure). NOTE: tests/conftest.py forces `VOCO_INTEGRATIONS_ENABLED=true` so the suite covers the enabled path; production default is OFF.

What shipped: (1) Silero VAD prewarmed per process (`prewarm_fnc`); (2) intake/services fetch folded into the pre-session gather (one fewer round-trip of pre-greeting dead air); (3) same-day 1-hour min-notice floor in `calc_slots_for_dates` (`MIN_NOTICE_TODAY_S`) closing the check_day→book_appointment sub-notice booking hole + new `tests/test_availability_min_notice.py`; (4) book_appointment reuses `deps["tenant"]`; (5) new `src/lib/background.py` `create_background_task()` holding strong refs for fire-and-forget tasks; (6) LiveKitAPI `aclose()` in finally on error paths; (7) `call_end_reason='subscription_blocked'` on the blocked-subscription disconnect. Full detail in the `voice-call-architecture` skill's 2026-08-19 entry.

**Why:** the pre-greeting critical path was paying per-call ONNX VAD load + a sequential Supabase RT, and check_day could token-register slots starting minutes out that check_slot itself would reject.

**How to apply:** user must sync sibling repo → GitHub → Railway for it to go live. Verified-and-deliberately-NOT-done: deferring the customer-context fetch past `session.say()` via `agent.update_instructions()` — marginal for v1 (Jobber/Xero flagged off, so the fetch is ~1-2 fast DB RTs); revisit if pre-greeting p95 stays high after this pass. False positives ruled out during the audit (don't re-chase): watchdog nudge does NOT pollute transcripts (`update_chat_ctx` never emits `conversation_item_added`); the no-input "are you still there?" can NOT fire mid-agent-speech (away timer only arms when agent AND user are both "listening"); `resume_false_interruption` already defaults True/2.0s in 1.5.7. Related: [[2026-06-23 LiveKit agent Railway memory optimization]], [[2026-07-04 Full end-to-end audit (summary)]].
