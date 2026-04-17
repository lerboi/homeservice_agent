---
phase: 55-xero-read-side-integration-caller-context
plan: 02
subsystem: api
tags: [xero, caller-context, next-cache, integration]

requires:
  - phase: 54-integrations-scaffolding
    provides: XeroAdapter skeleton + refreshTokenIfNeeded
provides:
  - XeroAdapter.fetchCustomerByPhone(tenantId, phoneE164) real impl
  - Two-tier cacheTag scheme (broad + per-phone) for Plan 04 webhook invalidation
  - Per-fetch last_context_fetch_at touch for P58 telemetry seed
affects: [55-04, 55-05, 55-06, 55-07]

tech-stack:
  added: []
  patterns:
    - "'use cache' as first statement + cacheTag two-tier invalidation"
    - "OData Contains() candidate narrowing + JS post-filter for E.164 exact match"

key-files:
  created:
    - tests/integrations/xero.fetch.test.js
    - tests/integrations/xero.cache.test.js
  modified:
    - src/lib/integrations/xero.js

key-decisions:
  - "Post-filter in JS for E.164 exact match (no phone normalization — D-01)"
  - "Silent degradation: all failure paths return { contact: null }; never throw out of cached fn"
  - "Per-fetch last_context_fetch_at touch (Claude's discretion — cheap write)"
  - "E.164 regex validation BEFORE interpolation guards cacheTag + OData injection"

patterns-established:
  - "Read primitives return uniform empty shape on any failure — cache absorbs errors with 5-min TTL self-heal"

requirements-completed: [XERO-02]

completed: 2026-04-18
---

# Plan 55-02: XeroAdapter.fetchCustomerByPhone implementation

**Real Xero caller-context fetcher — E.164 contact match, outstanding + last 3 invoices + last payment date, cached behind two-tier cacheTag for webhook invalidation.**

## Accomplishments

- Replaced P54 NotImplementedError stub in `src/lib/integrations/xero.js` with full implementation per D-01..D-05.
- `'use cache'` verified as literal first statement inside the function (static test).
- Two-tier cacheTag (`xero-context-${tenantId}` broad + `xero-context-${tenantId}-${phoneE164}` specific).
- OData `Phones[0].PhoneNumber.Contains("<last10>")` candidate narrowing, then JS-side E.164 exact match across all phone slots.
- Outstanding: sum `AmountDue` across `Status=="AUTHORISED" AND AmountDue>0`.
- Recent: top 3 `(AUTHORISED OR PAID) ORDER BY Date DESC`.
- Last payment: `MAX(fullyPaidOnDate)` across PAID, or null.
- Per-fetch `last_context_fetch_at` touch on `accounting_credentials`.
- All error paths return `{ contact: null }` (never throw — prevents poisoning the cache with an error entry).
- E.164 regex `^\+[1-9]\d{6,14}$` validation guards cacheTag + OData injection.

## Files

**Modified:** `src/lib/integrations/xero.js` (+new imports, +full method body; stub removed)

**Created:**
- `tests/integrations/xero.fetch.test.js` — 6 tests: disconnected, no-match, full-shape, no-PAID, touch-timestamp, malformed phone
- `tests/integrations/xero.cache.test.js` — 2 static-grep tests: directive placement + both tag strings

## Verification

- `npm test -- tests/integrations/xero.fetch.test.js tests/integrations/xero.cache.test.js` → 8/8 pass
- No ESLint regressions introduced (imports follow existing file conventions)

## Downstream Enablement

- Plan 55-04 webhook invalidates `xero-context-${tenantId}-${phoneE164}` tag after contact→phone resolution.
- Plan 55-05 UI reads `last_context_fetch_at` for the subtle "Last synced" timestamp.
- Plan 55-06 LiveKit Python fetcher mirrors this shape (independent implementation, shared contract).
