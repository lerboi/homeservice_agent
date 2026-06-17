# Voco Onboarding Journey Audit — Findings & Change Plan

**Date:** 2026-06-12 (audit) · 2026-06-13 (fix wave implemented)
**Scope:** The complete new-customer journey: landing page → pricing → signup/auth → onboarding wizard (4 steps) → Stripe checkout → phone provisioning → dashboard first-run → first live call readiness.
**Status:** CRITICAL + HIGH FIXES IMPLEMENTED 2026-06-13 (uncommitted): C1-code (sms-confirm 503-vs-409), C2 (webhook seeds trade-default working hours), C3 (timezone via sms-confirm browser-IANA + SG webhook backstop), C5 (two-stage ~3min polling + retry button + proxy paid-user rescue), C6 (provisioning_failed banner/account copy + Sentry alert + idempotent failure email), C7 copy-first (all 70+/Mandarin/Singlish/Hokkien claims cut to EN+ES across landing, FAQ, FeaturesGrid, comparisons.js, glossary.js, chatbot knowledge; stale "Powered by Gemini" line removed), H1 (buildE164 empty guard + server E.164 validation), H2 (country above phone, no wipe), H3 (WelcomeEmail with number + success-screen number display, 10s countdown), H4 (GET /api/onboarding/state + 3-page hydration), H6 (hero CTA → /pricing), H7 (services validation + min-1 + ordered delete), H8 (SG inventory reuse + Twilio friendlyName voco-tenant-{id} reuse). Skills synced (onboarding-flow, payment-architecture, dashboard-crm-system, public-site-i18n). Verified: lint clean (pre-existing setMounted warnings remain), `next build` exit 0, related jest suites pass (4 failing suites are pre-existing: stale @/lib/retell mocks + incomplete supabase mocks in untouched routes).
**STILL OPEN:** C1-ops (restock SG phone_inventory — funnel still closed for SG until done), C4 (call-forwarding activation guide/screen — biggest remaining value gap), C6.5 (resolve the existing provisioning_failed tenant), H5 (SIP-trunk-failure flag — needs migration 072 `routing_pending` column), all M/L items, marketing PDF script "no credit card" claim.

---

## 0. How to read this file (context for a fresh session)

Voco is a Next.js SaaS that gives home service businesses (plumbers, HVAC, electricians, handymen) an AI phone receptionist. The AI answers calls 24/7 via Twilio SIP → LiveKit → a Python agent (sibling repo at `C:\Users\leheh\.Projects\livekit-agent`, deployed on Railway) running a **cascade pipeline (Phase 66): Deepgram nova-3 STT (`language=multi`) → gpt-4.1-mini LLM → ElevenLabs eleven_flash_v2_5 TTS**. Billing is Stripe (14-day trial, card required, $99/$249/$599 plans). DB is Supabase (project `exbzhmparzjlpkryeiso`).

The onboarding journey today:

```
Landing (/) → Pricing (/pricing, tier CTA → /onboarding?plan=X&interval=Y)
  → proxy.js guard redirects unauthed → /auth/signin?redirect=/onboarding?plan=X...
  → email+password signUp → email OTP verify (or Google OAuth → /auth/callback)
  → /onboarding          Step 1: trade + business name  (2 POSTs to /api/onboarding/start)
  → /onboarding/services Step 2: edit template services  (POST /api/onboarding/start)
  → /onboarding/contact  Step 3: owner name, phone (optional), country (SG/US/CA)
                                  (POST /api/onboarding/sms-confirm)
  → /onboarding/checkout Step 4: embedded Stripe Checkout → poll /api/onboarding/verify-checkout
  → Stripe webhook (checkout.session.completed): sets onboarding_complete=true,
    provisions phone (SG: assign_sg_number RPC from phone_inventory; US/CA: Twilio
    purchase + SIP trunk association), creates subscription row
  → /dashboard (setup checklist, guided tour, AiNumberBanner)
```

Key facts that drive the findings below:

- Wizard state lives **only in sessionStorage** (`useWizardSession`, prefix `gsd_onboarding_`) — per-tab, never rehydrated from DB.
- Route gating is in **`src/proxy.js`** (NOT `src/middleware.js` — the onboarding-flow skill doc is stale on this). It preserves `pathname + search` in the `redirect` param when bouncing unauthed users to signin, so plan params DO survive the auth round-trip.
- The wizard never collects **working hours, timezone, address, service area, escalation contacts, or calendar connection**. Those live in dashboard settings + a 12-item setup checklist (FAB, bottom-right).
- **Live DB state at audit time:** 5 tenants total, 4 onboarded, **1 has `provisioning_failed=true` and no phone number**, `phone_inventory` has **ZERO rows** (no SG numbers at all), waitlist empty.

Verification notes (claims checked against code, not just docs):
- With `working_hours` NULL, the booking engine returns **zero slots for every day** (`livekit-agent/src/lib/slot_calculator.py:175-179` — `day_config` missing → `return []`), and the system prompt omits the hours section entirely (`livekit-agent/src/prompt.py:413-414`). The AI **cannot book anything** for an unconfigured tenant. (An earlier sub-audit claimed it "books 24/7" — that is wrong; the verified behavior is zero slots.)
- A new tenant's `ai_voice` is NULL → safe fallback to the `professional` ElevenLabs voice (`livekit-agent/src/agent.py:146-163`). The Phase 66 greeting is deterministic `session.say()` with business name — works on day one. Voice/greeting are NOT activation blockers.
- "No credit card required" copy has been **removed** from the live site (`src/` and `messages/` have no matches) — but `scripts/generate_marketing_pdf.py:389` still claims it, and `public-site-i18n` SKILL.md (lines ~249, ~417) still documents it. Stale references only.
- `notification_preferences` DB default = **all four events ON for both SMS and email** (`tenants` column default). SMS depends on `owner_phone`, which is optional (see C1).

---

## 1. CRITICAL — activation & revenue blockers

### C1. `phone_inventory` is empty → every Singapore signup is hard-blocked right now

**Evidence:** Live DB: `SELECT ... FROM phone_inventory` → 0 rows. `src/app/onboarding/contact/page.js:278` disables Continue when `sgFull` (`disabled={loading || sgFull}`). `src/app/api/onboarding/sms-confirm/route.js:15-28` independently returns 409 for SG when count=0.

**Why it matters:** Any owner who selects "Singapore" today sees "All Singapore numbers are currently assigned", can join a waitlist, and **cannot proceed**. The waitlist is a dead-end: `phone_inventory_waitlist.notified_at` is manual-only, there is no automated notify/resume flow, and the waitlist form captures only an email (no name/trade/phone — you can't even sell to them properly later). If SG is a primary launch market, the funnel is closed.

**Also:** `sms-confirm` treats a transient DB `countError` as "no numbers" and 409s (`if (countError || (count ?? 0) === 0)`) — a DB hiccup blocks SG signups.

**Fix:**
1. Restock `phone_inventory` with SG numbers (operational, do first).
2. Add admin alerting when SG available count drops below a threshold (e.g., ≤3) so this never silently happens again.
3. Waitlist improvements: capture business name + trade + phone; when admin adds inventory, auto-email waitlisted users a resume link (`/onboarding/contact`).
4. In `sms-confirm`, distinguish `countError` (500, "try again") from genuine zero (409).

### C2. The AI cannot book appointments for a brand-new tenant — working hours are never collected and there is no default

**Evidence:** No wizard step writes `working_hours` (column default NULL, confirmed in live schema). `livekit-agent/src/lib/slot_calculator.py:175-179`: missing/disabled day config → `return []` (zero slots). `livekit-agent/src/prompt.py:413-414`: `if not working_hours: return ""` — the AI's prompt contains no hours at all. Web-side `available-slots` route behaves the same (`working_hours || {}`).

**Why it matters:** The product's core promise is "AI answers and books jobs." On day one — the day the owner makes their test call and judges the product — `check_slot`/`check_day`/`book_appointment` will find **no availability, ever**. The AI will fall back to lead capture at best. The owner concludes the product doesn't work, during the trial window when churn-judgment happens. The setup checklist does list "Configure working hours" but it's one of 12 items in a FAB drawer, not a blocking activation step.

**Fix (two parts, do both):**
1. **Seed sensible defaults at tenant creation or checkout-webhook time:** e.g., Mon–Fri 08:00–18:00, Sat 09:00–13:00, Sun closed (trade-typical). A wrong-but-reasonable default the owner can refine beats a broken zero-state. Write the default in `handleCheckoutCompleted` (same place provisioning runs) so it never applies to half-finished signups.
2. **Add a lightweight "When do you work?" confirmation to the wizard** (either inside Step 3 below the country selector, or a 30-second Step 3.5): pre-filled weekly grid from the trade default, owner taps to adjust. Keep it skippable — the default still lands.

### C3. `tenant_timezone` is never set — every new tenant is `America/Chicago`, including Singapore

**Evidence:** Column default `'America/Chicago'` (live schema). Grep across `src/app/api` shows only `available-slots` (read) and `working-hours` (write, settings panel) touch `tenant_timezone`; no onboarding route and no webhook code writes it (grep of `src/app/api/stripe/webhook/route.js` → no matches for `timezone`).

**Why it matters:** Timezone poisons everything time-related on calls: "today/tomorrow" resolution, slot windows, the working-hours grid the owner sets (an SG owner who sets 9–6 gets slots computed 13–14 hours off), recovery-SMS timing, analytics. This compounds C2: even after the owner configures hours, bookings are wrong for non-US-Central tenants. This was plausibly a contributing factor to the Phase 60.4 booking-timezone work on the agent side — fix it at the source.

**Fix:**
- In `sms-confirm` (where `country` is saved): SG → `Asia/Singapore` (single-tz country, zero extra UX). For US/CA, add a small timezone select to Step 3 (default from browser `Intl.DateTimeFormat().resolvedOptions().timeZone`, which is almost always right) and persist it. Do NOT leave the Chicago default for US/CA either — browser-detected tz is strictly better.

### C4. Call-forwarding activation — the single step that makes the product real — is essentially unexplained

**Evidence:** The ONLY in-product copy telling the owner what to do with their new number is one line in `src/components/dashboard/AiNumberBanner.jsx` ("Forward your business line here so customers reach your AI"), which links to the **account page**, not a guide. The setup checklist's `configure_call_routing` item ("Choose when the AI picks up vs. when your phone rings first") describes the in-app schedule feature, assuming calls already arrive. The guided tour (5 steps, `src/components/dashboard/DashboardTour.jsx`) never mentions the phone number, forwarding, test calls, or working hours. No carrier instructions exist anywhere (searched for forwarding/porting content — none).

**Why it matters:** A new tenant has a fresh Voco number that nobody on earth calls. Until the owner (a) forwards their existing business line, or (b) puts the Voco number on their website/Google Business Profile, the AI receives **zero calls**, the dashboard stays empty ("Voco is listening…"), the trial expires with no demonstrated value, and the customer churns. This is the #1 product-value gap in the entire journey — everything else can be perfect and the business still gets nothing without this step.

**Fix:**
1. **Post-checkout activation screen** (replace/extend the current success phase): show the provisioned number → "Step 1: call it right now from your cell" (the wow moment) → "Step 2: forward your existing line" with carrier-specific instructions (US: `*72<number>` Verizon/most landlines, AT&T/T-Mobile app paths, conditional forwarding `*71`; SG: Singtel `**21*<number>#` / StarHub / M1 codes; CA: Bell/Rogers/Telus) → "Step 3: put the number on your website + Google Business Profile."
2. Rewrite the `configure_call_routing` checklist item to be "Get calls flowing to your AI" with the same guide; make it a REQUIRED-tier item, ordered right after the test call.
3. Add the forwarding guide as a dedicated dashboard page (`/dashboard/more/activate` or similar) so the checklist, banner, and welcome email all link to one canonical place.
4. Add a "copy number" button to `AiNumberBanner` and `SettingsAISection` (`src/components/dashboard/SettingsAISection.jsx:14-29` is plain read-only text today).

### C5. Paid-but-unconfirmed dead end: webhook delay > 60s strands a paying customer outside the product

**Evidence:** `src/app/onboarding/checkout/page.js:107-127` — 30 polls × 2s = 60s, then `phase='error'` whose UI (lines 251-262) is a single sentence with a contact-support link: no retry button, no payment-status clarity. Meanwhile `onboarding_complete` is still false, so `src/proxy.js:103-105` bounces the user from `/dashboard` back to `/onboarding` — they re-enter the wizard at Step 1 with empty sessionStorage **after having paid**. (Mitigations that DO exist: polls 4-30 pass `session_id` so `verify-checkout` can confirm against the Stripe API even if the webhook is down; returning to `/onboarding/checkout?session_id=...` re-enters verification, and proxy.js:95-99 allows that path. But nothing routes a confused user back there.)

**Why it matters:** This is the worst possible moment for friction — money has changed hands. A non-technical owner who sees "We couldn't confirm your subscription" will either dispute the charge or churn on day zero.

**Fix:**
1. Error phase: add a **"Check again" retry button** (re-runs `handleComplete()`), state plainly "Your payment may have gone through — do not pay twice," and keep polling in the background at a slower interval.
2. Extend the window (e.g., 30 × 2s, then 12 × 10s ≈ 3 min total).
3. **Belt-and-braces guard change:** in `proxy.js`, when an authenticated, not-onboarded user hits `/dashboard`, check for an `is_current` subscription (the service-role subscription check already exists for the gate) — if one exists, flip `onboarding_complete` (or redirect to `/onboarding/checkout?session_id=` recovery) instead of dumping them at wizard Step 1.
4. Send the welcome email (H3) with a deep link to `/onboarding/checkout?session_id={id}` so even a closed tab can resume verification.

### C6. `provisioning_failed` is invisible to the customer — and it's live in production right now

**Evidence:** Live DB: 1 of 4 onboarded tenants has `provisioning_failed=true`, `phone_number=NULL`. No UI component reads `provisioning_failed` (admin pages only). `src/app/dashboard/more/account/page.js:136-142` shows "Your number is being provisioned. It usually appears within a minute…" **forever**. `AiNumberBanner.jsx:28` returns null when phone is null — so the home page shows nothing at all about the missing number. Failure email (webhook route.js:302-317) is inline HTML, sent only if `owner_email` exists, swallows Resend errors, and is not idempotent (re-delivered webhook → duplicate email).

**Why it matters:** A paying customer with no phone number has bought nothing. Today they get a permanently lying "within a minute" message and silence.

**Fix:**
1. Dashboard banner keyed on `provisioning_failed=true`: "We hit a snag assigning your number. Our team is on it — you don't need to do anything. [Contact support]". Same state on the account page (replace the "within a minute" copy once >5 min have passed or the flag is set).
2. Admin alert (email/Slack) when the flag is set — today it's discovered only by checking the admin panel.
3. Auto-retry: a cron (or the admin "retry" action) that re-runs provisioning for flagged tenants — SG exhaustion is recoverable the moment inventory is restocked.
4. Make the failure email idempotent (reuse the `billing_notifications` dedupe pattern used by trial-reminder emails) and convert it to a React Email template like the others.
5. **Resolve the existing affected tenant.**

### C7. The landing page promises languages the current voice pipeline cannot deliver

**Evidence:** `src/app/components/landing/FeaturesCarousel.jsx:160` ("responds fluently in **70+ languages** · auto-detected"), `:255` ("English, Spanish, Mandarin, Malay, and 70+ more, including Singlish and mid-call code-switching"), `FAQSection.jsx:55-56` ("English, Spanish, Mandarin, Malay, Tagalog, Vietnamese, and 70+ more… a caller who starts in English and switches to **Hokkien** stays understood"), `FeaturesGrid.jsx:381-383` ("70+ Languages. Zero Frustration.").
Reality: Phase 66 cascade uses Deepgram nova-3 streaming with `language=multi`, which covers roughly **10 languages** (EN, ES, FR, DE, HI, RU, PT, JA, IT, NL) — **no Mandarin, no Malay, no Tagalog, no Vietnamese, no Hokkien, no Singlish-specific handling**. The STT is the hard ceiling regardless of what the LLM/TTS could do. (These claims were written in the Gemini Live era when broad language support was plausible; the cascade migration changed reality.)

**Why it matters:** This is the audit's biggest trust risk for the SG market specifically — a Singaporean owner signs up *because* of the Mandarin/Malay/Singlish claim, makes a Mandarin test call, and watches it fail. That's a refund + a bad review, not just churn.

**Fix (choose one, don't leave as-is):**
- **Copy-first (fast):** rewrite the language claims to what the pipeline does today ("English and Spanish, with more on the way" or the verified nova-3 multi list). Update FeaturesCarousel, FAQSection, FeaturesGrid, and the `messages/en.json`/`es.json` equivalents.
- **Product-first (slower):** keep the claim and route STT per-tenant/per-call to a multilingual model that actually covers SG languages — a separate engineering effort that should be consciously scheduled, not assumed.

---

## 2. HIGH — broken experiences and missing essentials

### H1. Empty "optional" phone saves garbage `owner_phone = '+65'` / `'+1'`

**Evidence:** `src/app/onboarding/contact/page.js:20-25` — `buildE164(country, '')` → digits `''` → returns the bare prefix. Line 98 calls it unconditionally; `sms-confirm/route.js:32` — `if (phone?.trim())` is truthy for `'+65'` → saved.
**Impact:** SMS notifications (default ON for all events), the post-payment test call, and any owner-dial fallback all target a 3-character non-number. Silent failures the owner never learns about.
**Fix:** In `buildE164`, return `''` when digits are empty; in `sms-confirm`, validate E.164 shape (`/^\+\d{7,15}$/`) before saving. Decide the product stance on phone: given SMS notifications and the test call depend on it, make it **required with a reason shown** ("We text you when the AI books a job") — or keep optional but flip SMS notification defaults off when absent.

### H2. Selecting a country wipes an already-typed phone number

**Evidence:** `contact/page.js:46-48` — `handleCountryChange` calls `setPhone('')`. The phone field sits ABOVE the country selector in the layout, so the natural top-to-bottom fill order guarantees the wipe for any user who types phone first.
**Fix:** Reorder fields (country → phone), and stop clearing the digits on country change (the prefix is rendered separately anyway).

### H3. No welcome email — the customer's phone number is never sent to them

**Evidence:** Webhook sends NO email on successful checkout/provisioning (only on provisioning failure, trial-ending, payment-failed). The checkout success screen (checkout/page.js:273-306) also omits the number. The first place an owner can see their own AI's number is buried dashboard pages.
**Fix:** Send a "You're live — here's your AI receptionist's number" email from `handleCheckoutCompleted` after provisioning succeeds: number, "call it now" nudge, forwarding guide link (C4), trial dates, dashboard link. Use a React Email template + `billing_notifications` idempotency. Also surface the number on the checkout success screen (poll `/api/onboarding/test-call-status` which already returns `phone_number`).

### H4. Wizard never rehydrates from the DB — returning/cross-device users re-enter everything

**Evidence:** `useWizardSession` is sessionStorage-only. Step 1 data IS saved to `tenants` on Continue, and services to `services`, but on return (new tab, next day, other device) the pages initialize from templates/empty (`services/page.js:34-41` reloads TRADE_TEMPLATES, not saved services).
**Impact:** The persona (an owner signing up on their phone between jobs) is exactly who abandons and resumes later. Today resume = start over; worse, re-submitting Step 1 wipes and re-inserts services, destroying Step 2 edits.
**Fix:** Add `GET /api/onboarding/state` returning `{business_name, trade_type, services, owner_name, owner_phone, country}`; each wizard page hydrates from it when sessionStorage is empty. Cheap, huge resilience win.

### H5. Silent SIP-trunk association failure = number that never rings the AI

**Evidence:** `src/app/api/stripe/webhook/route.js:56-70` (SG) and `:86-97` (US/CA) — trunk association failures are caught, logged, and ignored ("can be done manually"). No flag, no alert. The tenant sees a healthy-looking number, forwards their business line to it (C4), and **every customer call dies** — the worst possible outcome, worse than no number.
**Fix:** On association failure set a tenant flag (e.g., `routing_pending=true`) + admin alert + retry job; suppress the "forward your line" prompts while set.

### H6. Hero CTA routes auth-first while the rest of the funnel is pricing-first

**Evidence:** `src/app/components/landing/HeroSection.jsx:117` → `/auth/signin`, while `AuthAwareCTA.js:49` (used by FinalCTA etc.) → `/pricing`, and pricing tier CTAs carry `?plan=&interval=` into the wizard. A hero-CTA user reaches Step 4 with no plan and gets the "Choose a plan to continue" detour back to /pricing mid-checkout.
**Fix:** Point the hero CTA at `/pricing` (consistent with AuthAwareCTA). Optionally also: at the checkout `needsPlan` branch, preselect Growth ("most popular") with a "change plan" link instead of forcing the round-trip.

### H7. Removing all services silently keeps the old ones; service replace is non-atomic

**Evidence:** `src/app/api/onboarding/start/route.js:65-91` — delete runs only inside `if (Array.isArray(services) && services.length > 0)`; submitting an empty list is a silent no-op. Delete+insert is also not transactional (a failed insert after delete leaves the tenant with zero services).
**Fix:** When the trade shape includes a `services` array, always delete; enforce minimum 1 service in the UI (the AI is pointless with zero services); move delete+insert into a single RPC for atomicity. Also add basic server-side validation: `trade_type` ∈ TRADE_TEMPLATES keys ∪ allowed set, non-empty `business_name`, service name length caps — `/start` currently accepts arbitrary strings into AI-prompt-feeding columns.

### H8. Phone provisioning idempotency relies on a single non-atomic guard

**Evidence:** `webhook/route.js:284` — `if (tenantRow && !tenantRow.phone_number)` is the only guard before `provisionPhoneNumber`. Migration 068's `processing_started_at` claim makes concurrent duplicate deliveries unlikely, but a retry after a crash-after-provision-before-update can double-purchase a Twilio number (US/CA) or burn a second SG number.
**Fix:** Before purchasing, re-read `phone_number` with the claim held; for US/CA optionally search Twilio for an existing number with the tenant tag before purchasing. Low effort, removes a real money leak.

---

## 3. MEDIUM — friction and value gaps

### M1. Custom services are always `routine` — the owner can't mark emergencies

**Evidence:** `services/page.js:55-58` hardcodes `urgency_tag: 'routine'` for added services; no UI to change urgency of any service in the wizard.
**Why it matters:** Urgency triage is the product's differentiator. A plumber adding "Sewage backup" gets routine handling — wrong notification urgency, wrong booking priority, on a service the OWNER explicitly typed because it matters to them.
**Fix:** Add a 3-chip urgency selector (Emergency/Urgent/Routine) to the add-service form, and make existing badges tappable to cycle urgency. Mirror in the dashboard services settings.

### M2. Only 4 trades — roofers, locksmiths, garage-door, appliance-repair, pest, landscaping owners have no home

**Evidence:** `src/lib/trade-templates.js` — `plumber`, `hvac`, `electrician`, `general_handyman` only.
**Why it matters:** Conversion: an owner who can't find their trade assumes the product isn't for them. The "general handyman" fallback yields a service list that's visibly wrong for, say, a roofer — undermining the "we know your business" first impression that the trade-template feature exists to create.
**Fix:** Add 4–8 more templates (roofing, locksmith, garage door, appliance repair, pest control, landscaping, cleaning, painting — each is ~15 minutes of content work) plus an "Other" trade with an empty list + guided add flow.

### M3. Pricing shows bare `$` USD to SG/CA visitors

**Evidence:** `src/lib/format-utils.js:8-9` hardcodes `'$' + toLocaleString('en-US')`; pricing tiers show $99/$249/$599 with no currency code. Stripe charges in USD.
**Fix (minimum):** label prices "USD" on the pricing page so an SG owner isn't surprised at checkout. (Full localization — SGD/CAD price books in Stripe — is a bigger product decision; don't fake it with FX display.)

### M4. "COMING SOON" integrations (Housecall Pro, ServiceTitan) on the landing page

**Evidence:** `src/app/components/landing/IntegrationsStrip.jsx:11-14, 31-42`.
**Fix:** Remove or add honest ETA. An owner on ServiceTitan reads this as a commitment and either waits (lost sale) or signs up and feels misled.

### M5. Test call isn't promoted at the moment it matters

**Evidence:** TestCallPanel lives only at `/dashboard/more/ai-voice-settings` (three levels deep). The checklist's `make_test_call` item links there but nothing on the home page, success screen, or tour pushes it. (Item completion detection is also odd — keyed on `onboarding_complete`, which the webhook sets at payment, so it may show complete before any call happened; verify when implementing.)
**Fix:** Covered by the C4 activation screen ("call your AI right now"); additionally pin the test-call as the first checklist item and add it to the Help Discoverability Card.

### M6. Guided tour ignores activation entirely

**Evidence:** `src/components/dashboard/DashboardTour.jsx` — 5 steps covering nav tabs; nothing about the phone number, test call, hours, or forwarding. Re-run button hidden once `gsd_has_seen_tour` is set.
**Fix:** Add a step anchored on AiNumberBanner ("This is your AI's number — test it, then forward your line"); keep a persistent "Take the tour" affordance (e.g., in More).

### M7. OTP screen has no email-typo recovery; resend ambiguity

**Evidence:** `src/app/auth/signin/page.js` OTP branch — the entered email isn't editable; user must back out and retype. Typo'd email = OTP never arrives = bounce at the very top of the funnel.
**Fix:** Show the target email on the OTP screen with an "edit" link; keep resend with its existing rate-limit messaging.

### M8. `sms-confirm` ignores update failures

**Evidence:** `sms-confirm/route.js:36-41` — the `update` result is unchecked; returns `{saved:true}` even on error or 0-row match (e.g., user hit /onboarding/contact directly in a fresh session with no tenant row → nothing saved → webhook later reads `country=NULL` → `provisionPhoneNumber` returns null (route.js:100-104) → provisioning_failed for no good reason).
**Fix:** Check error + affected row; 404 with "complete step 1 first" if no tenant row (mirrors `/start` behavior).

### M9. Wizard is English-only while the public site is en/es

**Evidence:** Onboarding pages mix hardcoded English (profile, contact, checkout) with `useTranslations` (services page). Public site fully supports `es`. A Spanish-speaking US contractor goes Spanish landing → English wizard.
**Fix:** Move wizard strings into `messages/*.json` (the `onboarding` namespace already exists — the services page proves the wiring works).

### M10. Stale marketing PDF + stale skill docs

- `scripts/generate_marketing_pdf.py:389` still claims "No credit card required to start" — false (checkout uses `payment_method_collection: 'always'`). Fix or stop distributing.
- `onboarding-flow` SKILL.md: says guards live in `src/middleware.js` (actual: `src/proxy.js`); says plan params are captured by the services step (actual: profile page `/onboarding/page.js:24-33` and checkout page); describes `owner_phone` as required (actual: optional). Update after implementing changes (per project rules).
- `public-site-i18n` SKILL.md still documents "no credit card" copy that's been removed.

---

## 4. LOW — polish

- **L1.** Already-authenticated visitor to `/auth/signin?redirect=...` is redirected to `/onboarding` dropping the redirect param (`proxy.js:87-91`) — plan params lost in this edge. Preserve the param.
- **L2.** Success-screen date hardcodes `toLocaleDateString('en-US')` (checkout/page.js:266).
- **L3.** Vestigial routes: `/onboarding/plan`, `/onboarding/checkout-success`, `/onboarding/complete`, `/onboarding/profile`, `/onboarding/verify` — remove or leave documented as redirects.
- **L4.** `trial_period_days: 14` hardcoded in `checkout-session/route.js` — fine until marketing wants a different trial; note only.
- **L5.** Webhook log strings use `[stripe\webhook]` (backslash, e.g. route.js:43) vs `[stripe/webhook]` elsewhere — log-grep consistency.
- **L6.** No copy-to-clipboard on the phone number anywhere (also listed under C4 fix).
- **L7.** Logged-in users on /pricing see "Start Free Trial" CTAs rather than a "Go to Dashboard"/"Upgrade" state.

---

## 5. Persona-driven value improvements (not bugs — product opportunities)

These came from walking the journey as a non-technical owner. Each is independent.

1. **Auto-seed the escalation chain from onboarding data.** After checkout, insert `owner_name`/`owner_phone` as escalation contact #1 (when phone is valid — see H1). The AI's `transfer_call` then has a target on day one instead of being a dead tool. One INSERT in the webhook handler; remove the corresponding empty-state friction.
2. **A real "activation moment" sequence** (C4 fix): number → test call → forward line → put number on GBP/website. Owners who complete a test call in the first session will activate at a much higher rate; instrument it (`activity_log`) so you can measure activation, not just signups.
3. **Trial-value digest email** (week 1 and week 2): calls answered, after-hours calls caught, jobs booked, estimated revenue saved. The owner's renewal decision needs ammunition; today nothing tells them what Voco did for them. (Bigger build — schedule consciously.)
4. **Business address & service-area capture** post-payment (checklist, not wizard): unlocks travel buffers/zones and the AI's address-sanity answers. Keep the wizard short; put this as checklist item with a "why" ("so your AI doesn't book jobs an hour outside your area").
5. **Working-hours trade defaults** (C2) double as a demo of "we know your trade" — plumbers get emergency-friendly defaults (e.g., Sat enabled), office-hours trades don't.
6. **Calendar connect nudge timing:** prompt Google/Outlook connect right after the first real booking appears (the moment the owner feels the double-booking risk), not as a cold checklist item.

---

## 6. Suggested implementation order

**Wave 0 — operational, today:**
1. Restock SG `phone_inventory` (C1) + low-inventory alert.
2. Resolve the existing `provisioning_failed` tenant (C6.5).

**Wave 1 — activation blockers (highest value per line of code):**
3. Seed default working hours in webhook (C2.1) + set timezone from country/browser (C3).
4. `buildE164` empty-phone guard + E.164 validation + field reorder/no-wipe (H1, H2).
5. provisioning_failed banner + accurate account-page copy + admin alert (C6).
6. Checkout error-phase retry + extended polling + proxy paid-user rescue (C5).
7. Welcome email with number + show number on success screen (H3).

**Wave 2 — funnel correctness:**
8. Hero CTA → /pricing (H6). Language-claims copy fix (C7 copy-first). "USD" label (M3). COMING SOON removal (M4).
9. Wizard DB rehydration endpoint + page hydration (H4).
10. Services API: always-delete + min-1 + validation + atomic RPC (H7). Custom-service urgency picker (M1).
11. SIP-trunk failure flag + retry (H5); provisioning idempotency re-check (H8); failure-email idempotency (C6.4).

**Wave 3 — experience & breadth:**
12. Activation guide page + checklist rework + tour step + copy button (C4, M5, M6).
13. Escalation auto-seed (Value #1). Working-hours wizard step (C2.2).
14. More trades + "Other" (M2). Wizard i18n (M9). OTP email-edit (M7). sms-confirm error handling (M8).
15. Lows (L1–L7), stale docs/PDF (M10), waitlist enrichment (C1.3).

**After implementation:** update `onboarding-flow`, `dashboard-crm-system`, and `public-site-i18n` skill docs to match the new reality (project rule: skills must stay in sync), including fixing the pre-existing staleness listed in M10.

---

## 7. Things verified as GOOD (don't "fix" these)

- Plan params survive the unauth → signin → wizard round-trip (`proxy.js:70-74` preserves `pathname + search`).
- `verify-checkout` has a Stripe-API fallback when the webhook is slow (polls 4-30 pass `session_id`).
- Checkout 409-guards against double subscriptions; migration 068 atomic webhook claim + one-current-subscription index.
- `assign_sg_number` RPC is race-safe (`FOR UPDATE SKIP LOCKED`).
- Trial messaging at checkout is honest ("You won't be charged for 14 days", card required) and "no credit card" claims are gone from the live site.
- Deterministic branded greeting works for a zero-config tenant; NULL `ai_voice` falls back safely to the professional ElevenLabs voice.
- TradeSelector accessibility (radiogroup/keyboard), CelebrationOverlay reduced-motion handling, OtpInput paste handling.
- Empty-state copy on dashboard tiles is friendly and links somewhere sensible.
- TrialCountdownBanner two-stage (info → urgent ≤3 days) behavior.
