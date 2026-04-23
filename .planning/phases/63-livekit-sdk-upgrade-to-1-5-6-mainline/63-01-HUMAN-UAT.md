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

## Railway Preview Deploy — HUMAN TO FILL

- **Deploy triggered by:** `git push -u origin phase-63-livekit-sdk-upgrade` at 2026-04-24
- **Deploy status:** `____________` (SUCCESS | FAILED — fill from Railway dashboard)
- **Deploy URL:** `____________`
- **`registered worker` log line observed?** `____________` (yes | no; include timestamp)
- **Any boot-time `TypeError`/`ValidationError`/`AttributeError` in deploy logs?** `____________` (yes | no; paste first occurrence if yes)

Dashboard location: Railway → `voco-livekit-agent` service → Deployments → phase-63-livekit-sdk-upgrade

---

## UAT Call Evidence — HUMAN TO FILL

**Dial from personal phone:** +14783755631 (SG tenant +6587528516)

**Suggested script:**
> "Hi, I need to book an appointment for a leaky faucet at 123 Main Street, Singapore 100001, for tomorrow afternoon."

### Call metadata

- **Call ID (Twilio or Railway log):** `____________`
- **Duration (seconds):** `____________`
- **Caller number:** `____________` (personal — redact last 4 digits if sharing externally)
- **Callee number:** `+14783755631`
- **Outcome:** `____________` (booking confirmed | lead captured | declined | other)

### Tool chain evidence (paste 5-line excerpt from `tool_call_log_tail`)

Must show BOTH `check_availability` AND `book_appointment` firing at least once:

```
<paste tool_call_log_tail excerpt here>
```

### Log grep results

- **`grep -E "TypeError|ValidationError|AttributeError" <call-log>` count:** `____________` (expected: 0 per D-09 gate 7)
- **`grep -c "_SegmentSynchronizerImpl.playback_finished called before" <call-log>`:** `____________`
  - Per 63-RESEARCH.md: **NON-ZERO expected** — cutoff race is byte-identical on 1.5.6; NOT a merge blocker; D-09 gate 8 is observational only.

### Google Calendar side-effect verification (63-RESEARCH.md Open Question #2)

- **Calendar event created at booked slot?** `____________` (yes | no)
- **Event ID (if yes):** `____________`
- **If agent said "booked/confirmed" but no event exists → MERGE BLOCKER** (tool-response-delivery regression).

---

## Resume Signal — HUMAN TO TYPE AT CHECKPOINT PROMPT

Choose one:

- `merge` — Railway SUCCESS + UAT booking confirmed + calendar event created + zero TypeError/ValidationError/AttributeError
- `abort` — Railway FAILED OR UAT booking failed OR TypeError/ValidationError/AttributeError in logs OR calendar event missing despite confirmation
- `partial <details>` — all criteria passed except SegmentSynchronizer warning count is MUCH higher than Phase 60.4 baseline (treated as merge-eligible; flagged in SUMMARY)

---

## Notes / Observations (free text)

```
<add anything else observed during the UAT here>
```
