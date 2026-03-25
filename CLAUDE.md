# Project Instructions

## Skill-Driven Architecture Changes

When asked to read a skill file and make changes to a specific architecture or system:
1. Read the relevant skill file first to understand the full system
2. Make the requested code changes
3. **After changes are made, update the skill file** to reflect the new version of the code — keep it accurate and in sync with the actual codebase

**Architecture skill files (all must be kept in sync):**
- `voice-call-architecture` — WebSocket LLM server, Retell webhooks, call-processor, triage, whisper messages
- `scheduling-calendar-system` — Slot calculator, booking, Google + Outlook OAuth/sync/webhooks, cron jobs
- `dashboard-crm-system` — Dashboard pages, lead lifecycle, Kanban, analytics, escalation chain, settings, design tokens
- `onboarding-flow` — 4-step wizard, onboarding API routes, phone provisioning, SMS verify, test call
- `auth-database-multitenancy` — Supabase Auth, middleware, RLS, all migrations, getTenantId
- `public-site-i18n` — Landing, pricing, about, contact, Resend email, next-intl (en/es)
