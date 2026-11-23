---
type: log
date: 2026-06-23
status: record
description: "Railway RAM profile of the livekit-agent worker + which memory levers shipped vs are pending measurement (2026-06-23)"
source: "Claude memory note project_livekit_agent_memory_optimization.md"
migrated: 2026-11-23
tags: [voco/log]
---

# 2026-06-23 LiveKit agent Railway memory optimization
2026-06-23: investigated high Railway memory on the `livekit-agent` voice worker. Findings verified against the installed 1.5.7 source (`C:/Users/leheh/AppData/Roaming/Python/Python313/site-packages/livekit/...`).

**RAM profile (what actually costs memory):**
- STT/LLM/TTS are all cloud (Deepgram/OpenAI/ElevenLabs) → ~0 local model RAM.
- **The dominant, controllable cost is the warm idle job-process pool**: `num_idle_processes` defaults to `min(ceil(cpu_count),4)` in prod (likely 4 on Railway), each a full interpreter importing the whole app (~150–250 MB each). This is THE lever.
- Turn-detector (`MultilingualModel()`) weights live in ONE shared inference subprocess per worker (not per call) → prewarm gives ZERO memory savings for it (latency only). Silero VAD loads into each job proc but is only 2.3 MB.
- **NO torch** in the Railway image — verified via dependency metadata: turn-detector requires only jinja2/numpy/onnxruntime/transformers; silero only numpy/onnxruntime; transformers' torch is behind the `[torch]` extra (not installed). The torch in local site-packages is the shared global env, not the image.
- Krisp `BVCTelephony` is a LOCAL native model (~28 MB .kef + ~17 MB lib per active SIP call), redundant with the SIP trunk's `krisp_enabled` — but code labels it "echo-defense layer 1" (Phase-64 self-echo fix), so removing it is a quality tradeoff, not free.

**Shipped (COMMITTED + PUSHED to main as `bc152ac`, 2026-06-23):** ONLY the **Twilio** lazy-import in `src/lib/notifications.py` survived integration (deferred into `_get_twilio_client` via `TYPE_CHECKING` guard + quoted annotations; twilio confirmed absent from sys.modules at import). Full suite 501 passed, 1 pre-existing unrelated failure `test_incoming_call_vip_lead` (proven failing on pure origin/main).

**Dropped during integration with a teammate's `0e05d8b` "improved and fixed bugs" (which heavily rewrote both files + ADDED the owner-notification outbox `_enqueue_owner_notification_failure`→`owner_notification_failures` table = the H2 fix from the deep-read, and service-area/out-of-area M16 P1):**
- **stripe (post_call.py): DROPPED.** Remote restructured overage metering into a separate block (`stripe.StripeClient` ~line 516) that assumes a module-level `import stripe`. Took remote's post_call.py verbatim (`git checkout --ours`).
- **resend (notifications.py): REVERTED to module-level.** Remote's new tests `test_notifications_outbox_contract.py` / `test_notifications_out_of_area.py` do `patch("src.lib.notifications.resend")` at module level — a function-local import breaks them AND shadows the mock. Same trap as google_calendar. resend SDK is light; not worth deferring.

**Lesson:** before lazy-importing a name, grep tests for `patch(...module.NAME)` / `patch.object(module, 'NAME')`. Names patched at module level CANNOT be moved into functions. Safe-to-defer names here: ones accessed only via a module-level wrapper fn the tests patch instead (e.g. twilio via `_get_twilio_client`).

**Reverted (do NOT retry naively):** `src/lib/google_calendar.py` lazy import of `Credentials`/`build` — breaks `test_google_calendar_tz.py` which does `patch.object(google_calendar, 'build'/'Credentials')` at module level. Smallest win (~20–40 MB). To redo, must also repoint those patches to `googleapiclient.discovery.build` (a test change).

**PENDING — #1 num_idle_processes:** functionally 100% safe (`proc_pool.py`: it's a warm-spare target, NOT a concurrency cap — `launch_job` spawns on demand, no call dropped). But savings come from fewer warm spares, so a burst of simultaneous calls beyond the value cold-starts overflow callers (~0.5–2s pickup). User chose to MEASURE peak concurrency first before picking the value. Awaiting their per-process PSS + peak-concurrent-call numbers from Railway.

**Why:** the user requires memory reduction with zero functionality/process change; #2/#3 meet that bar, #1 has a concurrency-dependent latency edge so its value must come from real data.
**How to apply:** when the user returns with peak concurrency N, set `WorkerOptions(..., num_idle_processes=N)` at `src/agent.py:~1240`. Relates to [[2026-06-18 LiveKit agent deep read - reliability risks]] and the [[Voice Agent]] skill; verify-first per [[feedback_deep_verify_before_fix]].
