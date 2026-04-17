---
phase: 55-xero-read-side-integration-caller-context
plan: 04
subsystem: api
tags: [xero, webhook, hmac, next-cache]

requires:
  - phase: 55-01
    provides: XERO_WEBHOOK_KEY env var documented
  - phase: 55-02
    provides: two-tier cacheTag contract to invalidate against
provides:
  - /api/webhooks/xero POST handler with HMAC verify + per-phone invalidation
affects: [55-05]

key-files:
  created:
    - src/app/api/webhooks/xero/route.js
    - tests/api/webhooks/xero.test.js
    - tests/fixtures/xero-webhook-payloads/{intent-verify-good,intent-verify-bad,invoice-event}.json

key-decisions:
  - "nodejs runtime (not edge) — timingSafeEqual + Buffer require Node"
  - "Silent-200 on unknown Xero tenantId (D-07) to prevent retry storms"
  - "Broad-tag fallback when invoice→contact→phone resolution fails (Xero 5xx / rate limit)"
  - "No idempotency table in P55 — revalidateTag is idempotent; P58 adds telemetry if needed"

patterns-established:
  - "Always read raw body via request.text() BEFORE JSON parse when signature is required"

requirements-completed: [XERO-03]

completed: 2026-04-18
---

# Plan 55-04: Xero webhook endpoint

**Inbound webhook with HMAC-SHA256 verification and cacheTag invalidation driven by invoice→contact→phone resolution.**

## Accomplishments

- `POST /api/webhooks/xero` with `runtime = 'nodejs'` and `dynamic = 'force-dynamic'`.
- Reads raw body via `request.text()` before any JSON parse (HMAC must be computed over raw bytes).
- `crypto.createHmac('sha256', XERO_WEBHOOK_KEY)` + base64 digest, `crypto.timingSafeEqual` compare with length guard; bad sig → 401.
- Intent-verify handshake: 3 bad probes → 401, 1 good probe → 200 falls out for free.
- For each event in the payload:
  - Unknown Xero tenantId → silent `continue` (D-07 — no revalidateTag, overall 200 once all events processed).
  - INVOICE event with resolvable contact → per-phone `revalidateTag(`xero-context-${vocoTenantId}-${phoneE164}`)`.
  - Resolution failure (Xero 5xx / rate limit) → broad `revalidateTag(`xero-context-${vocoTenantId}`)`.
- Never throws out of the handler; every post-signature path returns 200.

## Tests (7/7 PASS)

- Signature missing → 401
- Bad signature → 401
- Good signature + empty events (intent-verify probe 4) → 200, no invalidation
- INVOICE event + resolvable contact → per-phone tag invalidated
- Multi-phone contact → each phone invalidated, empty strings skipped
- Contact resolution throws → broad-tag fallback
- Unknown Xero tenantId → 200 silent-ignore

## Files

**Created:**
- `src/app/api/webhooks/xero/route.js`
- `tests/api/webhooks/xero.test.js`
- `tests/fixtures/xero-webhook-payloads/intent-verify-good.json`
- `tests/fixtures/xero-webhook-payloads/intent-verify-bad.json`
- `tests/fixtures/xero-webhook-payloads/invoice-event.json`

## Deploy Action Needed

Subscribe webhook URL `https://{app-domain}/api/webhooks/xero` in Xero Developer Portal → INVOICE events → complete the intent-verify handshake with the `XERO_WEBHOOK_KEY` provisioned in Plan 55-01.
