---
name: onboarding-flow
description: "Complete architectural reference for the onboarding wizard — 4-step signup flow (profile, services, contact details, checkout), all onboarding API routes, country-aware phone number provisioning (SG inventory via RPC, US/CA via Twilio API + SIP trunk association), trade templates, Stripe Checkout Session, session persistence, and middleware auth guards. Test call functionality (LiveKit SIP) lives post-payment in dashboard settings, not in the wizard. Use this skill whenever making changes to the onboarding wizard, signup flow, phone provisioning, trade templates, billing checkout, or wizard session management. Also use when the user asks about how onboarding works, wants to modify wizard steps, or needs to debug provisioning or OTP issues."
---

# Onboarding Flow — Complete Reference

This document is the single source of truth for the onboarding wizard system. Read this before making any changes to onboarding pages, wizard session management, or provisioning routes.

**Last updated**: 2026-08-13 (Owner phone made **COMPULSORY** in the contact step: the "(optional)" label is gone and `validate()` on the contact page rejects an empty phone ("Please enter your phone number."); `sms-confirm` now 400s when the phone is missing (previously `owner_phone` was only saved "if provided") — `owner_name`/`country` remain individually optional server-side. Rationale: SMS notifications, escalation calls, and the test call all deliver to `owner_phone`. No DB constraint added — existing tenants (4 of 6 live rows) have NULL `owner_phone` and the step-1 upsert creates the tenant row before the contact step. Known residual: a deep-link straight to `/onboarding/checkout` still bypasses the contact step entirely — same pre-existing gap as `country`; `checkout-session` deliberately tolerates it.)

**Earlier (2026-06-26)** (Dark-mode + back-nav + checkout-robustness fix wave: (1) **white-on-white inputs in dark mode** — onboarding is a light-only surface but dark mode is class-based (`.dark` on `<html>`, persisted from the dashboard theme toggle), so inputs with no explicit text color inherited the dark `--foreground` over the hardcoded white card. Fixed by a `[data-onboarding-root]` block in `globals.css` that re-pins the LIGHT token set (`--foreground`, `--input`, `--ring`, `--primary`, etc.) + `color-scheme: light`, with `data-onboarding-root` on the layout's outer div. Caveat: the country `<Select>`'s dropdown is portaled to `document.body` (outside the root) so it stays dark-themed but readable. (2) **stuck Continue spinner after Back** — steps 1/2/3 set `loading=true` then `router.push()` on success without resetting it; on Back the step reappeared with the stale flag (button disabled + spinning). New hook `src/hooks/useClearLoadingOnPageRestore.js` resets the flag on mount + `pageshow` + `popstate`, wired into all three steps. (3) **sign-out button** added to the layout header (icon + i18n label `sign_out`/`signing_out`, `aria-label`, `supabase.auth.signOut()` → `window.location.href='/auth/signin'`). (4) **`sg-availability` DB error no longer reads as sold-out** — route returns `{available_count:null}`+503 (not 0) + `await connection()`; the contact page treats a failed check as UNKNOWN (no waitlist, no Continue block). (5) **checkout robustness** — `fetchClientSecret` failures (incl. 409 already-subscribed) now show a recovery screen instead of a blank Stripe iframe; verify-poll has unmount-cancel + concurrency guards; success countdown resets + pluralizes. (6) **signin open-redirect** hardened (`redirect` param validated `startsWith('/') && !startsWith('//')`). (7) `checkout-session` `customer_email` falls back to `user.email`. Signin itself is NOT affected by the white-on-white bug — it hardcodes `text-[#0F172A] bg-white` on every input.)

**Earlier (2026-06-13)** (Onboarding-audit fix wave: DB rehydration via new `GET /api/onboarding/state` + page hydration effects; contact step reordered country→phone, phone no longer wiped on country change, empty phone no longer saved as bare prefix; `sms-confirm` validates E.164, sets `tenant_timezone` (SG pinned to Asia/Singapore, US/CA from browser-detected IANA zone), distinguishes 503 count-errors from 409 sold-out, and 400s when no tenant row exists; `/start` validates business_name/trade_type/services (min 1, max 50, urgency enum); checkout verify polling extended to ~3 min two-stage with a retry button on the error phase, success screen shows the provisioned number (10s countdown); checkout webhook seeds default working_hours + timezone backstop, provisioning is idempotent (SG inventory reuse + Twilio friendlyName tag `voco-tenant-{id}` reuse), sends an idempotent WelcomeEmail with the number, and dedupes the provisioning-failure email via billing_notifications. proxy.js rescues paid-but-unflagged users hitting /dashboard.)

---

## Architecture Overview

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

## File Map

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

## 1. Wizard Layout

**File**: `src/app/onboarding/layout.js`

`OnboardingLayout({ children })` — wraps everything in `OnboardingProvider`
(`./OnboardingContext`, which exposes `{ completed, markComplete }`; checkout's
success phase calls `markComplete()` so the `StepIndicator` flips all dots to
done). The inner `OnboardingLayoutInner`:
- Outer div carries **`data-onboarding-root`** — see the light-mode pin below.
- Logo link to `/`
- `StepIndicator` (icon dots, NOT a "Step X of 4" text counter): 4 lucide icons
  (Briefcase/Wrench/UserCircle/CreditCard) with connector lines; done = emerald
  check, current = copper ring, future = stone. `getStep(pathname)` maps path → 1–4.
- **Sign-out button** (right cluster, next to `StepIndicator`): `LogOut` icon +
  i18n label (`t('sign_out')` / `t('signing_out')`, hidden `<sm`), `aria-label`,
  `signingOut` state; `supabase.auth.signOut()` → `window.location.href='/auth/signin'`.
- White wizard card: `bg-white rounded-2xl shadow-[...] border border-stone-200/60`,
  wrapped in `<AnimatedSection>`.
- Mobile: full-width flat card (`max-sm:rounded-none max-sm:shadow-none max-sm:border-none`).

**Light-mode pin (dark-mode fix, 2026-06-26)**: dark mode is class-based
(`.dark` on `<html>`, persisted from the dashboard theme toggle) and onboarding
is a deliberately light-only surface (hardcoded `bg-white` card, `text-[#0F172A]`
headings). Form controls with no explicit text color (shadcn `<Input>`, the raw
phone `<input>`) inherit `--foreground`, which `.dark` flips to white → white text
on the white card. `globals.css` re-pins the light token set on
`[data-onboarding-root]` (`color-scheme: light` + `--foreground`/`--input`/`--ring`/
`--primary`/... = their `:root` light values), so the wizard always renders light.
The closer ancestor wins for inherited custom properties, so this overrides the
`.dark` on `<html>` for the subtree. **Known limit**: the country `<Select>`
dropdown is portaled to `document.body` (outside the root) and stays dark-themed
(readable, just inconsistent) — fix would need a portal `container` or a
light-forcing wrapper on `SelectContent`.

**Stuck-spinner guard (2026-06-26)**: steps 1/2/3 call
`useClearLoadingOnPageRestore(setLoading)` (`src/hooks/useClearLoadingOnPageRestore.js`)
— resets the nav `loading` flag on mount + `pageshow` + `popstate`. Without it, a
step that did `setLoading(true)` then `router.push()` on success reappears on Back
with the stale flag, leaving Continue disabled + spinning. Step 4 (checkout) uses a
`phase` state machine instead and is not wired.

Pathname → step mapping:
- `/onboarding` (profile) → Step 1
- `/onboarding/services` → Step 2
- `/onboarding/contact` (contact details) → Step 3
- `/onboarding/checkout` → Step 4

---

## 2. Wizard Steps

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

## 3. Onboarding Components

### `TestCallPanel({ phoneNumber, onComplete, onGoToDashboard, context })`

**File**: `src/components/onboarding/TestCallPanel.js`

State machine via `callState`:
- `'ready'` → button to trigger call
- `'calling'` → spinner (Loader2), then transitions to `in_progress` on API success
- `'in_progress'` → pulsing green phone icon + elapsed timer. **Polls from both 'calling' and 'in_progress' states** — catches fast-completing calls that skip the in_progress transition
- `'complete'` → renders `CelebrationOverlay` + "Go to Dashboard"
- `'timeout'` → alert + retry button (after 3 minutes)

**Polling**: `setInterval` at 4000ms. On `data.complete === true` → `clearInterval` + `setCallState('complete')` + `onComplete()`.

**Dual context**: `context` prop (`'onboarding'` or `'settings'`) renders different UI styles — compact inline for settings panel, full-page styling retained for legacy/post-payment surfaces. Component is no longer mounted by the onboarding wizard, but the `'onboarding'` style branch is kept in case the panel is reused elsewhere.

### `CelebrationOverlay()`

**File**: `src/components/onboarding/CelebrationOverlay.js`

Animated SVG checkmark + orange radial pulse rings.

```js
const prefersReducedMotion = useReducedMotion();
// ...
{!prefersReducedMotion && (
  <>
    <div className="animate-radial-pulse-1" ... />
    <div className="animate-radial-pulse-2" ... />
    <div className="animate-radial-pulse-3" ... />
  </>
)}
```

**Critical**: When `prefersReducedMotion` is true, the radial pulse `<div>` elements are **not rendered at all** (not just missing animation class). Avoids layout artifacts from invisible absolutely-positioned elements.

The checkmark SVG (`animate-draw-circle`, `animate-draw-check`) has `opacity-100` static class when reduced motion is active.

### `TradeSelector({ selected, onSelect })`

**File**: `src/components/onboarding/TradeSelector.js`

Grid of trade picker cards. Iterates `TRADE_TEMPLATES` entries, renders with icons:
```js
const TRADE_ICONS = { plumber: Wrench, hvac: Thermometer, electrician: Zap, general_handyman: Hammer };
```

`role="radiogroup"` + `role="radio"` + `aria-checked` for accessibility. Keyboard: Enter/Space to select. Selected state: `border-[#C2410C] bg-[#C2410C]/[0.04]` (from design-tokens `selected.card`).

### `OtpInput({ onComplete, disabled })`

**File**: `src/components/onboarding/OtpInput.js`

6 digit box inputs using `useRef` array. Auto-advances focus on digit entry. Backspace moves backward. Paste handler strips non-digits, fills all boxes.

Focus ring: `focus:border-[#C2410C] focus:ring-2 focus:ring-[#C2410C]/20` (no `ring-offset`) — eliminates white gap on dark card backgrounds (avoidance of Pitfall 7). Box styling: `bg-stone-50 border border-stone-300`.

Calls `onComplete(code)` when all 6 digits are filled.

---

## 4. Session Management

**File**: `src/hooks/useWizardSession.js`

### `useWizardSession(key, defaultValue)`

```js
// Usage:
const [trade, setTrade] = useWizardSession('trade', null);
// Stores as: sessionStorage.key = 'gsd_onboarding_trade'
```

- Storage key format: `gsd_onboarding_${key}` — prefix isolates wizard state from other sessionStorage keys
- Reads on mount (`useState(() => ...)` initializer), writes via `useEffect` when value changes
- `JSON.parse`/`JSON.stringify` for non-string values
- Graceful degradation: if `window === 'undefined'` (SSR) or `sessionStorage` throws, uses `defaultValue`

### `clearWizardSession()`

```js
export function clearWizardSession() {
  // Bulk-removes all keys starting with 'gsd_onboarding_'
  const keys = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k && k.startsWith('gsd_onboarding_')) keys.push(k);
  }
  keys.forEach((k) => sessionStorage.removeItem(k));
}
```

Called from `checkout/page.js` after Stripe Checkout completes and webhook verification succeeds.

---

## 5. API Routes

### `POST /api/onboarding/start`

**File**: `src/app/api/onboarding/start/route.js`

Handles two shapes:
1. **Business profile**: `{ business_name, tone_preset }` → upserts `tenants` row on `owner_id` conflict
2. **Trade + services**: `{ trade_type, services }` → updates `trade_type` on tenant, deletes existing services, inserts new ones

Returns `{ tenant_id }`.

**Validation (2026-06-13)** — these fields feed the AI prompt, so the server enforces:
- `business_name`: non-empty string, ≤120 chars (trimmed before save)
- `trade_type`: must be a TRADE_TEMPLATES key
- `services` (when present): non-empty array (an empty array would silently leave the tenant with zero services since replace = delete+insert), max 50, each `{name: non-empty ≤80 chars, urgency_tag?: emergency|urgent|routine}`. Delete now runs AFTER row construction and is error-checked, so a malformed payload can't wipe services and then fail the insert. The services page also disables Continue at zero services.

**Error**: If the trade+services shape is sent before the business profile shape (tenant not found) → `400: "Tenant not found. Complete step 1 first."`

### `POST /api/onboarding/provision-number` — DEPRECATED

**File**: `src/app/api/onboarding/provision-number/route.js`

**DEPRECATED**: Provisioning now happens in the Stripe webhook (`handleCheckoutCompleted`) after checkout success (D-10). This route is no longer called from the onboarding wizard. Retained for reference only.

### `POST /api/onboarding/sms-confirm`

**File**: `src/app/api/onboarding/sms-confirm/route.js`

Saves `owner_name` (if provided) + `owner_phone` (**required** since 2026-08-13: 400 "Please enter your phone number." when missing/empty; validated against `/^\+\d{7,15}$/` → 400 on bad format) + `owner_email` (from `user.email`) + `country` (if provided) + `tenant_timezone` in one round-trip. Timezone resolution (2026-06-13): SG is pinned to `Asia/Singapore`; US/CA use the browser-sent `timezone` body field when it's a valid IANA zone (validated via `Intl.DateTimeFormat`). Without this, every tenant kept the DB default `America/Chicago` and all slot math ran in the wrong timezone.

Error semantics:
- SG availability `countError` → **503** ("couldn't check availability") — distinct from genuine zero → **409** (waitlist). A DB hiccup must not block SG signups as "sold out".
- Tenant update is checked: DB error → 500; **0 rows matched → 400** "Tenant not found. Complete step 1 first." (previously returned `saved:true` while saving nothing, and the webhook later failed provisioning on `country=NULL`).

Returns `{ saved: true }`.

**Note**: `country` must be saved here (before plan selection) so the Stripe webhook can read `tenant.country` to determine provisioning strategy at checkout time (Pitfall 6 from RESEARCH.md).

### `GET /api/onboarding/state` (2026-06-13)

**File**: `src/app/api/onboarding/state/route.js`

Returns saved wizard progress for the signed-in user: `{ exists, business_name, trade_type, owner_name, owner_phone, country, services: [{name, urgency_tag}] }` (`{ exists: false }` when no tenant row). Wizard pages call this on mount when sessionStorage is empty (return visit / new device) and rehydrate instead of forcing re-entry. Saved services take priority over the trade template on the services page — a customized list must not be silently reset to defaults.

### `POST /api/onboarding/sms-verify`

**File**: `src/app/api/onboarding/sms-verify/route.js`

Phone OTP: calls `supabase.auth.signInWithOtp({ phone })`. Used for phone number verification flow (separate from email OTP in auth page).

### `POST /api/onboarding/test-call`

**File**: `src/app/api/onboarding/test-call/route.js`

Triggers a LiveKit SIP outbound call to `owner_phone` via `SipClient.createSipParticipant()` into a `test-call-<tenantId>-<ts>` room (metadata `{ test_call, tenant_id, to_number }`; SIP participant identity `caller-<owner_phone>`). Sets `tenants.test_call_status = 'calling'` — it no longer marks `test_call_completed` at trigger time; that now happens only on a **genuine connect**, set by the `/api/webhooks/livekit` `participant_joined` webhook. Returns `{ call_id: roomName }`. Called from `TestCallPanel` in dashboard settings (post-payment); no longer wired into the wizard.

### `GET /api/onboarding/test-call-status`

**File**: `src/app/api/onboarding/test-call-status/route.js`

Returns `{ complete, status, ever_completed, phone_number }`. `complete = test_call_status === 'connected'` — the CURRENT attempt actually connected (set by the LiveKit `/api/webhooks/livekit` webhook when the owner's SIP leg joins). `ever_completed = test_call_completed` (durable "ever connected", read by the setup checklist). Used by `TestCallPanel` to drive its polling state and to show the provisioned number.

### `GET /api/onboarding/sg-availability`

**File**: `src/app/api/onboarding/sg-availability/route.js`

Returns `{ available_count: number }` for Singapore phone numbers. Queries `phone_inventory` table with `country='SG'` and `status='available'`. No auth required — fires on country dropdown change (D-07) for immediate feedback. Uses service_role client with `count: 'exact', head: true`. Calls `await connection()` (from `next/server`) so the live count is never prerendered/frozen under `cacheComponents`.

**Error semantics (2026-06-26)**: on a DB error it returns `{ available_count: null, error: 'check_failed' }` with **503** — NOT `{ available_count: 0 }`. Returning `0` made a transient DB hiccup indistinguishable from genuinely sold-out, which flipped the contact page to the waitlist panel and disabled Continue with no recovery. The contact page now treats a non-OK response or `available_count == null` as **UNKNOWN** (no waitlist, no Continue block); the authoritative sold-out decision is made server-side at `sms-confirm` (409 sold-out vs 503 retry). Mirrors `sms-confirm`'s 503-vs-409 design.

### `POST /api/onboarding/sg-waitlist`

**File**: `src/app/api/onboarding/sg-waitlist/route.js`

Accepts `{ email }`, validates email format, inserts into `phone_inventory_waitlist` table. Returns `{ queued: true }`. Returns 400 on invalid email. Shown when available_count === 0 and user selects SG (D-08).

### `POST /api/onboarding/checkout-session`

**File**: `src/app/api/onboarding/checkout-session/route.js`

Creates a Stripe Checkout Session for the selected plan. Request: `{ plan: 'starter' | 'growth' | 'scale', interval?: 'monthly' | 'annual', embedded?: boolean }`. Response: `{ url: string }` or `{ clientSecret: string }` (embedded).

- Authenticates user via `createSupabaseServer()` + `getUser()`
- Looks up tenant via service role client (for `tenant_id`, `owner_email`)
- Maps plan + interval to price ID via `PRICE_MAP` (monthly/annual/overage per plan)
- **Two line items**: flat-rate plan price + metered overage price. The overage price (usage-based) has no upfront quantity — Stripe bills based on usage records reported by `call-processor.js` when `calls_used > calls_limit`
- Creates Checkout Session with: `mode: 'subscription'`, `payment_method_collection: 'always'` (CC required), `trial_period_days: 14`
- **Critical**: `metadata.tenant_id` set on BOTH the session and `subscription_data` — the webhook handler reads `subscription.metadata.tenant_id` to find which tenant the subscription belongs to
- Supports embedded mode (`ui_mode: 'embedded_page'` with `return_url`) and hosted mode (`success_url`/`cancel_url`)

### `POST /api/onboarding/complete`

**File**: `src/app/api/onboarding/complete/route.js`

Legacy manual fallback: sets `onboarding_complete = true` on tenants — but only after verifying that an `is_current = true` subscription row exists (subscription guard added 2026-03-28). `onboarding_complete` is normally set by the `checkout.session.completed` webhook handler; this route is retained as a backstop for direct API callers.

---

## 6. Country-Aware Provisioning

Phone number provisioning happens **after checkout success** (D-10) — never during wizard steps. This prevents wasting numbers on abandoned signups.

### Provisioning Strategy

| Country | Source | Method | When |
|---------|--------|--------|------|
| SG | `phone_inventory` table | `assign_sg_number` RPC (atomic, race-safe) | `checkout.session.completed` webhook |
| US | Twilio API | `twilio.incomingPhoneNumbers.create({ countryCode: 'US' })` then `configureNumberRouting` | `checkout.session.completed` webhook |
| CA | Twilio API | `twilio.incomingPhoneNumbers.create({ countryCode: 'CA' })` then `configureNumberRouting` | `checkout.session.completed` webhook |

**Why Twilio-direct for US/CA:** Purchasing via Twilio API gives us ownership of the number, enabling SMS access from tenant numbers.

**Routing — `configureNumberRouting(client, phoneNumber, numberSid)` (R2 fix):** Both SG and US/CA numbers go through this helper after provisioning. When `RAILWAY_WEBHOOK_URL` is set it points the number's `voiceUrl`/`voiceFallbackUrl`/`smsUrl` at the FastAPI webhook (`/twilio/incoming-call` etc.) **and removes the number from the Elastic SIP trunk** — so owner-pickup, VIP routing, the working-hours schedule, and the outbound-minute cap (all implemented only in the livekit webhook) run for the new tenant. **Twilio precedence:** a number on a SIP trunk *ignores* its `voiceUrl` (the trunk wins), so the trunk association MUST be removed for webhook routing to take effect — the prior "associate with the SIP trunk so calls route to LiveKit" behavior (trunk-only, no voice URLs) was the R2 regression that left the whole routing layer dead for new tenants. **Fail-safe:** if `RAILWAY_WEBHOOK_URL` is unset, the helper falls back to the legacy trunk-only association (AI answers directly via the trunk's LiveKit origination) rather than setting a broken `voiceUrl`. Idempotent: re-sets the same URLs and 404-tolerates the trunk removal on Stripe retries. (Existing pre-fix numbers are migrated by `scripts/cutover-existing-numbers.js`, which now also disassociates the trunk.)

### Webhook Handler Flow (`src/app/api/stripe/webhook/route.js`)

```
// In handleCheckoutCompleted, after onboarding_complete is set (2026-06-13 flow):
// 1. ACTIVATION SEEDING: if working_hours is NULL → seed trade-typical defaults
//    (plumber/hvac/electrician get Mon–Sat longer days; handyman Mon–Fri 8–5;
//    shape mirrors WorkingHoursEditor: day-keyed {open, close, enabled, lunchStart, lunchEnd}).
//    Without this the slot calculator returns ZERO slots and the AI cannot book.
//    Timezone backstop: SG tenants still on the DB default get Asia/Singapore.
//    Seed failures are non-fatal but Sentry-alerted.
// 2. PROVISIONING (idempotent — see below). On success the tenant update also
//    clears provisioning_failed; a failed write THROWS so Stripe retries (the
//    idempotency pre-checks make the retry reuse the same number).
// 3. WELCOME EMAIL (success path): React Email WelcomeEmail with the formatted
//    number, test-call + forwarding guidance, trial end date (event.created +
//    14d), dashboard link. Idempotent via billing_notifications type 'welcome'.
// 4. FAILURE EMAIL (failure path): provisioning_failed=true + Sentry alert +
//    owner email, deduped via billing_notifications type 'provisioning_failed'.
// THEN subscription sync runs
```

**Idempotency (2026-06-13):** Three layers — (a) skip provisioning if `phone_number` already set; (b) SG: reuse any `phone_inventory` row already `assigned` to this tenant before calling the (non-idempotent) `assign_sg_number` RPC; (c) US/CA: numbers are purchased with `friendlyName: voco-tenant-{tenantId}` and the webhook lists-by-friendlyName to reuse an existing purchase. Protects against the crash-after-provision-before-tenant-update retry buying/burning a second number.

**Failure handling:** If provisioning fails (SG inventory exhausted, Twilio API error), `provisioning_failed = true` is set on the tenant and Sentry is alerted. The subscription is still created — the tenant paid and deserves their subscription. Admin must follow up manually. The flag is user-visible: `/api/account` returns it, `AiNumberBanner` renders an amber "we hit a snag" alert state, and the account page replaces the "being assigned" copy with the same message.

**SG availability at wizard step (D-06/D-07):** The `GET /api/onboarding/sg-availability` route fires on country dropdown change (not step submit) for immediate feedback. This is a real-time count from `phone_inventory`. Note: availability can change between the step check and actual checkout — the `assign_sg_number` RPC handles the definitive race-safe assignment.

### Environment Variables for Provisioning

| Variable | Purpose |
|----------|---------|
| `LIVEKIT_URL` | LiveKit Cloud URL for test call route |
| `TWILIO_ACCOUNT_SID` | Twilio API for US/CA number purchase |
| `TWILIO_AUTH_TOKEN` | Twilio API auth |
| `LIVEKIT_API_KEY` | LiveKit API auth for test call |
| `LIVEKIT_API_SECRET` | LiveKit API auth for test call |
| `LIVEKIT_SIP_OUTBOUND_TRUNK_ID` | LiveKit outbound SIP trunk for test calls |
| `TWILIO_SIP_TRUNK_SID` | Elastic SIP trunk — numbers are removed FROM it for webhook routing; legacy/fallback association when `RAILWAY_WEBHOOK_URL` is unset |
| `RAILWAY_WEBHOOK_URL` | Base URL of the livekit FastAPI webhook — when set, new numbers route to `<url>/twilio/incoming-call` (+ off the trunk); when unset, trunk-only fallback. MUST be set in Vercel prod for the routing layer to run for new tenants |

---

## 8. Trade Templates

**File**: `src/lib/trade-templates.js`

```js
export const TRADE_TEMPLATES = {
  plumber: {
    label: 'Plumber',
    services: [
      { name: 'Gas Leak', urgency_tag: 'emergency' },
      { name: 'Burst Pipe', urgency_tag: 'emergency' },
      { name: 'Water Heater Replacement', urgency_tag: 'urgent' },
      { name: 'Drain Cleaning', urgency_tag: 'routine' },
      // ... (10 services total)
    ],
  },
  hvac: { ... },          // 10 services: 3 emergency, 2 urgent, 5 routine
  electrician: { ... },   // 10 services: 3 emergency, 3 urgent, 4 routine
  general_handyman: { ... } // 10 services: 1 emergency, 2 urgent, 7 routine
};
```

Used in: profile page (pre-populates services on trade select), services page (initial state from sessionStorage or TRADE_TEMPLATES), TradeSelector (iterates keys for the picker grid).

Services list is editable in Step 3 — user can add/remove before saving.

---

## 9. Proxy Auth Guards

**File**: `src/proxy.js` (Next 16 proxy convention — NOT `src/middleware.js`; see auth-database-multitenancy skill)

```js
const AUTH_REQUIRED_PATHS = [
  '/onboarding',
  '/dashboard',
];
```

**IMPORTANT**: `/auth/signin` is NOT in `AUTH_REQUIRED_PATHS` — it's the public auth step. The `AUTH_REQUIRED_PATHS` check uses `pathname === p || pathname.startsWith(p + '/')` — so `/onboarding` itself (the profile page) IS auth-protected.

**Logic flow:**
1. Unauthenticated on auth-required path → redirect to `/auth/signin`
2. Authenticated on `/auth/signin` → redirect to `/onboarding` (not onboarded) or `/dashboard` (onboarded)
3. Authenticated on `/onboarding*` paths + `onboarding_complete === true` → redirect to `/dashboard`
4. Authenticated on `/dashboard*` paths + `onboarding_complete !== true` → **paid-user rescue first (2026-06-13)**: a service-role query checks for an `is_current` subscription with status active/trialing/past_due; if found, the proxy repairs `onboarding_complete = true` and lets the request through (a delayed `checkout.session.completed` webhook must not bounce a paying customer back to wizard Step 1). Otherwise → redirect to `/onboarding`

**Onboarding check is ONLY run for `/onboarding*` paths** — not `/dashboard`. This avoids an unnecessary DB query on every dashboard page load.

**OAuth callback**: `src/app/auth/callback/route.js` — default redirect target is `/onboarding` (no `next` param). Google OAuth users land on `/onboarding` after token exchange, which is Step 1 (profile) — they skip the auth prerequisite because Google already authenticated them.

---

## 10. Database Tables — Onboarding-Relevant Columns

### `tenants` table (onboarding-relevant columns)

| Column | Type | Notes |
|--------|------|-------|
| `owner_id` | uuid | Supabase auth user ID (unique, conflict target for upsert) |
| `owner_email` | text | Saved in sms-confirm route from `user.email` |
| `owner_name` | text | Saved in sms-confirm route from Your Details step (Phase 27) |
| `owner_phone` | text | Saved in sms-confirm route from wizard input (E.164 format) |
| `country` | text | 'SG' | 'US' | 'CA' — saved in sms-confirm route, read by checkout webhook for provisioning (Phase 27) |
| `business_name` | text | Required for AI prompt — set in Step 1 |
| `trade_type` | text | Set in Step 1 via /start route |
| `tone_preset` | text | Default 'professional', set in Step 1 |
| `phone_number` | text | Provisioned number — set by checkout webhook after Stripe payment (Phase 27) |
| `onboarding_complete` | boolean | Set by checkout.session.completed webhook after Stripe payment |
| `provisioning_failed` | boolean | Set by checkout webhook when phone provisioning fails (admin follow-up needed) (Phase 27) |
| `test_call_completed` | boolean | "Test call ever connected" — set by the LiveKit `/api/webhooks/livekit` participant_joined webhook on a genuine connect (no longer at trigger time). Gates the setup checklist's `make_test_call` item |
| `test_call_status` | text | Live state of the current test attempt: none\|calling\|connected\|failed (migration 077). `/api/onboarding/test-call` sets `calling`; the LiveKit webhook sets `connected` |
| `test_call_last_at` | timestamptz | Timestamp of the last test call that actually connected (migration 077) |

### `phone_inventory` table

Pre-purchased SG phone numbers managed by admin.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `phone_number` | text | E.164 format, unique |
| `country` | text | 'SG' (only SG numbers in inventory; US/CA provisioned on-demand) |
| `status` | text | 'available' | 'assigned' | 'retired' |
| `assigned_tenant_id` | uuid | FK to tenants.id; NULL when status='available' |
| `created_at` | timestamptz | For ordering (FIFO assignment) |

**Assignment is race-safe:** `assign_sg_number(p_tenant_id uuid)` RPC uses `SELECT ... FOR UPDATE SKIP LOCKED` inside an UPDATE, preventing double-assignment on concurrent checkouts.

### `phone_inventory_waitlist` table

SG waitlist signups when inventory is exhausted.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `email` | text | Waitlist email address |
| `country` | text | Always 'SG' |
| `created_at` | timestamptz | Signup timestamp |
| `notified_at` | timestamptz | NULL until admin notifies; enables future automated notification |

### `services` table

Populated during Step 1 (profile) and optionally modified in Step 2 (services). Each service: `{ tenant_id, name, urgency_tag }`. Pre-populated from TRADE_TEMPLATES.

---

## 11. Environment Variables

| Variable | Service | Purpose |
|----------|---------|---------|
| `LIVEKIT_URL` | LiveKit | LiveKit Cloud URL for test call route |
| `LIVEKIT_API_KEY` | LiveKit | API authentication for SipClient + RoomServiceClient |
| `LIVEKIT_API_SECRET` | LiveKit | API authentication |
| `LIVEKIT_SIP_OUTBOUND_TRUNK_ID` | LiveKit | Outbound SIP trunk ID for test calls |
| `TWILIO_SIP_TRUNK_SID` | Twilio | Elastic SIP trunk for number association during provisioning |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Client-side auth + browser client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Client-side auth + browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Server-side routes (sms-confirm, start, complete, sg-availability) |
| `TWILIO_ACCOUNT_SID` | Twilio | US/CA number purchase via `incomingPhoneNumbers.create()` + SMS OTP |
| `TWILIO_AUTH_TOKEN` | Twilio | US/CA number purchase + SMS OTP auth |
| `TWILIO_FROM_NUMBER` | Twilio | SMS sender |
| `STRIPE_SECRET_KEY` | Stripe | Stripe SDK initialization (server-side only) |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Webhook signature verification |
| `STRIPE_PRICE_STARTER` | Stripe | Price ID for Starter plan ($99/mo) |
| `STRIPE_PRICE_GROWTH` | Stripe | Price ID for Growth plan ($249/mo) |
| `STRIPE_PRICE_SCALE` | Stripe | Price ID for Scale plan ($599/mo) |
| `NEXT_PUBLIC_APP_URL` | App | Base URL for Checkout success/cancel redirects |

---

## 12. Key Design Decisions

- **`signUp()` sends OTP email directly — no separate `signInWithOtp()` call**: Supabase's `signUp()` already triggers the confirmation email when email confirmation is enabled. Calling `signInWithOtp()` immediately after `signUp()` triggers Supabase rate limiting (error contains "after"), which was incorrectly displayed as "Please wait a moment before trying again." The resend button on the OTP view still uses `signInWithOtp({ shouldCreateUser: true })` for re-sending.

- **OTP phase uses `useState` toggle (not `router.push`)**: On the auth page, switching from email input to OTP input uses a state toggle. `router.push` would cause a layout re-mount and the onboarding progress bar would reset/flicker — the wizard card would briefly disappear and re-render.

- **Two sequential POSTs to `/api/onboarding/start`**: Step 1 (profile) makes two calls — first `{ business_name, tone_preset }` to upsert the tenant, then `{ trade_type, services }` to save trade and services. The second call depends on the tenant row existing. If combined into one request, a race condition could occur if the tenant lookup happens before the upsert completes.

- **`onboarding_complete` set by checkout.session.completed webhook (Phase 27)**: `onboarding_complete` is set after successful Stripe payment. The test call step (Step 4) happens before checkout. Phone provisioning also runs in this same webhook handler, ensuring both subscription creation and number assignment happen atomically after the user pays.

- **Phone provisioning deferred to post-checkout (D-10)**: Numbers are NOT provisioned during wizard steps. This prevents wasting inventory or incurring Twilio API costs on abandoned signups. `tenant.country` must be saved by the sms-confirm route before checkout so the webhook can read it.

- **US/CA provisioned via Twilio API, then routed via `configureNumberRouting`**: Twilio-direct purchase gives ownership of the number, enabling SMS access. After purchase, the number is routed to the FastAPI webhook (`voiceUrl`/`voiceFallbackUrl`/`smsUrl` set + removed from the SIP trunk) when `RAILWAY_WEBHOOK_URL` is set, else trunk-only AI-direct fallback. A trunk-associated number ignores its `voiceUrl` (trunk wins), so the trunk MUST be disassociated for webhook routing — this is the R2 fix; the prior trunk-only provisioning left owner-pickup/VIP/schedule/cap dead for new tenants.

- **SG race protection via SECURITY DEFINER RPC**: The `assign_sg_number(p_tenant_id)` function uses `SELECT ... FOR UPDATE SKIP LOCKED` inside an UPDATE subquery. Concurrent checkout webhooks for SG tenants cannot double-assign the same number. Returns empty set if no numbers available.

- **`provisioning_failed` flag for admin follow-up**: When SG inventory is exhausted at checkout time (race between wizard availability check and actual checkout), the webhook sets `provisioning_failed = true` rather than throwing an error. The subscription is still created — the user paid and deserves their subscription. Admin must manually assign a number.

- **`useWizardSession` uses `gsd_onboarding_` prefix**: Prefix isolates wizard sessionStorage keys from other app state. `clearWizardSession()` can bulk-delete all wizard keys with a single `startsWith` check.

- **OAuth callback default is `/onboarding`**: Google OAuth users skip the auth prerequisite (already done via Google). They land directly on Step 1 (profile). The callback route uses `next || '/onboarding'` as the default.

- **`TestCallPanel` polls from both 'calling' and 'in_progress' states**: Polling starts when call is triggered (`'calling'`) and continues through `'in_progress'`. This catches fast-completing calls that may complete before the state transitions from 'calling' to 'in_progress'.

- **`AUTH_REQUIRED_PATHS` excludes `/onboarding` root (but includes it via `pathname === p`)**:The exact path `/onboarding` IS protected (user must be authenticated to reach the profile/trade step). The `/auth/signin` page is not in the list — it's the entry point for unauthenticated users.

- **Middleware checks `onboarding_complete` on `/onboarding*` paths only**: Checking on every dashboard page load would add a DB round-trip to every authenticated request. The check is scoped to `/onboarding*` paths where the redirect logic is actually needed.

- **`CelebrationOverlay` skips rendering radial pulse divs entirely**: When `prefers-reduced-motion` is active, the three pulse `<div>` elements are not rendered at all (conditional `{!prefersReducedMotion && ...}`). Removing just the animation class would leave absolutely-positioned invisible elements that could cause layout artifacts.

---

## Cross-Domain References

- **LiveKit test call + provisioning**: See `voice-call-architecture` skill for how the test call triggers the LiveKit agent and how the post-call pipeline processes the call. Phone provisioning is documented in the Stripe webhook handler section of that skill.
- **Auth + Supabase clients**: See `auth-database-multitenancy` skill for `createSupabaseServer()` vs `supabase` (service role) patterns, and `getTenantId()`.
- **Design tokens**: See `dashboard-crm-system` skill for the shared `src/lib/design-tokens.js` token system — both onboarding and dashboard use these brand colors.

---

## Important: Keeping This Document Updated

When making changes to any file listed in the File Map above, update the relevant sections of this skill document to reflect the new behavior. This ensures future conversations always have an accurate reference.
