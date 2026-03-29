# Voco — Project Instructions

## What This Is

Voco is a Next.js SaaS platform for home service businesses (plumbers, HVAC, electricians, handymen). An AI receptionist answers phone calls 24/7 via Twilio SIP + LiveKit + Gemini, triages urgency, books appointments, and creates CRM leads — so contractors never lose a job to voicemail.

**Tech stack**: Next.js (App Router), Supabase (Auth + Postgres + RLS + Realtime), Twilio SIP + LiveKit + Gemini 3.1 Flash Live (AI voice calls, Python agent on Railway), Stripe (billing), Resend (transactional email), Tailwind CSS, shadcn/ui, next-intl (i18n).

## Site Flow

```
New User:
  Public Site (landing, about, contact) → Pricing Page (select plan) → /auth/signin (signup + OTP) → Onboarding Wizard → Dashboard

Returning User:
  /auth/signin (signin) → Dashboard

Background:
  Voice Calls — Twilio SIP → LiveKit → Gemini AI answers calls → triage → booking → lead creation → notifications
```

## Skill Reference — Which Skill Covers What

Each skill below is a complete architectural reference for one part of the codebase. **Read the relevant skill before making changes, and update it after.**

### Core Application Skills

| Skill | Covers | Read this when you need to... |
|-------|--------|-------------------------------|
| `auth-database-multitenancy` | Supabase Auth, 3 client types, middleware guards, RLS policies, **all 23 DB migrations with every table definition**, getTenantId pattern, tenant isolation | ...understand the DB schema, add a migration, debug RLS, modify auth middleware, add a new table, or find any Supabase table definition |
| `onboarding-flow` | 5-step signup wizard, all `/api/onboarding/*` routes, Twilio phone provisioning + SIP trunk association, trade templates, LiveKit SIP test call, Stripe Checkout Session, wizard session persistence | ...modify the signup/onboarding flow, debug OTP or provisioning, change wizard steps, or touch billing checkout |
| `dashboard-crm-system` | All dashboard pages, lead lifecycle + merging, Kanban board, analytics charts, escalation chain, settings panels, setup checklist, design tokens, guided tour, Supabase Realtime | ...change anything on the dashboard, modify lead management, update analytics, edit settings panels, or debug Realtime subscriptions |
| `voice-call-architecture` | Twilio SIP + LiveKit + Gemini 3.1 Flash Live Python agent (Railway), SIP trunking, in-process tools, post-call pipeline, triage, scheduling, booking, notifications, lead creation | ...modify call handling, change AI agent behavior, update triage logic, debug the LiveKit agent, or touch the Twilio/LiveKit/Gemini integration |
| `scheduling-calendar-system` | Slot calculation, atomic booking, Google Calendar OAuth/sync/webhooks, Outlook Calendar OAuth/sync/webhooks, travel buffers, geographic zones, cron jobs, appointment management | ...change booking logic, modify calendar sync, debug OAuth flows, adjust working hours, or touch appointment APIs |
| `public-site-i18n` | Landing page sections, pricing page, about page, contact form (Resend email), navigation, footer, animation system, AuthAwareCTA, next-intl config, translation files (en/es) | ...edit public-facing pages, modify pricing tiers, change navigation/footer, update translations, or debug i18n |
| `scroll-line-path` | Decorative SVG scroll-draw line on the landing page (copper sine wave from How It Works → Get Started CTA) | ...adjust the scroll line animation, change section order on the landing page, or debug why the line doesn't align |

### Where to Find Database Tables

All Supabase table definitions, columns, RLS policies, and migrations are documented in `auth-database-multitenancy`. The 24 migrations are in `supabase/migrations/`. Key tables: `tenants`, `calls`, `services`, `appointments`, `leads`, `lead_calls`, `activity_log`, `escalation_contacts`, `calendar_credentials`, `calendar_events`, `service_zones`, `zone_travel_buffers`, `subscriptions`, `stripe_webhook_events`, `usage_events`, `phone_inventory`, `phone_inventory_waitlist`, `billing_notifications`.

## Rules

- **Keep skills in sync**: When making changes to any system covered by a skill, read the skill first, make the code changes, then update the skill to reflect the new state.
- **Brand name is Voco** — not HomeService AI, not homeserviceai. Fallback email domains use `getvoco.ai`.
