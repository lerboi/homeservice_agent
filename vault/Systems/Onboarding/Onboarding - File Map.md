---
type: system
system: Onboarding
status: legacy-app
description: "Which files implement Onboarding and what each one is responsible for."
source: .claude/skills/onboarding-flow/SKILL.md § File Map
migrated: 2026-11-23
verified:
tags: [voco/system/onboarding]
---

# File Map

Part of [[Onboarding]]. Migrated verbatim from the `onboarding-flow` skill; check `verified` before trusting details.

| File | Role |
|------|------|
| `src/app/onboarding/layout.js` | Wizard layout: logo, step counter, progress bar, white card |
| `src/app/onboarding/page.js` | Step 1: Trade selector + business name (profile) |
| `src/app/onboarding/services/page.js` | Step 2: Service list edit from TRADE_TEMPLATES |
| `src/app/onboarding/contact/page.js` | Step 3: Contact Details — owner name, phone, country selector + SG availability check |
| `src/app/onboarding/checkout/page.js` | Step 4 — embedded Stripe Checkout, webhook verification, success celebration |
| `src/app/onboarding/plan/page.js` | DEPRECATED — redirects to `/pricing` |
| `src/app/onboarding/checkout-success/page.js` | DEPRECATED — not in active wizard flow |
| `src/app/onboarding/complete/page.js` | Redirect to /dashboard (legacy, not in active wizard flow) |
| `src/app/onboarding/profile/page.js` | Redirect to /onboarding (legacy URL compatibility) |
| `src/app/onboarding/verify/page.js` | Redirect to /onboarding/contact (legacy URL compatibility) |
| `src/app/auth/signin/page.js` | Auth page (email signup + OTP) — prerequisite, not a wizard step |
| `src/app/auth/callback/route.js` | OAuth callback: exchanges code, redirects to /onboarding |
| `src/components/onboarding/TestCallPanel.js` | Polling call state machine (ready/calling/in_progress/complete/timeout) — post-payment use only (dashboard settings); no longer mounted in the onboarding wizard |
| `src/components/onboarding/CelebrationOverlay.js` | Animated checkmark + radial pulse rings |
| `src/components/onboarding/TradeSelector.js` | Trade picker grid (plumber/hvac/electrician/handyman) |
| `src/components/onboarding/OtpInput.js` | 6-digit OTP box inputs |
| `src/hooks/useWizardSession.js` | `useWizardSession(key, default)` + `clearWizardSession()` |
| `src/hooks/useClearLoadingOnPageRestore.js` | Resets a nav `loading` flag on mount + `pageshow` + `popstate` (back/bfcache restore). Used by steps 1/2/3 (2026-06-26) |
| `src/app/onboarding/OnboardingContext.js` | `OnboardingProvider` + `useOnboarding()` → `{ completed, markComplete }`; checkout success calls `markComplete()` |
| `src/app/api/onboarding/start/route.js` | POST: create/upsert tenant, save trade+services |
| `src/app/api/onboarding/provision-number/route.js` | **DEPRECATED**: provisioning now happens in Stripe webhook after checkout |
| `src/app/api/onboarding/sms-confirm/route.js` | POST: save owner_name + owner_phone + owner_email + country in one round-trip |
| `src/app/api/onboarding/sms-verify/route.js` | POST: phone OTP verification (signInWithOtp) |
| `src/app/api/onboarding/test-call/route.js` | POST: trigger LiveKit SIP test call — post-payment use from dashboard settings |
| `src/app/api/onboarding/test-call-status/route.js` | GET: poll test-call state — `complete` = `test_call_status === 'connected'` (set by the LiveKit webhook), plus `status`, `ever_completed` (test_call_completed), `phone_number`. Post-payment use from dashboard settings |
| `src/app/api/onboarding/complete/route.js` | POST: set onboarding_complete = true (legacy manual fallback) |
| `src/app/api/onboarding/checkout-session/route.js` | POST: create Stripe Checkout Session with 14-day trial + CC required |
| `src/app/api/onboarding/sg-availability/route.js` | GET: returns { available_count } for SG phone numbers from phone_inventory |
| `src/app/api/onboarding/sg-waitlist/route.js` | POST: accepts { email }, adds to phone_inventory_waitlist |
| `src/app/api/onboarding/state/route.js` | GET: saved wizard progress (tenant fields + services) for DB rehydration (2026-06-13) |
| `src/emails/WelcomeEmail.jsx` | React Email template: post-checkout welcome with the AI number (2026-06-13) |
| `src/lib/trade-templates.js` | TRADE_TEMPLATES map (4 trades × ~10 services each) |
| `src/proxy.js` | Auth guards, onboarding_complete redirect logic, paid-user rescue (2026-06-13) |

---
