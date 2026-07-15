# Voco — Full System Audit

**Date:** 2026-07-04
**Scope:** The entire journey — public site → pricing → onboarding/payment → dashboard setup → the live voice agent (LiveKit repo + Railway) — plus feasibility, value-to-customer, and over-engineering.
**Method:** Multi-agent audit grounded in the **actual code of both repos** (`homeservice_agent` + sibling `livekit-agent`), the **live Supabase database** (MCP), and the **live Stripe account** (MCP). Every subsystem's findings were put through an **adversarial verification pass** (a second agent tried to refute each finding against the real code/data). Two exceptions noted below.

**Confidence / verification status per subsystem:**

| Subsystem | Grounded in | Adversarially re-verified? |
|---|---|---|
| Public Site & Pricing | code | ✅ yes |
| Onboarding & Provisioning | code + live DB | ✅ yes |
| Payment & Billing (Stripe) | code + **live Stripe** + live DB | audited directly in main loop |
| Dashboard / Setup Checklist / CRM | code + live DB | ✅ yes |
| Voice: Call Routing & Live Agent | code + live DB | ⚠️ primary audit only (evidence concrete; 2 claims flagged "verify live") |
| Voice: Post-Call / Notifications | code + live DB | ⚠️ primary audit only |
| Auth / DB / Multi-tenancy | code + **live DB row-level impersonation** | ✅ yes |
| Scheduling & Calendar | code + live DB | ✅ yes |
| Integrations (Jobber/Xero) | code + live DB | ✅ yes |

> A note on why this ran in pieces: the audit hit the account's session usage limit twice mid-run and the process was interrupted once. It was resumed from cache each time; the payment/Stripe audit (the one that kept failing because it's the heaviest) was completed directly. All findings below are from completed, grounded analysis.

---

## 1. Executive summary

**Is the idea feasible and valuable? Yes — clearly.** The core loop (a 24/7 AI that answers the phone, triages urgency, books into an atomically-protected calendar, and texts the owner) is real, it is running in production today (152 calls, 139 reached `analyzed`), and the two hardest foundations are genuinely well-built: **multi-tenant isolation is airtight** (verified by row-level impersonation against live data) and **atomic booking cannot double-book** (DB-level GiST exclusion constraint, 0 overlapping appointments in prod). The value proposition — "never miss a call = never lose a job" — is exactly right for a plumber/HVAC/electrician, and the messaging, pricing, and ROI framing land it well.

**So what's wrong?** Two things, and they're related:

1. **The product can't yet safely take a real paying customer through the whole funnel.** There are ~5 seams between subsystems where the journey silently breaks — and several are *already broken in your live data*:
   - Stripe is a **sandbox**; you cannot charge a real card as configured.
   - A paying/trialing tenant (`f4665eef`) is **already stranded** with no phone number, because the checkout fallback path fulfills billing but never provisions.
   - Inbound-call routing works **only because of hand-edited cloud config that lives nowhere in the repo** — any redeploy from source silently kills every call.
   - The dashboard can say **"You're call-ready"** while the phone gate is still forwarding 100% of calls away from the AI.
   - The **owner alert — the entire payoff — can be silently dropped** on ~4% of calls, and emergency detection leans on a single external LLM that fails to "routine" silently.
   - The AI books against a calendar mirror that is **frozen 16 days** in prod.

2. **The product is over-scoped for its stage.** A solo founder pre-PMF has shipped roughly **two to three extra products' worth of surface** that *no live user touches*: a full invoicing + estimates suite (recurring, batch, PDF, reminder crons), a dual Jobber+Xero integration (dual OAuth, GraphQL+REST, cross-language refresh locks, a 15-min schedule-mirror poll), a programmatic-SEO content engine, a multi-zone travel-buffer matrix, and a customer merge/unmerge/undo stack. All of it is maintenance drag and focus drain; none of it is in the core loop.

**The prescription is simple to state:** narrow ruthlessly to the core loop, harden the ~5 launch-blocker seams, and freeze/defer everything else. You are not short on capability — you're short on *focus and reliability on the one path that matters*.

### The 5 launch blockers (do these before charging a real customer)

> **Status update (2026-07-09):** after a deep verify-and-fix pass (see `P0-fix-plan.md`), the three unblocked fixes (P0-3, P0-4, P0-5/DASH-1) are **implemented and verified in the working tree (uncommitted)**. P0-2 and the P0-5/VOICE-2 half remain **blocked** on LiveKit Cloud checks; P0-1 is **not an issue** (live keys run on Vercel; this repo uses test, per the owner).

| # | Blocker | Where | Severity | Status |
|---|---|---|---|---|
| P0-1 | **Stripe is sandbox-only** — no live products/prices/meter/webhook; 0 paid conversions | Payment | 🔴 launch | ⚪ N/A in repo — live keys run on Vercel; repo uses test (per owner) |
| P0-2 | **SIP dispatch binding not in the repo** — re-applying the committed rule = dead air on inbound | Voice Routing | 🔴 critical | ⛔ Blocked — needs `lk sip dispatch list` (LiveKit Cloud) first |
| P0-3 | **Checkout fallback strands paying tenants** (already happened: `f4665eef`) | Onboarding | 🔴 critical | ✅ Code fixed (uncommitted); `f4665eef` backfill pending |
| P0-4 | **Owner emergency alert can be silently dropped** (~4% pipelines abort; triage fails to "routine" silently) | Voice Post-Call | 🔴 high | ✅ Code fixed (uncommitted) — persist-first + caps; triage-recall half deferred |
| P0-5 | **"Call-ready" can lie** — test call never checks the AI answered; meter defeatable | Dashboard + Voice | 🔴 high | ◑ Half fixed (DASH-1 done); VOICE-2 + `make_test_call` blocked on P0-2 |

---

## 2. Where the funnel breaks *between* subsystems (cross-cutting)

Each subsystem is mostly fine on its own; the danger is in the seams. Tracing the whole journey a real customer takes:

**Landing → Pricing → Checkout.** Clean handoff, honest pricing, no dead routes. But the flagship "hear it in action" demo is broken (plays a placeholder), and the hero shows a **fabricated live "1,247 calls answered right now"** counter — a trust/false-advertising risk. And **you literally cannot collect real money**: the connected Stripe account is a sandbox with only test-mode objects.

**Checkout → Working phone number.** This is the most dangerous seam. Provisioning lives **only inside the async Stripe webhook**. The embedded checkout's own fallback (`verify-checkout`) marks the tenant paid, attaches billing, and says *"You're all set — we've emailed your number"* — but **never provisions a number and never seeds working hours**. Live proof: tenant `f4665eef` is a trialing Growth subscriber with `phone_number = NULL`, `working_hours = NULL`, and `provisioning_failed = false` — paid, stranded, and invisible. There is no sweep that finds such tenants.

**Provisioned number → Inbound call reaches the AI.** The worker registers as a *named* agent (`agent_name="voco-voice-agent"`), which in LiveKit **disables automatic dispatch** — an agent only joins a room if a dispatch rule explicitly names it. The committed `sip-dispatch-rule.json` contains **no such binding**. Production works only because someone hand-edited the live LiveKit Cloud rule. Re-apply the repo config, or stand up any fresh/DR environment, and **every inbound call is dead air**.

**"Setup complete" → the AI actually works.** The setup checklist is genuinely wired to a real DB gate (`is_tenant_call_ready`) that the phone webhook enforces — good design. But (a) the "make a test call" that unlocks it **only checks that the owner's phone rang, not that the AI answered**, and (b) the home-page readiness meter can be turned green by clicking "Mark done" or by an empty `working_hours = {}` object, while the enforced gate still forwards 100% of calls. So the dashboard can say "your AI is live" when it is not.

**Call answered → owner gets alerted.** The payoff. The known "outbox not fed" risk is genuinely *fixed* — the owner-notification outbox and its 5-minute drain cron both exist and are wired. **But** the owner alert still sits inside a single 8-second pipeline behind ~9 sequential DB round-trips + a 2.5s LLM call, and **~4% of live pipelines already abort before the alert fires** (6/139 calls, including the most recent one) — dropping the alert with no outbox row and no retry. And emergency detection depends on one external LLM (Groq) that **silently downgrades to "routine" on any error**.

**Booked appointment → owner's real calendar.** Booking itself is atomic and durable. But the AI checks availability against a **calendar mirror that is frozen 16 days in prod** (both connected calendars last synced 2026-06-18), with no agent-side staleness gate — so it will happily book over real events the owner added since.

**The "value-add" integrations.** Both live Jobber/Xero connections are **dead** (`token_refresh_failed`); the Jobber one **never served a single lookup** in 2.5 months. And the pre-call context fetch **blocks the greeting by up to 2.5s of dead air** for connected tenants.

---

## 3. Feasibility & value verdict

**Feasible: yes.** Nothing here is architecturally impossible or fundamentally mis-designed. The spine is sound. The failures are reliability/ops gaps and scope sprawl, not "this can't work."

**Valuable: yes, genuinely — for the core loop.** A busy contractor loses real money to voicemail, and an AI that answers, triages an emergency, books the job, and texts them is a direct, quantifiable win. The pricing math ("one recovered call pays for the year") is honest and compelling. The anti-hallucination discipline in the agent prompt (never say "booked"/"available" without a tool result) is exactly the right obsession — a fabricated confirmation is the worst possible outcome and the design takes it seriously.

**The risk to the business is not the idea — it's dilution.** Effort is spread across ~5 subsystems that zero users touch (invoicing, estimates, dual accounting integrations, programmatic SEO, zone-buffer matrix) while the *entry* (live payments, provisioning, dispatch) and the *payoff* (owner alert) have real, sometimes already-manifested, failures. Every subsystem you maintain is focus taken from the one path that makes or breaks the company.

**What a home-service owner actually wants from this, ranked:** (1) the phone gets answered and they get told about the job; (2) it books into their calendar without double-booking; (3) they can see who called and what happened. That's the product. Invoicing, estimates, and accounting-sync are things they already do in QuickBooks/Jobber/Xero — which is exactly why building a second billing product inside your app is the clearest over-investment.

---

## 4. Over-engineering — the consolidated "cut / defer / freeze" list

Ranked by how much surface it removes for how little it costs you today. **None of these are in the answer→triage→book→notify loop.**

| What | Live usage | Verdict |
|---|---|---|
| **Invoicing suite** (recurring, batch, PDF, AI line-items, 2 crons, `@react-pdf/renderer`) | `invoicing:false` default; **0/5 tenants**; 13 test invoices | **Freeze.** Don't touch until a paying customer asks. If you need any, keep single-invoice create+send only. |
| **Estimates subsystem** (list/convert/send/PDF) | 4 test estimates, same disabled flag | **Defer entirely.** Phase-2-if-invoicing-gets-traction. |
| **Jobber + Xero integrations** (dual OAuth, GraphQL+REST, merge layer, cross-language refresh locks, per-phone caching) | **2 connections, both dead;** one never used once in 2.5 months | **Reduce to ONE provider (Jobber) behind a beta flag.** Cut the merge layer, the second provider, and the per-phone cache tags. |
| **Jobber schedule-mirror** (Phase 57: VISIT_* webhooks + 15-min full-window poll cron) | 0 users; polls 90-day-past/180-day-future every 15 min because Jobber has no `updatedAt` filter | **Remove until a customer runs their crew on Jobber.** Wasteful polling for nobody. |
| **Programmatic-SEO engine** (5 dynamic templates: compare/for/glossary/integrations/blog) | ~16 thin entries (2-term glossary, 3 blog posts) on a no-traffic site | **Deindex / hide footer links** until there's real content depth + traffic. Thin content is an SEO liability, not a win. |
| **Per-zone travel-buffer matrix** (`zone_travel_buffers` + cross-zone lookup) | **Dead code** — `zone_id` is always NULL on real bookings; every path collapses to the flat buffer | **Delete the table + branch.** Keep the flat `travel_buffer_mins` and the flat service-area coverage list (that part is valuable). |
| **Customer merge/unmerge/7-day-undo** (+admin view + UnmergeBanner + audit table) | `customer_merge_audit` has **0 rows ever**; 20 customers total | **Cut to a manual admin merge** (or nothing). Undo/preview/audit is scale you haven't reached. |
| **FAQ LLM chatbot** (Groq + a knowledge base) on the landing page | no traffic; a static FAQ accordion already exists | Retire it; keep the static FAQ. |
| **VIP-caller routing** in the hot inbound path | half-built; lead-based path is dead code after the leads table was dropped | Delete/flag-off until there's a UI + demand. |
| **Per-call goodbye-race diagnostics** (~150 lines, always-on Sentry instrumentation) | for a race on the *old* Gemini model you've since migrated off | Gate behind an env flag (default off) or remove. |
| **Layer-3 triage** (owner-rules escalation) | **0/152 calls** ever escalated; adds an uncapped query to the 8s alert budget | Cut it (feeds the PC-1 alert-drop risk). Keep layer1 keywords + layer2 LLM. |
| **Orphaned Spanish i18n** (`es.json` fully translated) | unreachable — the `locale` cookie is never set; no switcher | Ship a switcher, or drop the scaffolding until needed. |
| **Redundant wizard state layers** (sessionStorage + per-step DB + rehydration + bfcache hook) | for a 4-step wizard | Keep the per-step DB save (the agent depends on it); drop one client layer. |
| Dead code: `FeaturesGrid.jsx`, `checkout-success/` page, `sms-verify` route, `provision-number` POST | not referenced | Delete. |

**One nuance in the other direction:** the billing webhook handler and the multi-tenant RLS model are *not* over-engineered — that's exactly where heavy correctness work is justified, and it's well spent. Don't cut there.

---

## 5. Prioritized roadmap

Severities below reflect the **adversarial verification verdicts** (some were downgraded on re-check — noted).

### P0 — Launch blockers (before charging any real customer)

1. **[⚪ N/A — not a repo issue]** **Go live on Stripe.** Create live-mode products/prices/**meter** (`voco_calls`), repopulate all 9 `STRIPE_PRICE_*` env vars with live IDs, set the live secret key + live webhook secret, register the live webhook endpoint, and **re-verify the annual+metered flexible-billing attach in live mode** (the code notes classic-mode attach is rejected). ⚠️ `PLAN_MAP` is env-driven — a single wrong live price ID defaults subscriptions to `starter/40` (Sentry-alerted but wrong quota+overage). *(effort M)* — *Owner confirms live keys already run on Vercel; the repo uses test. Treated as resolved.*
2. **[⛔ BLOCKED — needs LiveKit Cloud]** **Make inbound dispatch reproducible from the repo (VOICE-1).** Add `room_config.agents:[{agent_name:"voco-voice-agent"}]` to `sip-dispatch-rule.json` + an idempotent deploy step (`lk sip dispatch create`), OR drop `agent_name` from `WorkerOptions` to use automatic dispatch. Assert the rule at boot. *(effort S — but confirm the live LiveKit Cloud rule first)* — *Not started: must `lk sip dispatch list` and confirm the live rule shape before touching, or the fix could itself cause the outage.*
3. **[✅ DONE 2026-07-09 (uncommitted)]** **Fix the provisioning fallback (PROV-1).** Extract a shared `fulfill()` so `verify-checkout` runs the *same* provision + activation-seed as the webhook (or sets `provisioning_failed=true` + alerts on failure). Add a nightly sweeper for `onboarding_complete=true AND phone_number` empty/invalid — **and validate E.164, not just NULL** (live data has `""` and `"+12"` junk numbers that a NULL check misses). **Backfill `f4665eef` manually.** *(effort M)* — *Implemented: new `src/lib/tenant-activation.js` `activateTenant()` shared by the webhook + fallback (billing-synced FIRST, provision best-effort after); new `cron/sweep-unprovisioned-tenants` that **detects + flags** (no autonomous Twilio purchase — money-safety) + `vercel.json`. Deferred: fully-atomic provisioning claim (re-SELECT guard used instead) and the `f4665eef` backfill (do via a one-off `activateTenant()` call after confirming it's a real paying account).*
4. **[✅ DONE 2026-07-09 (uncommitted) — persist-first + caps; triage-recall half deferred]** **Make the owner alert un-droppable (PC-1 + TRI-1).** Persist the notification *intent* to `owner_notification_failures` **before** the in-band send (the 5-min drain cron then guarantees delivery even on SIGKILL/timeout). Move the alert ahead of `record_outcome`/layer2 (layer1 keyword urgency already decides emergencies). On Groq/triage failure, **bias toward urgent** instead of silently defaulting to "routine," and broaden the layer1 keyword net. *(effort M)* — *Implemented (PC-1): persist-first for emergency/urgent in `post_call.py` (+ delete-on-success), and the two uncapped pre-alert awaits are now capped (`layer3_rules.py` services query inside its try; `write_outcome.py` RPC). Per verification the alert was **NOT reordered** ahead of `record_outcome` (that reverses a deliberate fix — capped instead), and the **TRI-1 triage-recall half is deferred** (the layer1 floor does not fix the non-keyword-emergency misclassification; real fix = don't mute emergencies at the pref layer / escalate-on-uncertainty).*
5. **[◑ PARTIAL — DASH-1 done; VOICE-2 blocked]** **Make "call-ready" honest (VOICE-2 + DASH-1).** Flip `test_call_completed` only after the **agent** participant joins (and ideally speaks) — dispatch the agent into the test-call room so it exercises the real path. Derive the readiness meter from `is_tenant_call_ready` (or the same raw conditions), not from checklist `complete`; don't let "Mark done" satisfy essentials; fix the `working_hours = {}` auto-divergence. *(effort M)* — *DASH-1 DONE: `Mark done` no longer satisfies the 4 non-test essentials (`ChecklistItem.jsx` hides the button); `configure_hours` rejects `{}`; `working-hours` PUT validates shape. VOICE-2 + tightening `make_test_call` are **blocked on P0-2** (agent dispatch) and on confirming the LiveKit webhook is registered — until then `make_test_call` deliberately keeps its mark-done fallback.*

### P1 — Critical reliability (before onboarding real, higher-volume tenants)

6. **Calendar staleness gate + root-cause the freeze (SCHED-1/2).** *[verified: downgraded critical→high — recovery machinery exists but is broken]* Add an agent-side gate: if the primary calendar's `last_synced_at` is older than ~2–6h, degrade to "take a callback" instead of confirming. Root-cause the 16-day freeze — most likely **`CRON_SECRET` unset on Vercel** (the cron 500s and never runs) or `invalid_grant` from an unpublished Google OAuth app (7-day refresh-token expiry in "Testing" mode). **Confirm every cron in `vercel.json` actually executes on your Vercel plan** (Hobby caps crons to daily, which would balloon the owner-notification drain from 5 min to ~24h).
7. **Fix `transfer_call` (VOICE-3).** The transfer target `sip:<owner>@pstn.twilio.com` likely doesn't match your trunk host (`voco-livekit.pstn.twilio.com`), and the "whisper" context is built then thrown away (blind cold transfer). Use `tel:+<owner>` or the trunk host, deliver context, and **verify with one live human-transfer test**.
8. **Verify `current_period_end` populates on active subs (PAY-2).** The agent's past-due gate fails *open* when `current_period_end` is null — and all 7 live subs currently have it null. If it stays null after conversion, a delinquent tenant keeps the AI forever. Confirm Basil's item-level period field lands in the DB on a real active subscription.
9. **Require an owner phone at onboarding (CFG-1/PROV-5).** SMS alerts, emergency transfer, *and* the test-call gate all silently depend on it; 3/5 live tenants have none.
10. **Confirm the LiveKit `participant_joined` webhook is registered (DASH-3)** in LiveKit Cloud + add a smoke test. Without it, the only path to a green readiness meter is the fakeable "Mark done."
11. **Fix the Jobs-page hooks crash (DASH-2).** Two `useMemo` calls sit after an `if (error) return` early-return → "rendered fewer hooks than expected" on any `/api/jobs` failure, so the intended inline Retry UI never shows.

### P2 — Important (polish + hardening)

- **Fix the broken audio demo (PUB-1)** — it's your single best conversion asset and it plays a placeholder — and **remove the fake "1,247 calls" live counter (PUB-2).**
- **US/CA timezone confirmation (PROV-3)** — one live US tenant is silently on `America/Chicago`; all their slot math is wrong.
- **Default working hours + a "hours not set" warning (SCHED-3)** — 2/5 tenants have `working_hours = null`, which makes the AI silently un-bookable.
- **DB hardening (AUTH-1/2/3):** add a `REVOKE`-by-default grant baseline for `anon`/`authenticated` (today isolation rests entirely on never forgetting RLS on a new table); drop the always-true anon INSERT policy on `phone_inventory_waitlist` (+ rate-limit the route); backfill `supabase_migrations.schema_migrations` so `db push`/`db diff` work again.
- **Calendar push retry (BOOK-1):** the calendar push + caller confirmation SMS are fire-and-forget `create_task`s that a fast hangup cancels — a booked job may never reach the owner's calendar. Add a reconciliation cron keyed on appointments missing an external event id.
- **Restock `phone_inventory` or hide SG (PROV-4)** — it's empty, so SG onboarding is 100% closed right now.

### P3 — Cut / defer / freeze

Everything in §4 (Over-engineering). Doing these *reduces* your maintenance surface and regression risk.

---

## 6. Subsystem detail

The nine sections below are the full findings. Each carries file:line evidence; the italic verdict line reflects the adversarial re-check.

---

### 6.1 Public Site & Pricing Funnel
*Verdict: mostly works. All findings CONFIRMED on re-check; PUB-3 downgraded to low.*

The funnel is well-built where it matters most: the message is clear, the pricing is honest, and the stranger-to-signup handoff works. The problems are in the proof layer (a broken demo, a fake live counter) and in scope (an SEO engine and a Spanish layer built years ahead of need).

**What works well**
- **Value prop is instantly clear.** Hero H1 "Stop losing $1,000+ every time you miss a call" + "Voco AI answers, triages, and books every call — in under 1 ring" (`HeroSection.jsx:109-113`) lands the message in one glance. Pricing repeats it ("one call you'd have missed covers the whole year").
- **Plan → signup handoff is solid.** Tier CTAs link to `/onboarding?plan=…&interval=…` (`PricingTiers.jsx:161`); onboarding validates the plan and persists it. No broken CTAs or dead routes.
- **Pricing is honest and legible** — leads with calls/mo, discloses overage rates + annual totals, and pre-empts objections ("calls under 20s never counted").
- **The public chat endpoint is not an abuse hole** — IP cooldown + global daily cap via Supabase, cheap Groq model (`public-chat/route.js:56-79`).

**Real defects**
- **HIGH — The flagship audio demo plays identical placeholder clips (PUB-1).** `AudioDemoSection.jsx:6-27` defines two scenarios with ~30s synced transcripts, but `demo-emergency.mp3` and `demo-routine.mp3` are **byte-identical** (md5 `7502aab0…`, 58 KB — a few seconds, also identical to `demo-intro.mp3`). Both tabs play the same wrong clip while the transcript drifts. *Verifier extra:* a **third** on-page player (`AudioPlayerCard` in the objections grid) uses the same placeholder — fix all three, and mind the `window.vocoAudioRef` single-play coordination.
- **MEDIUM — Fabricated "1,247 calls answered right now" live counter (PUB-2)** — a hardcoded string with a pulsing "live" dot (`HeroSection.jsx:91-98`). Trust / false-advertising risk on a pre-PMF product.
- **LOW — Spanish is completely unreachable (PUB-3).** `es.json` is fully translated but the `locale` cookie is never written and there's no switcher (`i18n/request.js:6`). *Verified down to low:* it's orphaned dead code, and the "Multi-language support" comparison-table row legitimately refers to the AI **call agent** (which does support EN+ES), so it's not an over-promise.
- **LOW — ROI calculator hardcodes `vocoMonthly = 79`** (`ROICalculator.jsx:68`) instead of deriving from pricing data — honest today, will silently drift.

**Over-engineering:** programmatic-SEO engine (5 templates, ~16 thin entries), FAQ LLM chatbot (a static FAQ already exists), decorative animation stack, dead `FeaturesGrid.jsx`. *(See §4.)*

---

### 6.2 Onboarding & Phone Provisioning
*Verdict: partial. PROV-1 CONFIRMED critical; PROV-2 downgraded high→medium (its false-positive example was wrong — only the false-negative holds).*

The wizard itself is lean and defensively coded, and the *primary* (webhook) provisioning path configures the agent completely. But turning a payment into a working number is fragile: it runs only in the async webhook, its documented fallback under-provisions, and a real paying tenant is already stranded.

**Live happy path (works):** `/onboarding` → services → contact → embedded Stripe checkout. Each step persists to the DB and rehydrates on mount, so refresh/back/new-device resume works. When `checkout.session.completed` fires, `handleCheckoutCompleted` (`stripe/webhook/route.js:424`) sets `onboarding_complete`, seeds working hours + timezone, provisions the number (SG via `assign_sg_number` RPC; US/CA via Twilio purchase), routes it to the FastAPI webhook (and disassociates the SIP trunk), writes `phone_number`, and sends the welcome email. This is exactly what the agent needs at call time (`twilio_routes.py:214` resolves tenant by `phone_number`). Provisioning is idempotent (reuse-if-assigned), so retries don't double-buy.

**CRITICAL — the fallback fulfills billing but never provisions (PROV-1).** The embedded checkout polls `verify-checkout`; past ~6s it hits `fulfillSubscription` (`verify-checkout/route.js:110-152`), which marks paid + attaches overage + syncs the subscription — but **never calls `provisionPhoneNumber` and never seeds hours/timezone.** It returns `verified:true`, the user sees "You're all set!" and a "we've emailed your number" claim that is **false** on this path. **Live:** tenant `f4665eef` is a trialing Growth subscriber with `phone_number=NULL`, `working_hours=NULL`, `provisioning_failed=false` — paid, empty, and unflagged. The reconcile cron only replays `processed=false` webhook rows; **no sweep exists for onboarded-but-numberless tenants.** *Verifier:* the correct sweep must validate **E.164** (a 3rd tenant `3b512e8d` has `phone_number="+12"` junk, and `7954aa5c` has `""`), not just NULL.

**HIGH→MEDIUM — `provisioning_failed` is unreliable (PROV-2).** Written only on the webhook path. `f4665eef` has no number but `pf=false` (the important false-negative — it's invisible to the admin "Re-Provision" button, which only shows when `pf=true`). *(The audit's false-positive example was refuted: `7954aa5c` has `phone_number=""`, so its `pf=true` is actually correct.)*

**MEDIUM — US/CA timezone rests on browser detection (PROV-3).** Only SG has a server backstop; a US/CA tenant whose detection fails keeps `America/Chicago` and all slot math is wrong. Live: US tenant `3b512e8d` is on Chicago.

**MEDIUM — SG onboarding is effectively closed (PROV-4).** `phone_inventory` is **empty**; every SG signup 409s to the waitlist. Fail-safe, but SG is unsellable until restocked, with no alert.

**LOW — Owner phone is optional and unverified (PROV-5).** Skipping it silently disables SMS alerts, emergency `transfer_call`, and the in-dashboard test call (which is the only way to satisfy the call-ready gate). The SMS-OTP route `sms-verify` is orphaned.

**Root cause (verifier):** `verify-checkout` and the webhook are the **same fulfillment concept implemented twice** with divergent side-effects. Extract one shared `fulfill()` — that single divergence is the source of the stranded tenant.

---

### 6.3 Payment & Billing (Stripe)
*Verdict: the webhook handler is genuinely well-engineered — but the whole stack runs on a Stripe **sandbox** and cannot take real money as configured. Audited directly against live Stripe + live DB.*

**The launch blocker: everything is test-mode.**
- The connected account is a **sandbox** (`VOCO PRIVATE LIMITED sandbox`, `acct_1TEjeJ…`). Every price is `livemode:false`. The overage meter is `mtr_test_61UQ4h…`. **7 subscriptions exist, all `trialing`, 0 active/paid.**
- Live products/prices reconcile cleanly with the code: Starter $99/mo ($948/yr, overage $2.48 >40), Growth $249/mo ($2,388/yr, $2.08 >120), Scale $599/mo ($5,748/yr, $1.50 >400) — all three overage prices bind to the one test meter.
- **To go live:** create live products/prices/meter, repopulate all 9 `STRIPE_PRICE_*` env vars with live IDs, set the live secret + live webhook secret, register the live webhook endpoint, and re-verify the annual+metered flexible-billing attach in live mode. `PLAN_MAP` (`stripe-plans.js:14-21`) is env-driven — a wrong live price ID silently defaults to `starter/40` (Sentry-alerted, but wrong quota + overage).

**What's genuinely solid (this is where heavy engineering is *justified*):**
- **Webhook robustness** (`stripe/webhook/route.js`): fail-closed signature verify (401), **claim-based idempotency** with a UNIQUE `event_id` + 10-minute stale-claim stealing (handles concurrent delivery, dead workers, function timeouts), out-of-order protection via `event.created`, and the history-table pattern with a partial unique index (one `is_current` row per tenant). Provisioning idempotency prevents double phone purchases on retries. Overage-attach failure → Sentry (never silent).
- **Meter integrity:** both posters use `event_name:"voco_calls"` (agent `post_call.py:483` + `retry-meter-events` cron); `identifier=overage_{call_id}` → Stripe dedupes → **can't double-bill**. Live `stripe_meter_failures` = **0**.
- **Outbox drains are all scheduled** (`vercel.json`): `retry-meter-events` (6h), `retry-owner-notifications` (5 min), `reconcile-stripe-webhooks` (6h, a missed-webhook safety net), `send-recovery-sms` (1 min).
- **Annual quota is correct:** annual limit = the *monthly* allotment (40/120/400), not ×12 — because the overage item is monthly and resets monthly (`stripe-plans.js:8-13`). Subtle and right.
- `invoice.paid` usage reset has a 0-row-match retry guard so a renewal race can't carry a full cycle's usage forward.

**Findings:**
- **PAY-1 (CRITICAL / launch):** sandbox-only — see above.
- **PAY-2 (MEDIUM — verify):** the agent's past-due gate (`subscription_gate.py:40-51`) **fails open when `current_period_end` is null** — and all 7 live subs have it null. During trial that's harmless, but if it stays null after conversion to active/past_due, the 3-day grace never triggers and a delinquent tenant **keeps the AI forever**. Confirm Basil's item-level `current_period_end` actually lands in the DB on a real active subscription.
- **PAY-3 (LOW):** null `current_period_end` may also blank the renewal date on the billing dashboard.

---

### 6.4 Dashboard, Setup Checklist & CRM
*Verdict: mostly works — activation is real, not cosmetic. DASH-1 CONFIRMED high; DASH-2 CONFIRMED; DASH-3 downgraded to low/plausible.*

The core activation loop is real and well-built. The setup checklist's ESSENTIAL tier is mirrored by a single-source-of-truth DB function that the phone webhook actually enforces. The biggest issues are a meter-vs-gate decoupling and a full invoicing/estimates product no tenant uses.

**What genuinely works**
- **Checklist → real gate.** `is_tenant_call_ready(uuid)` (`migration 078`, verified applied live) checks business name, ≥1 active service, working hours, an active/trial/past_due sub, AND `test_call_completed`. The inbound webhook calls it and forwards callers to the owner until it's true (`twilio_routes.py:154,273`). Fails **open/safe**. This is the good part.
- **Notifications hold on defaults** — booked SMS+email fire even if the user never opens settings.
- **Realtime is clean** — refs avoid socket teardown on filter changes, disconnects refetch missed rows, `removeChannel` on unmount. No leak.
- **Tenant isolation intact** — RLS enforced even where routes omit an explicit filter.

**Real problems**
- **HIGH — the dashboard can lie about readiness (DASH-1).** Every checklist item renders a "Mark done" button (`ChecklistItem.jsx:148-160`), and a manual override marks essentials complete (`setup-checklist/route.js:250`). `CallReadinessCard` then shows green "You're call-ready." But `is_tenant_call_ready` reads raw columns and ignores overrides, so the webhook keeps forwarding every call. *Verifier extra — a **silent** divergence needs no click:* `configure_hours` auto-completes on `!!working_hours`, which is **true for an empty `{}`**, but the gate rejects `{}` — so a tenant with `working_hours={}` gets a green meter while the AI can't book.
- **MEDIUM — Jobs page crashes to the error boundary (DASH-2).** Two `useMemo`s sit after `if (error) return (…)` (`jobs/page.js:406,492,498`) → "rendered fewer hooks than expected" on any fetch failure; the intended inline Retry UI never shows. Fix: hoist the hooks above the early return.
- **LOW/PLAUSIBLE — test-call verification depends on an unregistered-if-unlucky LiveKit webhook (DASH-3).** `test_call_completed` flips only via the `participant_joined` webhook, whose own docstring warns it never auto-completes unless registered in LiveKit Cloud. The 3/5 tenants with it true are all explained by the migration-078 backfill, so the webhook path is unconfirmed. Feeds DASH-1.

**Over-engineering:** full invoicing (0/5 enabled), estimates (4 test rows), merge/unmerge/undo (0 audit rows ever). *(See §4.)*

---

### 6.5 Voice: Call Routing & Live Agent  *(core)*
*Verdict: partial. Primary audit only (not independently re-verified) — but the evidence is concrete. VOICE-1 is the scariest claim; confirm the live LiveKit Cloud rule as a 2-minute check.*

The AI answer→triage→book→notify loop works in production (139 calls reached `analyzed`, last 2026-06-26), and the highest-stakes primitive — atomic booking — is production-grade. But the call-to-agent handoff is held together by out-of-band cloud config the repo can't reproduce, and two "safety net" paths are weaker than they claim.

**CRITICAL — inbound dispatch works only via config drift (VOICE-1).** The worker registers as a **named agent** (`agent.py:1421-1424`), which disables automatic dispatch. The committed `sip-dispatch-rule.json` has only `dispatchRuleIndividual.roomPrefix:"call-"` — **no `roomConfig.agents` binding**, no `CreateAgentDispatch`, no `RoomConfiguration.agents`. Your own skill doc even documents the binding the file lacks. Production works only because the **live** cloud rule was hand-edited. Consequence: re-applying the repo rule or standing up any fresh/DR environment **silently breaks every inbound call** — caller connects, `call-*` room is created, no agent joins, dead air until hangup. There is no committed source of truth.

**HIGH — the "test call" never checks the AI answered (VOICE-2).** `test_call_completed` flips purely on the **owner's** phone leg joining (`webhooks/livekit/route.js:85-118`); it never inspects the agent or any audio. Worse, the test call is placed into a room `test-call-…` that doesn't match the `call-` dispatch prefix and has no `agents` config — so in a clean env the agent wouldn't join the *test* either, yet the flag still goes true. The signal proves "the owner's phone rang," not "the AI works."

**HIGH — `transfer_call` is a blind transfer with an undelivered whisper and a suspect target (VOICE-3).** `whisper_context` is built then only `logger.info`'d — never delivered (`transfer_call.py:61-67`). The transfer is a blind SIP REFER to `sip:{owner}@pstn.twilio.com` (`:83`), but the account's actual termination host is `voco-livekit.pstn.twilio.com` (`sip-outbound-trunk.json:3`). Likely unroutable → the `except` fires → the caller who asked for a human gets "sorry, offer a callback." Needs a live test.

**What's genuinely solid**
- **Atomic booking / no double-book (confirmed live).** `book_appointment_atomic` uses `pg_try_advisory_xact_lock` + overlap re-count + a real GiST exclusion constraint on `appointments`; opaque server-minted `slot_token`s (600s TTL) stop the LLM fabricating a time.
- **Fail-closed Twilio signature verification** (`security.py`) — 503 when the auth token is unset, the unsigned bypass gated to non-prod, and the catch-all handler won't mask a 403 into a 200.
- **Boot preflight** hard-fails `start`/`dev` if any cascade key (OpenAI/Deepgram/ElevenLabs) is missing.
- **Voice front door never 5xx's** — every error branch returns AI-SIP TwiML, so a DB/timezone error routes the caller to the AI, not Twilio's "application error, goodbye."
- **Prompt robustness** — outcome-framed, reserves "available/booked/confirmed" behind tool results, scopes its silence license strictly to the tool-run window (avoiding the prior deadlock failure mode).

**LOW — empty/garbage `phone_number` rows are a latent mis-routing landmine (VOICE-4)** — live values include `""`, `"+12"`, and nulls; constrain to non-empty E.164 at write time.

**Over-engineering:** VIP path (dead), goodbye diagnostics (~150 lines for an old-model race), outbound caps + SMS forwarding (premature). *(See §4.)*

---

### 6.6 Voice: Post-Call Pipeline, Notifications & Reliability  *(core)*
*Verdict: mostly works — the headline "outbox not fed" risk is genuinely fixed, but a real residual gap survives and is visible in live data. Primary audit only.*

The prior "owner-notification outbox NOT fed → emergency alerts silently drop" risk is **genuinely closed**: `post_call.py` §7 writes an `owner_notification_failures` row on every send failure, the 5-minute drain cron exists, and both outbox tables are empty now. Booking is durable, metering is idempotent, and the alert correctly runs before billing. What remains is a latency-bounded starvation window (confirmed firing) plus a single-vendor triage dependency.

**Solidly good (keep):**
- **Owner alert wins the budget over billing** — the Stripe meter POST is deferred to §7.5, after notifications, each capped at 3s.
- **Emergency ignores tenant prefs** — `is_emergency` forces SMS+email even for a tenant who muted routine alerts.
- **Booking can't be lost by a post-call failure** — `atomic_book_slot` writes the row synchronously mid-call; post-call only reconciles. Confirmed live (aborted-pipeline calls still show `booking_outcome='booked'`).
- **Metering is idempotent** — `ON CONFLICT (call_id) DO NOTHING` + Stripe identifier dedup.

**HIGH — owner alert can still be silently dropped (PC-1).** The whole pipeline runs under one `asyncio.wait_for(timeout=8.0)` (`agent.py:967-996`), capped by the SDK's 10s SIGKILL. Before §7 (notifications) fire, it does ~9 sequential Supabase round-trips **plus** a 2.5s Groq call **plus** an uncapped `services` query and an uncapped `record_call_outcome` RPC. On a slow call the budget is exhausted before §7 — and this path writes **no outbox row and has no retry**. **Not theoretical:** 6/139 analyzed calls (~4%) have `urgency_classification IS NULL` (pipeline aborted before the near-final update), including the most recent call (2026-06-26). Fix: persist the alert intent to the outbox **first**, then send.

**MEDIUM-HIGH — emergency detection depends on one external LLM that fails to "routine" silently (TRI-1).** `run_llm_scorer` returns `routine` on any exception/timeout with no alerting (`layer2_llm.py:56-57`), and 85/152 calls (56%) were decided by layer2. Layer1's keyword net is narrow — "water is pouring through my ceiling" matches nothing and falls to the fragile layer2. Compounds with prefs: for a tenant who muted routine alerts (or has no phone), a misclassified emergency yields **zero** notification.

**MEDIUM — calendar push + caller confirmation SMS are fire-and-forget with no retry (BOOK-1)** — a fast hangup cancels them; the booking may never reach the owner's calendar. No reconciliation cron.

**LOW — layer3 triage never fired in 152 calls (TRI-2)** yet adds an uncapped query to the alert budget — cut it. **LOW — flagship SMS can't reach 3/5 tenants with no owner phone (CFG-1).**

> **Open question worth heeding:** this fixed path has near-zero live exercise (1 call in 14 days, all from one test number). Empty outboxes do **not** prove end-to-end delivery — validate with one real emergency call before relying on it. Also confirm the Vercel plan supports minute/5-minute crons.

---

### 6.7 Auth, Database & Multi-Tenant Isolation
*Verdict: **works as intended** — and verified against the live database by row-level impersonation. All 4 findings CONFIRMED as low/medium hygiene items; none are core-loop risks.*

This is the subsystem that ends the company if it's broken — and it holds up. I found no way for one contractor to read or write another's data.

**What was verified live (not just code):** impersonating a real tenant at the Postgres role level, "Make It AI" saw **80 of 152** calls (its own), **3** customers, **1** tenant row (its own). `anon` saw **0** across every table. All 41–42 public tables have `rowsecurity = true`; no RLS-disabled tables; no SECURITY-DEFINER views.

**Application layer is correct too:** tenant identity is **never** taken from client input (grep for `body.tenant_id` etc. → zero matches); it's always resolved server-side via `getTenantId()`. `[id]` routes use `.eq('id',id).eq('tenant_id',tenantId)` → `not_found` instead of leaking. All 7 SECURITY DEFINER RPCs are **service-role EXECUTE-only with pinned search_paths** — no anon/authenticated privilege-escalation vector. Admin API routes each independently call `verifyAdmin()`.

**Findings (all hardening):**
- **MEDIUM — RLS is the sole defense layer, no REVOKE baseline (AUTH-1).** `anon`/`authenticated` hold full CRUD grants on ~38 of 42 tables (Supabase default). Safe today (RLS enabled everywhere), but a *future* table shipped with RLS forgotten would be wide open via the browser anon key. Add a REVOKE-by-default baseline + a CI/advisor gate.
- **LOW — always-true anon INSERT on `phone_inventory_waitlist` (AUTH-2)** enables unauthenticated spam writes directly to PostgREST (the app uses the service-role client anyway). Drop the policy + rate-limit the route.
- **LOW — no migration tracking (AUTH-3).** `supabase_migrations.schema_migrations` doesn't exist; the 77–78 files were applied out-of-band. Schema is at HEAD, but `db push`/`db diff` won't work. Backfill it.
- **LOW — `btree_gist` in `public` + leaked-password protection off (AUTH-4).** Cosmetic / minor; leave `btree_gist` (moving it risks the exclusion constraint).

> **Future flag (not a bug):** the whole model assumes **one owner = one tenant** (`tenants_owner_id_key` UNIQUE). If staff/team logins are ever on the roadmap, every RLS policy will need to move to a memberships/roles table — a deliberate future decision.

---

### 6.8 Scheduling & Calendar Sync
*Verdict: mostly works — booking core is strong, external sync is the soft underbelly. SCHED-1 downgraded critical→high (recovery machinery exists but is broken); all others CONFIRMED.*

Caller-vs-caller double-booking is properly prevented at the DB; the risk is caller-vs-owner's-real-calendar, which rides on a mirror that is currently frozen in production.

**Genuinely solid (keep):**
- **Atomic booking is correct** — advisory lock + COUNT pre-check + GiST exclusion constraint backstop (`019_…`). **Live: 0 overlapping non-cancelled appointment pairs** across 42 appointments.
- **Timezone handling — the stated prior pain point — is now careful.** Every boundary is built via `ZoneInfo`; all-day blocks are correctly expanded to tenant-local bounds; slot tokens defend against the LLM reconstructing a naive wall-clock ISO (the old 8-hour-off bug class). The live `working_hours` JSON shape matches what the calculator reads — no key drift.

**HIGH — AI books against a frozen mirror (SCHED-1).** The agent's availability read (`_availability_lib.py:196`) pulls `calendar_events` with **no `last_synced_at` gate**. **Live: both connected calendars last synced 2026-06-18 — ~16 days stale** — despite a daily `renew-calendar-channels` cron that *should* advance it every run. *Verifier correction:* the recovery machinery (staleness detection @26h, Sentry "frozen" alerts, auto-reanchor, a "Synced X ago" card) **already exists** — the sharper finding is that it's present yet **still broken 16 days**, meaning the recovery loop itself isn't running (most likely `CRON_SECRET` unset on Vercel → the route 500s, or `invalid_grant` from an unpublished Google OAuth app). Downgraded to high because it's conditional (needs a calendar-connected tenant who added a conflicting event) and both frozen calendars are your own test tenants — but even a *healthy* cron leaves the mirror up to 26h stale by design.

**HIGH — only appointment-vs-appointment overlap is DB-enforced (SCHED-2).** The GiST constraint covers `appointments` only; `calendar_events` are a soft check against the snapshot. With SCHED-1's stale mirror this becomes routine real double-booking. Fix: force a targeted freeBusy re-check for the primary calendar immediately before commit.

**MEDIUM — null `working_hours` = silent "never available" (SCHED-3).** 2/5 tenants are null; the calculator returns `[]` for every day with no default and (beyond a generic checklist nudge) no "AI can't book" warning.

**LOW — OAuth tokens stored plaintext (SCHED-4)** — mitigated by RLS (service-role-only), but encrypt the refresh token given its long-lived access.

**Over-engineering:** the per-zone travel-buffer matrix is **dead code** (`zone_id` always NULL on real bookings — `book_appointment.py:497` hardcodes `zone_id=None`); the multi-zone model only ever runs flattened. Delete `zone_travel_buffers`; keep the flat buffer + flat coverage list. *(See §4.)*

---

### 6.9 Integrations (Jobber & Xero)
*Verdict: partial — high craftsmanship, near-zero usage, both live connections dead. INT-1 CONFIRMED high; INT-2 downgraded high→medium (no healthy connected tenant pays it today).*

The engineering quality is genuinely high (timing-safe HMAC, shielded token rotation, graceful degradation). The problem is that this is a **large, fragile, high-maintenance surface built for demand that doesn't exist**, and the one real-world signal says it isn't staying connected.

**Live reality check:** the entire `accounting_credentials` table has **two rows, both broken** — Xero (fetched customer context exactly **once**, ~3 min after connect, now `token_refresh_failed`) and Jobber (`last_context_fetch_at = null` — **never served a single lookup**, now `token_refresh_failed`). In 2.5 months this subsystem produced context for **one** call. Likely cause: the keep-fresh cron is a June addition, so Apr→June nothing rotated tokens and the unused grants aged out.

**HIGH — dead-connection recovery is a single easily-missed email (INT-1).** Once a row hits `error_state`, the keep-fresh cron skips it **forever** (`refresh-integration-tokens/route.js:49`), and the only nudge is one email + a dashboard banner (never re-sent). *Verifier extra (worse):* the **Python agent-side** refresh path sets `error_state` with **zero email** (`xero.py:301`, `jobber.py:301` deliberately never email), and the JS notifier is then suppressed forever — so a first fatal refresh **in-call** (the most likely place) leaves the owner with *no notification at all*.

**MEDIUM — pre-call context fetch blocks the greeting (INT-2).** `agent.py:407` awaits `fetch_merged_customer_context_bounded(timeout=2.5)` **before** the greeting; the Xero path has **no cache** (`xero.py:474`), so a healthy Xero tenant eats ~1.5–2.5s of dead air before "Thanks for calling" on every call — and if it exceeds 2.5s the work is discarded. The in-code "caller-perceived latency is zero" comment is false. Fix: greet first, inject context via a chat-ctx update before the first model turn. *(Downgraded because there are currently zero healthy connected tenants paying this cost.)*

**LOW — Jobber webhook cache invalidation misses non-US tenants (INT-3)** — hardcoded `DEFAULT_PHONE_REGION='US'` in the webhook vs caller-derived region on the read path, and the broad tag only fires when `phones.length===0`. Latent staleness for UK/SG/AU Jobber tenants.

**What works well:** timing-safe HMAC on both webhooks; Jobber `external_account_id` write-back with rollback-on-probe-failure; fatal-vs-transient refresh classification; the lease-based refresh-lock (correct, if premature); RLS now enabled on the lock table. **No tenant-isolation issues** — all reads resolve tenant server-side.

**Over-engineering:** the Phase-57 schedule-mirror (15-min full-window poll for 0 users), dual-provider merge layer, cross-language refresh-lock, and dead Xero per-phone cache tags. This is **the most over-scoped area of the product.** *(See §4.)*

---

## 7. Live-data snapshot (as of 2026-07-04)

Facts pulled from the live DB / Stripe during this audit — useful as a baseline:

| Metric | Value |
|---|---|
| Tenants | 5 |
| Calls (total / analyzed) | 152 / 139 |
| Pipelines that aborted before completion | ~4% (6/139, incl. the most recent call) |
| Subscriptions | 7 — **all `trialing`, 0 active/paid** |
| Stripe account | **sandbox**; all prices `livemode:false` |
| `stripe_meter_failures` / `owner_notification_failures` | 0 / 0 (outboxes empty) |
| Stranded paying tenant (paid, no number) | **1** (`f4665eef`) |
| `phone_inventory` (SG numbers) | **0 rows** (SG onboarding closed) |
| `accounting_credentials` (Jobber/Xero) | 2 rows, **both dead**; 1 never used |
| Connected calendars | 2, **both frozen ~16 days** |
| Invoicing-enabled tenants | 0/5 (13 test invoices, 4 test estimates) |
| `customer_merge_audit` rows | 0 (ever) |
| Public tables with RLS enabled | 41–42 / all |
| Cross-tenant leak found | **none** |

## 8. Open questions to resolve (need Vercel/LiveKit console access — outside this audit's reach)

1. **Does the live LiveKit Cloud SIP dispatch rule contain the `voco-voice-agent` binding?** (VOICE-1) — the 139 analyzed calls imply yes, but it must be captured as code.
2. **Are all `vercel.json` crons actually executing?** (SCHED-1, PC-1) — a Hobby plan or an unset `CRON_SECRET` would silently break the calendar-refresh + owner-notification drains. This likely explains the 16-day calendar freeze.
3. **Does `current_period_end` populate on a real *active* subscription?** (PAY-2) — if not, the past-due gate never enforces.
4. **Is the LiveKit `participant_joined` webhook registered?** (DASH-3) — determines whether new tenants can legitimately complete the test-call essential.
5. **Was `f4665eef` stranded by the inline fallback or a never-delivered webhook?** — either way there's no recovery path; backfill it and add the sweeper.
6. **Root-cause the Jobber/Xero token death** — did the keep-fresh cron ever run + does Xero's 60-day non-use expiry get reset by rotation for a low-traffic tenant?

---

*End of audit.*
