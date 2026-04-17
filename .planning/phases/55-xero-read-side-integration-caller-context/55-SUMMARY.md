---
phase: 55-xero-read-side-integration-caller-context
subsystem: multi
plans_count: 8
duration: 1 session (same-day plan + execute + UAT + close)

provides:
  - Xero OAuth end-to-end (connect, refresh, disconnect)
  - Next.js XeroAdapter.fetchCustomerByPhone with two-tier cacheTag
  - /api/webhooks/xero HMAC endpoint with per-phone invalidation
  - BusinessIntegrationsClient 4-state UX (Disconnected / Connected / Reconnect / Loading)
  - connect_xero setup checklist item
  - XeroReconnectEmail + notifyXeroRefreshFailure
  - livekit-agent integrations/xero.py (refresh-aware fetch)
  - check_customer_account tool + customer_context prompt block
  - Migration 053 error_state column

requirements-completed: [XERO-01, XERO-02, XERO-03, XERO-04]
completed: 2026-04-18
---

# Phase 55: Xero Read-Side Integration (Caller Context) — Summary

**The AI receptionist now sees Xero customer context during inbound calls — outstanding balance, recent invoices, last payment — with silent-awareness privacy rules preventing unprompted disclosure. Token lifecycle, owner-facing UX, and cross-repo Python agent all wired end-to-end.**

## 8 Plans Shipped

| Plan | Outcome | Tests |
|------|---------|-------|
| 55-01 | Migration 053 (`error_state` column) + `XERO_WEBHOOK_KEY` docs + live schema push | — |
| 55-02 | `XeroAdapter.fetchCustomerByPhone` (module-level cached fn with `'use cache'` + two-tier cacheTag) | 8/8 |
| 55-03 | OAuth callback heals `error_state`; disconnect revokes + invalidates `${provider}-context-${tenantId}` tag | 9/9 |
| 55-04 | `/api/webhooks/xero` with HMAC-SHA256 + intent-verify + invoice→phone resolution + per-phone invalidation | 7/7 |
| 55-05 | BusinessIntegrationsClient Reconnect banner + Last-synced timestamp + `connect_xero` checklist + `XeroReconnectEmail` + `notifyXeroRefreshFailure` | 17/17 |
| 55-06 | [CROSS-REPO] livekit-agent `integrations/xero.py` refresh-aware fetch + `fetch_xero_context_bounded` wrapper | 9/9 |
| 55-07 | [CROSS-REPO] livekit-agent `check_customer_account` tool + `customer_context` prompt block (CRITICAL RULE) + agent pre-session wiring | 8/8 |
| 55-08 | 3 skill syncs (voice-call-architecture, auth-database-multitenancy, dashboard-crm-system) + ROADMAP/STATE/REQUIREMENTS close | — |

**Total: 58 tests across both repos, all passing.**

## Post-UAT Fixes Applied

Five issues surfaced during live-call UAT; each fixed and folded in:

1. **Next.js 16 `'use cache'` on class methods** — extracted `fetchCustomerByPhone` to module-level `fetchXeroCustomerByPhone` function (class method delegates).
2. **`expiry_date` BIGINT vs ISO parse** — Python parser now handles both (was always parsing as 0 → every-call refresh → race → token burned).
3. **Token lifecycle race** — after #2 fixed, refreshes only fire when needed (not every call).
4. **800ms timeout too tight** — bumped to 2.5s + httpx per-request 1.5s + parallelized the two `getInvoices` calls.
5. **OData phone match too strict** — dropped the `Contains` filter, fetch default page + digits-match (last-10 OR last-7) handles every Xero storage shape and country format.

## Key Design Decisions

- **Module-level cached function** (not class method) for Next.js `'use cache'` compliance
- **Pre-session Xero fetch** (awaited before `build_system_prompt`) for D-08 prompt-block injection
- **Silent-aware prompt** — STATE+DIRECTIVE format with CRITICAL RULE framing prevents LLM from volunteering data
- **Cross-runtime casing divergence is INTENTIONAL** — Next.js camelCase, Python snake_case; never cross runtime boundaries
- **Python error_state write, Next.js dashboard surfaces** — separation of concerns prevents per-call email spam
- **Digits-match (last 10 or last 7)** — handles US 10-digit local, SG 8-digit local, compound Xero fields, formatted strings
- **No OData narrowing** — fetches Xero contacts default page (100); pagination deferred to P58 if hit

## Backlog Opened from UAT

- `999.1` booking urgency constraint mismatch (pre-existing bug — `book_appointment` passes `'high'`, DB accepts only emergency/urgent/routine)
- `999.2` LiveKit voice cutoff on tool calls (pre-existing SDK behavior when caller talks over AI)

Both captured via `/gsd-add-backlog`. Promote via `/gsd-review-backlog` when ready.

## Cross-Repo Commits

**Voco (homeservice_agent) main branch:**
- 06bd555 feat(55-01): migration + env docs
- adca9da feat(55-02): fetchCustomerByPhone
- 474fc42 docs(55-02): summary
- eca869e feat(55-03): OAuth scaffold finalization
- 88b5c96 docs(55-03): summary
- 9e59a95 feat(55-04): Xero webhook
- da9f5a4 docs(55-04): summary
- a631fa8 feat(55-05): Business Integrations UI + email
- 32b0271 docs(55-05): summary
- 5761285 docs(55-06): summary
- 89283e5 docs(55-07): summary
- 3b2c14f fix(55-02): Next.js 16 use cache on class method
- 6490964 fix(55): compound phone fields + formatted strings
- cd2c3b4 docs: backlog 999.1 + 999.2
- 7e99dec feat(55-08): skills + ROADMAP/STATE/REQUIREMENTS close

**livekit-agent main branch:**
- 448aa89 feat(p55): xero fetcher + bounded parallel task
- d1d30e1 feat(p55): prompt block + tool
- 6b3105f fix(p55): compound phone fields
- (user-pushed locally) fix(p55): bigint expiry + timeout bump + last-7 match + parallel invoices + diagnostic logs

## Verification Status

- Automated: 58/58 tests across both repos
- Live UAT: D-10 silent awareness confirmed (AI does not volunteer data); tool fires on explicit ask; no-match path returns cold-call behavior; connected path shows Last-synced timestamp
- Schema push: verified live Supabase has `error_state` column
- OAuth: confirmed end-to-end round-trip with Xero Demo Company

## Status

**COMPLETE.** Phase 56 (Jobber read-side) is the next target — will reuse the same integration architecture with Jobber GraphQL in place of Xero REST.
