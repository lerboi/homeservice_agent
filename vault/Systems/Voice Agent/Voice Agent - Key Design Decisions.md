---
type: system
system: Voice Agent
status: current
description: "Python 3.12 + LiveKit Agents SDK — replaced Node.js; primary SDK with"
source: .claude/skills/voice-call-architecture/SKILL.md § 12. Key Design Decisions
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# Key Design Decisions

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

- **Python 3.12 + LiveKit Agents SDK** — replaced Node.js; primary SDK with
  native OpenAI Realtime support.
- **Cascaded pipeline (Phase 66)** — Deepgram nova-3 STT → gpt-4.1-mini LLM →
  ElevenLabs Flash v2.5 TTS. Migration rationale: a strong text LLM is a more
  reliable, debuggable tool-caller than a realtime speech model, on LiveKit's
  mature pipeline plugin APIs. (The prior gpt-realtime-2 speech-to-speech
  bullets are historical.)
- **Silero VAD + MultilingualModel turn detection (Phase 66)** — semantic
  end-of-turn; Silero defaults for barge-in (do NOT port the realtime 2.5s
  silence value — Phase 64 did and added ~2s/turn).
- **asyncio.to_thread() everywhere** — all sync Supabase/Twilio/Resend
  calls wrapped to prevent blocking audio.
- **In-process tool execution** — all 6 tools run directly in the agent
  process; zero webhook round-trips.
- **Single post-call pipeline** — combines `processCallEnded` +
  `processCallAnalyzed` into one function.
- **Silent repeat caller context** — `check_caller_history` instructs AI
  never to mention it.
- **Caller-preference-first booking; agent offers only tool-returned times
  (2026-06-12 — replaces "Caller-led booking — AI never offers times
  first")** — the agent asks the caller's preference first, but when the
  caller is vague, asks what's available, or their time is rejected, it
  offers at most 2–3 times/days taken VERBATIM from the availability tool
  return (check_day OPTIONS, check_slot ALTS/earliest_today/next_open,
  next_available_days days). The old absolute ban was a Gemini-era
  anti-fabrication guard that forced callers into a guess-reject loop
  (hang-up evidence: call 31559053). Anti-hallucination invariant
  unchanged: a time never present in a tool return is never speakable.
- **Event handlers before `session.start()`** — prevents race.
- **`close_complete` event keeps entrypoint alive** — without this, the
  LiveKit worker exits immediately after entrypoint returns, killing
  the post-call pipeline.
- **Atomic booking via Postgres advisory locks** — `book_appointment_atomic`
  RPC with `tstzrange` overlap checking.
- **`booking_outcome` written before side effects** — persists even if
  caller hangs up during calendar push / SMS.
- **`end_call` triggers `ctx.shutdown()`** — cascades into session
  close → post-call pipeline.
- **Past-date validation** — check_slot rejects past dates;
  1-hour buffer for today.
- **`recording_storage_path` at egress start** — safety net for post-call
  failure.
- **Triage never downgrades** — Layer 3 only escalates.
- **Fail-open on ERRORS, fail-closed on known-bad status (2026-06-12)** —
  missing tenant, slot failures, and subscription QUERY errors all route to
  AI; but a successfully-read blocked status (canceled/paused/incomplete, or
  past_due beyond the 3-day grace) disconnects via the shared
  `subscription_gate.py`. The grace's end was previously banner copy only —
  no code ever enforced it.
- **Shared subscription gate module** — `BLOCKED_STATUSES` was hand-copied in
  `agent.py` + `twilio_routes.py` (and mirrored in the main repo's JS), which
  is how the past_due gap survived. `src/lib/subscription_gate.py` is now the
  single source of truth on the call path.
- **Boot preflight for cascade keys** — missing `OPENAI_API_KEY` /
  `DEEPGRAM_API_KEY` / `ELEVEN_API_KEY` fails the deploy at startup instead
  of silently killing every call behind a green healthcheck.
- **Meter failures go to a durable outbox** — `stripe_meter_failures` upsert
  on `call_id` (migration 071, main repo) + retry cron; the meter post itself
  is capped at 3s so Stripe latency can't starve the post-call envelope.
- **Webhook routing replaces SIP-only routing (Phase 40)** — numbers route
  via `voice_url` → `/twilio/incoming-call`. A trunk-associated number IGNORES
  its `voice_url` (the trunk's origination wins), so webhook-routed numbers are
  **removed from the SIP trunk**; provisioning (`configureNumberRouting`) and
  `cutover-existing-numbers.js` both set the URLs AND disassociate the trunk
  when `RAILWAY_WEBHOOK_URL` is set, falling back to trunk-only AI-direct when
  it isn't (R2 fix — trunk-only provisioning had left the routing layer dead
  for new tenants). Rollback = re-associate the number with the trunk.
- **Fail-open at every webhook stage** — blocked tenants, unknown
  numbers, subscription errors, schedule evaluation errors, cap errors
  → AI. (Blocked tenants get the AI route — never paid owner-pickup
  forwarding — and the agent-side gate then disconnects them.)
- **Pre-TwiML calls row insert for owner-pickup** — ensures row exists
  before dial-status callback.
- **Owner-pickup calls are lightweight** — no transcript, no recording,
  no triage, no lead, no notifications, no `increment_calls_used`.
- **Same AI greeting for all paths** — direct AI or fallback-after-no-answer
  get identical greeting.
- **Soft cap gates owner-pickup only** — AI calls allowed regardless of
  cap.
- **`call_sid` for dial-status correlation** — more reliable than
  phone+timestamp matching.
- **Router-level Twilio signature dep** — single dep applied to all
  `/twilio/*`.
- **Pure-function schedule evaluator** — zero side effects; trivially
  unit-testable.
- **Cross-runtime customer_context casing divergence is intentional** —
  Next.js camelCase, Python snake_case. Don't "unify" (see
  `integrations-jobber-xero`).
- **Phase 58 telemetry uses real `activity_log` column names
  (`event_type` + `metadata`)** — NOT CONTEXT D-06 wording
  (`action` + `meta`). Matches existing `src/lib/leads.js` writers.
- **Integration telemetry inserted via injected admin client** — tests
  patch caller's module-level `get_supabase_admin`, never the helper.

---
