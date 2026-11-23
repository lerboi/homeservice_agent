---
type: system
system: Onboarding
status: legacy-app
description: "signUp() sends OTP email directly — no separate signInWithOtp() call: Supabase's signUp() already triggers the confirmation email when email confirmation is …"
source: .claude/skills/onboarding-flow/SKILL.md § 12. Key Design Decisions
migrated: 2026-11-23
verified:
tags: [voco/system/onboarding]
---

# Key Design Decisions

Part of [[Onboarding]]. Migrated verbatim from the `onboarding-flow` skill; check `verified` before trusting details.

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
