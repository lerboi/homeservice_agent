---
phase: 55-xero-read-side-integration-caller-context
plan: 01
subsystem: database
tags: [supabase, migration, xero, accounting_credentials]

requires:
  - phase: 54-integrations-scaffolding
    provides: accounting_credentials table with scopes + last_context_fetch_at
provides:
  - error_state TEXT NULL column on accounting_credentials
  - Partial index idx_accounting_credentials_error_state for degraded-row lookups
  - XERO_WEBHOOK_KEY documented in .env.example
affects: [55-03, 55-04, 55-05]

tech-stack:
  added: []
  patterns:
    - "Degraded-state persistence via nullable enum-string column"

key-files:
  created:
    - supabase/migrations/053_xero_error_state.sql
  modified:
    - .env.example

key-decisions:
  - "Dedicated TEXT NULL column (not JSONB flag) per CONTEXT D-14 Open Question 3"
  - "Partial index filtered WHERE error_state IS NOT NULL to keep healthy-row table cheap"
  - "IF NOT EXISTS guards for replay idempotency"

patterns-established:
  - "Phase 55 error-state surfacing: background refresh writes error_state → UI reads it → callback/refresh clears it"

requirements-completed: [XERO-01]

completed: 2026-04-18
---

# Plan 55-01: Error-state migration + webhook key docs

**Schema substrate for the Xero Reconnect banner — `accounting_credentials.error_state` column + partial index, pushed live to Supabase.**

## Accomplishments

- Added `error_state TEXT NULL` to `accounting_credentials` with replay-safe `ADD COLUMN IF NOT EXISTS`.
- Created partial index `idx_accounting_credentials_error_state` on `(tenant_id, provider) WHERE error_state IS NOT NULL` so only degraded rows are scanned.
- Documented `XERO_WEBHOOK_KEY` placeholder in `.env.example` with pointer to Xero Developer Portal webhook signing key.
- Migration pushed to live Supabase schema by user (SQL editor paste).

## Files

**Created:**
- `supabase/migrations/053_xero_error_state.sql`

**Modified:**
- `.env.example` (added `XERO_WEBHOOK_KEY=` placeholder block)

## Verification

- Migration file contains required DDL and partial index.
- `.env.example` contains `XERO_WEBHOOK_KEY=` with explanatory comment.
- Live Supabase schema confirmed by user (`pushed` resume-signal received).

## Downstream Enablement

- Plan 55-03 disconnect path can clear/delete error_state on row removal.
- Plan 55-05 Business Integrations card reads `error_state` to render Reconnect banner.
- Plan 55-05 token-refresh failure writer (`src/lib/integrations/xero.js`) writes `'token_refresh_failed'` on refresh failures.
