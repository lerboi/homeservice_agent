---
type: log
date: 2026-08-20
status: record
description: "2026-08-20 over-engineering pass — invoicing v1 master freeze (crons unscheduled, main repo UNCOMMITTED) + dead calculate_initial_slots deleted (agent side PUSHED in a51caec); remaining cut-list findings listed"
source: "Claude memory note project_2026_08_20_simplification_pass.md"
migrated: 2026-11-23
tags: [voco/log]
---

# 2026-08-20 Simplification pass - invoicing v1 freeze
2026-08-20 simplification pass, both repos, **UNCOMMITTED**. Two issues verified to certainty and fixed:

**(1) Invoicing v1 master freeze (main repo).** Verification overturned the original "just remove the crons" framing: both invoice crons already short-circuited cheaply on zero enabled tenants, but the per-tenant enable toggle at `/dashboard/more/features` was LIVE self-service (linked from More + a customer-detail nudge), so unscheduling alone would silently break reminders/late-fees/`sent`→`overdue` flips/recurring generation the day a tenant enabled it. Implemented the safe version mirroring the Jobber/Xero `f80f9bf` pattern: new `src/lib/invoicing-enabled.js` (`INVOICING_ENABLED`, `NEXT_PUBLIC_INVOICING_ENABLED === 'true'`, fail-closed, re-enable checklist in the comment), PATCH `/api/tenant/features` 403s `invoicing: true` (false always allowed), features-page switch disabled + "Coming soon" badge (only in the off→on direction), both cron routes no-op gated, and both entries removed from `vercel.json` (12 → 10 crons). Verified: all 6 live tenants `invoicing:false`; no jest test covers any touched file; ESLint clean; `next build` gate. **Re-enable = flip flag AND re-add both cron schedules.**

**(2) Dead `calculate_initial_slots` deleted (livekit-agent `src/utils.py`).** Zero callers repo-wide (all file types), no test pins, Node-era `handleInbound` leftover that still carried the banned `America/Chicago` silent fallback. Deleted with its now-unused `timedelta` + `calculate_available_slots` imports; suite unchanged at 508 passed / same 1 pre-existing VIP failure.

**Why:** executing the 2026-07-04 audit's freeze verdict properly — the freeze was never actually implemented for invoicing (only Jobber/Xero got the master-flag treatment).

**How to apply:** skills updated (voice-call-architecture, scheduling-calendar-system cron table, auth-database-multitenancy). Remaining verified-but-not-done cut-list items from the 2026-08-19 review: `zone_travel_buffers` deletion (highest-value agent simplification — zone_id always NULL), `language_barrier` machinery structurally dead (detector's output set == SUPPORTED_LANGUAGES so barrier is always false), transfer whisper built-then-discarded, dead legacy slot-ISO branch in book_appointment, `send-recovery-sms` at `* * * * *` could be `*/15`, `[63.1-DIAG]`/goodbye-race diagnostics for dead Gemini bugs, plus the still-live July-audit items (SEO templates, public chatbot, merge/unmerge, layer-3 triage, VIP path, sms-verify, es i18n). Related: [[2026-08-19 Voice latency and reliability pass]], [[2026-07-04 Full end-to-end audit (summary)]].
