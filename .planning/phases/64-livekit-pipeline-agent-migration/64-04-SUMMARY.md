---
phase: 64-livekit-pipeline-agent-migration
plan: 04
subsystem: voice-call-architecture
tags: [deploy, railway, preview, pipeline, checkpoint-pending]

# Dependency graph
requires:
  - phase: 64-02
    provides: pipeline AgentSession assembly on branch phase-64-pipeline-migration (HEAD 96eebb2 → now 24bf7c0 post Plan 03)
  - phase: 64-03
    provides: D-03c greeting re-frame + D-03d NO DOUBLE-BOOKING compression + EN/ES parity on the same branch
provides:
  - origin/phase-64-pipeline-migration @ 24bf7c08716c4d67a84ce28be2e42c99f0fca91d (remote branch for Railway preview consumption)
  - Railway preview deploy URL + deploy SHA (TODO — awaiting human verification)
  - Boot-log snippet confirming "worker registered" + absence of ImportError/TypeError/ModuleNotFoundError in first 60s (TODO — awaiting human verification)
affects:
  - 64-05 (UAT) — unblocked once preview URL / SIP address is confirmed green
  - 64-06 (phase close) — `--no-ff` merge sequenced after UAT success

# Tech tracking
tech-stack:
  added: []  # deploy-only plan, no new deps
  patterns:
    - "Pre-push local gate: full pytest suite as a last sanity check before branch push (captures any env-drift regression that crept in between Plans 03 and 04)"
    - "Silero pin gate (Pitfall 7 mitigation): grep for livekit-plugins-silero==1.5.6 in pyproject.toml before push — pin was intact, no corrective commit needed"

key-files:
  created:
    - .planning/phases/64-livekit-pipeline-agent-migration/64-04-SUMMARY.md  # this file (skeleton; Task 2 sections filled post-checkpoint)
  modified: []

key-decisions:
  - "No corrective silero commit was required — pyproject.toml already had `livekit-plugins-silero==1.5.6` pinned since Phase 63; Pitfall 7 gate passed without intervention"

patterns-established:
  - "Cross-repo discipline continued: livekit-agent push uses --no-verify; homeservice_agent SUMMARY.md commit is standard (no --no-verify)"

requirements-completed: []
decisions-covered: [D-01, D-08, D-11]

# Metrics
duration: TODO (Task 1 ~2 min; Task 2 human-verify pending)
completed: TODO (finalize after checkpoint resolves)
---

# Phase 64 Plan 04: Railway Preview Deploy — Summary

**Deploy-only plan. Task 1 (push + pre-flight gates) complete; Task 2 (Railway preview verification) is a blocking human-verify checkpoint — this SUMMARY is a skeleton awaiting user-supplied preview URL + deploy SHA + boot-log confirmation.**

## Performance

- **Task 1 duration:** ~2 min (status check + test suite + pin grep + push + remote verify)
- **Task 2 duration:** TODO (pending Railway deploy + human verification)
- **Tasks:** 1 auto-complete + 1 human-verify checkpoint pending
- **Files modified:** 0 code changes in livekit-agent; 1 SUMMARY skeleton in homeservice_agent
- **Commits on feature branch:** 0 new (branch content unchanged since Plan 03's HEAD `24bf7c0`)

## Task 1 Results (Complete)

### Pre-flight checks

| Check                                                              | Result                                                                 |
|--------------------------------------------------------------------|------------------------------------------------------------------------|
| `git branch --show-current`                                        | `phase-64-pipeline-migration` ✓                                        |
| `git log --oneline main..phase-64-pipeline-migration` (commit count) | 8 commits (≥5 required) ✓                                            |
| Full pytest suite                                                  | **283 passed, 2 failed** (both pre-existing; documented in Plan 03 SUMMARY) ✓ |
| Pitfall 7 silero pin grep                                          | `"livekit-plugins-silero==1.5.6"` present in `pyproject.toml` line 11 ✓ |
| `git push --no-verify -u origin phase-64-pipeline-migration`       | **Success** — new remote branch created; upstream set                  |
| `git ls-remote origin phase-64-pipeline-migration`                 | `24bf7c08716c4d67a84ce28be2e42c99f0fca91d` ✓                           |
| Remote SHA == local HEAD                                           | **Match** — `24bf7c08716c4d67a84ce28be2e42c99f0fca91d` ✓               |

### Pre-existing test failures (NOT new regressions)

1. `tests/webhook/test_routes.py::test_incoming_call_vip_lead` — deferred VIP test documented in STATE.md + Plan 02 SUMMARY + Plan 03 SUMMARY.
2. `tests/test_check_availability_slot_cache.py::test_fresh_cache_bypasses_supabase_scheduling_queries` — time-dependent 3pm-today race, reproducible on pre-Plan-02 HEAD, documented in Plan 03 SUMMARY.

Neither failure is in Phase 64 scope. Both are known and acceptable per Plans 02/03 SUMMARYs.

### Branch commit log (top 8, ahead of `main`)

```
24bf7c0 feat(64): compress NO DOUBLE-BOOKING to one-liner per D-03d (pipeline)
77030e6 test(64): build_system_prompt composition asserts D-03c re-frame EN+ES
74b165a feat(64): re-frame _build_greeting_section per D-03c (pipeline)
96eebb2 feat(64): swap RealtimeModel → STT+LLM+TTS+VAD pipeline session
edce1ec feat(64): add _build_pipeline_plugins helper + silero import
6b45510 test(64-01): wave 0 RED — D-03d NO DOUBLE-BOOKING one-liner contracts
6f44cb1 test(64-01): wave 0 RED — D-03c greeting re-frame contracts
fd30b32 test(64-01): wave 0 RED — session construction invariants
```

### Silero pin status (Pitfall 7 mitigation gate)

`pyproject.toml` line 11 confirms `"livekit-plugins-silero==1.5.6"` — pin intact from Phase 63. **No corrective `chore(64):` commit was needed.** The pre-push gate in the plan anticipated a drift scenario that did not materialize.

## Task 2 Results (PENDING — awaiting human verification)

### Preview deploy metadata (TODO)

| Field                                   | Value                                                                    |
|-----------------------------------------|--------------------------------------------------------------------------|
| Railway deploy status                   | TODO (expected: SUCCESS)                                                 |
| Railway deploy SHA                      | TODO (expected to match local/remote `24bf7c08716c4d67a84ce28be2e42c99f0fca91d`) |
| Railway preview URL / SIP address       | TODO                                                                     |
| Boot log "worker registered" snippet    | TODO                                                                     |
| Boot errors observed in first 60s       | TODO (expected: NONE — no ImportError / ModuleNotFoundError / TypeError / FileNotFoundError) |
| `GOOGLE_APPLICATION_CREDENTIALS` present| TODO (expected: present)                                                 |
| Cloud Speech v2 IAM role                | TODO (expected: `roles/speech.client` or `roles/speech.admin` or custom role with `speech.v2.*` permissions) |

### Boot-log positive signals expected (to be pasted after verification)

- `INFO livekit.agents.cli:registered worker` (or equivalent 1.5.6 phrasing)

### Boot-log negative signals (must be absent)

- `ImportError: No module named 'onnxruntime'` (Pitfall 7)
- `FileNotFoundError: silero model not found` (Pitfall 7)
- `TypeError` on `STT.__init__`, `LLM.__init__`, or `VAD.load` (Pitfall 3 — kwarg mismatch)
- `RuntimeError` or other unhandled exceptions in first 60s

## Preserved Contracts (Regression Guards)

- ✓ Branch content matches Plan 03 HEAD (`24bf7c0`) — no code changes in Plan 04
- ✓ Pre-existing `main` history untouched — merge deferred to Plan 64-06 per D-01
- ✓ Full pytest suite runs green except for 2 pre-existing unrelated failures (Plans 02+03 baseline preserved)

## Decisions Made

- **No silero pin correction needed.** The Pitfall 7 gate passed on first grep; Phase 63's pin is intact. No `chore(64):` commit was added to the branch.
- **Checkpoint scope unchanged from plan.** Task 2 remains a pure human-verify gate — no Railway-side automation attempted from the executor (dashboard state, IAM role inspection, and log reading are hands-on by design per plan's `<how-to-verify>` protocol).

## Deviations from Plan

None — Task 1 executed verbatim. 2 failures out of 285 tests match the pre-existing baseline from Plans 02+03. Silero pin gate passed without intervention.

### Auto-fixed Issues

None.

## Issues Encountered

- **`pytest` not on PATH** — invoked via `python -m pytest tests/` instead. Cosmetic; no impact on results.
- **Stale `.pyc` files in working tree** — `src/__pycache__/*.pyc` showed as modified but are not tracked (excluded by `.gitignore`); no action needed.

## Known Stubs

None — this is a deploy gate. Task 2 placeholders in the tables above are NOT stubs; they are awaiting legitimate user-supplied values that cannot be gathered by the executor per the plan's checkpoint protocol.

## User Setup Required

**Railway dashboard verification (Task 2, human-verify):**

1. Open Railway dashboard → livekit-agent service → Deployments.
2. Locate the deployment tied to `phase-64-pipeline-migration` HEAD SHA (`24bf7c08716c4d67a84ce28be2e42c99f0fca91d`).
3. Wait for status = SUCCESS (typical ~2–3 min). If Railway does not auto-deploy on branch push, trigger manually from the Deployments panel.
4. Open the deploy's log pane. Confirm:
   - "worker registered" (or livekit-agents 1.5.6 equivalent)
   - No ImportError / ModuleNotFoundError / TypeError / FileNotFoundError in the first 60s
5. Verify env:
   - `GOOGLE_APPLICATION_CREDENTIALS` populated in Railway variables.
   - The service account identified by that credential has Cloud Speech v2 scope (`roles/speech.client` minimum; `roles/speech.admin` also acceptable; or a custom role carrying `speech.v2.*` permissions).
6. Capture the preview URL / SIP address for Plan 05 UAT consumption.

**Resume signal:** Reply with `"preview green"` + preview URL + deploy SHA, OR paste the failure log excerpt + root cause (do NOT attempt a fix in this plan — if a fix is needed, open a new gap-closure plan).

## Authentication Gates

**One latent auth gate (Task 2):** If `GOOGLE_APPLICATION_CREDENTIALS` on Railway is NOT scoped for Cloud Speech v2, Plan 05 UAT will fail at first STT call. Resolution is user-side (add IAM role OR rotate to a service account with the scope). Not blocking for the preview boot — only blocking for live STT in UAT.

## Next Phase Readiness

**Plan 05 (UAT) is blocked on:**
1. Railway deploy = SUCCESS at `24bf7c08716c4d67a84ce28be2e42c99f0fca91d` (Task 2).
2. Preview URL / SIP address captured (Task 2).
3. Cloud Speech v2 IAM scope confirmed (Task 2).

**Plan 06 (phase close / merge) is blocked on Plan 05.** D-01 `--no-ff` merge of `phase-64-pipeline-migration` → `livekit-agent/main` happens only after UAT passes.

## Self-Check: PASSED (Task 1 scope only)

- ✓ `git ls-remote origin phase-64-pipeline-migration` returns `24bf7c08716c4d67a84ce28be2e42c99f0fca91d`
- ✓ Local `git rev-parse phase-64-pipeline-migration` == `24bf7c08716c4d67a84ce28be2e42c99f0fca91d`
- ✓ Full pytest suite = 283 passed / 2 pre-existing failures (matches Plan 03 SUMMARY baseline)
- ✓ `pyproject.toml` line 11 contains `livekit-plugins-silero==1.5.6`
- ✓ Branch has 8 commits ahead of `main` (≥5 required)
- ○ Task 2 self-check PENDING (will be filled in post-checkpoint: Railway SUCCESS + boot-log grep + IAM role confirmation)

---

*Phase: 64-livekit-pipeline-agent-migration*
*Plan: 04*
*Task 1 completed: 2026-04-24T15:42:04Z*
*Task 2 completed: TODO (awaiting human verification)*
