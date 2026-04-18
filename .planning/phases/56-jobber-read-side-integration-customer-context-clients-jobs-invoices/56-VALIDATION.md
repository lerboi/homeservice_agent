---
phase: 56
slug: jobber-read-side-integration-customer-context-clients-jobs-invoices
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-18
---

# Phase 56 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

### Next.js side (this repo)

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x (ESM via `node --experimental-vm-modules`) |
| **Config file** | `package.json > scripts.test` — no dedicated jest.config; resolves with default ESM config + project conventions from P55 |
| **Quick run command** | `npm test -- tests/integrations/jobber` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds (full suite as of P55 close) |

### Python side (separate livekit-agent repo at `C:/Users/leheh/.Projects/livekit-agent/`)

| Property | Value |
|----------|-------|
| **Framework** | pytest (assumed — matches P55 convention) |
| **Config file** | `pyproject.toml` (to confirm at Plan 05 start) |
| **Quick run command** | `pytest tests/test_jobber_integration.py -x` (run inside livekit-agent repo) |
| **Full suite command** | `pytest` (run inside livekit-agent repo) |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task-specific quick command listed in the Per-Task Verification Map
- **After every plan wave:** Run `npm test -- tests/integrations tests/api/webhooks/jobber tests/components tests/notifications` (Next.js side)
- **Before `/gsd-verify-work`:** Both Next.js full suite (`npm test`) and Python suite (`pytest` inside livekit-agent) must be green
- **Max feedback latency:** ~20 seconds per task commit; ~30 seconds per wave; ~60 seconds for phase gate

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 56-01-01 | 01 | 1 | JOBBER-01, JOBBER-02 | T-56-01-03, T-56-01-04 | Wave 0 test scaffolds — shape, no-match, cache directive, refresh rotation | unit | `npm test -- tests/integrations/jobber` | ❌ created by this task | ⬜ pending |
| 56-01-02 | 01 | 1 | JOBBER-01 | T-56-01-01, T-56-01-02 | OAuth exchangeCode persists both tokens + JWT expiry; refreshToken persists rotated refresh_token on every call | unit | `npm test -- tests/integrations/jobber.adapter.test.js tests/integrations/jobber.refresh.test.js` | ✅ W0 | ⬜ pending |
| 56-01-03 | 01 | 1 | JOBBER-02 | T-56-01-05, T-56-01-06 | fetchJobberCustomerByPhone with `'use cache'` as FIRST statement; two-tier cacheTag; E.164 regex validated pre-interpolation; post-filter phone exact match via libphonenumber-js | unit | `npm test -- tests/integrations/jobber.fetch.test.js tests/integrations/jobber.cache.test.js tests/integrations/jobber.phone-match.test.js` | ✅ W0 | ⬜ pending |
| 56-02-01 | 02 | 1 | JOBBER-01 | T-56-02-01 | Migration 054 adds `external_account_id TEXT` column; backfills Xero rows from `xero_tenant_id`; no RLS regression | migration | `supabase db diff --linked` + `grep -n "external_account_id" supabase/migrations/054_*.sql` | ❌ created by this task | ⬜ pending |
| 56-02-02 | 02 | 1 | JOBBER-01, JOBBER-03 | T-56-02-02 | `.env.example` documents JOBBER_WEBHOOK_SECRET=JOBBER_CLIENT_SECRET overload; no leak into code | static | `grep -n "JOBBER_WEBHOOK_SECRET\|JOBBER_CLIENT_SECRET" .env.example` | ✅ already has JOBBER_* keys (empty values) | ⬜ pending |
| 56-03-01 | 03 | 2 | JOBBER-03 | T-56-03-01, T-56-03-02, T-56-03-03 | Wave 0 test scaffolds for webhook route — HMAC 401, unknown-tenant 200, per-phone revalidateTag | integration | `npm test -- tests/api/webhooks/jobber` | ❌ created by this task | ⬜ pending |
| 56-03-02 | 03 | 2 | JOBBER-03 | T-56-03-01, T-56-03-02 | POST /api/webhooks/jobber HMAC-SHA256 verify using JOBBER_CLIENT_SECRET on raw body; timingSafeEqual; 401 on mismatch; 200 on unknown accountId (silent-ignore) | integration | `npm test -- tests/api/webhooks/jobber/route.test.js` | ✅ W0 | ⬜ pending |
| 56-03-03 | 03 | 2 | JOBBER-03 | T-56-03-04 | Event routing: CLIENT_*/JOB_*/VISIT_*/INVOICE_* resolve clientId → phones → E.164 normalize → per-phone revalidateTag; broad fallback on resolve failure | integration | `npm test -- tests/api/webhooks/jobber/route.test.js` | ✅ W0 | ⬜ pending |
| 56-04-01 | 04 | 2 | JOBBER-01 | — | Bug fix: hardcoded "Xero" in Reconnect banner swapped for `{meta.name}`; Preferred badge renders only when `status.xero !== null && connected` | unit (RTL) | `npm test -- tests/components/BusinessIntegrationsClient.test.jsx` | ❌ created by this task | ⬜ pending |
| 56-04-02 | 04 | 2 | JOBBER-01 | — | integrations/page.js passes Jobber row (id, last_context_fetch_at, error_state) in initialStatus; disconnect route adds Jobber branch (row delete + revalidateTag broad) | integration | `npm test -- tests/app/dashboard/integrations-page.test.jsx tests/api/integrations/disconnect-jobber.test.js` | ❌ created by this task | ⬜ pending |
| 56-04-03 | 04 | 2 | JOBBER-01 | T-56-04-01 | connect_jobber setup-checklist item appended; notifyJobberRefreshFailure helper sends JobberReconnectEmail via Resend (no token echo in email body or log) | integration | `npm test -- tests/api/setup-checklist-jobber.test.js tests/notifications/jobber-refresh-email.test.js` | ❌ created by this task | ⬜ pending |
| 56-05-01 | 05 | 3 | JOBBER-02, JOBBER-04 | T-56-05-01, T-56-05-02 | [CROSS-REPO] Python `src/integrations/jobber.py` service-role read of accounting_credentials + refresh-aware httpx GraphQL + refresh_token write-back on rotation | unit (Python) | `pytest tests/test_jobber_integration.py -x` (in livekit-agent repo) | ❌ W0 created by this task (cross-repo) | ⬜ pending checkpoint |
| 56-06-01 | 06 | 4 | JOBBER-04 | — | [CROSS-REPO] `src/lib/customer_context.py::merge_customer_context` — Jobber wins client/recentJobs/lastVisitDate; Xero wins outstandingBalance/lastPaymentDate/lastInvoices; both-miss returns None | unit (Python) | `pytest tests/test_customer_context_merge.py -x` (in livekit-agent repo) | ❌ W0 created by this task (cross-repo) | ⬜ pending checkpoint |
| 56-06-02 | 06 | 4 | JOBBER-04 | T-56-06-01 | [CROSS-REPO] `_run_db_queries` 5th parallel task with 800ms `asyncio.wait_for`; `httpx.Timeout(connect=0.3, read=0.7)` socket-level self-terminate; Sentry capture on timeout with hashed-phone tag | unit (Python) | `pytest tests/test_agent_jobber_timeout.py -x` (in livekit-agent repo) | ❌ W0 created by this task (cross-repo) | ⬜ pending checkpoint |
| 56-06-03 | 06 | 4 | JOBBER-04, JOBBER-05 | — | [CROSS-REPO] prompt.py source annotations emitted per field via `_sources` dict; check_customer_account re-serves merged dict as STATE+DIRECTIVE (no re-fetch) | unit (Python) | `pytest tests/test_check_customer_account.py -x` (in livekit-agent repo) | ❌ W0 created by this task (cross-repo) | ⬜ pending checkpoint |
| 56-07-01 | 07 | 4 | all | — | Skill updates: voice-call-architecture (5-task + merge helper + jobber integration), auth-database-multitenancy (migration 054 external_account_id), dashboard-crm-system (Jobber card states + Preferred badge + connect_jobber checklist) | static | `grep -nE "jobber|merge_customer_context|external_account_id" .claude/skills/*/SKILL.md` | N/A (doc update) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity check:** No sequence of 3 consecutive tasks lacks an automated verify. Every task above lists a concrete `<automated>` command.

---

## Wave 0 Requirements

### Next.js side (this repo)

- [ ] `tests/integrations/jobber.adapter.test.js` — OAuth auth URL + exchangeCode + revoke (JOBBER-01) — created in Plan 01 Task 1
- [ ] `tests/integrations/jobber.refresh.test.js` — refresh token rotation write-back (JOBBER-01) — created in Plan 01 Task 1
- [ ] `tests/integrations/jobber.fetch.test.js` — fetchJobberCustomerByPhone shape + match + no-match (JOBBER-02) — created in Plan 01 Task 1
- [ ] `tests/integrations/jobber.phone-match.test.js` — (555) 123-4567 ↔ +15551234567 normalization (JOBBER-02) — created in Plan 01 Task 1
- [ ] `tests/integrations/jobber.cache.test.js` — static-grep `'use cache'` + two-tier cacheTag (JOBBER-02) — created in Plan 01 Task 1
- [ ] `tests/api/webhooks/jobber/route.test.js` — HMAC verify / silent-ignore / event routing (JOBBER-03) — created in Plan 03 Task 1
- [ ] `tests/components/BusinessIntegrationsClient.test.jsx` — banner `meta.name` + Preferred badge render condition — created in Plan 04 Task 1
- [ ] `tests/app/dashboard/integrations-page.test.jsx` — server page passes initialStatus.jobber — created in Plan 04 Task 1
- [ ] `tests/api/integrations/disconnect-jobber.test.js` — Jobber branch row delete + revalidateTag — created in Plan 04 Task 1
- [ ] `tests/api/setup-checklist-jobber.test.js` — connect_jobber appended + autoComplete — created in Plan 04 Task 1
- [ ] `tests/notifications/jobber-refresh-email.test.js` — Resend send + subject (copy from UI-SPEC) — created in Plan 04 Task 1

### Python side (cross-repo livekit-agent)

- [ ] `tests/test_jobber_integration.py` — fetch_jobber_customer_by_phone + refresh rotation + write-back — created in Plan 05 Task 1
- [ ] `tests/test_customer_context_merge.py` — merge_customer_context all 4 provider-present combinations — created in Plan 06 Task 1
- [ ] `tests/test_agent_jobber_timeout.py` — 800ms race + Sentry capture — created in Plan 06 Task 1
- [ ] `tests/test_check_customer_account.py` — extend existing; merged dict serialization (STATE+DIRECTIVE) — created in Plan 06 Task 1

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live Jobber OAuth end-to-end — Connect button → Jobber consent screen → callback → card flips to Connected | JOBBER-01 | Requires live Jobber sandbox account + browser redirect; cannot mock consent flow | 1. Register Jobber dev app at developer.getjobber.com, set redirect `http://localhost:3000/api/integrations/jobber/callback`, configure scopes in Developer Center UI. 2. Set `JOBBER_CLIENT_ID`/`JOBBER_CLIENT_SECRET` in `.env.local`. 3. Visit `/dashboard/more/integrations` → click "Connect Jobber" → complete Jobber consent. 4. Expect redirect back → card shows "Connected. Sharing customer and job history..." (emerald). 5. Verify `accounting_credentials` row with provider='jobber', non-null access_token/refresh_token, non-null external_account_id. |
| Visual parity — Jobber card matches Xero card in all 4 states (UI-SPEC §Interaction States) | JOBBER-01 | Visual fidelity requires human eyes; screenshot-diff tooling not set up | Screenshot each of 4 states: Disconnected, Connected (invoicing off), Connected (invoicing on) + Preferred badge, Reconnect-needed. Compare side-by-side with Xero card. Confirm: emerald success text, amber banner, full-width buttons, Preferred badge in header row right-aligned via ml-auto. |
| Live Jobber webhook delivery — client update in Jobber → cache invalidates within ~5s | JOBBER-03 | Requires live Jobber sandbox + real webhook traffic to Vercel/ngrok endpoint | 1. Use ngrok to expose `/api/webhooks/jobber` publicly during sandbox test. 2. Register webhook in Jobber Developer Center → paste ngrok URL. 3. In Jobber sandbox, update a client's phone number. 4. Expect POST to `/api/webhooks/jobber` with `X-Jobber-Hmac-SHA256` header, 200 response. 5. Subsequent `fetchJobberCustomerByPhone` for that tenant returns fresh data. |
| <500ms p95 latency (JOBBER-02 non-functional target) | JOBBER-02 | Cache-warm perf measurement best done against live Jobber sandbox under realistic load | After implementing Plan 01 + 02, run `k6 run` or `autocannon` against a test Next.js endpoint that calls `fetchJobberCustomerByPhone(tenantId, phoneE164)` 100× for a warm tenant+phone. Assert p95 < 500ms. If cold-cache first call exceeds, that's acceptable — JOBBER-02 p95 target is cache-warm behavior. |
| LiveKit agent end-to-end call — Gemini speaks Jobber-informed context only when asked | JOBBER-04, JOBBER-05 | Requires live Twilio SIP + LiveKit + Gemini + real caller + connected Jobber | In livekit-agent repo after Plan 05/06 deployment: 1. Connect Jobber sandbox for test tenant. 2. Create a Jobber client with phone +15551234567, one recent job, one outstanding invoice. 3. Place a test call from +15551234567. 4. Gemini does NOT volunteer balance/job details. 5. Caller asks "do you have my info on file?" → Gemini acknowledges without specifics. 6. Caller asks "how much do I owe?" → Gemini reads the figure factually from STATE. No hallucinated invoice numbers. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (11 Next.js test files + 4 Python test files)
- [x] No watch-mode flags (all commands are one-shot)
- [x] Feedback latency < 30s per task, < 60s phase gate
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** draft — sign off at `/gsd-verify-work` time
