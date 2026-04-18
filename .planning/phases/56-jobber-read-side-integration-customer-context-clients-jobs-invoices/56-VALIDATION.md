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

> Numbering convention: `56-{plan}-{task}` where `{task}` is the 1-indexed ordinal position of the `<task>` element inside the plan's `<tasks>` block. Each plan-task has exactly one row.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 56-01-01 | 01 | 1 | JOBBER-01, JOBBER-02 | T-56-01-03, T-56-01-04, T-56-01-07 | Wave 0 — install graphql-request + libphonenumber-js; write 5 failing test files (adapter, refresh, fetch, phone-match, cache) | unit | `npm test -- tests/integrations/jobber 2>&1 \| tail -50` | ❌ created by this task | ⬜ pending |
| 56-01-02 | 01 | 1 | JOBBER-01, JOBBER-02 | T-56-01-01, T-56-01-02, T-56-01-05, T-56-01-06, T-56-01-08 | Replace JobberAdapter stubs — OAuth exchangeCode + JWT expiry; refreshToken with mandatory rotation write-back; revoke no-op; module-level fetchJobberCustomerByPhone with 'use cache' + two-tier cacheTag + E.164 regex guard + libphonenumber-js match + X-JOBBER-GRAPHQL-VERSION | unit | `npm test -- tests/integrations/jobber 2>&1 \| tail -60` | ✅ W0 | ⬜ pending |
| 56-02-01 | 02 | 1 | JOBBER-01, JOBBER-03 | T-56-02-01 | Migration 054 adds `external_account_id TEXT` column; backfills Xero rows from `xero_tenant_id`; partial unique index; additive only (no RLS regression, no DROP) | migration | `grep -n "external_account_id" supabase/migrations/054_external_account_id.sql && grep -c "ADD COLUMN IF NOT EXISTS\|CREATE UNIQUE INDEX IF NOT EXISTS\|UPDATE accounting_credentials\|COMMENT ON COLUMN" supabase/migrations/054_external_account_id.sql` | ❌ created by this task | ⬜ pending |
| 56-02-02 | 02 | 1 | JOBBER-01, JOBBER-03 | T-56-02-02 | `.env.example` documents JOBBER_WEBHOOK_SECRET overload — handler reads `JOBBER_CLIENT_SECRET` directly; only Jobber-block comments added | static | `grep -c "JOBBER_CLIENT_SECRET" .env.example && grep -n "webhook HMAC\|Hmac-SHA256" .env.example` | ❌ edited by this task | ⬜ pending |
| 56-02-03 | 02 | 1 | JOBBER-01, JOBBER-03 | T-56-02-03 | [BLOCKING checkpoint:human-action] `supabase db push` applies migration 054 to the Supabase project; 4 post-push SQL checks (column exists, backfill count matches, index exists, no errors) | migration (live) | `supabase db push 2>&1 \| tail -20` | N/A (runtime apply) | ⬜ pending checkpoint |
| 56-03-01 | 03 | 2 | JOBBER-03 | T-56-03-01, T-56-03-02, T-56-03-03, T-56-03-08 | Wave 0 — webhook route test scaffold (11 cases W1-W11: missing/wrong HMAC → 401; unknown acct → 200; 5 topics → per-phone revalidateTag; resolve failure → broad fallback; malformed JSON → 200; handler never throws) | integration | `npm test -- tests/api/webhooks/jobber 2>&1 \| tail -50` | ❌ created by this task | ⬜ pending |
| 56-03-02 | 03 | 2 | JOBBER-03 | T-56-03-01, T-56-03-02, T-56-03-04, T-56-03-05, T-56-03-06, T-56-03-07 | Implement `src/app/api/webhooks/jobber/route.js` — HMAC-SHA256 verify with JOBBER_CLIENT_SECRET on raw body via timingSafeEqual; tenant resolve via `external_account_id`; 5-topic routing → GraphQL phone resolve → per-phone revalidateTag; broad fallback; silent-200 on unknown acct | integration | `npm test -- tests/api/webhooks/jobber 2>&1 \| tail -50` | ✅ W0 | ⬜ pending |
| 56-03-03 | 03 | 2 | JOBBER-03 | T-56-03-09, T-56-03-10, T-56-03-11 | [BLOCKER FIX] OAuth callback extended — Jobber-only post-token GraphQL probe `query { account { id } }` with X-JOBBER-GRAPHQL-VERSION; UPDATE `external_account_id`; probe failure does NOT orphan tokens (redirect `error=account_probe_failed`); Xero path unchanged | integration | `npm test -- tests/api/integrations/jobber-callback 2>&1 \| tail -50` | ❌ created by this task | ⬜ pending |
| 56-04-01 | 04 | 2 | JOBBER-01 | — | Wave 0 — 5 test files (component UI, integrations page, disconnect, setup-checklist, refresh-failure email); includes banner bug fix assertions (U1/U2), Preferred badge render conditions (U3/U4/U5), setup-checklist item presence (SC1-SC4), and email no-token-echo (EM4) | unit (RTL) + integration | `npm test -- tests/components/BusinessIntegrationsClient tests/app/dashboard/integrations-page tests/api/integrations/disconnect-jobber tests/api/setup-checklist-jobber tests/notifications/jobber-refresh-email 2>&1 \| tail -60` | ❌ created by this task | ⬜ pending |
| 56-04-02 | 04 | 2 | JOBBER-01 | — | BusinessIntegrationsClient.jsx — banner bug fix (`{meta.name}` not hardcoded `Xero`); Preferred badge markup + render condition (`connected && status.xero !== null && !hasError`); integrations/page.js Promise.all Jobber row fetch + initialStatus; disconnect route provider-agnostic Jobber branch | unit (RTL) + integration | `npm test -- tests/components/BusinessIntegrationsClient tests/app/dashboard/integrations-page tests/api/integrations/disconnect-jobber 2>&1 \| tail -50` | ✅ W0 | ⬜ pending |
| 56-04-03 | 04 | 2 | JOBBER-01 | T-56-04-01, T-56-04-03 | connect_jobber setup-checklist (6-point extension: VALID_ITEM_IDS + THEME_GROUPS + ITEM_META + fetch + autoComplete + state surface); notifyJobberRefreshFailure helper + JobberReconnectEmail template; email CTA exact UI-SPEC copy; email body NEVER echoes access_token/refresh_token | integration | `npm test -- tests/api/setup-checklist-jobber tests/notifications/jobber-refresh-email 2>&1 \| tail -40` | ✅ W0 | ⬜ pending |
| 56-05-01 | 05 | 3 | JOBBER-02, JOBBER-04 | — | [CROSS-REPO checkpoint:human-action] Verify livekit-agent repo baseline — httpx ≥ 0.27, phone-normalization strategy (reuse _normalize_phone vs add phonenumbers), xero.py + test template exist, sentry_sdk available | verification (Python) | `cd C:/Users/leheh/.Projects/livekit-agent && pytest tests/test_xero_integration.py -x 2>&1 \| tail -10` | N/A (env check) | ⬜ pending checkpoint |
| 56-05-02 | 05 | 3 | JOBBER-02, JOBBER-04 | T-56-05-01 through T-56-05-06 | [CROSS-REPO] Author `livekit-agent/src/integrations/jobber.py` + `tests/test_jobber_integration.py` — service-role Supabase read; httpx GraphQL with X-JOBBER-GRAPHQL-VERSION + socket timeout; refresh rotation write-back of NEW refresh_token; never raises; field-parity return shape | unit (Python) | `cd C:/Users/leheh/.Projects/livekit-agent && pytest tests/test_jobber_integration.py -x 2>&1 \| tail -30` | ❌ created by this task (cross-repo) | ⬜ pending checkpoint |
| 56-06-01 | 06 | 4 | JOBBER-04, JOBBER-05 | — | [CROSS-REPO checkpoint:human-action] Confirm Plan 05 files present in livekit-agent + baseline pytest green + src/lib/ dir + P55 xero_context_task still in src/agent.py | verification (Python) | `cd C:/Users/leheh/.Projects/livekit-agent && pytest tests/test_jobber_integration.py tests/test_xero_integration.py -x 2>&1 \| tail -15` | N/A (env check) | ⬜ pending checkpoint |
| 56-06-02 | 06 | 4 | JOBBER-04 | — | [CROSS-REPO] Wave 0 — 3 pytest files (merge logic M1-M5, timeout race T1-T4, tool serialization AC1/AC2/AC3/AC5); T4 asserts concurrent execution ≤1.0s; AC5 asserts no fetch calls from tool | unit (Python) | `cd C:/Users/leheh/.Projects/livekit-agent && pytest tests/test_customer_context_merge.py tests/test_agent_jobber_timeout.py tests/test_check_customer_account.py -x 2>&1 \| tail -30` | ❌ created by this task (cross-repo) | ⬜ pending checkpoint |
| 56-06-03 | 06 | 4 | JOBBER-04 | T-56-06-01, T-56-06-02, T-56-06-04 | [CROSS-REPO] `src/lib/customer_context.py::merge_customer_context` (Jobber wins client/recentJobs/lastVisitDate; Xero wins outstandingBalance/lastPaymentDate/lastInvoices; _sources provenance); wire `jobber_context_task` as 5th concurrent task in `_run_db_queries` with `asyncio.wait_for(timeout=0.8)`; Sentry capture with hashed-phone tag (never raw from_number) | unit (Python) | `cd C:/Users/leheh/.Projects/livekit-agent && pytest tests/test_customer_context_merge.py tests/test_agent_jobber_timeout.py -x 2>&1 \| tail -30` | ✅ W0 | ⬜ pending checkpoint |
| 56-06-04 | 06 | 4 | JOBBER-04, JOBBER-05 | T-56-06-03, T-56-06-05 | [CROSS-REPO] `src/prompt.py::build_system_prompt` emits `(source)` per field via _sources lookup (D-08); field omission when data absent (D-11); `src/tools/check_customer_account.py` re-serves merged dict as STATE+DIRECTIVE verbatim (D-10) with NO re-fetch; no-match locked string (D-11 tool-side) | unit (Python) | `cd C:/Users/leheh/.Projects/livekit-agent && pytest tests/test_check_customer_account.py -x 2>&1 \| tail -30` | ✅ W0 | ⬜ pending checkpoint |
| 56-07-01 | 07 | 4 | all | T-56-07-01 | voice-call-architecture SKILL.md — Phase 56 section: 5-task _run_db_queries shape, `src/integrations/jobber.py` (cross-repo), merge helper, field-level merge table, check_customer_account extended source, 800ms + Sentry hashed-phone; preserves all P55 content | static | `grep -c "Phase 56" .claude/skills/voice-call-architecture/SKILL.md && grep -c "jobber_context_task\|merge_customer_context" .claude/skills/voice-call-architecture/SKILL.md` | N/A (doc update) | ⬜ pending |
| 56-07-02 | 07 | 4 | all | T-56-07-01 | auth-database-multitenancy SKILL.md — Migration 054 section: `external_account_id` column (TEXT NULL, backfill, partial unique index `idx_accounting_credentials_tenant_provider_external_unique`, `xero_tenant_id` deprecated-retained note) | static | `grep -c "Migration 054\|external_account_id" .claude/skills/auth-database-multitenancy/SKILL.md` | N/A (doc update) | ⬜ pending |
| 56-07-03 | 07 | 4 | all | T-56-07-01 | dashboard-crm-system SKILL.md — Phase 56 section: Jobber card states (4 mirrors of Xero), Preferred badge render condition + markup, Reconnect banner bug-fix (meta.name), connect_jobber checklist item (theme voice, required false, auto-complete), notifyJobberRefreshFailure + JobberReconnectEmail | static | `grep -c "## Phase 56\|Preferred badge\|connect_jobber\|JobberReconnectEmail" .claude/skills/dashboard-crm-system/SKILL.md` | N/A (doc update) | ⬜ pending |

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
- [ ] `tests/api/integrations/jobber-callback.test.js` — OAuth callback post-token GraphQL probe writes `external_account_id`; probe failure does NOT orphan tokens (JOBBER-01, JOBBER-03 enabler) — created in Plan 03 Task 3 (Blocker fix)
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
| Live Jobber webhook delivery — client update in Jobber → cache invalidates within ~5s | JOBBER-03 | Requires live Jobber sandbox + real webhook traffic to Vercel/ngrok endpoint | 1. Use ngrok to expose `/api/webhooks/jobber` publicly during sandbox test. 2. In Jobber Developer Center, register the app's webhook endpoint = ngrok URL AND subscribe to ALL FIVE topics required by CONTEXT D-12: (a) `CLIENT_UPDATE`, (b) `JOB_UPDATE`, (c) `INVOICE_UPDATE`, (d) `VISIT_COMPLETE`, (e) `VISIT_UPDATE`. Missing ANY of these five will cause the corresponding cache invalidation path to silently not fire. 3. For each of the five topics, trigger a corresponding event in the Jobber sandbox: (a) update a client's phone number → expect CLIENT_UPDATE POST; (b) edit a job's title or status → JOB_UPDATE; (c) edit an invoice → INVOICE_UPDATE; (d) mark a visit completed → VISIT_COMPLETE; (e) reschedule a visit → VISIT_UPDATE. 4. For each event, expect a POST to `/api/webhooks/jobber` with `X-Jobber-Hmac-SHA256` header and 200 response in Vercel/ngrok logs. 5. For CLIENT_UPDATE specifically, a subsequent `fetchJobberCustomerByPhone` for that tenant returns fresh data (per-phone cache invalidated). For non-CLIENT events, the broad fallback invalidates the tenant-wide tag. |
| <500ms p95 latency (JOBBER-02 non-functional target) | JOBBER-02 | Cache-warm perf measurement best done against live Jobber sandbox under realistic load | After implementing Plan 01 + 02, run `k6 run` or `autocannon` against a test Next.js endpoint that calls `fetchJobberCustomerByPhone(tenantId, phoneE164)` 100× for a warm tenant+phone. Assert p95 < 500ms. If cold-cache first call exceeds, that's acceptable — JOBBER-02 p95 target is cache-warm behavior. |
| LiveKit agent end-to-end call — Gemini speaks Jobber-informed context only when asked | JOBBER-04, JOBBER-05 | Requires live Twilio SIP + LiveKit + Gemini + real caller + connected Jobber | In livekit-agent repo after Plan 05/06 deployment: 1. Connect Jobber sandbox for test tenant. 2. Create a Jobber client with phone +15551234567, one recent job, one outstanding invoice. 3. Place a test call from +15551234567. 4. Gemini does NOT volunteer balance/job details. 5. Caller asks "do you have my info on file?" → Gemini acknowledges without specifics. 6. Caller asks "how much do I owe?" → Gemini reads the figure factually from STATE. No hallucinated invoice numbers. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (12 Next.js test files + 4 Python test files)
- [x] No watch-mode flags (all commands are one-shot)
- [x] Feedback latency < 30s per task, < 60s phase gate
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** draft — sign off at `/gsd-verify-work` time
