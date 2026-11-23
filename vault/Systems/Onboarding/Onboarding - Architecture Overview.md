---
type: system
system: Onboarding
status: legacy-app
description: "Auth (/auth/signin) is a prerequisite before the wizard but is not counted as a wizard step. Plan selection happens on the external /pricing page BEFORE ente…"
source: .claude/skills/onboarding-flow/SKILL.md § Architecture Overview
migrated: 2026-11-23
verified:
tags: [voco/system/onboarding]
---

# Architecture Overview

Part of [[Onboarding]]. Migrated verbatim from the `onboarding-flow` skill; check `verified` before trusting details.

| Step | Route | Purpose |
|------|-------|---------|
| **Step 1: Profile** | `/onboarding` (page.js) | Trade selector + business name + 2x POST to /start |
| **Step 2: Services** | `/onboarding/services` | Edit pre-populated service list from TRADE_TEMPLATES. Also captures `selected_plan` + `selected_interval` from URL params (for users coming from pricing page) |
| **Step 3: Contact Details** | `/onboarding/contact` | Owner name, phone, country + SG availability check → sms-confirm saves owner_name + owner_phone + country |
| **Step 4: Checkout** | `/onboarding/checkout` | Embedded Stripe Checkout (3 phases: checkout form → verifying webhook → success celebration). Auto-redirects to `/dashboard` after 5s |

Auth (`/auth/signin`) is a prerequisite before the wizard but is not counted as a wizard step. Plan selection happens on the external `/pricing` page BEFORE entering the wizard — the services step captures `selected_plan` + `selected_interval` from URL params.

**What is NOT in the wizard**:
- **AI voice selection** (Phase 44) lives in Dashboard Settings (`/dashboard/settings` → AI Voice). New tenants use the curated Gemini default derived from their `tone_preset` (see the `VOICE_MAP` in the voice-call-architecture skill) until they explicitly override it post-onboarding.
- **Test call** (LiveKit SIP outbound) is no longer part of the wizard — the wizard cannot run a test call before payment because the phone number is provisioned by the Stripe webhook *after* checkout. The `TestCallPanel` component, `/api/onboarding/test-call`, and `/api/onboarding/test-call-status` routes remain live and are used post-payment from dashboard settings.

```
User selects plan on /pricing page (external)
       ↓
  /auth/signin — Email + OTP signup (Supabase Auth)
       ↓  (Google OAuth → /auth/callback → /onboarding, skips auth)
  /onboarding (Step 1: Profile)
  → POST /api/onboarding/start (business_name + tone_preset) → tenant upserted
  → POST /api/onboarding/start (trade_type + services) → services inserted
       ↓
  /onboarding/services (Step 2: Services)
  → Captures selected_plan + selected_interval from URL params
  → POST /api/onboarding/start (trade_type + services) → services replaced
       ↓
  /onboarding/contact (Step 3: Contact Details)
  → On country=SG select: GET /api/onboarding/sg-availability → show available count (D-07)
  → On zero SG available: show waitlist option → POST /api/onboarding/sg-waitlist
  → POST /api/onboarding/sms-confirm → owner_name + owner_phone + owner_email + country saved
       ↓
  /onboarding/checkout (Step 4: Checkout)
  → Embedded Stripe Checkout via EmbeddedCheckoutProvider
  → Phase 1: Stripe checkout form
  → Phase 2: Verifying — polls GET /api/onboarding/verify-checkout (up to 30 times)
  → Phase 3: Success — CelebrationOverlay + markComplete() + clearWizardSession()
  → Auto-redirects to /dashboard after 5 seconds
       ↓
  /dashboard
```

**Deprecated routes** (not in active wizard flow):
- `/onboarding/plan` — redirects to `/pricing`
- `/onboarding/checkout-success` — thin wrapper, not in active flow

Layout: `onboarding/layout.js` wraps all wizard steps with logo, step counter ("Step X of 4"), orange progress bar, and wizard card.

---
