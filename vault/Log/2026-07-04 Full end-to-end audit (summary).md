---
type: log
date: 2026-07-04
status: record
description: "2026-07-04 full end-to-end audit (funnel→onboarding→payment→dashboard→voice agent); 5 launch blockers + over-engineering list at [[2026-07-04 Full system audit (full report)]]"
source: "Claude memory note project_2026_07_04_full_audit.md"
migrated: 2026-11-23
tags: [voco/log]
---

# 2026-07-04 Full end-to-end audit (summary)
Full multi-agent audit run 2026-07-04, grounded in live code (both repos) + live Supabase + live Stripe MCP, adversarially verified. Report: [[2026-07-04 Full system audit (full report)]].

**Verdict:** idea is feasible + valuable; core loop works; multi-tenant isolation (verified by row-level impersonation) and atomic booking (GiST constraint) are solid. Two problems: (1) ~5 funnel seams break, several already broken in live data; (2) heavily over-scoped for a solo pre-PMF founder.

**5 launch blockers (before charging a real customer):**
1. Stripe is a **sandbox** — all prices `livemode:false`, 0 paid subs (7 all `trialing`). Need live products/prices/meter/webhook + repopulate 9 `STRIPE_PRICE_*` env vars.
2. **SIP dispatch binding is config drift** — `agent_name="voco-voice-agent"` disables auto-dispatch but committed `sip-dispatch-rule.json` has no `roomConfig.agents`; prod works only via hand-edited LiveKit Cloud rule. Any redeploy = dead air on all calls.
3. **verify-checkout fallback strands paying tenants** — fulfills billing but never provisions a number/seeds hours. Tenant `f4665eef` already stranded (trialing Growth, phone_number=NULL, provisioning_failed=false). Extract shared `fulfill()` + E.164-validating sweeper.
4. **Owner alert can silently drop** — 8s post-call pipeline aborts on ~4% of calls (6/139) before §7 notify, no outbox row; triage layer2 (Groq) fails to "routine" silently. Persist alert intent to `owner_notification_failures` BEFORE send.
5. **"Call-ready" can lie** — test call only checks owner's phone rang not that AI answered; readiness meter defeatable by Mark-done or `working_hours={}` while gate still forwards calls.

**Fix status (updated 2026-07-09, UNCOMMITTED in working tree; verified — eslint clean, jest baseline identical +3 tests, pytest 505 pass). Detailed plan: [[2026-07-09 P0-2 to P0-5 verification and fix plan]]:**
- **P0-1 (Stripe):** N/A per owner — live keys run on Vercel, repo uses test.
- **P0-3 (provisioning strand): DONE** — new `src/lib/tenant-activation.js` `activateTenant()` shared by webhook + `verify-checkout` (billing synced FIRST, provision best-effort after); new `cron/sweep-unprovisioned-tenants` DETECTS+FLAGS only (no auto Twilio purchase) + `vercel.json`. Deferred: atomic provisioning claim (re-SELECT guard used) + `f4665eef` backfill (via one-off `activateTenant()` after confirming it's a real account).
- **P0-4 (owner alert): DONE** — persist-first for emergency/urgent in `post_call.py` + capped `layer3_rules.py` services query (inside try) + `write_outcome.py` RPC. Did NOT reorder record_outcome (capped instead) or raise 8s wall. TRI-1 triage-recall half DEFERRED (layer1 floor doesn't fix non-keyword-emergency misclassification).
- **P0-5/DASH-1: DONE** — `setup-checklist/route.js` (mark-done no longer satisfies 4 non-test essentials; configure_hours rejects `{}`), `ChecklistItem.jsx` (hide button), `working-hours/route.js` (shape guard). `make_test_call` keeps mark-done fallback.
- **P0-2 + P0-5/VOICE-2: BLOCKED** — need `lk sip dispatch list` (live rule shape) + confirm LiveKit `participant_joined` webhook registered before touching, else the fix itself could cause the outage / strand new tenants.

**Biggest over-engineering (cut/defer/freeze):** invoicing+estimates suite (0/5 tenants), Jobber+Xero (both live connections dead, 1 never used — reduce to 1 flagged provider + cut schedule-mirror), programmatic-SEO engine, zone_travel_buffers matrix (dead code), customer merge/unmerge/undo (0 rows ever).

**Open items needing Vercel/LiveKit console (I can't reach):** confirm live dispatch rule; confirm all `vercel.json` crons run (unset CRON_SECRET / Hobby plan likely explains 16-day frozen calendars); confirm `current_period_end` populates on active subs (past_due gate fails open when null).

Supersedes the older 06-xx trackers as the current-state snapshot. Related: [[2026-06-26 Deploy readiness verified state]], [[2026-06-18 LiveKit agent deep read - reliability risks]], [[2026-06-09 Cascade pipeline migration (Deepgram + gpt-4.1-mini + ElevenLabs)]].
