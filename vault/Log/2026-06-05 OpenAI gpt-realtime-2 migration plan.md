---
type: log
date: 2026-06-05
status: superseded
description: "Voice-agent migration Gemini 3.1 → OpenAI gpt-realtime-2 — NOW COMMITTED TO main on BOTH repos (2026-06-05); Railway deploy state unverified; uncommitted prompt WIP in sibling repo"
source: "Claude memory note project_openai_realtime_migration.md"
migrated: 2026-11-23
tags: [voco/log]
---

# 2026-06-05 OpenAI gpt-realtime-2 migration plan
Voice agent is migrating from `gemini-3.1-flash-live-preview` to OpenAI **gpt-realtime-2**
(audio-to-audio swap, NOT a cascade pipeline). Reason: Gemini 3.1's sync/blocking-only
function calling causes a server-VAD cancellation cascade → fabricated slot tokens + failed
bookings (proven in Railway logs, call AJ_AfqPbCYPNEep). gpt-realtime-2 has native async
function calling, which removes the root cause.

**Full execution handoff doc:** `docs/OPENAI-REALTIME-2-MIGRATION.md` (main repo). Read it
before doing any migration work — it has the file-by-file change inventory, break risks,
verified OpenAI plugin API, and the mandatory UAT gate.

Locked decisions: model=gpt-realtime-2; clear all `tenants.ai_voice` to NULL + professional
default (VOICE_MAP professional=marin); greeting=native via `generate_reply`.

Agent code lives in the sibling repo `C:\Users\leheh\.Projects\livekit-agent\` (deploys to
Railway), not the main repo. A prior pipeline migration (Phase 64) was reverted — see
[[feedback_gsd_worktree_stale_base_windows]] context and `.planning/phases/64-*/64-REVERTED.md`.
Independent open issues at time of planning: dead Jobber/Xero OAuth refresh tokens, and a
failing Railway build (pip timeout) that must be fixed before anything deploys.

**STATUS UPDATE 2026-06-05 (later) — NOW MERGED/COMMITTED TO `main` ON BOTH REPOS.**
Sibling agent repo `main` HEAD = `d4987a9 feat(agent): migrate voice brain Gemini 3.1 Flash
Live → OpenAI gpt-realtime-2`; main repo `main` HEAD = `490da7c feat(voice): migrate ai_voice
to OpenAI gpt-realtime voices (Phase 65)`. So the migration is no longer branch-only — it is
the live code on main. **Railway actual-deploy state is UNVERIFIED from the repo** (confirm via
Railway dashboard / a fresh call log; the `docs/Logs` dump is the OLD Gemini build 2026-06-03).
There is also **uncommitted WIP in the sibling repo**: `src/prompt.py` `_build_tool_narration_section`
retuned from the Gemini mandated ~3s filler to OpenAI's "one short preamble" guidance, plus
matching edits in `tests/test_prompt.py` + `tests/test_prompt_tool_narration.py` (not yet committed).
The UAT gate (one real phone call) may still be outstanding — verify before assuming prod-clean.

**STATUS UPDATE 2026-06-05 (prompt optimization) — that WIP is NOW COMMITTED, on a sibling-repo
feature branch (NOT main).** Carried out `livekit-agent/docs/PROMPT-OPTIMIZATION-GPT-REALTIME-2.md`:
a prompt-quality pass tightening `src/prompt.py` toward OpenAI realtime idioms (bullets, lighter
preambles, Gemini-VAD cruft purge, "filler"→"preamble") while preserving every data-injection block,
tool wiring, anti-fabrication guarantee, and EN+ES parity. Branch `prompt-optimization-gpt-realtime-2`
(2 commits: `4fb764d` brief doc, `4ef169c` impl) off `d4987a9`. `build_system_prompt` signature +
section order are byte-for-byte unchanged (no skill structure update needed). Assembled prompt EN
−6.6% / ES −7.0% vs clean main, all injected blocks intact. Tests: 315 pass; the 8 fails + 2
collection-errors are the documented pre-existing baseline (stale `check_availability` refs from the
tool split — NOT introduced). **STOPPED at the UAT gate (§10): the user must place one real phone
call on a preview deploy before merge/deploy — a near-identical Phase 64 change was reverted on
on-paper reasoning, so the real call is mandatory.** Sibling repo is left checked out on this branch.

**STATUS UPDATE 2026-06-05 (deploy CONFIRMED LIVE + ai_voice incident).** Railway is now
**confirmed running gpt-realtime-2** — a real prod call (tenant "Make It AI" 24141cd0, call
`call-_+65XXXXXXXX_UDxNMC3KDkyd`) hit the OpenAI Realtime API. So the earlier "Railway deploy
UNVERIFIED" notes are resolved: it IS deployed. **Incident:** that call errored because
`tenants.ai_voice='Zephyr'` (a Gemini-era voice) was passed unvalidated to `RealtimeModel(voice=)`
and OpenAI rejected it (`invalid_value`, supported set = alloy/ash/ballad/coral/echo/sage/shimmer/
verse/marin/cedar). Root cause: **migration 067 (`NULL ai_voice` + OpenAI CHECK) was never applied
to the prod Supabase DB** — proven because the new CHECK would forbid 'Zephyr'. Every tenant with a
stale Gemini voice was failing on every call. **Fix shipped:** hotfix on agent `main` (`35238f7`,
`fix/ai-voice-validation`) adds `OPENAI_VOICES` allowlist + `_resolve_voice()` so an unsupported
voice falls back to the tone default (professional→marin) instead of erroring the session; new
`tests/test_resolve_voice.py` (6 tests). Two follow-ups for the user: (1) push agent `main` +
redeploy Railway; (2) run migration 067 on prod Supabase to clean the data + add the guard CHECK.

**Original pre-commit status 2026-06-05 — EXECUTED up to the UAT gate.** Agent branch
`phase-65-openai-realtime-2`; main-repo changes (migration 067 + dashboard picker) on the
working branch. Verified against installed `livekit-plugins-openai==1.5.7`: agent imports +
constructs OK, 312 pytest pass (9 fails + 2 collection errors are pre-existing baseline,
proven on clean main), main-repo voice test 25/25. Plugin-version deviations from the plan:
NO `reasoning` kwarg in 1.5.7 (omitted; gpt-realtime-2 defaults low); `input_audio_transcription`
must be a typed `AudioTranscription` not a dict; `TurnDetection` not exported → used SDK
`SemanticVad`; `gpt-realtime-2` is NOT in the plugin's model literal so it's only verified at
the live handshake (isolated as `OPENAI_REALTIME_MODEL` constant — #1 UAT risk). **Two deploy
hazards (doc §17.4):** (1) don't ship the dashboard OpenAI-voice picker to prod before the
Railway agent cutover, else a Gemini agent gets a non-Gemini voice; (2) `public/audio/voices/`
has no `.mp3` samples for the new voices (preview-play 404s, not call-blocking). REMAINING:
set `OPENAI_API_KEY` on Railway → preview deploy → one real UAT call → commit/merge.
