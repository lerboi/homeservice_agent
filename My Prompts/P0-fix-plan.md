# P0-2 … P0-5 — Verification & Fix Plan

**Date:** 2026-07-09
**Method:** Each issue was investigated end-to-end against current code + live Supabase, then handed to an independent adversarial reviewer who tried to (a) prove it's a false positive and (b) prove the proposed fix would break something. Every mechanical claim was verified in the actual code / SDK source / live DB.

**Implementation status (updated 2026-07-09):** the three unblocked fixes — **P0-3, P0-4, and the P0-5/DASH-1 half** — are now **implemented and verified in the working tree (uncommitted)**. **P0-2** and the **P0-5/VOICE-2** half remain blocked on the LiveKit Cloud checks below. See the Status column and the *Implementation status* section.

## Bottom line

| Issue | Real bug? | Confidence | Severity (corrected) | Code fix safe now? | Status (2026-07-09) |
|---|---|---|---|---|---|
| **P0-2** Dispatch binding not in repo | ✅ Confirmed | High | **DR / drift landmine** (not "every redeploy dies") | ⛔ Blocked — needs LiveKit Cloud inspection first | ⛔ Not started (blocked) |
| **P0-3** verify-checkout strands paying tenants | ✅ Confirmed | High→Certain | High (active failure mode) | ✅ Yes, with 2 corrections | ✅ Implemented (uncommitted); `f4665eef` backfill pending |
| **P0-4** Owner alert can be silently dropped | ✅ Confirmed | High (mechanism certain, rate unmeasured) | High (latent) | ✅ Yes, with 3 corrections | ✅ Implemented (uncommitted); TRI-1 triage-recall half deferred |
| **P0-5** "Call-ready" can lie | ✅ Confirmed | Certain | DASH-1 = false-confidence (fail-safe routing); VOICE-2 = test proves nothing | ⚠️ Split: half now, half blocked on P0-2 | ◑ DASH-1 implemented (uncommitted); VOICE-2 blocked on P0-2 |

**None were false positives.** But two important things changed on close inspection:
1. **Two fixes have hard external prerequisites I cannot satisfy from here** (LiveKit Cloud CLI/console state). Writing those fixes blind could *cause* the very outage they aim to prevent.
2. **Every "naive fix" from the original audit needed a correction** to avoid introducing a new regression. Those corrections are below.

---

## Implementation status (2026-07-09)

**Verified:** ESLint clean on all changed JS; main-repo jest baseline **identical** with vs without the changes (24 pre-existing failures, all unrelated to these edits) **+3 new passing tests**; livekit-agent `py_compile` clean + full pytest **505 passed** (the 1 failure, `test_incoming_call_vip_lead`, fails on baseline too — unrelated VIP path). Nothing committed (main repo on `main`).

### ✅ P0-3 — implemented
- **New `src/lib/tenant-activation.js`** — single `activateTenant()` (seed hours/timezone + provision + welcome/failure email + `isValidE164` gate + re-SELECT concurrency guard), shared by the webhook and the fallback.
- **`stripe/webhook/route.js`** — inline seed+provision block replaced with `activateTenant()`; helpers moved out; all exports the reconcile cron imports are preserved.
- **`onboarding/verify-checkout/route.js`** — calls `activateTenant()` **after** billing sync, in try/catch (correction #1: the billing rescue is never blocked by a provisioning error).
- **New `cron/sweep-unprovisioned-tenants` + `vercel.json`** — nightly **detect-and-flag** (E.164-validating); **no autonomous Twilio purchase** (correction #2: money-safety, since local status is stale while the webhook lags).
- **Deferred:** fully-atomic provisioning claim (needs a schema column — re-SELECT guard used instead); **`f4665eef` backfill** (do via a one-off `activateTenant()` call **after** confirming it's a real paying account).

### ✅ P0-4 — implemented
- **`lib/triage/layer3_rules.py`** — services query capped (1.5s) **inside** `apply_owner_rules`' try (correction: not wrapped around it, which would propagate a timeout and downgrade a real emergency to routine).
- **`lib/write_outcome.py`** — `record_call_outcome` RPC capped (2s) → caller degrades to call-metadata; the alert still fires.
- **`post_call.py`** — **persist-first** for `emergency`/`urgent` (write the outbox row before the in-band send, delete on success) so a SIGKILL/timeout can't drop the alert; the `*/5min` cron re-sends. **Did not** reorder `record_outcome` (correction: capped instead — reordering reverses a deliberate inquiry-creation fix) and **did not** raise the 8s wall.
- **Deferred (TRI-1 triage-recall):** the layer1 floor does **not** fix the non-keyword-emergency misclassification — the real fix is *don't mute emergencies at the pref layer* / *escalate-on-uncertainty in the layer2 fallback*. Not done in this pass.

### ◑ P0-5 — DASH-1 implemented, VOICE-2 blocked
- **`api/setup-checklist/route.js`** — `Mark done` no longer satisfies the 4 non-test essentials; `configure_hours` rejects empty `{}` (mirrors the gate).
- **`components/dashboard/ChecklistItem.jsx`** — hides `Mark done` on those essentials (keeps it for `make_test_call` + recommended/optional items).
- **`api/working-hours/route.js`** — rejects empty/non-object `working_hours` (defense-in-depth against the only remaining `{}` path).
- **`tests/agent/setup-checklist.test.js`** — the one stale test (which asserted the old "mark-done fakes an essential" bug) rewritten to the new contract; +3 tests lock in the fix.
- **Blocked:** tightening `make_test_call` + VOICE-2 (dispatch the agent into the test room + flip on the agent leg) needs P0-2's dispatch mechanism **and** confirmation the LiveKit webhook is registered; `make_test_call` deliberately keeps its mark-done fallback until then.

### ⛔ P0-2 — not started (blocked)
No changes made. Requires `lk sip dispatch list` against the live LiveKit project first (see Prerequisites) so the committed rule mirrors reality — applying a guessed shape could itself cause the inbound outage.

---

## ⚠️ Prerequisites that must be resolved BEFORE writing code

These are the "will it break anything?" gates. Two issues cannot be safely implemented until these are answered:

1. **P0-2 / P0-5-VOICE-2 — inspect the live LiveKit Cloud SIP dispatch rule.** Run `lk sip dispatch list` (LiveKit CLI) against the production project and capture the exact live rule shape (roomPrefix, `roomConfig.agents`, field casing, metadata). Reason: the fix commits that binding into the repo, and if the committed shape doesn't match the live one, applying it would strip the agent binding and kill inbound. **We must mirror reality, not guess it.**
2. **P0-5 — confirm the LiveKit `participant_joined` webhook is actually registered** in LiveKit Cloud (Project → Settings → Webhooks → `/api/webhooks/livekit`). Live data proves it has **never fired** in production (every `test_call_completed=true` came from a migration backfill, not the webhook). If it isn't registered, tightening `make_test_call` would permanently strand every new tenant.
3. **P0-3 — confirm the live-mode Stripe webhook endpoint is delivering `checkout.session.completed`.** In the *test/sandbox* account the reviewer found **zero** webhook events delivered since 2026-03-26 — which is why the fallback (billing-only) is the *active* fulfillment path and tenants strand. This must be checked for the live-mode endpoint too; if live webhooks aren't delivering, the code fix helps but the root ops problem remains.

> Note on the "stranded paying tenant" `f4665eef` ("Voco Live"): it is a **US** tenant (so it is not the empty-SG-inventory case), but its Stripe subscription is a **sandbox/trialing** sub, and its name (plus `voco`, `leroyng`) strongly suggests it's an **internal/test account**. The *code bug that stranded it is 100% real and would strand a real live customer identically* — but do **not** blind-backfill these three with real Twilio numbers until you've confirmed via live Stripe whether they're real paying accounts (avoids paying for dead test numbers).

---

## P0-2 — Inbound SIP dispatch binding lives only in LiveKit Cloud, not the repo

**Confirmed (high). Re-scoped: this is a disaster-recovery / reproducibility / drift landmine + a stale doc — NOT "any redeploy kills inbound calls."**

### Why it's real (verified)
- The worker runs in **explicit-dispatch mode**: `agent.py:1423` sets `agent_name="voco-voice-agent"`, and the pinned SDK's own source (`livekit-agents==1.5.7`, `worker.py:217-220`) states explicit dispatch means *"jobs will not be dispatched to rooms automatically."* `.env` also sets `LIVEKIT_AGENT_NAME` (a second, independent explicit-dispatch trigger via the env fallback at `worker.py:500-508`).
- The committed `sip-dispatch-rule.json` is, in full: `{"name":"voco-inbound-dispatch","rule":{"dispatchRuleIndividual":{"roomPrefix":"call-"}}}` — **no agent binding**.
- Exhaustive grep of **both** repos: no `CreateAgentDispatch` / `room_config.agents` / `RoomConfiguration` anywhere in code. No deploy step applies any rule (`Dockerfile:23` CMD is just `python -m src.agent start`; no CI/Procfile/Makefile/`*.sh`).
- 139 inbound calls reached `status='analyzed'` (a status only the agent writes) → the live LiveKit Cloud rule *must* carry a binding that the repo doesn't. (Can't read LiveKit Cloud from here — this is sound inference, honestly flagged.)
- The skill doc `voice-call-architecture/SKILL.md:421-422` **falsely claims** the committed rule already contains `agentName` — a stale doc that masked this.

### Correction to the audit's wording
A routine **Railway redeploy does NOT re-apply the dispatch rule** (the Dockerfile never touches it), so a normal redeploy does **not** break inbound. What breaks inbound is **applying the committed `sip-dispatch-rule.json` to LiveKit Cloud** (the only rule the repo has), or the live rule being reset/lost — with no repo source of truth to restore it and no drift detection. So the honest severity is "latent DR/reproducibility risk," not "imminent outage." (Prod has worked as recently as 2026-06-26.)

### The fix — Option (a): commit the binding, keep explicit dispatch
Recommended because production already runs explicit dispatch, so this is a **zero runtime-model change**.
1. `sip-dispatch-rule.json` — add the agent binding **after mirroring the exact live shape** from `lk sip dispatch list`.
2. Add a committed, **idempotent** apply step (documented as the SIP-config deploy step), run only when the JSON changes — **never** per container boot (SIP dispatch rules are a project-level singleton; per-boot create = duplicate rules = undefined routing).
3. `onboarding/test-call/route.js` — dispatch the agent into test-call rooms too (they're named `test-call-*`, which don't match the `call-` prefix). *(This is the shared piece with P0-5.)*
4. Fix the stale SKILL doc.

### Will it break anything? — the corrections the reviewer found
- 🔴 **Placement matters (would otherwise cause the outage):** the naive "add top-level `roomConfig`" is likely **wrong** — in the current protocol, top-level `room_config` (field 9) is **deprecated**; the live field is nested `room_config` (field 10) inside the rule message (`@livekit/protocol` `.d.ts:16289-16291` vs `16421-16425`). Placing it wrong serializes to the dead field and leaves the agent **unbound**. → *Mirror the exact live shape from `lk sip dispatch list`; place the binding inside `rule`.*
- 🟠 **Prefer `UpdateSIPDispatchRule` over delete-then-create** — a delete+create apply step opens a window with no inbound rule (dropped calls). The SDK has `UpdateSIPDispatchRuleRequest`.
- 🟠 **test-call double-dispatch** — the webhook route comment (`webhooks/livekit/route.js:~95`) implies an agent already reaches test rooms via live config; adding a second dispatch could request two agent jobs. Verify the live test-room mechanism first.
- Option (b) (drop `agent_name` for automatic dispatch) is **not** a pure repo change and is riskier: you'd also have to remove `LIVEKIT_AGENT_NAME` from Railway (or it's a silent no-op) and strip the live binding, and the agent would then join *every* room in the project. **Not recommended.**
- Repo-side code is otherwise safe: no test asserts the JSON shape; `test-call/route.js` is the only `createRoom` caller.

**Verdict: legit; fix is sound but BLOCKED on inspecting the live rule first. I can't guarantee "it will all work" without that LiveKit Cloud read.**

---

## P0-3 — verify-checkout fallback fulfills billing but never provisions/seeds

**Confirmed (certain on the code divergence; the reviewer strengthened it beyond the original).**

### Why it's real (verified)
- **Fallback** `verify-checkout/route.js:110-152` (`fulfillSubscription`) does exactly three things — set `onboarding_complete`, attach the overage item, sync the subscription — and **never imports twilio/Resend, never calls `provisionPhoneNumber`, never seeds `working_hours`/`timezone`**.
- **Webhook** `stripe/webhook/route.js:454-599` does all of that (seed + provision + welcome/failure email). Billing fulfillment and activation have silently forked into two writers; only one activates the tenant.
- It's reachable in prod: the embedded checkout poll sends `session_id` from attempt 3 (`checkout/page.js:140`), so ~6s after return-from-Stripe the fallback fulfills **billing only**, the client shows "success," and the user lands paid with no number.
- **Decisive new evidence:** `stripe_webhook_events` has **no `checkout.session.completed` after 2026-03-26** and **zero events of any type for `f4665eef`**. The fallback is the *only* code path that sets `onboarding_complete=true` without recording an event → the fallback provably fulfilled `f4665eef`, and the webhook (with its provisioning) never ran. So this is the **active everyday failure mode**, not a rare race.
- No healing path: admin re-provision is hard-gated to `country==='SG'` (`admin/tenants/[id]/route.js:67-72` — a US tenant can't be healed); `reconcile-stripe-webhooks` only replays `processed=false` rows; no sweeper exists.

### The fix
Extract seed + provision + welcome/failure into a shared `src/lib/tenant-activation.js` `activateTenant()`; call it from **both** the webhook and the fallback. Add a nightly sweeper for onboarded, actively-subscribed tenants whose `phone_number` fails an E.164 regex (`^\+[1-9][0-9]{7,14}$` — catches the live `""` and `"+12"` junk a NULL check misses). Backfill `f4665eef`/`3b512e8d` via a one-off `activateTenant` call.

### Will it break anything? — the corrections the reviewer found
- 🔴 **Ordering (would otherwise be worse than today):** do **NOT** call `activateTenant` *before* `syncSubscription` in the fallback. The webhook's activation rethrows on provisioning write errors; if the fallback did that before creating the subscription, a Twilio hiccup would leave the user with **no subscription and an error screen** — strictly worse than today. → *Sync billing FIRST (guarantee the rescue), then provision best-effort in try/catch (non-fatal, flag `provisioning_failed` on error).*
- 🟠 **Don't reuse `handleCheckoutCompleted` wholesale** — its subscription-sync uses the event's `created` as the out-of-order version stamp; if the fallback passed `Date.now()`, a later real webhook would be wrongly skipped. → *Extract only the activation side-effects; keep the fallback's `subscription.created` stamp.*
- 🟠 **Concurrency (opens once the webhook is restored):** webhook + fallback could both provision before either writes `phone_number` → double Twilio purchase / double SG assign. The friendlyName/inventory reuse guards only cover *sequential* re-runs. → *Add an atomic conditional-UPDATE provisioning claim (not just a re-SELECT — that has a TOCTOU gap).*
- 🟠 **Sweeper must not trust local subscription status** (it's stale precisely because the webhook is down) → verify live Stripe status before spending Twilio money, and gate on an active/trialing/past_due `is_current` sub. Prefer manual/verified backfill for the 3 known (likely-test) tenants.
- 🟢 **Preserve exports:** `reconcile-stripe-webhooks` imports `handleCheckoutCompleted` etc. by name — keep those exports intact; the reconcile cron then inherits the shared activation for free.

**Verdict: legit, high confidence. Code fix is safe with the ordering + concurrency corrections. The most urgent *ops* item is confirming the live-mode Stripe webhook is actually delivering.**

---

## P0-4 — Owner emergency alert can be silently dropped before the notify step

**Confirmed (high). Mechanism 1 is certain; production drop *rate* is unmeasured.**

### Why it's real (verified)
- The whole post-call pipeline runs under **one** `asyncio.wait_for(timeout=8.0)` in the sole shutdown callback (`agent.py:967-996`, registered at `:1021`), further capped by the SDK's ~10s SIGKILL. The abort handler (`997-1005`) **only logs** — no outbox row, no delivery.
- The owner-alert step (§7) sits **after** the slow work: §6 triage (Groq layer2 ≤2.5s + an **uncapped** layer3 services query, `layer3_rules.py:21-29`) and §6.5 `record_outcome` (**uncapped** RPC, `write_outcome.py:106-111`), plus §2/§2b/§4 round-trips. The durable `owner_notification_failures` row is written **only inside §7's per-send `except`** (`405-424`). So any abort in the §2→§7 window drops the alert with **no outbox row and no retry**.
- No alternate delivery path (refuted): the owner senders are called only from §7; `transfer_call` is a live transfer not an alert; the recovery-SMS cron targets the **caller**. One shutdown callback, pipeline inside it.
- Mechanism 2: `layer2_llm.py:56-57` returns `'routine'` on any error silently; the `is_emergency` override is the **only** bypass of `notification_preferences`, and a **live tenant mutes SMS+email for non-booked outcomes** → a misclassified emergency that didn't book = **zero notification, no timeout even needed**.

### Honest caveat on severity
The 6/139 (~4.3%) NULL-urgency calls are a **strong proxy but not proof** of a real dropped alert — `urgency_classification` is written in §9, *after* §7, so a NULL-urgency call could have alerted fine and only aborted between §7 and §9. And all 6 are from one dev/test number. So: **certain latent code path, unmeasured production incidence.**

### The fix (both parts; corrected)
- **(A) Persist-first:** UPSERT the rendered owner-alert payload to `owner_notification_failures` **before** the in-band send, delete on success. The `*/5min` retry cron then guarantees delivery even on SIGKILL. *(Migration 076 + the cron + the payload contract are all verified live and match byte-for-byte — no schema/cron change needed.)*
- **(B) Reach §7 fast + decide emergency synchronously:** cap the layer3 query and `record_outcome` so §7 is reliably reached in budget.

### Will it break anything? — the corrections the reviewer found
- 🔴 **Do NOT move `record_outcome` (§6.5) after §7.** That reverses a documented 2026-04-21 fix that deliberately put it earlier to guarantee inquiry-row creation (else "customer rows with `inquiry_count=0`"). And it buys **zero** benefit — the notification builders (`notifications.py:75-110`) use none of the CRM ids. → *CAP §6.5, don't reorder it.*
- 🔴 **Cap layer3 INSIDE `apply_owner_rules`' existing try** (`layer3_rules.py:21-31`), not around it. Wrapping it around (`classifier.py:47`) propagates the `TimeoutError` up to `post_call.py:245-248`, which **resets urgency to routine** — downgrading a real emergency.
- 🟠 **The layer1 "floor" does NOT fix mechanism 2.** A non-keyword emergency is layer1-routine too, so a layer1 floor adds no override in that exact case. Use it only to preserve a synchronous urgency across the restructure; treat the muted-tenant misclassification as a **separate** triage-recall item (real fix: don't let prefs mute *emergencies*, or escalate-on-uncertainty in the layer2 fallback).
- 🟠 **Don't raise the 8s wall** toward 10s — it's a deliberate margin against the SIGKILL. Durability comes from persist-first + caps.
- 🟢 **Scope persist-first to emergency/high-priority** to limit duplicate-send exposure and the extra in-budget DB round-trips (persist adds up to 4 writes into the very budget it protects). Duplicate alerts are explicitly acceptable (cron is at-least-once); a dupe beats a drop.
- 🟢 No test asserts the ordering or outbox-only-on-failure (`test_goodbye_diag.py` only checks the handler logs), so the change won't break the suite.
- *Recommended before finalizing cap values:* add `perf_counter` breadcrumbs to measure what each pre-§7 step actually costs on real calls.

**Verdict: legit (mechanism certain). Safe with the 3 corrections. Fully implementable now — no external prerequisite.**

---

## P0-5 — "Call-ready" can be green while the AI isn't answering (DASH-1 + VOICE-2)

**Confirmed (certain). Two severity nuances + one critical fix-ordering gate.**

### Why it's real (verified)
- **DASH-1:** the meter's `callReady` derives from checklist `complete = autoComplete[id] || markDoneOverride` (`setup-checklist/route.js:250`, callReady `:420-438`). `markDoneOverride` is a **one-click "Mark done" button rendered on every item including essentials** (`ChecklistItem.jsx:148-160`). The enforced gate `is_tenant_call_ready` (`078_call_readiness_gate.sql:28-45`) reads **raw columns**, never consults overrides, and rejects `working_hours in ('null','{}')`. The Twilio webhook gates on the RPC (`twilio_routes.py:154-178, 272-298`). → mark essentials "done" → dashboard green, but the gate stays false and forwards every call to the owner.
- **VOICE-2:** `test_call_completed` flips only on the **owner's** SIP leg joining (`webhooks/livekit/route.js:85-117`); the agent participant is explicitly ignored. The test room is created with **no agent dispatch** (`test-call/route.js:32-39`), named `test-call-*` (doesn't match the `call-` prefix), and the agent is explicit-dispatch — so it never joins. The owner connects to a **silent, agent-less room** and the flag flips true anyway. (The agent entrypoint is already test-aware at `agent.py:308-320` — only dispatch wiring is missing.)

### Severity nuances (be honest)
- DASH-1 is a **false-confidence *display* bug**, not a mis-routing bug — routing is gated by `is_tenant_call_ready` and **fails safe** (forwards to owner). Harm = owner distrust/disengagement, not calls hitting a broken AI.
- Both DASH-1 paths are currently **latent**: **zero** tenants have any `checklist_overrides`, and no tenant has `working_hours={}`. So nothing is showing a false green today.

### The fix — must be SPLIT
- **Ship now (low-risk): DASH-1 minus `make_test_call`.** In `deriveChecklistItems`, for the essentials `setup_profile / configure_services / configure_hours / setup_billing`, compute `complete = autoComplete[id]` only (drop mark-done); fix `configure_hours` to reject empty `{}` (`Object.keys(...).length > 0`, mirroring the gate). Hide "Mark done" on those essentials in `ChecklistItem.jsx`. *(Must fix at the `item.complete` source — CallReadinessCard and SetupChecklist both re-derive `callReady` from it client-side.)* Optional defense: `working-hours/route.js` reject non-object/empty `working_hours`.
- **Blocked / ship-with-P0-2: `make_test_call` tightening + VOICE-2.** Dispatch `voco-voice-agent` into the test room (the P0-2 mechanism) and flip `test_call_completed` only after the **agent** joins (ideally after first agent audio).

### Will it break anything? — the critical gate the reviewer found
- 🔴 **Do NOT drop Mark-done for `make_test_call`, and do NOT tighten the flip, until the LiveKit webhook is verified live.** `webhooks/livekit/route.js:27` documents Mark-done as the *intended manual fallback* "without [the webhook registered]." Live data proves the auto-flip has **never fired** (all `test_call_completed=true` are the migration-078 backfill). If the webhook isn't actually registered, tightening `make_test_call` **permanently strands every new tenant** at that gate → their live calls forward to the owner forever. → *Verify the webhook fires + the agent joins/speaks in a real test call first; keep the Mark-done fallback for `make_test_call` until then.*
- 🟠 **VOICE-2 must ship with P0-2** (shared agent-dispatch mechanism) so they don't drift.
- 🟢 **No regression to existing tenants** from the DASH-1 half: zero `checklist_overrides` live; the 3 `test_call_completed=true` tenants keep it (stricter flip only affects future writes) and stay `gate_ready=true`.
- 🟠 **Tests to rewrite** (`tests/api/livekit-webhook.test.js:63-94` codifies owner-leg-flip / agent-ignored; must invert). Test maintenance, not a runtime regression. *(Note: the investigator's claim that `tests/agent/setup-checklist.test.js` breaks was overstated by the reviewer — that test still passes.)*

**Verdict: legit. DASH-1 (minus make_test_call) is safe to implement now. VOICE-2 + make_test_call are cross-dependent on P0-2 and on confirming the LiveKit webhook — must not ship blind.**

---

## Cross-dependencies & recommended sequence

- **P0-5-VOICE-2 ⟂ P0-2** (same agent-dispatch mechanism) — build together.
- **P0-3 and P0-4 are independent** of everything else.
- Suggested order:
  1. **Now (no external blockers):** P0-4 (with corrections), P0-3 code fix (with corrections), P0-5 DASH-1-minus-make_test_call.
  2. **After LiveKit Cloud is inspected/confirmed:** P0-2, then P0-5 VOICE-2 + make_test_call tightening (as one unit).
  3. **Ops (parallel):** confirm live-mode Stripe webhook delivery (P0-3), decide on backfilling the 3 stranded (likely-test) tenants after checking they're real accounts.

## Can I guarantee "it will all work"?
- **P0-4 and P0-3 (code) and P0-5 DASH-1:** yes — *with the specific corrections above*. The naive versions from the audit would each have introduced a regression; the corrected versions are safe and I've traced every consumer.
- **P0-2 and P0-5 VOICE-2:** **no, not without LiveKit Cloud access.** The fix is correct in design, but it depends on the exact live dispatch-rule shape and on the LiveKit webhook actually being registered — both unreadable from here. Writing them blind risks causing the outage / stranding new tenants. These need the `lk sip dispatch list` output and a confirmed webhook registration first.
