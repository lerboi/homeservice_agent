---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Phases
status: executing
stopped_at: "Completed 60.3-03-PLAN.md Branch P prompt-harden fix; UAT #2 PARTIAL verdict accepted; Stream A closed, Stream B (Plan 4) unblocked"
last_updated: "2026-04-22T09:44:48.719Z"
last_activity: 2026-04-22
progress:
  total_phases: 19
  completed_phases: 16
  total_plans: 83
  completed_plans: 85
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-16)

**Core value:** Every inbound call is answered instantly and converted into a confirmed booking or qualified lead — no call goes to voicemail, no lead is lost to a competitor.
**Current focus:** Phase 60.3 — voice-agent-goodbye-cutoff-and-prompt-audit

## Current Position

Milestone: v6.0 (planning)
Phase: 60.3 (voice-agent-goodbye-cutoff-and-prompt-audit) — EXECUTING
Plan: 4 of 13
Status: Ready to execute
Last activity: 2026-04-22

Progress: [██████████] 100%

## Performance Metrics

**v5.0 final velocity:**

- Phases shipped: 4 (47, 48, 48.1, 49)
- Plans shipped: 19
- Phases absorbed: 1 (50 → into 49)
- Phases deferred to v6.0: 2 (51, 52)

| Phase | Plans | Status |
|-------|-------|--------|
| 47 | 5 | Complete |
| 48 | 5 | Complete |
| 48.1 | 4 | Complete |
| 49 | 5 | Complete |
| Phase 53 P03 | 8min | 3 tasks | 3 files |
| Phase 53 P04 | 18min | 3 tasks | 13 files |
| Phase 53 P05 | 14min | 3 tasks | 3 files |
| Phase 53 P07 | 10min | 3 tasks | 4 files |
| Phase 56 P01 | 35min | 2 tasks | 8 files |
| Phase 56 P02 | 15min | 3 tasks | 2 files |
| Phase 56 P03 | 35min | 3 tasks | 4 files |
| Phase 56 P04 | ~5min | 3 tasks | 10 files |
| Phase 56 P05 | ~20min | 2 tasks | 3 files |
| Phase 56 P06 | 35min | 3 tasks | 7 files |
| Phase 56 P07 | 15 minutes | 3 tasks | 3 files |
| Phase 59 P03 | 30 | 2 tasks | 3 files |
| Phase 59 P04 | 8 | 2 tasks | 15 files |
| Phase 59 P05 | 20 | 2 tasks | 6 files |
| Phase 59-customer-job-model-separation P06 | 1 session | 3 tasks | 17 files |
| Phase 59 P07 | 1 session | 3 tasks | 17 files |
| Phase 59 P08 | 526949 | 4 tasks | 18 files |
| Phase 60.3 P01 | 10min | 3 tasks | 4 files |
| Phase 60.3 P02 | 20min | 2 tasks | 2 files |
| Phase 60.3 P03 | 90min | 4 tasks | 3 files |

## Accumulated Context

### Decisions (v6.0 planning)

- [v6.0 Plan]: Milestone goal — refocus on Call System; invoicing becomes optional toggleable feature; native Jobber + Xero read-side integrations for caller context
- [v6.0 Plan]: Invoicing default OFF for ALL tenants (still in dev — no real users at risk); existing Phase 35 push code stays dormant behind the flag
- [v6.0 Plan]: Reuse `accounting_credentials` table for Jobber + Xero (extend provider CHECK to include `'jobber'`); no new credentials table
- [v6.0 Plan]: Jobber schedule mirrored into local `calendar_events` (Option B from advisory) — zero call-path latency; webhook-driven freshness; same pattern as Google Calendar
- [v6.0 Plan]: LiveKit agent fetches Jobber/Xero directly via Python (service-role Supabase reads creds → direct GraphQL/REST); no round-trip through Next.js for context lookup
- [v6.0 Plan]: Next.js 16 caching scope = dashboard reads only (`cacheComponents: true` + `"use cache"` + `revalidateTag`); call path stays Python-direct
- [v6.0 Plan]: Phase sequence — 52 (Leads → Jobs) → 53 (invoicing toggle) → 54 (integrations foundation + sandbox provisioning + Next.js 16 caching) → 55 (Xero read) → 56 (Jobber read) → 57 (Jobber schedule mirror) → 58 (checklist + skills + UAT)
- [v6.0 Plan]: Sandbox accounts for Jobber + Xero are pre-req for Phases 55–57; user to register dev apps during Phase 53/54 planning
- [v6.0 P55]: Xero read-side shipped — XeroAdapter.fetchCustomerByPhone as module-level cached fn with two-tier cacheTag (Next.js 16 forbids `'use cache'` on class methods); /api/webhooks/xero with HMAC + intent-verify + per-phone invalidation; BusinessIntegrationsClient gains 4 states with Reconnect banner + Last-synced timestamp; connect_xero setup checklist item; XeroReconnectEmail + notifyXeroRefreshFailure helper; livekit-agent fetches customer_context pre-session with 2.5s budget + parallel getInvoices; check_customer_account tool re-serves cached data as STATE+DIRECTIVE; error_state column (migration 053) surfaces token-refresh failures; cross-runtime casing divergence INTENTIONAL (camelCase Next / snake_case Python)
- [v6.0 P55 UAT findings → backlog]: 999.1 booking urgency constraint mismatch (`book_appointment` passes `urgency='high'` but DB only accepts emergency/urgent/routine); 999.2 LiveKit voice cutoff on tool calls (server cancelled tool calls when caller talks over AI)
- [v6.0 P56-02]: Added provider-agnostic `accounting_credentials.external_account_id` via migration 054 (backfilled from `xero_tenant_id` for Xero rows; partial unique index on `(tenant_id, provider, external_account_id) WHERE NOT NULL`). `xero_tenant_id` retained — P58 will drop. `.env.example` clarifies `JOBBER_CLIENT_SECRET` doubles as the webhook HMAC key (no separate `JOBBER_WEBHOOK_SECRET` env var — Pitfall 1 option b). Unblocks Plan 03 webhook tenant-resolution lookup.
- [v6.0 P56-03]: `/api/webhooks/jobber` shipped — HMAC-SHA256 raw-body verify via `JOBBER_CLIENT_SECRET` (Pitfall 1, no separate webhook-secret env var); `crypto.timingSafeEqual` constant-time compare; silent-200 on unknown accountId (prevents Jobber retry storms). Tenant resolution via `accounting_credentials.external_account_id` (P56-02 column). Topic-prefix routing: `CLIENT_*` → client query, `JOB_*`/`VISIT_*` → job→client query, `INVOICE_*` → invoice→client query; phones normalized via `libphonenumber-js.isPossible() + format('E.164')` → per-phone `revalidateTag('jobber-context-${tenantId}-${E164}')`; broad `jobber-context-${tenantId}` fallback on any GraphQL failure or zero valid phones. No `console.log`, no intent-verify branch (Pitfall 6). OAuth callback extended with Jobber-only `query { account { id } }` probe (5s AbortController timeout) that UPDATEs `external_account_id` on success; probe failure is non-destructive — tokens stay valid, redirect with `?error=account_probe_failed&provider=jobber` so UI surfaces reconnect. Xero callback path literally unchanged. 15 new tests (11 webhook + 4 callback); full regression suite 31/31.
- [2026-04-18 backlog 999.1 & 999.2 resolved]: (999.1) `src/tools/book_appointment.py` now normalizes urgency via `_normalize_urgency()` (maps `high`/`medium` → `urgent`, `low`/`normal` → `routine`, `critical`/`asap` → `emergency`, unknown → `routine`) before calling `atomic_book_slot`; tool description enumerates the three allowed values to stop Gemini inventing new ones. (999.2) `src/agent.py` passes a `RealtimeInputConfig` with `AutomaticActivityDetection` set to LOW start/end sensitivity, `prefix_padding_ms=400`, `silence_duration_ms=1000` to `google.realtime.RealtimeModel` — dampens Gemini server VAD so breaths/overlap no longer cancel in-flight tool calls (root cause: livekit/agents#4441). Barge-in preserved. Skill `voice-call-architecture` updated; both entries ready to be deleted from ROADMAP backlog section.
- [v6.0 P60.3-01]: Stream A goodbye-race instrumentation shipped to livekit-agent (`c4f0570` on `lerboi/livekit_agent` main; Railway auto-deploy triggered). `[goodbye_race]` JSON logger.info line + Sentry breadcrumb emitted on every call close with 6 timestamps (`end_call_invoked_at`, `last_text_token_at`, `last_audio_frame_at`, `playback_finished_at` + `text_done`/`audio_done`, `participant_disconnect_at` + `disconnect_reason`, `session_close_at` + `close_reason`), transcript_tail (last 3 turns, ≤500 chars, E.164 phone-redacted via `_PHONE_REDACT_RE`), and `tool_call_log_tail`. All via public livekit-agents 1.5.1 APIs — no private symbol monkey-patching. `_GoodbyeDiagHandler` stdlib logging.Handler reads `text_done`/`audio_done` from the synchronizer warning's LogRecord extra= fields (R-A3). `_flush_goodbye_diag` is the FIRST statement in `_on_close_async` so the record survives Fix I's 8s post-call pipeline timeout. 7 new unit tests green; baseline prompt tests green (2+4). 1 pre-existing `tests/webhook/test_routes.py::test_incoming_call_vip_lead` failure documented in 60.3 `deferred-items.md` (out of Stream A scope, touches `src/webhook/app.py`). Ready for Plan 02 UAT #1.
- [v6.0 P60.3-02]: Stream A UAT #1 captured `[goodbye_race]` payload for call-_+6587528516 (174s, declined). Caller heard `"Alright, I'll get all"` cut mid-sentence. Evidence matches BOTH #5096 signature (`text_done=false, audio_done=true`) AND Branch P directional signal (`end_call_invoked_at` 11ms before `last_text_token_at`; `playback_finished_at` stale on earlier segment at -15.2s; 3× mid-call `_SegmentSynchronizerImpl` warnings at +152s/+202s/+222s — systemic pipeline race, not goodbye-isolated). Per Plan 2 ambiguity-resolution rule (lines 285-294) → **Selected fix: Branch P** (prompt-harden `_build_call_duration_section` at `src/prompt.py:544-556`; lower-risk, fully revertable prompt-only change). Plan 3 executes Branch P only; Branch G tasks (`end_call.py` `wait_for_playout` pre-guard) marked `skipped`. Post-Branch-P UAT #2 discriminates — if truncation persists, promote Branch G inside Phase 60.3 evidence loop. Non-blocking concerns: (a) systemic mid-call warnings may need own phase; (b) `playback_finished_at` stale-segment capture is instrumentation refinement note; (c) `tool_call_log_tail` empty on `end_call` firing is by-design gap. Artifacts: `60.3-HUMAN-UAT.md`, `60.3-STREAM-A-ANALYSIS.md`. Bundle commit `9811ea2`.
- [v6.0 P60.3-03]: Stream A Branch P prompt-harden fix shipped to livekit-agent main (commit `ebaa556`; Railway auto-deployed). `_build_call_duration_section` promoted to `ENDING THE CALL — CRITICAL RULE:` block with WRONG (`"Thank you for calling Voco — have a' *click*`) / RIGHT (speak → silence → separate-turn end_call) inline failure-mode example; section reordered from near-end to position 5 of `build_system_prompt` (top-attention band, after `_build_outcome_words_section` before `_build_tool_narration_section`). 9/10-minute bounds preserved. 5 new TDD tests in `tests/test_prompt.py`. Branch G (tool-level `wait_for_playout` pre-guard) skipped per 60.3-STREAM-A-ANALYSIS.md selection. **UAT #2** (call-_+6587528516_B8XEm2FgLTGZ, 62s, declined): **Verdict PARTIAL**. Primary Stream A goal achieved — `_SegmentSynchronizerImpl` warning absent (vs 3× in UAT #1); `text_done`/`audio_done`/`playback_finished_at` keys absent from payload (healthy-pipeline signal); transcript_tail ends on complete sentence `"agent: I understand."` (no mid-word cutoff). **New gap surfaced:** model invoked end_call after saying only `"I understand."` — no farewell phrase at all. CRITICAL RULE enforces two-step mechanics but not farewell *content*. Scope-appropriate for Stream B (Plans 4-12 prompt audit); NOT a Branch-G swap candidate (no pipeline race evidence). The 11-12ms `end_call_invoked_at`→`last_text_token_at` delta is an instrumentation/timing artifact (identical magnitude both UATs = event-loop dispatch noise, not prompt-defiance). D-X-02 success criteria 3 & 4 satisfied; **Stream A closed, Stream B (Plan 4) unblocked**. Bundle commit `56a4493` (UAT evidence); final bundle commit pending (this STATE update + SUMMARY + ROADMAP).

### Roadmap Evolution

- 2026-04-16: v5.0 milestone closed. 4 phases shipped (47, 48, 48.1, 49); Phase 50 absorbed into 49 Plan 05; Phases 51 and 52 deferred to v6.0. Phase 47-05 documented as superseded in part by Phase 48.1 revenue-recovery rewrite.
- 2026-04-16: v6.0 (Integrations & Focus) opened. 7 phases planned (52, 53, 54, 55, 56, 57, 58). Detailed plan in conversation log.
- 2026-04-17: Phase 56 added — Customer/Job model separation (split deduped leads into Customers + per-appointment Jobs, rewrite Jobs tab, add Customer detail page, reattribute invoices per-job). Note: this shifts previously-planned Jobber-read out of slot 56 → will need renumbering when planned.
- 2026-04-19: Voice-intake polish batch added at v6.0 tail — Phases 60 (voice prompt polish: name-once + single-question address intake framing), 61 (Google Maps Address Validation API + structured address columns on appointments/leads), 62 (Jobber write-side — push booked customer + job, promoted from backlog 999.3). CONTEXT seed files written for each; ready for `/gsd:discuss-phase 60` etc. Phase 62 supersedes backlog 999.3 (backlog entry marked PROMOTED). v6.0 phase range extended to 52-58, 60-62 (10 phases). Phase 59 stays v7.0 prep (unchanged).
- 2026-04-21: Phase 60.4 inserted after Phase 60 (URGENT) — "Booking timezone fix + STT language pinning". Two orthogonal bugs surfaced in the 2026-04-21 UAT call on +6587528516: (1) 3 PM SG booking landed at 11 PM in Google Calendar (+8h shift matches UTC+8 offset — likely missing tzinfo or wrong `timeZone` kwarg on `events.insert()`); (2) Gemini Live transcript hallucinates German/Hindi during silence even though caller speaks English only. Not covered by 60.2 (shipped — Fix G tool-call VAD) or 60.3 (ready-for-planning — goodbye-cutoff diagnosis + prompt audit). Should be discussed + planned + executed AFTER Phase 59 cutover ships and AFTER Phase 60.3 ships. Prerequisite: Phase 59 live-call test passes so #4 (booking/call not in dashboard) is confirmed resolved or confirmed as an additional 60.4 scope item.

### Pending Todos

- v6.0 Phase 52 (Leads → Jobs rename) needs `/gsd:plan-phase` execution (carries over from v5.0)
- User to register Jobber dev account at developer.getjobber.com (pre-req for Phase 56)
- ~~User to register Xero dev account at developer.xero.com (pre-req for Phase 55)~~ ✅ done (Phase 55 shipped)

### Blockers/Concerns

- [v6.0]: Sandbox account provisioning is the single user-action blocker for Phases 55–57 — flagged in milestone plan
- [v6.0]: Multiple parallel phone-based lookups during call setup (VIP + leads history + Jobber + Xero) need telemetry to confirm latency budget — Phase 58 deliverable

## Session Continuity

Last session: 2026-04-22T09:44:48.711Z
Stopped at: Completed 60.3-03-PLAN.md Branch P prompt-harden fix; UAT #2 PARTIAL verdict accepted; Stream A closed, Stream B (Plan 4) unblocked
Resume file: None
