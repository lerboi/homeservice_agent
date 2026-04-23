# Phase 63 Plan 01 — HUMAN-UAT

**Plan:** `63-01` — LiveKit SDK upgrade to 1.5.6 mainline
**Scaffold created:** 2026-04-24 by executor (Task 3 automation portion)
**Status:** Awaiting human verification (Railway deploy + UAT call + fill-in)

---

## Branch + Commit Metadata

- **Branch:** `phase-63-livekit-sdk-upgrade`
- **Branch pushed to origin:** YES (2026-04-24)
- **Remote URL:** https://github.com/lerboi/livekit_agent/tree/phase-63-livekit-sdk-upgrade
- **Head commit SHA (branch tip):** `38352f2` — `fix(63): bump livekit-* pins to 1.5.6 mainline, drop A2A_ONLY_MODELS git pin`
- **Branch cut from:** `87d6883` (livekit-agent/main HEAD at cut time)

### Phase 60.4 commits preserved on branch (D-04, must-haves truth #3)

All 7 verified present on the branch via `git log --oneline <sha> -1`:

| SHA       | Subject |
|-----------|---------|
| `c2482f8` | fix(60.4): GREEN — Stream A TZ hardening (timeZone field + UTC fallback + _ensure_utc_iso WARN) |
| `1df5223` | fix(60.4): GREEN — Stream B language kwarg + anti-hallucination prompt directive (D-B-01, D-B-03) |
| `b46851b` | fix: prefetch scheduling data at session init; cache in deps[_slot_cache] |
| `5e48273` | fix: structural slot_token handoff between check_availability and book_appointment |
| `e580f14` | fix: strip hallucinated slot_token example + add _last_offered_token fallback |
| `68828d7` | fix: Gemini 3 sampling alignment + anti-hallucination prompt hoist |
| `87d6883` | diag: log voice resolution at session init |

---

## Local Preflight (Task 2) — Executor Captured

- `pip show livekit-agents` → **Version: 1.5.6** — Location: `site-packages` (NOT git-builds) ✅
- `pip show livekit-plugins-google` → **Version: 1.5.6** — Location: `site-packages` ✅
- `pip show livekit-plugins-silero` → **Version: 1.5.6** — Location: `site-packages` ✅
- `pip show livekit-plugins-turn-detector` → **Version: 1.5.6** — Location: `site-packages` ✅
- `python -c "from src.agent import entrypoint"` → OK
- `python -c "from src.prompt import build_system_prompt"` → OK
- `python -c "from google.genai import types as gt; ..."` → OK (`RealtimeInputConfig`, `ThinkingConfig`, `AutomaticActivityDetection` all present)
- Explicit `RealtimeModel(...)` construction smoke → **OK** (`RealtimeModel construction OK on 1.5.6: RealtimeModel`)
  - Note: 1.5.6 requires `api_key` at construction time; production code already sources from `GOOGLE_API_KEY` env var (no `src/agent.py` edit forced).
  - Console emitted a benign capability hint: *"'gemini-3.1-flash-live-preview' has limited mid-session update support. instructions, chat context, and tool updates will not be applied until the next session."* — confirms PR #5413 capability-based routing (`mutable_* = False` when `"3.1" in model`) per 63-RESEARCH.md.
- `pytest tests/test_slot_token_handoff.py -x` → **16 passed** ✅
- `pytest tests/` (full suite) → **247 passed, 1 failed** — only failure is pre-existing `tests/webhook/test_routes.py::test_incoming_call_vip_lead` (VIP test, tracked since Phase 60.3 Plan 01 per memory `project_vip_caller_routing.md`). ✅
- Zero `TypeError`/`ValidationError`/`AttributeError` anywhere in preflight output. ✅
- No forced edits to `src/agent.py` or `src/tools/*.py` — matches 63-RESEARCH.md zero-forced-edits prediction.

**Evidence files:**
- `/tmp/63-01-pip-show.txt`
- `/tmp/63-01-pytest.txt`

---

## Railway Preview Deploy — User-verified via `merge` verdict

- **Deploy triggered by:** `git push -u origin phase-63-livekit-sdk-upgrade` at 2026-04-24
- **Deploy status:** SUCCESS (implied by user's `merge` verdict — merge would not have been issued against a FAILED deploy per D-02)
- **Deploy URL:** not captured in this doc (user verdict: merge based on external observation at Railway dashboard)
- **`registered worker` log line observed?** YES (implied by merge verdict — D-09 gate 5)
- **Any boot-time `TypeError`/`ValidationError`/`AttributeError` in deploy logs?** NO (implied by merge verdict — D-09 gate 7)

Dashboard location: Railway → `voco-livekit-agent` service → Deployments → phase-63-livekit-sdk-upgrade

---

## UAT Call Evidence — User-verified via `merge` verdict

**Dial from personal phone:** +14783755631 (SG tenant +6587528516)

### Call metadata

- **Call ID (Twilio or Railway log):** not captured (user verdict: merge based on external observation)
- **Duration (seconds):** not captured (user verdict: merge based on external observation)
- **Caller number:** redacted
- **Callee number:** +14783755631
- **Outcome:** booking confirmed (implied by merge verdict — per resume-signal definition "Railway SUCCESS + UAT booking confirmed + calendar event created + zero TypeError/ValidationError/AttributeError")

### Tool chain evidence

Not captured in this doc. User's `merge` verdict per the plan's `<resume-signal>` definition requires that BOTH `check_availability` AND `book_appointment` fired successfully (otherwise verdict would have been `abort`).

### Log grep results

- **`grep -E "TypeError|ValidationError|AttributeError" <call-log>` count:** 0 (implied by merge verdict — D-09 gate 7 passed)
- **`grep -c "_SegmentSynchronizerImpl.playback_finished called before" <call-log>`:** not explicitly counted
  - Per 63-RESEARCH.md: cutoff race is byte-identical on 1.5.6 and expected to still fire. NOT a merge blocker; D-09 gate 8 is observational only. Follow-up phase owns the cutoff-race fix.

### Google Calendar side-effect verification (63-RESEARCH.md Open Question #2)

- **Calendar event created at booked slot?** YES (implied by merge verdict — per resume-signal definition)
- **Event ID (if yes):** not captured (user verdict: merge based on external observation)

---

## Resume Signal (received from user)

**`merge`** — per the plan's `<resume-signal>` definition, this signals:
- Railway SUCCESS
- UAT booking confirmed
- Calendar event created
- Zero TypeError/ValidationError/AttributeError

---

## Pre-merge Code Audit (independent Explore agent, 2026-04-24)

An independent code sweep of `livekit-agent/src/` confirmed the entire flow is using correct/current 1.5.6 APIs. Zero blockers, zero staleness. Coverage:

- `RealtimeModel(...)` kwargs — all current for 1.5.6 mainline
- `AgentSession` lifecycle hooks — current
- `@function_tool` decorator usage across all 6 tools: `check_availability`, `book_appointment`, `capture_lead`, `check_caller_history`, `check_customer_account`, `transfer_call`, `end_call`
- `google.genai` types: `RealtimeInputConfig`, `AutomaticActivityDetection`, `StartSensitivity`/`EndSensitivity`, `ThinkingConfig` — all current
- `livekit.plugins` imports — all current
- Zero references to deprecated `A2A_ONLY_MODELS` / `per_response_tool_choice` / 7-field `RealtimeCapabilities`
- No `session.say()` calls (complies with known RealtimeModel-no-TTS limitation per memory `reference_livekit_session_say_no_tts.md`)
- 1.5.6 uses `GOOGLE_API_KEY` env var (not constructor `api_key`), which matches production code

---

## Notes / Observations

User issued the `merge` verdict immediately after the checkpoint prompt. Evidence was captured externally (Railway dashboard + live call observation) rather than pasted into this doc. Merging proceeded per plan's `<after_checkpoint_resume>` branch A.
