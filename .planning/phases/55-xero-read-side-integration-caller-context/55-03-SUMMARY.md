---
phase: 55-xero-read-side-integration-caller-context
plan: 03
subsystem: api
tags: [oauth, xero, next-cache, integration]

requires:
  - phase: 54-integrations-scaffolding
    provides: P54 OAuth scaffolds + XeroAdapter.revoke + PROVIDERS list
  - phase: 55-01
    provides: error_state column
provides:
  - Callback heals error_state on reauth + invalidates xero-context tag
  - Disconnect invalidates xero-context tag (revoke path was already P54)
affects: [55-05]

key-files:
  modified:
    - src/app/api/integrations/[provider]/callback/route.js
    - src/app/api/integrations/disconnect/route.js
  created:
    - tests/api/integrations/oauth.test.js
    - tests/api/integrations/disconnect.test.js

key-decisions:
  - "Generalized tag to ${provider}-context-${tenantId} so P56 Jobber inherits the pattern"
  - "Revoke path preserved as-is from P54 — already best-effort + tolerant of upstream errors"

patterns-established:
  - "OAuth callback always sets error_state:null — any reauth is a heal regardless of prior state"

requirements-completed: [XERO-01]

completed: 2026-04-18
---

# Plan 55-03: OAuth scaffolds finalization

**Callback and disconnect now invalidate the xero-context cache tag and heal error_state on reauth.**

## Accomplishments

- Callback route upsert now includes `error_state: null` — any successful reauth heals the row from D-14 token_refresh_failed state.
- Callback calls `revalidateTag(`${provider}-context-${tenantId}`)` in addition to the P54 integration-status tag, so stale cached caller-context is wiped when owner reconnects (including switching Xero orgs).
- Disconnect calls `revalidateTag(`${provider}-context-${tenantId}`)` after deleting the row, completing D-13 behavior.
- Revoke flow already in place from P54 (best-effort, tolerates upstream failure) — preserved verbatim.
- Auth route needed no change — signed state + JSON `{url}` response already working.

## Files

**Modified:**
- `src/app/api/integrations/[provider]/callback/route.js` — +`error_state: null`, +`revalidateTag(`${provider}-context-${tenantId}`)`
- `src/app/api/integrations/disconnect/route.js` — +`revalidateTag(`${provider}-context-${tenantId}`)`

**Created:**
- `tests/api/integrations/oauth.test.js` — 5 tests (auth redirect + upsert shape + dual revalidateTag + CSRF reject + unsupported provider)
- `tests/api/integrations/disconnect.test.js` — 4 tests (revoke called, row deleted, dual revalidateTag, tolerates revoke failure)

## Verification

- `npm test -- tests/api/integrations/oauth.test.js tests/api/integrations/disconnect.test.js` → 9/9 pass
