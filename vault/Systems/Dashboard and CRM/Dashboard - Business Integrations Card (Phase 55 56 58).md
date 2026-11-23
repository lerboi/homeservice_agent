---
type: system
system: Dashboard and CRM
status: legacy-app
description: "Server Component: src/app/dashboard/more/integrations/page.js Covers: File map; BusinessIntegrationsClient 4-state machine; Phase 58 AsyncButton migration; Reconnect banner; JobberBookableUsersSection (Phase 57); Integrations page server component + retry"
source: .claude/skills/dashboard-crm-system/SKILL.md § 9. Business Integrations Card (Phase 55/56/58)
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Business Integrations Card (Phase 55 56 58)

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

### File map

- Server Component: `src/app/dashboard/more/integrations/page.js`
- Client child: `src/components/dashboard/BusinessIntegrationsClient.jsx`
- Retry helper (Phase 58): `src/components/dashboard/IntegrationsRetryButton.jsx`
- Jobber bookable users (Phase 57): `src/components/dashboard/JobberBookableUsersSection.jsx`

### BusinessIntegrationsClient 4-state machine

Each provider card (Xero, Jobber) renders one of:

| State | Trigger | Render |
|-------|---------|--------|
| **disconnected** | no `accounting_credentials` row | Connect `<AsyncButton pendingLabel="Connecting…">` |
| **connecting** | local `isConnecting` | `<AsyncButton pending>` spinner + disabled |
| **connected** | row + `error_state IS NULL` | "Connected as {tenant_name}" + Last synced + Disconnect `<AsyncButton pendingLabel="Disconnecting…">` |
| **error-degraded** | row + `error_state = 'token_refresh_failed'` | Reconnect banner + Reconnect `<AsyncButton pendingLabel="Reconnecting…">` + Disconnect |

Last synced: `formatDistanceToNow(parseISO(row.last_context_fetch_at))`.
Written by Python adapter on successful fetch — see
`integrations-jobber-xero/references/python-agent-injection.md`.

### Phase 58 AsyncButton migration

All 4 action buttons migrated from ad-hoc `<Button disabled={isX}>{isX ? <Loader2 /> : "Label"}</Button>`
to shared `<AsyncButton>`. Unicode `…` single glyph (NOT `...`) is
grep-enforced via UI-SPEC §10.5.

### Reconnect banner

When any provider in `error-degraded`, Alert at top:
```jsx
<Alert variant="destructive">
  <AlertTitle>Reconnect needed</AlertTitle>
  ...
</Alert>
```

### JobberBookableUsersSection (Phase 57)

When Jobber connected, sub-section lets owner pick which employees'
schedules mirror. Reads + writes `accounting_credentials.jobber_bookable_user_ids`
via PATCH `/api/integrations/jobber/bookable-users`.

### Integrations page server component + retry

`page.js` wraps `getIntegrationStatus(tenantId)` in try/catch. On error:
renders `<ErrorState/>` + `<IntegrationsRetryButton/>` (client island
calling `useRouter().refresh()`).

For full Xero/Jobber OAuth + refresh + webhook + caching coverage, see
the **`integrations-jobber-xero`** skill — that skill consolidates
architecture that previously lived scattered across Phase 55/56/57
summaries.

---
