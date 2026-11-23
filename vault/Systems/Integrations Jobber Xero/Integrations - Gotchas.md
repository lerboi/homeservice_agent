---
type: system
system: Integrations Jobber Xero
status: legacy-app
description: "Next.js 16 forbids 'use cache' on class methods. Use module-level"
source: .claude/skills/integrations-jobber-xero/SKILL.md § Gotchas
migrated: 2026-11-23
verified:
tags: [voco/system/integrations-jobber-xero]
---

# Gotchas

Part of [[Integrations Jobber Xero]]. Migrated verbatim from the `integrations-jobber-xero` skill; check `verified` before trusting details.

1. **Next.js 16 forbids `'use cache'` on class methods.** Use module-level
   cached functions. `xero.js` exports a top-level `fetchCustomerByPhone`
   function; the adapter class's `fetchCustomerByPhone` delegates to it.
2. **Cross-runtime casing divergence is intentional.** Next.js side is
   camelCase (`externalAccountId`), Python side is snake_case
   (`external_account_id`). Don't "normalize" — one side will break.
3. **`activity_log` column names are `event_type` + `metadata`**, NOT
   `action` + `meta` despite what CONTEXT D-06 (Phase 58) wording says.
   Phase 58 Plan 03 reconciled to real column names (Option A in research).
4. **Jobber webhook HMAC key = `JOBBER_CLIENT_SECRET`** (no separate
   `JOBBER_WEBHOOK_SECRET` env var). This is Pitfall 1 Option B from
   Phase 56 research and a common onboarding confusion.
5. **`jobber_last_schedule_poll_at` is separate from `last_context_fetch_at`.**
   Schedule poll cursor (Phase 57) vs customer-context touch (Phase 55/56).
   Don't conflate when debugging stale data.
6. **Raw body must be read ONCE for HMAC.** Calling `request.json()` and
   re-stringifying breaks the Xero + Jobber HMAC compare. Always
   `await request.text()` and `JSON.parse` manually.
7. **Silent-ignore on unknown tenant (HTTP 200).** Both webhooks return
   200 with an empty body when `external_account_id` lookup misses —
   prevents Jobber/Xero from retrying indefinitely against stale
   registrations.
8. **`_touch_last_context_fetch_at` is a blind UPDATE.** No read-modify-write,
   no race with Next.js side. Telemetry `INSERT` uses a fresh UUID PK —
   also race-free. Both are parallelized via `asyncio.gather` in the
   Python adapters (zero added latency on fetch return path).
9. **Xero `GET /Contacts` requires `summaryOnly=false` for phone data.**
   Default response omits `PhoneNumber`/`PhoneCountryCode`/`PhoneAreaCode`
   (returns PhoneType slots with null values). Any caller that matches
   contacts by phone — `xeroContactMatchesPhone`, the Python pre-session
   matcher, the webhook phone-cacheTag resolver — must pass the parameter.
   Affected call sites kept in sync: `livekit-agent/src/integrations/xero.py`
   `_get_contacts_by_phone`; `src/lib/integrations/xero.js`
   `fetchCustomerByPhone`; `src/app/api/webhooks/xero/route.js` invoice
   contact resolution. `findOrCreateCustomer` (email-search, ID-only read)
   does not need the flag.
10. **`accounting_credentials.expiry_date` is BIGINT epoch-MILLISECONDS, not a
   timestamp.** Every writer (both runtimes) must store `int(epoch_ms)`. Writing
   an ISO string is silently rejected by the text→bigint cast and swallowed by
   the fail-soft wrapper — the Python side had exactly this bug (refreshes never
   persisted) until 2026-06-04. Readers (`_expiry_to_epoch`) return epoch
   SECONDS and tolerate legacy ISO rows. See "Token-expiry storage contract".
11. **The Python agent now holds the OAuth refresh lock too.** Don't assume the
   agent refreshes unconditionally — it acquires `try_acquire_oauth_refresh_lock`
   and a loser polls for the winner's row; **on poll timeout the loser returns
   None (2026-06-12) — never re-fire the wire refresh as a "fallback"**, the
   winner has usually already consumed the single-use token and the retry's 400
   bricks the connection behind a false Reconnect banner. Critical for Jobber's
   single-use refresh-token rotation. See "OAuth refresh-lock — cross-runtime
   participation".
12. **Phase 58 telemetry rows only persist once migration 071 is applied.**
   The `activity_event_type` enum lacked `integration_fetch`/
   `integration_fetch_fanout` until 071 — inserts before that failed the cast
   silently (the emit helpers never raise). Zero rows is a migration gap, not
   an agent bug.

---
