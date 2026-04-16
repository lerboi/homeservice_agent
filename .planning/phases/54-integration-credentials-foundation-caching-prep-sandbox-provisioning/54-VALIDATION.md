---
phase: 54
slug: integration-credentials-foundation-caching-prep-sandbox-provisioning
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-17
---

# Phase 54 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `54-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7.0 (`jest-cli` per `package.json` line 59-60) |
| **Config file** | No explicit `jest.config.*` — Jest uses package.json defaults; repo scripts use `--experimental-vm-modules` for ESM |
| **Quick run command** | `npm test -- --testPathPatterns=integrations` |
| **Full suite command** | `npm run test:all` |
| **Integration subset** | `npm run test:integration` |
| **Estimated runtime** | ~5-15 seconds for the integrations subset; ~90-180 seconds for full suite |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPatterns=integrations` (scoped to new tests only; seconds)
- **After every plan wave:** Run `npm run test:all` (full suite green)
- **Before `/gsd-verify-work`:** Full suite green + manual Supabase migration verification + `npm run build` clean
- **Max feedback latency:** ~15 seconds for scoped runs; ~180 seconds for full suite

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 54-01-01 | 01 | 1 | INTFOUND-02 | T-54-01 / T-54-02 | CHECK swap atomic; QB/FB rows purged before CHECK tightening | smoke (grep) | `grep -c "CHECK (provider IN ('xero', 'jobber'))" supabase/migrations/051_integrations_schema.sql` must return 1 | ✅ | ⬜ pending |
| 54-01-02 | 01 | 1 | INTFOUND-02 | — | Migration applied to live DB; insert of 'quickbooks' rejected | manual (DB) | MISSING — manual Supabase Studio verification; three SQL queries (see Plan 01 Task 2 how-to-verify) | — | ⬜ pending |
| 54-02-01 | 02 | 1 | INTFOUND-01 | T-54-06 | Adapter factory returns Xero; Jobber stub throws NotImplementedError | unit (TDD) | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/unit/integrations/adapter.test.js tests/unit/integrations/jobber.test.js tests/unit/integrations/status.test.js --passWithNoTests` | ❌ W0 (test files created in Plan 02 Task 1 TDD RED step) | ⬜ pending |
| 54-02-02 | 02 | 2 | INTFOUND-01 | T-54-07 / T-54-08 | XERO_SCOPES bundle includes write scopes for invoicing continuity; Jobber revoke throws; service-role status read excludes tokens | smoke (grep) | `grep -c "accounting.contacts" src/lib/integrations/xero.js && grep -c "'use cache'" src/lib/integrations/status.js && grep -c "cacheTag" src/lib/integrations/status.js` | ✅ after Task 1 | ⬜ pending |
| 54-03-01 | 03 | 3 | INTFOUND-01 | T-54-12 / T-54-13 | PROVIDERS allowlist guards path param; HMAC state verify; revalidateTag fires on callback | smoke (grep) | `grep -c "PROVIDERS.includes(provider)" src/app/api/integrations/[provider]/auth/route.js && grep -cF "revalidateTag(\`integration-status-" src/app/api/integrations/[provider]/callback/route.js` | ✅ after Task 1 | ⬜ pending |
| 54-03-02 | 03 | 3 | INTFOUND-01 | T-54-14 / T-54-16 | Status route excludes tokens; disconnect revokes upstream best-effort before DB delete | smoke (grep) | `! grep -q "access_token" src/app/api/integrations/status/route.js && grep -c "adapter.revoke" src/app/api/integrations/disconnect/route.js` | ✅ after Task 2 | ⬜ pending |
| 54-03-03 | 03 | 3 | INTFOUND-01 | — | Legacy /api/accounting/** directory removed; no stale imports | smoke (fs + grep) | `test ! -d src/app/api/accounting && npm run build 2>&1 \| grep -cE "Filling a cache during prerender timed out\|next-request-in-use-cache"` | ✅ after Plan 02 | ⬜ pending |
| 54-03-04 | 03 | 3 | INTFOUND-01 | — | Xero + Jobber dev-console redirect URIs match new `/api/integrations/<p>/callback` path | manual | MISSING — dev-console UI task; optional curl smoke `curl -i http://localhost:3000/api/integrations/xero/auth` | — | ⬜ pending |
| 54-04-01 | 04 | 4 | INTFOUND-03 | — | cacheComponents: true at top-level of nextConfig; no superseded flags coexist | smoke (grep) | `grep -c "cacheComponents: true" next.config.js && ! grep -q "experimental.*cacheComponents" next.config.js` | ✅ after Task 1 | ⬜ pending |
| 54-04-02 | 04 | 4 | INTFOUND-03 | T-54-20 / T-54-21 | Production build clean under cacheComponents: true; no "Filling a cache during prerender timed out" errors | smoke (build) | `npm run build 2>&1 \| grep -cE "Filling a cache during prerender timed out\|next-request-in-use-cache"` must be 0 | ✅ after Task 1 | ⬜ pending |
| 54-04-03 | 04 | 4 | INTFOUND-03 | T-54-23 | `'use cache'` + revalidateTag loop visible in dev logs | manual (e2e) | MISSING — `NEXT_PRIVATE_DEBUG_CACHE=1 npm run dev`; human observes cache miss/hit + revalidate after disconnect | — | ⬜ pending |
| 54-05-01 | 05 | 5 | INTFOUND-01 | T-54-24 / T-54-25 | BusinessIntegrationsClient uses verbatim UI-SPEC strings; no QB/FB residue; `/api/integrations/*` only | smoke (grep) | `grep -c "Connect Xero to share customer history" src/components/dashboard/BusinessIntegrationsClient.jsx && ! grep -q "QuickBooks\|FreshBooks\|/api/accounting/" src/components/dashboard/BusinessIntegrationsClient.jsx` | ✅ after Task 1 | ⬜ pending |
| 54-05-02 | 05 | 5 | INTFOUND-01 | — | Page is Server Component; calls getIntegrationStatus directly (Pattern A per RESOLVED Q1) | smoke (grep) | `! grep -q "^'use client'" src/app/dashboard/more/integrations/page.js && grep -c "await getIntegrationStatus" src/app/dashboard/more/integrations/page.js` | ✅ after Task 2 | ⬜ pending |
| 54-05-03 | 05 | 5 | INTFOUND-01 | — | Skills synced (dashboard-crm-system + auth-database-multitenancy) | smoke (grep) | `grep -c "Business Integrations" .claude/skills/dashboard-crm-system/SKILL.md && grep -c "051_integrations_schema" .claude/skills/auth-database-multitenancy/SKILL.md` | ✅ after Task 3 | ⬜ pending |
| 54-05-04 | 05 | 5 | INTFOUND-01/02/03 | — | End-to-end UI + cache loop on live dev server | manual (human-verify) | MISSING — `npm run build && npm run start`; walk 8-step checklist in Plan 05 Task 4 how-to-verify | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/integrations/adapter.test.js` — covers INTFOUND-01 adapter factory (TDD RED step in Plan 02 Task 1)
- [ ] `tests/unit/integrations/jobber.test.js` — covers INTFOUND-01 Jobber stub throws NotImplementedError (TDD RED step in Plan 02 Task 1)
- [ ] `tests/unit/integrations/status.test.js` — covers INTFOUND-03 `getIntegrationStatus` return shape (cache behavior integration-tested; unit test stubs Supabase) (TDD RED step in Plan 02 Task 1)
- Shell: no framework install needed — Jest 29.7.0 already configured in `package.json`.

*Wave 0 is satisfied by Plan 02 Task 1's TDD RED step creating the three stub test files before the implementation tasks (Plan 02 Task 2) turn them GREEN.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration 051 applied to live Supabase project | INTFOUND-02 | Migration application always manual in this repo (Phase 53 precedent); `supabase db push` requires an access token and a live project | Plan 01 Task 2 how-to-verify — run `SUPABASE_ACCESS_TOKEN=<token> supabase db push` or paste SQL into Studio; verify via `information_schema.columns`, `pg_get_constraintdef`, and a rejected QB insert |
| Xero + Jobber dev-console redirect URIs match `/api/integrations/<provider>/callback` | INTFOUND-01 | External dev-console UI (developer.xero.com, developer.getjobber.com); no CLI exists | Plan 03 Task 4 how-to-verify — owner logs in and confirms redirect URI entries; optional curl smoke against `/api/integrations/xero/auth` |
| `'use cache'` + revalidateTag full loop visible in dev logs | INTFOUND-03 | Requires interactive dev server with authenticated session and `NEXT_PRIVATE_DEBUG_CACHE=1` | Plan 04 Task 3 how-to-verify — run `NEXT_PRIVATE_DEBUG_CACHE=1 npm run dev`, hit `/api/integrations/status` twice (miss → hit), then disconnect + hit again (miss again) |
| End-to-end Business Integrations page render + 8-step UI-SPEC compliance | INTFOUND-01 | UI visual audit; OAuth round-trip; dark mode; accessibility; keyboard/focus order | Plan 05 Task 4 how-to-verify — `npm run build && npm run start`, walk 8-step checklist |

*Manual items follow Phase 53 VALIDATION.md precedent (see `.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-VALIDATION.md`). Every manual item is paired with an automated grep/fs-assertion to catch gross regressions.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (15 task rows above; 11 automated, 4 manual-only with MISSING markers)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (manual tasks are dispersed across plans 01, 03, 04, 05)
- [x] Wave 0 covers all MISSING references (3 test files created in Plan 02 Task 1 TDD RED step)
- [x] No watch-mode flags (all commands use `--passWithNoTests`, not `--watch`)
- [x] Feedback latency < 180s (full suite worst case)
- [x] `nyquist_compliant: true` set in frontmatter
- [x] `wave_0_complete: true` set in frontmatter (Plan 02 Task 1 creates the three stub test files)

**Approval:** approved (transcribed from 54-RESEARCH.md §Validation Architecture on 2026-04-17)
