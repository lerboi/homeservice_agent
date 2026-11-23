---
type: system
system: Onboarding
status: legacy-app
description: "Wizard Steps. Covers: Auth (prerequisite, not a wizard step) (`/auth/signin`); Step 1: Profile (`/onboarding/page.js`); Step 2: Services (`/onboarding/services/page.js`); Step 3: Contact Details (`/onboarding/contact/page.js`); Step 4: Checkout (`/onboarding/checkout/page.js`); Deprecated: Plan Sele"
source: .claude/skills/onboarding-flow/SKILL.md § 2. Wizard Steps
migrated: 2026-11-23
verified:
tags: [voco/system/onboarding]
---

# Wizard Steps

Part of [[Onboarding]]. Migrated verbatim from the `onboarding-flow` skill; check `verified` before trusting details.

### Auth (prerequisite, not a wizard step) (`/auth/signin`)

**File**: `src/app/auth/signin/page.js`

Three conditional render branches (NOT tabs) for structurally distinct layouts:
- **Signup** (default): Split layout, email + password input, "Create account" → calls `supabase.auth.signUp({ email, password })` which both creates the user AND sends the OTP confirmation email. No separate `signInWithOtp()` call — Supabase handles email delivery as part of `signUp()`.
- **OTP**: Centered card with `OtpInput` component — toggles via `useState` (NOT `router.push`) to avoid layout re-mount and progress bar flicker. Verifies with `supabase.auth.verifyOtp({ email, token, type: 'email' })`.
- **Signin**: Same layout for returning users, uses `supabase.auth.signInWithPassword({ email, password })`.

**Key**: OTP phase uses `useState` toggle, NOT router navigation. Keeps the user in the same wizard card.

### Step 1: Profile (`/onboarding/page.js`)

**File**: `src/app/onboarding/page.js`

State from `useWizardSession`: `trade`, `business_name`.

Two sequential POSTs to `/api/onboarding/start`:
1. `{ business_name, tone_preset: 'professional' }` → upserts tenant (must happen first so tenant row exists)
2. `{ trade_type: trade, services: TRADE_TEMPLATES[trade].services }` → updates trade + inserts services

UI: `TradeSelector` grid, then `Input` for business name revealed after trade selected. Both fields required. Navigates to `/onboarding/services` on success.

### Step 2: Services (`/onboarding/services/page.js`)

**File**: `src/app/onboarding/services/page.js`

Editable service list pre-populated from `TRADE_TEMPLATES[trade]`. User can remove services or add custom ones (new service gets `urgency_tag: 'routine'`). Services stored in wizard session via `useWizardSession('services', ...)`.

On submit: POST `/api/onboarding/start` with `{ trade_type, services }` (replaces existing services via delete + re-insert). Navigates to `/onboarding/contact`.

### Step 3: Contact Details (`/onboarding/contact/page.js`)

**File**: `src/app/onboarding/contact/page.js`

Collects `owner_name` (required), `country` (required — SG, US, CA), and `owner_phone` (**required** since 2026-08-13, with helper copy "We text you here when your AI books a job or needs you" — empty phone fails `validate()` with "Please enter your phone number."; <7 digits fails with the format message). Field order is **country above phone** (2026-06-13) so the prefix is known before typing; selecting a country no longer wipes typed phone digits. `buildE164` still returns `''` for empty input as defense in depth — a bare prefix (`'+65'`) must never be saved as owner_phone, and the server now 400s on empty anyway.

On country=SG select: fires `GET /api/onboarding/sg-availability` immediately (D-07) to show remaining count ("3 Singapore numbers available"). If available_count === 0: shows waitlist UI → user enters email → `POST /api/onboarding/sg-waitlist` → blocks proceed.

On submit: `POST /api/onboarding/sms-confirm` with `{ phone, owner_name, country, timezone }` where `timezone` is the browser-detected IANA zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`). Saves `owner_name`, `owner_phone`, `owner_email`, `country`, and `tenant_timezone` to tenants in one round-trip. Navigates to `/onboarding/checkout`.

Session state via `useWizardSession`: `owner_name`, `country`, `phone`. On mount with empty session state, hydrates from `GET /api/onboarding/state` (country goes through `handleCountryChange` so the SG check still runs; the E.164 owner_phone has its prefix stripped back off for the local-digits input).

### Step 4: Checkout (`/onboarding/checkout/page.js`)

**File**: `src/app/onboarding/checkout/page.js`

Embedded Stripe Checkout with 4 phases:

1. **Checkout form**: Renders embedded Stripe Checkout via `EmbeddedCheckoutProvider` with a client secret from `POST /api/onboarding/checkout-session` (embedded mode). User enters payment details inline without leaving the wizard.
2. **Verifying**: After Stripe form completes, polls `GET /api/onboarding/verify-checkout` on a two-stage plan (2026-06-13): 30×2s fast window, then 12×10s slow tail (~3 min total) — the old 60s cutoff stranded paid customers during webhook lag. Polls 4+ pass `session_id` so the endpoint can fall back to the Stripe API.
3. **Error** (polling exhausted): "Still confirming your subscription" with an explicit **"Check again" retry button** (re-runs `handleComplete`) and **do-not-pay-again** copy, plus a support link. Not a dead end anymore.
4. **Success**: Shows `CelebrationOverlay`, **the provisioned AI number** (fetched from `/api/onboarding/test-call-status`, short poll up to 4 tries, `formatInternational` display, "call it from your cell right now" nudge; falls back to "being assigned" copy). Calls `markComplete()` and `clearWizardSession()`. Auto-redirects to `/dashboard` after **10 seconds** (the countdown resets on entry and pluralizes — "1 second" vs "N seconds").

**Robustness (2026-06-26)**: (a) `fetchClientSecret` is wrapped in try/catch — on failure (invalid plan, **409 already-subscribed** on revisit, network) it sets `checkoutError`, and a dedicated recovery screen (Try again / Go to dashboard / Contact support) renders instead of a blank Stripe iframe that would otherwise strand the user. (b) The verify-checkout poll loop has an unmount-cancel ref (no `setState` after unmount) and a `pollingRef` concurrency guard (the `sessionId` effect and the error-screen "Check again" button can't run two loops at once).

### Deprecated: Plan Selection (`/onboarding/plan/page.js`)

**Status**: DEPRECATED. Redirects to `/pricing`. Plan selection now happens on the external `/pricing` page before entering the wizard. The selected plan and interval are passed as URL params through the flow and captured by the services step.

### Deprecated: Checkout Success (`/onboarding/checkout-success/page.js`)

**Status**: DEPRECATED. Thin wrapper, not in active wizard flow. Replaced by the embedded checkout at `/onboarding/checkout`.

### Legacy: Complete (`/onboarding/complete/page.js`)

Simple redirect to `/dashboard`. No longer called from the active wizard flow.

---
