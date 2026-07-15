# Disabling the Jobber & Xero Integrations for v1

**Date:** 2026-07-15
**Branch:** `chore/disable-integrations-v1` (created in **both** repos: `homeservice_agent` + sibling `livekit_agent`)
**Status:** Implemented on-branch, not committed. Main-repo test baseline is unchanged (see Verification).
**Decision:** **Freeze/flag-off, do NOT delete.** Ship v1 with the Jobber/Xero integrations disabled everywhere (UI, API, crons, and the LiveKit voice agent) behind a single master flag. The code stays in-tree, dormant and importable, so it's a one-flag flip to re-enable when a paying customer asks.

---

## 1. Why

Context from the decision discussion:

- **The app isn't deployed yet.** Everything is test/staging, so the "both connections are dead / zero usage" signal proves nothing about demand — it's a pre-launch artifact, not evidence against the feature.
- **It's not part of the v1 hypothesis.** v1 exists to test one thing: *does the AI receptionist (answer → triage → book → notify) create demand and work reliably?* Jobber/Xero ("the AI knows the caller's account/job/invoice history") is a **second-order differentiator**, orthogonal to that test. Positioning headline is "never miss a call = never lose a job," not the accounting sync.
- **It adds risk + latency to the one path that must be flawless.** The pre-session context fetch sits on the call-setup critical path (up to ~2.5s of dead air before the greeting — INT-2), and an in-call token death is a silent-failure surface (INT-1). For a first prod launch you want the call path minimal.
- **It's over-engineered *for v1* — in sequencing, not quality.** Dual OAuth in two languages, a cross-language refresh lock, a 270-day schedule-mirror poll every 15 min, a merge layer — all built before the core loop was validated. Good code, built too early.
- **Disable, don't delete.** Deleting is a hot-path teardown with wide blast radius (it's wired into lead-capture, prompt-building, invoice, booking, and a landing-page layout dependency) for zero revenue gain, and you'd rebuild it later. Disabling gets the identical clean v1 test with none of that risk, and keeps the option cheap to switch back on.

This directly implements the audit's §4 "reduce/freeze integrations" recommendation and the follow-up analysis in `Audit.md` / `Audit-Verification` — but as a **hard freeze** rather than the audit's "reduce to one provider" (which was the worst option: it keeps most of the surface for the provider with the worse signal).

---

## 2. The master flag

One global kill-switch per repo. **Fail-closed: OFF unless explicitly enabled.**

| Repo | Env var | Read in | Default |
|---|---|---|---|
| `homeservice_agent` (Next.js) | `NEXT_PUBLIC_INTEGRATIONS_ENABLED` | `src/lib/integrations-enabled.js` → `export const INTEGRATIONS_ENABLED` | **off** (unset) |
| `livekit_agent` (Python) | `VOCO_INTEGRATIONS_ENABLED` | `src/lib/feature_flags.py` → `INTEGRATIONS_ENABLED` | **off** (`"false"`) |

- `NEXT_PUBLIC_` is used so the same constant is readable in **client** components (the "Coming soon" UI) and on the **server** (route/cron/page gates), inlined at build time.
- This is a **global v1 switch**, deliberately separate from the per-tenant `tenants.features_enabled` flags in `features.js`. When we re-enable we can move to per-tenant gating there for a staged rollout.

To re-enable: set the env var to `true` in Vercel (main) **and** Railway (agent). Nothing else is required for the code to light back up — but read §6 first (there are two defects to fix before the first real connection).

---

## 3. What changed — `livekit_agent` (the AI receptionist)

This is the most important half: it removes the integration from the live call path.

| File | Change |
|---|---|
| `src/lib/feature_flags.py` | **New.** Defines `INTEGRATIONS_ENABLED` from `VOCO_INTEGRATIONS_ENABLED` (default off). |
| `src/agent.py` | (1) Imports the flag. (2) Wraps the pre-session merged-context fetch in `_fetch_customer_context_bounded()` that returns `None` immediately when disabled — so `fetch_merged_customer_context_bounded` **never enters the `asyncio.gather` on the call-setup critical path**. `caller_history` (Voco's own DB tables, **not** an integration) still fetches in parallel, unchanged. (3) Gates the `emit_integration_fetch_fanout` telemetry block behind the flag. |
| `src/tools/__init__.py` | The `check_customer_account` tool is **no longer always-registered** — it's appended only when `INTEGRATIONS_ENABLED`. With it off, there's no dead tool on the LLM's tool-selection surface and (because `prompt.py` already omits the `CUSTOMER CONTEXT` block when `customer_context` is `None`) no integration text in the system prompt. |
| `tests/conftest.py` | Sets `VOCO_INTEGRATIONS_ENABLED=true` for the test run so the existing agent tests (which exercise the *enabled* path) keep their coverage. Prod still defaults off. |

**Deliberately NOT changed:** `src/integrations/{jobber,xero,_refresh_lock}.py`, `src/lib/customer_context.py`, `src/tools/check_customer_account.py`. These stay importable and dormant. In particular `tools/capture_lead.py` imports `_normalize_free_form` from `integrations/jobber.py` on the always-on lead path — deleting `jobber.py` would break lead capture, which is exactly why we freeze rather than delete.

---

## 4. What changed — `homeservice_agent` (Next.js app)

| File | Change |
|---|---|
| `src/lib/integrations-enabled.js` | **New.** Master flag `INTEGRATIONS_ENABLED`. |
| `src/app/components/landing/IntegrationsStrip.jsx` | Flag-driven: when off, **Jobber + Xero render under the existing "Coming soon" heading** instead of the live strip (honest — the code exists, it's one flip away). Calendars/WhatsApp unchanged. |
| `src/app/dashboard/more/integrations/page.js` | Keeps the **Calendar Connections** section (a real, shipped feature). The **Accounting & Job Management** section becomes a **"Coming soon"** panel when disabled — no connectable OAuth cards, no reader query, no permanently-broken reconnect state. |
| `src/app/api/integrations/[provider]/auth/route.js` | Returns **404** when disabled — refuses to start any OAuth flow, even via a direct URL. |
| `src/app/api/integrations/[provider]/callback/route.js` | Redirects away when disabled — a callback can't legitimately arrive. |
| `src/app/api/webhooks/jobber/route.js` | Early **404** when disabled (dormant endpoint). |
| `src/app/api/webhooks/xero/route.js` | Early **404** when disabled (dormant endpoint). |
| `src/app/api/cron/poll-jobber-visits/route.js` | No-op early return when disabled (belt-and-suspenders; also removed from `vercel.json`). |
| `src/app/api/cron/refresh-integration-tokens/route.js` | No-op early return when disabled (also removed from `vercel.json`). |
| `src/lib/accounting/sync.js` | `pushToAccounting` + `pushStatusUpdate` no-op when disabled — the single choke point for invoice→accounting sync (covers both call sites: `invoice-send.js` and `invoices/[id]` PATCH). |
| `src/app/api/appointments/route.js` | The fire-and-forget `notifyBookingCopyToJobber` "copy to Jobber" hook is gated on the flag. |
| `src/app/api/setup-checklist/route.js` | `connect_xero` / `connect_jobber` checklist items are skipped when disabled — no connect/reconnect nudge. |
| `vercel.json` | **Removed** the two integration crons: `poll-jobber-visits` (was `*/15`) and `refresh-integration-tokens` (was `*/10`). Cron count 14 → 12. |
| `src/components/dashboard/CalendarConnectionsCard.jsx` | **(2nd-pass fix.)** The calendar page's **"Connections"** card: the **Business apps** section (Jobber/Xero **Connect/Reconnect** rows + "Action needed" badge) is hidden, and the `/api/integrations/status` poll is skipped (null SWR key) when disabled. Calendars (Google/Outlook) stay. |
| `src/app/dashboard/calendar/page.js` | Skips the `/api/integrations/status` fetch and forces `jobberConnected = false` when disabled. This **cascades** to hide the AppointmentFlyout **"Copy to Jobber"** section, the **"Not in Jobber yet"** pills, and the CalendarView Jobber indicators (all gate on `jobberConnected`). |
| `src/app/api/integrations/status/route.js` | Returns `{ xero: null, jobber: null }` when disabled, so no client reads a dead credential row as connected. |
| `src/app/api/integrations/jobber/connection-status/route.js` | Returns `{ connected: false }` when disabled (a dead `accounting_credentials` row must not read as connected). |
| `src/app/api/integrations/disconnect/route.js` | **404** when disabled. |
| `src/app/api/integrations/jobber/resync/route.js` | **404** when disabled. |
| `src/app/api/integrations/jobber/bookable-users/route.js` | **404** (GET + PATCH) when disabled. |
| `tests/setup/jest.setup.js` | Sets `NEXT_PUBLIC_INTEGRATIONS_ENABLED=true` for the test run so the existing integration suites (which exercise the *enabled* path) keep their coverage. Prod defaults off. |

**Deliberately NOT changed (already safe):**
- `src/lib/integrations/*` and `BusinessIntegrationsClient.jsx` (388 LOC) — not rendered when disabled (the integrations page gates it), so no rewrite needed.
- `CustomerDetailHeader.jsx` Jobber/Xero badges — driven by a fetch to `/api/accounting/credentials`, which **does not exist as a route (404)**, so the fetch fails gracefully and the badges never render.
- `CopyToJobberSection.jsx`, the "Not in Jobber yet" pills, CalendarView Jobber indicators — all gate on the `jobberConnected` prop, which is now forced `false` (see the `calendar/page.js` row above).
- `InvoiceSyncIndicator.jsx` — a status pill (not a connection control) that only renders inside the invoicing feature, which is independently flag-off (`features_enabled.invoicing = false`, 0 tenants). No new sync rows are created either (the `accounting/sync.js` choke point is gated).
- DB tables `accounting_credentials` / `oauth_refresh_locks` / `accounting_sync_log` — inert, left in place.

---

## 5. What a user sees now (flag off)

- **Landing page:** Jobber & Xero appear grayed under "Coming soon" alongside Housecall Pro / ServiceTitan. Calendars/WhatsApp still shown as live.
- **Dashboard → More → Integrations:** Calendar connections work normally; Accounting & Job Management shows a "Coming soon" card. No "Connect Xero/Jobber" button, no reconnect banner.
- **Dashboard → Calendar ("Connections" card):** shows only your calendars (Google/Outlook). The Jobber/Xero **Business apps** rows, their **Connect/Reconnect** buttons, and the **"Action needed"** badge are gone. On bookings, the **"Copy to Jobber"** action and **"Not in Jobber yet"** pills are hidden too.
- **Setup checklist:** no Xero/Jobber items.
- **Voice calls:** the agent never fetches integration context (no greeting latency), and `check_customer_account` isn't offered to the model.
- **Direct URLs / stale webhooks:** OAuth start = 404, webhooks = 404, crons removed.

---

## 6. Re-enable checklist (when a paying customer asks)

1. **Fix INT-2 first (greeting latency):** in `agent.py`, greet first and inject customer context via a chat-ctx update *after* `session.start()` rather than awaiting it before the greeting. (Today the gate makes the fetch return instantly, but the moment you re-enable, a healthy tenant eats up to ~2.5s of dead air.)
2. **Fix INT-1 first (silent death / no recovery):** the keep-fresh cron (`refresh-integration-tokens`) skips `error_state` rows forever, and the Python agent-side refresh sets `error_state` with no email. Auto-retry transient failures and re-arm the reconnect notification so the first real connection doesn't inherit a silent-death path.
3. Set `NEXT_PUBLIC_INTEGRATIONS_ENABLED=true` in **Vercel** and `VOCO_INTEGRATIONS_ENABLED=true` in **Railway**.
4. Re-add the two crons to `vercel.json` (or, better, keep `poll-jobber-visits` off until a customer actually runs their crew on Jobber — the 270-day full-window poll is wasteful).
5. Re-test the OAuth connect flow end-to-end (tokens have rotted since April; the `xero-node` SDK + Jobber GraphQL schema may have drifted — expect a refresh/re-test pass, not a pure toggle).
6. Confirm the dashboard card, checklist items, and landing strip flip back to "live" automatically (they're all flag-driven).

---

## 7. Verification

**`homeservice_agent` (Node):**
- **`npm run build` passes** — exit 0, `✓ Compiled successfully`, 172/172 static pages generated (including `/dashboard/calendar` and `/dashboard/more/integrations`). The one build-log line (`cookies()` during prerender on `/api/calendar-sync/status`) is a pre-existing Next.js trace on a route not touched here — build still exits 0.
- **Full `npm test` suite is baseline-neutral.** With changes: `24 failed suites / 61 failed / 791 passed`. Stashed pristine tree: **identical** `24 failed suites / 61 failed / 791 passed`. The pre-existing failures (ESM-mock issues, unrelated to integrations) are unchanged; **my changes add zero new failures.**
- **ESLint clean on every file I edited.** The only lint errors in scope are **2 pre-existing** `react-hooks/set-state-in-effect` in `dashboard/calendar/page.js` (lines 196, 310) — lines I never touched (my diff is the import + the SWR-key gate); confirmed identical on the stashed pristine tree.
- `vercel.json` validated as JSON; integration crons confirmed removed (12 crons remain).

**`livekit_agent` (Python):**
- `python -m compileall src` clean; `feature_flags.INTEGRATIONS_ENABLED` reads `False` by default.
- `_fanout_task` confirmed only referenced inside the gated telemetry block — skipping it when disabled cannot `NameError`.
- ⚠️ **The pytest suite could not be run in this environment** — the repo requires Python ≥3.11 with the `livekit` package installed, and only Python 3.9 (no `livekit`) is available here. The agent edits are minimal (one import, one wrapper coroutine, one gated `if`, one conditional `append`) and were code-reviewed against every consumer. `tests/conftest.py` was updated so the suite passes with integrations enabled when run in a proper env. **Recommend running `pytest` in the real agent environment before merging.**

---

## 8. Notes / follow-ups

- Nothing is committed yet — changes sit on `chore/disable-integrations-v1` in both repos.
- The pre-existing `D "My Prompts/text3.md"` deletion in the working tree is **not** part of this work — left untouched.
- Optional later cleanup (out of scope here, per the audit's §4): the orphaned dead-code files, the Phase-57 schedule mirror, and eventual full deletion of the integration surface if it's still dead at the next milestone. Freeze — not delete — was the deliberate call.
