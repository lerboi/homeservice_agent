---
type: log
date: 2026-09-04
status: record
description: "2026-09-04: Phase 0 (P0.1-P0.3) + Phase 1 (P1.1-P1.4, P1.6-P1.11) of the call-experience plan COMMITTED + PUSHED to livekit-agent main d901df5..0c7715b (Railway deploying) + skill sync pushed to main repo (227237f, 6ddb266); pending: live verification after deploy, P0.4 baseline calls, P1.5 Railway env, INFRA-REGIONS blanks"
source: "Claude memory note project_2026_09_04_phase0_phase1_executed.md"
migrated: 2026-11-23
tags: [voco/log]
---

# 2026-09-04 Call-experience Phase 0 and 1 executed
**State on 2026-09-04 (end of session): COMMITTED + PUSHED.** livekit-agent `main`
`d901df5` (P0.1/P0.2/P0.3 docs) → `a490a0f` (P1.1) → `b22d8c7` (P1.2) → `11b4e28` (P1.3) →
`2e9d11b` (P1.4) → `ea543dc` (P1.6–P1.9) → `0fe3aa0` (P1.10/P1.11) → `0c7715b` (doc). Railway
deploys from main. Main repo skill sync `227237f` + `6ddb266`. Suite **618 passed / 1 pre-existing
failure** (`test_incoming_call_vip_lead`), verified green at EVERY commit in a throwaway worktree.
Brief: `livekit-agent/docs/PLAN-2026-09-02-phase0-phase1.md` §8 (see
[[Call-experience four-phase plan (2026-09-02)]]).

**P1.1 follow-up found by live testing:** gpt-4.1-nano is ~0.85 s warm but the first request in a
process paid a TLS handshake (~2.1 s from SG) and tripped the 2.5 s cap → `layer2_llm.warm_client()`
fired at call start (`VOCO_TRIAGE_LAYER2_WARM`), client keep-alive expiry disabled,
`VOCO_TRIAGE_LAYER2_TIMEOUT_S` env-tunable, `[triage] layer2 ok … elapsed_ms=` logged. After the
warm: 0.7–1.0 s per classification, verdicts correct (emergency/urgent/routine).

**Done:** P0.1 turn_metrics log · P0.2 transcript timestamps · P0.3 `docs/INFRA-REGIONS.md`
(Supabase Tokyo verified; Railway + LiveKit regions TO-FILL — no Railway CLI login, Chrome
extension not connected) · P1.1 layer-2 triage → OpenAI gpt-4.1-nano · P1.2 check_day pops
`_last_offered_token` · P1.3 address-loop cap in code · P1.4 OneMap SG postal-first
(`src/integrations/onemap.py`, verified live) · P1.6 rotating filler bank + de-literalized tool
descriptions · P1.7 acknowledge+act · P1.8 SCHEDULING rewrite · P1.9 short greeting + ES
diacritics + recovery_error reword · P1.10 Supabase keep-alive client + prewarm ping (live:
204 ms vs 532 ms after 7 s idle) · P1.11 `num_idle_processes` pinned (default 2).

**NOT done (needs the user / a deploy):** post-deploy live verification on Railway; P0.4 baseline test calls; P1.5
`VOCO_MAX_ENDPOINTING_DELAY_S=1.2` on Railway; the two INFRA-REGIONS blanks; live verify after
deploy (`[agent] turn_metrics`, `[validate_address] onemap hit`, `[agent] prewarm: supabase
connection warmed`, `[triage] layer2 ok`, emergency triage on a flooding test call).

**Deviations from the brief (all reported to the user):** P1.3 adds a call-level backstop
(`UNCONFIRMED_TOTAL_CAP=3`) on top of the per-street cap of 2; P1.4 uses `returnGeom=Y` (lat/lng
filled) and strips spaces/hyphens from the postal before the 6-digit check; P1.6 example shapes
are Let me…/I'll…/Hang on…/participle (no question-tag examples — they invite a reply mid-tool),
and the ADDRESS VALIDATION opener's literal filler was also removed; P1.10 gained
`VOCO_SUPABASE_KEEPALIVE`/`VOCO_SUPABASE_TIMEOUT_S`/`VOCO_SUPABASE_PREWARM` flags and a 10 s
request cap (postgrest default was 120 s). Flags that default ON (not "today's behaviour"), per
the brief: `VOCO_SG_ONEMAP`, `VOCO_SUPABASE_KEEPALIVE`, `VOCO_SUPABASE_PREWARM`,
`VOCO_NUM_IDLE_PROCESSES=2`.

**Why:** the next session must not re-implement or re-derive; it should verify the deploy live.
**How to apply:** when asked to continue the call-experience work, start from the "NOT done"
list, then Phase 2 of the plan artifact. Never reopen P1.1's model choice (gpt-4.1-nano) or the
Groq/Cerebras question ([[2026-09-01 LLM provider decision and prompt caching]]).
