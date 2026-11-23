---
type: system
system: Scheduling and Calendar
status: current
description: "Environment variables Scheduling and Calendar reads, and where they are set."
source: .claude/skills/scheduling-calendar-system/SKILL.md § 9. Environment Variables
migrated: 2026-11-23
verified:
tags: [voco/system/scheduling-and-calendar]
---

# Environment Variables

Part of [[Scheduling and Calendar]]. Migrated verbatim from the `scheduling-calendar-system` skill; check `verified` before trusting details.

| Variable | Service | Purpose |
|----------|---------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth | OAuth client ID for Google Calendar |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | OAuth client secret for Google Calendar |
| `MICROSOFT_CLIENT_ID` | Microsoft OAuth | Azure app registration client ID |
| `MICROSOFT_CLIENT_SECRET` | Microsoft OAuth | Azure app registration client secret |
| `MICROSOFT_TENANT_ID` | Microsoft OAuth | Azure tenant (used in auth flows; authority set to `common` for multi-tenant) |
| `OUTLOOK_WEBHOOK_SECRET` | Outlook Webhooks | `clientState` sent during subscription creation and verified on each notification |
| `NEXT_PUBLIC_APP_URL` | OAuth callbacks | Base URL for OAuth redirect URIs (e.g., `https://yourapp.vercel.app`) |
| `CRON_SECRET` | Cron auth | Bearer token for `/api/cron/*` endpoints |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | DB access for slot data, credentials, events |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Service role for webhook handlers (bypasses RLS) |

---
