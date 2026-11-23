---
type: system
system: Onboarding
status: legacy-app
description: "HTTP routes belonging to Onboarding: methods, parameters and behaviour. Covers: `POST /api/onboarding/start`; `POST /api/onboarding/provision-number` — DEPRECATED; `POST /api/onboarding/sms-confirm`; `GET /api/onboarding/state` (2026-06-13); `POST /api/onboarding/sms-verify`; `POST /api/onboarding/t"
source: .claude/skills/onboarding-flow/SKILL.md § 5. API Routes
migrated: 2026-11-23
verified:
tags: [voco/system/onboarding]
---

# API Routes

Part of [[Onboarding]]. Migrated verbatim from the `onboarding-flow` skill; check `verified` before trusting details.

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
