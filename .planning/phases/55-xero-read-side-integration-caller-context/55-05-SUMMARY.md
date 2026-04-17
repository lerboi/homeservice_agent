---
phase: 55-xero-read-side-integration-caller-context
plan: 05
subsystem: ui
tags: [dashboard, xero, integrations, email, setup-checklist]

requires:
  - phase: 55-01
    provides: error_state column
  - phase: 55-02
    provides: last_context_fetch_at touch on every fetch
  - phase: 55-03
    provides: OAuth heal on reauth
provides:
  - Business Integrations card Reconnect-needed state + Last-synced timestamp
  - connect_xero setup-checklist item (voice theme, auto-complete via accounting_credentials presence)
  - notifyXeroRefreshFailure helper (error_state write + revalidateTag + Resend email)
  - XeroReconnectEmail React Email template
affects: []

key-files:
  created:
    - src/emails/XeroReconnectEmail.jsx
    - tests/api/setup-checklist-xero.test.js
    - tests/lib/notifyXeroRefreshFailure.test.js
    - tests/components/BusinessIntegrationsClient.static.test.js
  modified:
    - src/components/dashboard/BusinessIntegrationsClient.jsx
    - src/lib/integrations/status.js (select error_state)
    - src/app/api/setup-checklist/route.js (connect_xero wired into 4 sites)
    - src/lib/notifications.js (notifyXeroRefreshFailure helper)

key-decisions:
  - "Static-grep tests for BusinessIntegrationsClient instead of RTL — project has no RTL setup; visual render covered by Task 4 UAT"
  - "Skipped adapter.js refreshTokenIfNeeded notifyOnFailure hook — no Next.js caller currently triggers a refresh on read; Python side (Plan 06) already writes error_state on its refresh failures"
  - "JSX emails mocked in notification tests (NewLeadEmail + XeroReconnectEmail) because Jest has no babel-preset-react in this project"
  - "Email sent only when ownerEmail provided; silent skip with log when missing — matches existing billing notification tolerance"

patterns-established:
  - "3-state integration card: Disconnected → Connected (+ optional Last-synced) → Reconnect-needed (amber banner + Reconnect/Disconnect stack)"
  - "Mock @/emails/* as JSX-free stubs in any Jest test that imports @/lib/notifications"

requirements-completed: [XERO-01]

completed: 2026-04-18
---

# Plan 55-05: Business Integrations UI + email

**Card now renders all 3 integration states (Disconnected / Connected / Reconnect-needed); owners get an email when Xero refresh fails; setup checklist has a connect_xero nudge.**

## Accomplishments

### UI
- `BusinessIntegrationsClient.jsx`: added 3rd state with locked UI-SPEC copy — "Reconnect needed — Xero token expired. Your AI receptionist can't access Xero customer info until you reconnect." Amber AlertTriangle banner.
- Primary Reconnect button (accent bg) + secondary ghost-red Disconnect, stacked vertically.
- Connected state enriched with "Last synced X ago" muted line using `date-fns` `formatDistanceToNow(parseISO(last_context_fetch_at), { addSuffix: true })`.
- P54 locked copy preserved verbatim (disconnect dialog, confirm-connect dialog, status lines, PROVIDER_META).

### Backend
- `src/lib/integrations/status.js` now selects `error_state` alongside existing columns — no signature change.
- `src/app/api/setup-checklist/route.js`: `connect_xero` added to `VALID_ITEM_IDS`, `THEME_GROUPS.voice`, `ITEM_META`, and `deriveChecklistItems` autoComplete; `fetchChecklistState` gains a 7th parallel query for the accounting_credentials row count.
- `src/lib/notifications.js`: new `notifyXeroRefreshFailure(tenantId, ownerEmail)` export that writes `error_state='token_refresh_failed'`, calls `revalidateTag('integration-status-${tenantId}')`, and sends a Resend email via the new `XeroReconnectEmail` template. Safe when ownerEmail is null/missing; never throws.
- `src/emails/XeroReconnectEmail.jsx`: React Email template matching UI-SPEC §Copywriting Contract (subject "Your Xero connection needs attention", plain-language body, copper-orange CTA button).

### Tests (17/17 PASS)
- `setup-checklist-xero.test.js` — 5 tests (VALID_ITEM_IDS presence, theme placement, complete=true/false, dismissed override filters item out, href correct).
- `notifyXeroRefreshFailure.test.js` — 6 tests (error_state write, revalidateTag, email subject/body, skip on missing email, tolerates Resend failure, no-ops on missing tenantId).
- `BusinessIntegrationsClient.static.test.js` — 6 static-grep tests (banner copy verbatim, Last-synced prefix + formatDistanceToNow call, error_state branch, Reconnect button label, P54 copy preserved, AlertTriangle/Alert imports).

### Deviations
- **Task 4 (Visual UAT):** still pending the user's review — this plan cannot sign off autonomously per `autonomous: false`.
- **`refreshTokenIfNeeded` `notifyOnFailure` option:** skipped. No current Next.js caller performs a refresh on read. Python side (Plan 06) writes `error_state` directly on its own refresh failures, which is sufficient to surface the banner. Email firing can be added later via a cron or admin Test-Connection action.

## Files

**Created:**
- `src/emails/XeroReconnectEmail.jsx`
- `tests/api/setup-checklist-xero.test.js`
- `tests/lib/notifyXeroRefreshFailure.test.js`
- `tests/components/BusinessIntegrationsClient.static.test.js`

**Modified:**
- `src/components/dashboard/BusinessIntegrationsClient.jsx`
- `src/lib/integrations/status.js`
- `src/app/api/setup-checklist/route.js`
- `src/lib/notifications.js`

## Task 4 Checkpoint — Visual UAT Pending

User needs to verify the following in the dev server:
1. State 1 (Disconnected) renders with P54 copy + "Connect Xero" button
2. State 2 (Connected) — after inserting a row, emerald status line + "Last synced X ago" line when `last_context_fetch_at` is set
3. State 3 (Reconnect) — after `UPDATE accounting_credentials SET error_state='token_refresh_failed'`, amber banner + Reconnect + Disconnect
4. Setup checklist shows "Connect Xero" item under voice theme
5. Email render — call `notifyXeroRefreshFailure('<tenant>', 'you@example.com')` from REPL, confirm inbox
6. 375px mobile viewport — card stays single-column, buttons stack

Reply `approved` after checks pass or describe issues.
