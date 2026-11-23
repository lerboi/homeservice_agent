---
type: system
system: Onboarding
status: legacy-app
description: "Phone number provisioning happens after checkout success (D-10) — never during wizard steps. This prevents wasting numbers on abandoned signups. Covers: Provisioning Strategy; Webhook Handler Flow (`src/app/api/stripe/webhook/route.js`); Environment Variables for Provisioning"
source: .claude/skills/onboarding-flow/SKILL.md § 6. Country-Aware Provisioning
migrated: 2026-11-23
verified:
tags: [voco/system/onboarding]
---

# Country-Aware Provisioning

Part of [[Onboarding]]. Migrated verbatim from the `onboarding-flow` skill; check `verified` before trusting details.

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
