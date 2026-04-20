# Dashboard UI — BusinessIntegrationsClient + Setup Checklist Reconnect

Covers: 4-state machine, reconnect banner, setup-checklist red-dot variant,
`<AsyncButton>` Connect/Disconnect/Reconnect migration (Phase 58),
`JobberBookableUsersSection` + `JobberCopyBanner` (Phase 57).

## File map

| Concern | File |
|---------|------|
| Business Integrations card client | `src/components/dashboard/BusinessIntegrationsClient.jsx` |
| Integrations page (Server Component) | `src/app/dashboard/more/integrations/page.js` |
| Integrations retry helper (Phase 58) | `src/components/dashboard/IntegrationsRetryButton.jsx` |
| Status shape source | `src/lib/integrations/status.js :: getIntegrationStatus` |
| Jobber bookable users section (Phase 57) | `src/components/dashboard/JobberBookableUsersSection.jsx` |
| Jobber copy banner (Phase 57) on calendar | `src/components/dashboard/JobberCopyBanner.jsx` |
| Setup checklist API | `src/app/api/setup-checklist/route.js` |
| Checklist item leaf | `src/components/dashboard/ChecklistItem.jsx` |
| Checklist accordion | `src/components/dashboard/SetupChecklist.jsx` |
| AsyncButton primitive | `src/components/ui/async-button.jsx` |

## 4-state machine — BusinessIntegrationsClient

Each provider card (Xero, Jobber) renders one of 4 states:

| State | Trigger | Render |
|-------|---------|--------|
| **disconnected** | no row in `accounting_credentials` | Provider logo + Connect `<AsyncButton>` (pendingLabel `"Connecting…"`) |
| **connecting** | `isConnecting` local state true (user just clicked Connect) | `<AsyncButton pending>` — spinner + disabled |
| **connected** | row exists + `error_state IS NULL` | Provider logo + "Connected as {tenant_name}" + Last synced timestamp + Disconnect `<AsyncButton>` (pendingLabel `"Disconnecting…"`) |
| **error-degraded** | row exists + `error_state = 'token_refresh_failed'` | Reconnect banner at top + provider card with Reconnect `<AsyncButton>` (pendingLabel `"Reconnecting…"`) + Disconnect `<AsyncButton>` |

### State derivation

```js
const xeroState =
  !xero ? 'disconnected'
  : isXeroConnecting ? 'connecting'
  : xero.error_state ? 'error-degraded'
  : 'connected';
```

## Reconnect banner

When ANY provider is in `error-degraded`, the page shows an Alert above the
provider cards:

```jsx
{hasAnyError && (
  <Alert variant="destructive">
    <AlertTitle>Reconnect needed</AlertTitle>
    <AlertDescription>
      {errorProviders.join(' and ')} {errorProviders.length > 1 ? 'have' : 'has'}
      lost access. Reconnect below so your AI keeps using customer data from
      your accounting system.
    </AlertDescription>
  </Alert>
)}
```

Copy is locked by UI-SPEC (Phase 58) — "Reconnect needed" is grep-anchored
in both `ChecklistItem.jsx` and `BusinessIntegrationsClient.jsx` (and the
error_subtitle in setup-checklist API for the checklist variant).

## Last synced timestamp

Under "Connected as {tenant_name}", the card renders:

```jsx
{row?.last_context_fetch_at && (
  <p className="text-xs text-muted-foreground">
    Last synced {formatDistanceToNow(parseISO(row.last_context_fetch_at), { addSuffix: true })}
  </p>
)}
```

`last_context_fetch_at` is written by the Python adapter on every successful
fetch (see `python-agent-injection.md`). D-08 (Phase 58) confirmed the
`getIntegrationStatus` select already includes this column symmetrically for
both providers; no code change was needed.

## Setup checklist Phase 58 Reconnect flow

The checklist items `connect_xero` and `connect_jobber` gain a third rendering
variant beyond the binary complete/incomplete (Phase 58 Plan 02):

### API side — `src/app/api/setup-checklist/route.js`

`fetchChecklistState` issues 4 queries per provider pair (instead of 2):

```js
// healthy
.from('accounting_credentials').select('id', { count: 'exact', head: true })
  .eq('provider', 'xero').is('error_state', null)
// error
.from('accounting_credentials').select('id', { count: 'exact', head: true })
  .eq('provider', 'xero').not('error_state', 'is', null)
// (same two for jobber)
```

`deriveChecklistItems` emits `has_error` + `error_subtitle` on every item:

```js
items.push({
  id: 'connect_xero',
  complete: counts.xeroConnected,           // healthy count > 0
  has_error: counts.xeroHasError,           // error count > 0
  error_subtitle: counts.xeroHasError ? 'Reconnect needed' : null,
  // ... other fields
});
```

### Leaf renderer — `ChecklistItem.jsx`

Three variants in order (first match wins):

1. **Error (red-dot + Reconnect CTA)** — `item.has_error === true`
   - Leading icon: `<span className="h-2 w-2 rounded-full bg-red-600 dark:bg-red-500" />`
     (the red-dot — decorative, aria-hidden wrapper).
   - Subtitle between title and description:
     `<p className="text-xs font-medium text-red-600 dark:text-red-400 mt-1">{item.error_subtitle}</p>`
     renders "Reconnect needed".
   - CTA label: `primaryLabel = 'Reconnect'` (this branch is FIRST — precedes
     `!item.required` → "Open settings" because connect_xero / connect_jobber
     are recommended, not required).
2. **Complete** — `item.complete === true` → `<CheckCircle2>` + muted label.
3. **Idle** — default → `<Circle>` + "Finish setup" CTA.

### Accordion parent — `SetupChecklist.jsx`

A grep-anchored contract comment above the `{themeItems.map(...)}` block
(Phase 58 Plan 02) names `has_error`, `error_subtitle`, and "red-dot" as
Phase 58 CHECKLIST-01 fields so future refactors don't silently drop them.
The `item={item}` spread was already correct.

## JobberBookableUsersSection (Phase 57)

When Jobber is connected, a sub-section renders below the Jobber card letting
the owner pick which Jobber employees' schedules mirror into Voco's calendar.

Component: `src/components/dashboard/JobberBookableUsersSection.jsx`.

- Fetches `accounting_credentials.jobber_bookable_user_ids` (array of IDs).
- Lists Jobber employees (via a read-side call).
- Toggle checkboxes update the array.
- Saves via PATCH to `/api/integrations/jobber/bookable-users`.

The schedule mirror (`calendar_events` with `provider='jobber'`) is populated
by Phase 57's poll cron + visit webhooks using this user list as the filter.

## JobberCopyBanner (Phase 57)

Not on the integrations page — on the calendar page. When the tenant has
Jobber connected and `jobber_bookable_user_ids` populated, calendar events
from Jobber visits render with a "From Jobber" overlay pill on each event
card. The JobberCopyBanner explains the read-only nature.

## AsyncButton migration (Phase 58 Plan 05)

All 4 action buttons on BusinessIntegrationsClient migrated from ad-hoc
`<Button disabled={isX}>{isX ? <Loader2 /> : "Label"}</Button>` to the
shared `<AsyncButton>` primitive:

| Call site | pending binding | pendingLabel |
|-----------|-----------------|--------------|
| hasError → Reconnect | `isConnecting` | `"Reconnecting…"` |
| hasError → Disconnect | `isDisconnecting` | `"Disconnecting…"` |
| connected → Disconnect | `isDisconnecting` | `"Disconnecting…"` |
| disconnected → Connect | `isConnecting` | `"Connecting…"` |

The Unicode `…` single glyph (NOT `...` three periods) is grep-enforced.

## Integrations page server component

`/dashboard/more/integrations/page.js` is a Server Component:

```js
export default async function Page() {
  try {
    const status = await getIntegrationStatus(tenantId);
    return <BusinessIntegrationsClient initialStatus={status} />;
  } catch (err) {
    return (
      <>
        <ErrorState />
        <IntegrationsRetryButton />
      </>
    );
  }
}
```

`IntegrationsRetryButton` (Phase 58 Plan 05) is a thin `'use client'`
component calling `useRouter().refresh()` — it lets an error path on a
Server Component surface a retry affordance without converting the whole
page to client.

## Debugging UI-to-data discrepancies

| Symptom | Check |
|---------|-------|
| Card says "Connected" but no Last synced | Python hasn't succeeded yet (never called, or all calls failed). Check `activity_log WHERE event_type='integration_fetch'`. |
| Card stuck on "Connecting…" | Callback didn't `revalidateTag('integration-status-${tenantId}')` after writing the row. |
| Checklist shows red-dot, card doesn't | `getIntegrationStatus` cache is stale OR `error_state` was set after last tag bust. Hit any of the `/api/integrations/*` endpoints to trigger revalidate, or wait the cache TTL. |
| Card shows "error-degraded" but `error_state` in DB is null | Stale cache. `revalidateTag('integration-status-${tenantId}')`. |
| Both show "Disconnected" for real-connected tenant | Wrong tenant_id resolved (check `getTenantId` middleware path). |
