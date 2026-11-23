---
type: system
system: Voice Agent
status: current
description: "Triage System. Covers: Caller-only classification + emergency-first ordering (2026-06-10); Layer 3 service detection — now actually fires (prod-readiness 2026-06)"
source: .claude/skills/voice-call-architecture/SKILL.md § 7. Triage System
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# Triage System

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

**Directory**: `src/lib/triage/`

Three-layer pipeline. Layer 3 can only ESCALATE, never downgrade.
Valid urgencies: `{emergency, routine, urgent}`.

- **Layer 1 — Keywords** (`layer1_keywords.py`): synchronous regex.
  2026-06-10: EMERGENCY patterns checked FIRST (emergency beats routine —
  "gas leak, but no rush" is still an emergency; previously routine-first),
  and classification runs on **caller-only turns** via `extract_caller_text()`.
- **Layer 2 — LLM** (`layer2_llm.py`): only when Layer 1 not confident.
  **OpenAI `gpt-4.1-nano` since 2026-09-04 (P1.1)** — `LAYER2_MODEL`,
  `AsyncOpenAI()` with no base_url/api_key (reads the boot-required
  `OPENAI_API_KEY`), JSON mode, temp 0, `max_tokens=100`; the except is
  split (`asyncio.TimeoutError` → `[triage] layer2 timeout` warning; any
  other → `[triage] layer2 failed: …` error) and both still return the
  `routine/low` fallback dict so the post-call pipeline never raises.
  Why: it WAS Groq + Llama 4 Scout — Groq retired that model 2026-07-17 and
  its last non-reasoning Llama models on 2026-08-16 (its remaining
  gpt-oss models are reasoning models whose thinking eats the 100-token
  budget → empty content → JSON error), and the old blanket except had
  silently classified every layer-2 call as routine/low since mid-July
  (`GROQ_API_KEY` was never in the preflight either). Verify after deploy
  with a "water is flooding my kitchen right now" test call → `emergency`.
  **Connection warm (same day):** every call's post-call triage runs in a
  fresh job process, so the classifier's first request was always cold —
  measured ~2.1 s (TLS handshake + generation) against the 2.5 s cap, vs
  ~0.85 s warm. `agent.py` now fires `layer2_llm.warm_client()` (one
  `models.retrieve`, `WARM_TIMEOUT_S=4`, never raises) as a background task
  right after the prompt-cache warm (`VOCO_TRIAGE_LAYER2_WARM`, default
  on); the client uses the SDK's `DefaultAsyncHttpxClient` with
  `keepalive_expiry=None` so the warmed connection is still open at
  post-call time (httpx's default 5 s expiry would have dropped it).
  `TIMEOUT_S` reads `VOCO_TRIAGE_LAYER2_TIMEOUT_S` (default 2.5). Success
  logs `[triage] layer2 ok urgency= confidence= elapsed_ms=` — the number
  to watch on Railway.
  Tests: `tests/test_triage_layer2.py`. Historical: JSON mode, temp 0, **2.5s timeout**
  (`TIMEOUT_S` 5.0 → 2.5, 2026-06-12 audit H8: a slow Groq call inside the
  post-call 8s envelope starved the outcome + notification writes; a layer-2
  timeout falls back to the Layer-1 verdict, so the trade is marginal triage
  precision for guaranteed delivery).
  2026-06-10: receives caller-only text (`caller_text or transcript`).
- **Layer 3 — Owner Rules** (`layer3_rules.py`): always runs. Queries the
  tenant's active `services` (name + `urgency_tag`); escalates the call's
  urgency to a matched service's tag **only when its severity is higher**.
  Unchanged 2026-06-10 — still matches against the **full transcript**.

### Caller-only classification + emergency-first ordering (2026-06-10)

The agent's own speech must never drive urgency — the prompt makes the agent
say things like "let me take a look at the schedule", which confidently
matched `ROUTINE_PATTERNS` and downgraded real emergencies. Two changes:

- `extract_caller_text(transcript)` (new, `layer1_keywords.py`): returns only
  the `"Caller:"`-prefixed lines from the transcript (post_call builds it as
  `"Caller:"` / `"AI:"` prefixed lines). Falls back to the full text when the
  input has no speaker prefixes (raw text), and to `""` when only `AI:` lines
  are present. `run_keyword_classifier` filters internally via this helper;
  `classify_call` (`classifier.py`) extracts it once and hands the caller-only
  text to the layer-2 LLM too (defense in depth).
- `run_keyword_classifier` now evaluates **EMERGENCY_PATTERNS before
  ROUTINE_PATTERNS** — an emergency match always wins over any routine match.
  The old routine-first order (built to stop "not urgent" matching emergency)
  let a routine phrase mask a genuine emergency in the same transcript.

Layer 3 is deliberately untouched: service-name matching needs the full
transcript (the agent often names the service back to the caller).
Tests: `tests/test_triage_layer1_keywords.py` (new).

### Layer 3 service detection — now actually fires (prod-readiness 2026-06)

**Prior bug (fixed 2026-06-04).** `classify_call` (`classifier.py`) never
passed `detected_service` into `apply_owner_rules`, so Layer 3 could never
identify which service the call was about — the owner's per-service
`services.urgency_tag` config was **inert** and Layer 3 never escalated.

**Fix.** `apply_owner_rules` now derives the service itself by
**word-boundary matching each active `services.name` against the call
transcript** (`re.search(rf"\b{re.escape(name)}\b", transcript_lower)`), with a
`MIN_SERVICE_NAME_LEN=4` guard that skips short/generic names (e.g. "AC",
"gas", "tap") to prevent spurious over-matching. First match wins.
`classify_call` now threads the `transcript` through to `apply_owner_rules`
on both the layer1-confident and layer2 paths.

Constraints (the escalation stays conservative):

- Layer 3 can only **raise** urgency, and only on a **genuine service-name
  match** — no match leaves `base_urgency` untouched.
- Layer 1 keywords + Layer 2 LLM remain the **emergency floor**; Layer 3
  cannot downgrade below them.
- The previously-removed **single-service auto-escalation is NOT
  reintroduced** — a single-service tenant no longer adopts its one service's
  tag on every call; the tag applies only when the transcript names it.
- `triage_layer_used` (the calls-row column written from `triage_result["layer"]`
  in `post_call.py`) can now legitimately be **`layer3`** — `classifier.py`
  returns `layer="layer3"` whenever `apply_owner_rules` reports `escalated`.

(`apply_owner_rules` still accepts an explicit `detected_service` arg, checked
before the transcript fallback, for any future caller that supplies one.)

---
