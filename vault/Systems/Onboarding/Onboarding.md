---
type: system-index
system: Onboarding
status: legacy-app
repo: homeservice_agent
description: Complete architectural reference for the onboarding wizard — 4-step signup flow (profile, services, contact details, checkout), all onboarding API routes, country-aware phone number provisioning (SG inventory via RPC, US/CA via Twilio API +…
source_skills: [onboarding-flow]
migrated: 2026-11-23
verified:
tags: [voco/system/onboarding]
---

# Onboarding

Up: [[Home]] · [[Systems]]

> **How to use:** read this index, then open only the notes the task needs. After changing code in this system, update the matching note and set its `verified:` date.

**Status (2026-11-23):** legacy app. The wizard is home-service specific (trade selector, trade templates) and is unchanged by the 2026-11 rebrand; public pages will stop linking to it.

## Notes (from `onboarding-flow`)

| Note | Lines | Status | What is in it |
|---|---|---|---|
| [[Onboarding - Architecture Overview]] | 49 | legacy-app | Auth (/auth/signin) is a prerequisite before the wizard but is not counted as a wizard step. Plan selection happens on the external /pricing page BEFORE ente… |
| [[Onboarding - File Map]] | 38 | legacy-app | Which files implement Onboarding and what each one is responsible for. |
| [[Onboarding - Wizard Layout]] | 47 | legacy-app | File: src/app/onboarding/layout.js |
| [[Onboarding - Wizard Steps]] | 70 | legacy-app | Wizard Steps. Covers: Auth (prerequisite, not a wizard step) (`/auth/signin`); Step 1: Profile (`/onboarding/page.js`); Step 2: Services (`/onboarding/services/page.js`); Step 3: Contact Details (`/onboarding/contact/page.js`); Step 4: Checkout (`/onboarding/checkout/page.js`); Deprecated: Plan Selection (`/onboarding/plan/page.js`); Deprecated: Checkout Success (`/onboarding/checkout-success/page.js`); Legacy: Complete (`/onboarding/complete/page.js`) |
| [[Onboarding - Onboarding Components]] | 60 | legacy-app | Onboarding Components. Covers: `TestCallPanel({ phoneNumber, onComplete, onGoToDashboard, context })`; `CelebrationOverlay()`; `TradeSelector({ selected, onSelect })`; `OtpInput({ onComplete, disabled })` |
| [[Onboarding - Session Management]] | 33 | legacy-app | Session Management. Covers: `useWizardSession(key, defaultValue)`; `clearWizardSession()` |
| [[Onboarding - API Routes]] | 97 | legacy-app | HTTP routes belonging to Onboarding: methods, parameters and behaviour. Covers: `POST /api/onboarding/start`; `POST /api/onboarding/provision-number` — DEPRECATED; `POST /api/onboarding/sms-confirm`; `GET /api/onboarding/state` (2026-06-13); `POST /api/onboarding/sms-verify`; `POST /api/onboarding/test-call`; `GET /api/onboarding/test-call-status`; `GET /api/onboarding/sg-availability`; `POST /api/onboarding/sg-waitlist`; `POST /api/onboarding/checkout-session`; `POST /api/onboarding/complete` |
| [[Onboarding - Country-Aware Provisioning]] | 56 | legacy-app | Phone number provisioning happens after checkout success (D-10) — never during wizard steps. This prevents wasting numbers on abandoned signups. Covers: Provisioning Strategy; Webhook Handler Flow (`src/app/api/stripe/webhook/route.js`); Environment Variables for Provisioning |
| [[Onboarding - Trade Templates]] | 26 | legacy-app | File: src/lib/trade-templates.js |
| [[Onboarding - Proxy Auth Guards]] | 23 | legacy-app | File: src/proxy.js (Next 16 proxy convention — NOT src/middleware.js; see auth-database-multitenancy skill) |
| [[Onboarding - Database Tables - Onboarding-Relevant Columns]] | 52 | legacy-app | Pre-purchased SG phone numbers managed by admin. Covers: `tenants` table (onboarding-relevant columns); `phone_inventory` table; `phone_inventory_waitlist` table; `services` table |
| [[Onboarding - Environment Variables]] | 22 | legacy-app | Environment variables Onboarding reads, and where they are set. |
| [[Onboarding - Key Design Decisions]] | 30 | legacy-app | signUp() sends OTP email directly — no separate signInWithOtp() call: Supabase's signUp() already triggers the confirmation email when email confirmation is … |
| [[Onboarding - Scope and change history]] | 34 | record | The former onboarding-flow skill's scope statement, preamble and running 'last updated' change history. Read only when you need to know when or why something changed. |

## Short sections

### Cross-Domain References

- **LiveKit test call + provisioning**: See `voice-call-architecture` skill for how the test call triggers the LiveKit agent and how the post-call pipeline processes the call. Phone provisioning is documented in the Stripe webhook handler section of that skill.
- **Auth + Supabase clients**: See `auth-database-multitenancy` skill for `createSupabaseServer()` vs `supabase` (service role) patterns, and `getTenantId()`.
- **Design tokens**: See `dashboard-crm-system` skill for the shared `src/lib/design-tokens.js` token system — both onboarding and dashboard use these brand colors.

---


### Important: Keeping This Document Updated

When making changes to any file listed in the File Map above, update the relevant sections of this skill document to reflect the new behavior. This ensures future conversations always have an accurate reference.
