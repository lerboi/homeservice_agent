---
name: onboarding-flow
description: "Complete architectural reference for the onboarding wizard — 4-step signup flow, all onboarding API routes, Retell phone provisioning, trade templates, test call, session persistence, and middleware auth guards. Use this skill whenever making changes to the onboarding wizard, signup flow, phone provisioning, trade templates, test call functionality, or wizard session management. Also use when the user asks about how onboarding works, wants to modify wizard steps, or needs to debug provisioning or OTP issues."
---

# Onboarding Flow — Complete Reference

This document is the single source of truth for the onboarding wizard system. Read this before making any changes to onboarding pages, wizard session management, or provisioning routes.

**Last updated**: 2026-03-25 (Phase 7 — unified signup and onboarding wizard, Phase 13 — auth page redesign)

---

## Architecture Overview

| Step | Route | Purpose |
|------|-------|---------|
| **Step 1: Auth** | `/auth/signin` | Email OTP signup/signin (public) |
| **Step 2: Profile** | `/onboarding` (page.js) | Trade selector + business name + 2x POST to /start |
| **Step 3: Services** | `/onboarding/services` | Edit pre-populated service list from TRADE_TEMPLATES |
| **Step 4: Contact** | `/onboarding/contact` | Owner phone number → sms-confirm saves owner_phone |
| **Step 5: Test Call** | `/onboarding/test-call` | TestCallPanel → Retell dials owner → webhook sets onboarding_complete |
| **Step 6: Complete** | `/onboarding/complete` | Redirects to `/dashboard` |

```
User lands on /auth/signin
       ↓
  Email + OTP signup (Supabase Auth)
       ↓  (Google OAuth → /auth/callback → /onboarding, skips Step 1)
  /onboarding (Step 2: Profile)
  → POST /api/onboarding/start (business_name + tone_preset) → tenant upserted
  → POST /api/onboarding/start (trade_type + services) → services inserted
       ↓
  /onboarding/services (Step 3: Services)
  → POST /api/onboarding/start (trade_type + services) → services replaced
       ↓
  /onboarding/contact (Step 4: Contact)
  → POST /api/onboarding/sms-confirm → owner_phone + owner_email saved
       ↓
  /onboarding/test-call (Step 5: Test Call)
  → POST /api/onboarding/test-call → Retell dials owner_phone
  → Poll /api/onboarding/test-call-status (4s interval)
  → Retell webhook fires on call completion → sets onboarding_complete = true
       ↓
  /dashboard
```

Layout: `onboarding/layout.js` wraps all wizard steps with logo, step counter, orange progress bar, and wizard card.

---

## File Map

| File | Role |
|------|------|
| `src/app/onboarding/layout.js` | Wizard layout: logo, step counter, progress bar, white card |
| `src/app/onboarding/page.js` | Step 2: Trade selector + business name (profile) |
| `src/app/onboarding/services/page.js` | Step 3: Service list edit from TRADE_TEMPLATES |
| `src/app/onboarding/contact/page.js` | Step 4: Owner phone number collection |
| `src/app/onboarding/test-call/page.js` | Step 5: TestCallPanel + phone number display |
| `src/app/onboarding/complete/page.js` | Redirect to /dashboard |
| `src/app/onboarding/profile/page.js` | Redirect to /onboarding (legacy URL compatibility) |
| `src/app/onboarding/verify/page.js` | Redirect to /onboarding/contact (legacy URL compatibility) |
| `src/app/auth/signin/page.js` | Step 1: Auth page (email signup + OTP) |
| `src/app/auth/callback/route.js` | OAuth callback: exchanges code, redirects to /onboarding |
| `src/components/onboarding/TestCallPanel.js` | Polling call state machine (ready/calling/in_progress/complete/timeout) |
| `src/components/onboarding/CelebrationOverlay.js` | Animated checkmark + radial pulse rings |
| `src/components/onboarding/TradeSelector.js` | Trade picker grid (plumber/hvac/electrician/handyman) |
| `src/components/onboarding/OtpInput.js` | 6-digit OTP box inputs |
| `src/hooks/useWizardSession.js` | `useWizardSession(key, default)` + `clearWizardSession()` |
| `src/app/api/onboarding/start/route.js` | POST: create/upsert tenant, save trade+services |
| `src/app/api/onboarding/provision-number/route.js` | POST: Retell phone number provisioning |
| `src/app/api/onboarding/sms-confirm/route.js` | POST: save owner_phone + owner_email in one round-trip |
| `src/app/api/onboarding/sms-verify/route.js` | POST: phone OTP verification (signInWithOtp) |
| `src/app/api/onboarding/test-call/route.js` | POST: trigger Retell outbound test call |
| `src/app/api/onboarding/test-call-status/route.js` | GET: poll for onboarding_complete + retell_phone_number |
| `src/app/api/onboarding/complete/route.js` | POST: set onboarding_complete = true (manual fallback) |
| `src/lib/trade-templates.js` | TRADE_TEMPLATES map (4 trades × ~10 services each) |
| `src/middleware.js` | Auth guards, onboarding_complete redirect logic |

---

## 1. Wizard Layout

**File**: `src/app/onboarding/layout.js`

`OnboardingLayout({ children })` — wraps all steps:
- Logo link to `/`
- Step counter: "Step X of 4" (4 tracked steps: / , /services, /contact, /test-call)
- Orange progress bar: `width: (currentStep / TOTAL_STEPS) * 100%`, `transition-all duration-500 ease-out`
- White wizard card: `bg-white rounded-2xl shadow-[...] border border-stone-200/60`
- Mobile: full-width flat card (`max-sm:rounded-none max-sm:shadow-none max-sm:border-none`)

`getStep(pathname)` maps path to 1–4 for progress bar.

---

## 2. Wizard Steps

### Step 1: Auth (`/auth/signin`)

**File**: `src/app/auth/signin/page.js`

Three conditional render branches (NOT tabs) for structurally distinct layouts:
- **Signup** (default): Split layout, email input, "Send Code" → calls `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })` wait — actually Step 1 creates the user
- **OTP**: Centered dark card with `OtpInput` component — toggles via `useState` (NOT `router.push`) to avoid layout re-mount and progress bar flicker
- **Signin**: Compact layout for returning users

**Key**: OTP phase uses `useState` toggle, NOT router navigation. Keeps the user in the same wizard card.

### Step 2: Profile (`/onboarding/page.js`)

**File**: `src/app/onboarding/page.js`

State from `useWizardSession`: `trade`, `business_name`.

Two sequential POSTs to `/api/onboarding/start`:
1. `{ business_name, tone_preset: 'professional' }` → upserts tenant (must happen first so tenant row exists)
2. `{ trade_type: trade, services: TRADE_TEMPLATES[trade].services }` → updates trade + inserts services

UI: `TradeSelector` grid, then `Input` for business name revealed after trade selected. Both fields required. Navigates to `/onboarding/services` on success.

### Step 3: Services (`/onboarding/services/page.js`)

**File**: `src/app/onboarding/services/page.js`

Editable service list pre-populated from `TRADE_TEMPLATES[trade]`. User can remove services or add custom ones (new service gets `urgency_tag: 'routine'`). Services stored in wizard session via `useWizardSession('services', ...)`.

On submit: POST `/api/onboarding/start` with `{ trade_type, services }` (replaces existing services via delete + re-insert). Navigates to `/onboarding/contact`.

### Step 4: Contact (`/onboarding/contact/page.js`)

**File**: `src/app/onboarding/contact/page.js`

Collects `owner_phone` (optional). On submit: POST `/api/onboarding/sms-confirm` with `{ phone }`. The API saves both `owner_phone` (if provided) and `owner_email` (from `user.email`) in a single round-trip. Navigates to `/onboarding/test-call`.

### Step 5: Test Call (`/onboarding/test-call/page.js`)

**File**: `src/app/onboarding/test-call/page.js`

On mount: fetches `GET /api/onboarding/test-call-status` to get provisioned phone number. Shows phone number in display + `TestCallPanel`. If no phone provisioned, shows "You're all set" fallback with direct "Go to Dashboard" button (calls `/api/onboarding/complete` POST to set onboarding_complete).

`handleComplete()` and `handleGoToDashboard()` both call `clearWizardSession()` to bulk-remove all `gsd_onboarding_*` keys from sessionStorage.

### Step 6: Complete (`/onboarding/complete/page.js`)

Simple redirect to `/dashboard`.

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

**Dual context**: `context` prop (`'onboarding'` or `'settings'`) renders different UI styles — compact inline for settings panel, full-page for wizard.

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

Called from `test-call/page.js` when user completes or skips to dashboard.

---

## 5. API Routes

### `POST /api/onboarding/start`

**File**: `src/app/api/onboarding/start/route.js`

Handles two shapes:
1. **Business profile**: `{ business_name, tone_preset }` → upserts `tenants` row on `owner_id` conflict
2. **Trade + services**: `{ trade_type, services }` → updates `trade_type` on tenant, deletes existing services, inserts new ones

Returns `{ tenant_id }`.

**Error**: If Step 2 is called before Step 1 (tenant not found) → `400: "Tenant not found. Complete step 1 first."`

### `POST /api/onboarding/provision-number`

**File**: `src/app/api/onboarding/provision-number/route.js`

Calls `retell.phoneNumber.create({})` → saves `retell_phone_number` on tenant. Returns `{ phone_number, phone_number_pretty }`.

### `POST /api/onboarding/sms-confirm`

**File**: `src/app/api/onboarding/sms-confirm/route.js`

Saves `owner_phone` (if provided) + `owner_email` (from `user.email`) in one round-trip:
```js
const updateFields = { owner_email: user.email };
if (phone?.trim()) updateFields.owner_phone = phone.trim();
await adminSupabase.from('tenants').update(updateFields).eq('owner_id', user.id);
```
Returns `{ saved: true }`.

### `POST /api/onboarding/sms-verify`

**File**: `src/app/api/onboarding/sms-verify/route.js`

Phone OTP: calls `supabase.auth.signInWithOtp({ phone })`. Used for phone number verification flow (separate from email OTP in auth page).

### `POST /api/onboarding/test-call`

**File**: `src/app/api/onboarding/test-call/route.js`

Fetches `retell_phone_number`, `owner_phone`, `business_name`, `tone_preset` from tenant. Calls:
```js
retell.call.createPhoneCall({
  from_number: tenant.retell_phone_number,
  to_number: tenant.owner_phone,
  retell_llm_dynamic_variables: {
    business_name: tenant.business_name,
    onboarding_complete: true,   // keeps AI in booking-enabled mode during test
    tone_preset: tenant.tone_preset,
  },
});
```

Sets `test_call_completed: true` on tenant (tracks trigger, not completion). `onboarding_complete` is set by Retell webhook on call completion — NOT here.

Returns `{ call_id }`.

### `GET /api/onboarding/test-call-status`

**File**: `src/app/api/onboarding/test-call-status/route.js`

Returns `{ complete: boolean, retell_phone_number: string | null }` from tenants row. Used by `TestCallPanel` polling (every 4s) and by test-call page on mount.

### `POST /api/onboarding/complete`

**File**: `src/app/api/onboarding/complete/route.js`

Manual fallback: sets `onboarding_complete = true` on tenants. Used when user skips test call (no phone provisioned) or bypasses wizard.

---

## 6. Trade Templates

**File**: `src/lib/trade-templates.js`

```js
export const TRADE_TEMPLATES = {
  plumber: {
    label: 'Plumber',
    services: [
      { name: 'Gas Leak', urgency_tag: 'emergency' },
      { name: 'Burst Pipe', urgency_tag: 'emergency' },
      { name: 'Water Heater Replacement', urgency_tag: 'high_ticket' },
      { name: 'Drain Cleaning', urgency_tag: 'routine' },
      // ... (10 services total)
    ],
  },
  hvac: { ... },          // 10 services: 3 emergency, 2 high_ticket, 5 routine
  electrician: { ... },   // 10 services: 3 emergency, 3 high_ticket, 4 routine
  general_handyman: { ... } // 10 services: 1 emergency, 2 high_ticket, 7 routine
};
```

Used in: profile page (pre-populates services on trade select), services page (initial state from sessionStorage or TRADE_TEMPLATES), TradeSelector (iterates keys for the picker grid).

Services list is editable in Step 3 — user can add/remove before saving.

---

## 7. Middleware Auth Guards

**File**: `src/middleware.js`

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
4. Authenticated on `/dashboard*` paths + `onboarding_complete !== true` → redirect to `/onboarding`

**Onboarding check is ONLY run for `/onboarding*` paths** — not `/dashboard`. This avoids an unnecessary DB query on every dashboard page load.

**OAuth callback**: `src/app/auth/callback/route.js` — default redirect target is `/onboarding` (no `next` param). Google OAuth users land on `/onboarding` after token exchange, which is Step 2 (profile) — they skip Step 1 because Google already authenticated them.

---

## 8. Database Tables — Onboarding-Relevant Columns

### `tenants` table (onboarding-relevant columns)

| Column | Type | Notes |
|--------|------|-------|
| `owner_id` | uuid | Supabase auth user ID (unique, conflict target for upsert) |
| `owner_email` | text | Saved in sms-confirm route from `user.email` |
| `owner_phone` | text | Saved in sms-confirm route from wizard input |
| `business_name` | text | Required for AI prompt — set in Step 2 |
| `trade_type` | text | Set in Step 2 via /start route |
| `tone_preset` | text | Default 'professional', set in Step 2 |
| `retell_phone_number` | text | Provisioned number from Retell, shown in Step 5 |
| `onboarding_complete` | boolean | Set by Retell webhook on test call completion |
| `test_call_completed` | boolean | Set by /test-call route at trigger time |

### `services` table

Populated during Step 2 (profile) and optionally modified in Step 3 (services). Each service: `{ tenant_id, name, urgency_tag }`. Pre-populated from TRADE_TEMPLATES.

---

## 9. Environment Variables

| Variable | Service | Purpose |
|----------|---------|---------|
| `RETELL_API_KEY` | Retell | Phone number provisioning + test call trigger |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Client-side auth + browser client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Client-side auth + browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Server-side routes (sms-confirm, start, complete) |
| `TWILIO_ACCOUNT_SID` | Twilio | SMS OTP (sms-verify route) |
| `TWILIO_AUTH_TOKEN` | Twilio | SMS OTP |
| `TWILIO_FROM_NUMBER` | Twilio | SMS sender |

---

## 10. Key Design Decisions

- **`shouldCreateUser: false` on `signInWithOtp`**: Prevents a second user row being created when OTP is sent after initial `signUp`. Without this flag, Supabase creates a duplicate user entry (Research Pitfall 2 from Phase 7).

- **OTP phase uses `useState` toggle (not `router.push`)**: On the auth page, switching from email input to OTP input uses a state toggle. `router.push` would cause a layout re-mount and the onboarding progress bar would reset/flicker — the wizard card would briefly disappear and re-render.

- **Two sequential POSTs to `/api/onboarding/start`**: Step 2 makes two calls — first `{ business_name, tone_preset }` to upsert the tenant, then `{ trade_type, services }` to save trade and services. The second call depends on the tenant row existing. If combined into one request, a race condition could occur if the tenant lookup happens before the upsert completes.

- **`onboarding_complete` set on webhook callback, NOT at test call trigger time**: The `/api/onboarding/test-call` route only sets `test_call_completed: true` (acknowledges trigger). `onboarding_complete` is set by the Retell `call_analyzed` webhook when the test call actually completes. Setting it prematurely (at trigger) would incorrectly mark the wizard done before the AI has been verified working.

- **`retell_llm_dynamic_variables` keeps `onboarding_complete: true` for test call**: Even though the DB flag isn't set yet, the dynamic variable is passed as `true` during the test call. This enables the AI's BOOKING-FIRST PROTOCOL during the test — separate concern from the DB wizard completion flag.

- **`useWizardSession` uses `gsd_onboarding_` prefix**: Prefix isolates wizard sessionStorage keys from other app state. `clearWizardSession()` can bulk-delete all wizard keys with a single `startsWith` check.

- **OAuth callback default is `/onboarding`**: Google OAuth users skip Step 1 (auth is already done via Google). They land directly on Step 2 (profile). The callback route uses `next || '/onboarding'` as the default.

- **`TestCallPanel` polls from both 'calling' and 'in_progress' states**: Polling starts when call is triggered (`'calling'`) and continues through `'in_progress'`. This catches fast-completing calls that may complete before the state transitions from 'calling' to 'in_progress'.

- **`AUTH_REQUIRED_PATHS` excludes `/onboarding` root (but includes it via `pathname === p`)**:The exact path `/onboarding` IS protected (user must be authenticated to reach the profile/trade step). The `/auth/signin` page is not in the list — it's the entry point for unauthenticated users.

- **Middleware checks `onboarding_complete` on `/onboarding*` paths only**: Checking on every dashboard page load would add a DB round-trip to every authenticated request. The check is scoped to `/onboarding*` paths where the redirect logic is actually needed.

- **`CelebrationOverlay` skips rendering radial pulse divs entirely**: When `prefers-reduced-motion` is active, the three pulse `<div>` elements are not rendered at all (conditional `{!prefersReducedMotion && ...}`). Removing just the animation class would leave absolutely-positioned invisible elements that could cause layout artifacts.

---

## Cross-Domain References

- **Retell provisioning + test call**: See `voice-call-architecture` skill for how the test call triggers the WebSocket server, and how `call_analyzed` webhook sets `onboarding_complete`.
- **Auth + Supabase clients**: See `auth-database-multitenancy` skill for `createSupabaseServer()` vs `supabase` (service role) patterns, and `getTenantId()`.
- **Design tokens**: See `dashboard-crm-system` skill for the shared `src/lib/design-tokens.js` token system — both onboarding and dashboard use these brand colors.

---

## Important: Keeping This Document Updated

When making changes to any file listed in the File Map above, update the relevant sections of this skill document to reflect the new behavior. This ensures future conversations always have an accurate reference.
