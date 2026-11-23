---
type: plan
date: 2026-11-23
status: in-progress
description: "Start-here handoff for a fresh session: exact state on 2026-11-23, what is left of the Demo Studio (Task 2) and the public-site rebrand (Task 3), the owner's decisions that override the older plan notes, key files, how to test, and the traps already hit."
verified: 2026-11-23
tags: [voco/plan]
---

# Handoff - Demo Studio and rebrand (start here)

> **Superseded for front-end work on 2026-11-24** by [[Handoff - Public site changes (start here)]]. Tasks 2 and 3 are built; this note is kept as the record of how they started.

> **Update, 2026-11-23 late:** Task 2 is built and locally verified on the `demo-studio` branch in both repos, not deployed. Sections 1 and 3 below describe the starting point; what was done, what the tests showed and what is left are in [[2026-11-23 Demo Studio build]], [[Demo Studio]] and [[Now]]. Remaining for Task 2: the owner's go-ahead to push, a scripted call against production, and a spoken call through `/admin/demo`. Task 3 has not started.
>
> **Update, 2026-11-24:** Task 2 is deployed and verified in production with scripted calls. Task 3 is built on the `rebrand` branch of `homeservice_agent`, not pushed: [[2026-11-24 Public site rebrand]]. Left: the owner's review of the look and the go-ahead to push; the recorded demo video (`DEMO_VIDEO.src` in `src/data/site.js`); a mobile check.

Read this note fully, then [[Now]]. It overrides [[Plan 3 - Demo Studio]] and [[Plan 2 - Frontend rebrand to voice integration for any backend]] wherever they disagree, because the owner changed several decisions after those were written.

Naming: the owner calls the Demo Studio "Task 2" and the public-site rebrand "Task 3" (the vault migration was Task 1 and is finished). The plan notes are numbered by when they were written: Plan 3 = Demo Studio, Plan 2 = rebrand.

## 1. State on 2026-11-23

| Thing | State |
|---|---|
| Vault, `CLAUDE.md`, skill stubs | Done, pushed (`homeservice_agent` `c08538b`) |
| Voice agent fast path | Deployed (`livekit-agent` `c1b048e`). Details: [[Voice Agent - Scheduling profile and fast LLM path (verified)]] |
| Demo tenant | `24141cd0-5735-4c7a-82d5-994c6b821861`, business name "Voco", phone `+14783755631`, timezone Asia/Singapore, hours Mon-Fri 08:00-17:00, 60-minute slots. Owner login is also the only admin. |
| Google Calendar | **Disconnected.** The old connection was removed on purpose; the reconnect stopped at Google's account chooser because the owner has not said which account. `calendar_credentials` has no row for the demo tenant until this is done. |
| Demo Studio page, demo calendar push | Not started |
| Rebrand | Not started |

## 2. Owner decisions that override the older plan notes

1. **Browser calls only.** Phone calls are set aside. Do not build a phone mode.
2. **Demo and production use the same, fastest configuration.** There is no demo-only model or prompt. The scheduling profile is the default for every call.
3. **Demo tenant is `24141cd0…` renamed "Voco"**, not the tenant that was already called `voco` (that one has an empty phone number and cannot take calls).
4. **Google Calendar first.** Outlook is deferred; show it in the "Save to" dropdown as "connect to enable" and do not spend time on it until asked.
5. **The owner wants things done for them where possible** (they asked for Chrome to be driven for the Google connect) and wants one committed recommendation, not menus. Measure before claiming a speed-up.
6. Rebrand decisions are unchanged from Plan 2 section 6: buyer is businesses; "Book a demo" and "Watch the demo" as calls to action; pricing page becomes "talk to us"; integrations presented as available under a done-for-you framing; retire `/blog`, `/glossary`, `/compare`; `/for` becomes `/use-cases`; new light palette with one green-teal accent; hero plus one section shown as screenshots for sign-off before building the rest.

## 3. Task 2: what is left of the Demo Studio

Goal: the owner records a browser call in which they book an appointment and it visibly lands in their Google Calendar.

### 3.1 Google connection (first, needs the owner)
- Ask which Google account. The chooser listed nine; do not guess. The "Voco" account there is signed out and needs a password the owner must type.
- Flow that works through Chrome automation: open `https://www.voco.live/dashboard/calendar` (the bare domain redirects to `www`), then in the page run a fetch of `/api/google-calendar/auth` and set `window.location` to the returned `url`. The dashboard's own Connect button opens a popup window that browser automation cannot reach. The redirect URI is `https://voco.live/api/google-calendar/callback`; scope is `calendar.events`.
- After connecting, verify: the `calendar_credentials` row exists with `is_primary = true`, then do a real token refresh and create and delete a test event.
- If the Google OAuth app is in "Testing" mode the refresh token dies after 7 days (the likely cause of the June failure). Tell the owner to record within a week or publish the app.
- Bug to fix while here: `src/app/api/google-calendar/callback/route.js:48` sets `is_primary` from "tenant has zero rows", so reconnecting over an existing row clears it. Preserve the existing value on reconnect.

### 3.2 Agent changes (`livekit-agent`)
The scheduling prompt, tool set and fast LLM already exist. Still to build:

| File | Change |
|---|---|
| `src/agent.py` | Read `room_meta["demo"]` (only when `test_call` is true; metadata is server-set) into `deps["demo"]`. Publish tool events on a LiveKit text stream (suggested topic `voco.events`) for `web_test` rooms so the page can show live actions. |
| `src/tools/book_appointment.py` | At the sandbox gate (search for `test call — skipping calendar push`): when `deps["demo"]` asks for an external destination, run the calendar push anyway; still never send SMS. Emit "booked" and "saved to calendar" events with the event link. |
| `src/lib/calendar_push.py`, `src/lib/google_calendar.py` | Accept an explicit provider; return the created event's `htmlLink`. In the scheduling profile the event must not print "Service Address" or "Urgency": title `<caller>: <reason>` (reason is in `appointments.notes`), body "Booked by the Voco voice agent". |
| `src/post_call.py` | Skip the test-call auto-cancel (search for `Test call auto-cancel`) when `demo.keep_booking` is set. Billing, CRM writes and owner notifications stay off. |
| `tests/` | None exist for the scheduling profile. Add: prompt contains the invariants; scheduling tool list and schema; provider selection and fallback wiring; `demo` ignored unless `test_call`; SMS, billing, CRM and notifications never fire in demo mode; calendar push fires only when asked. Suite baseline: 663 pass, 1 pre-existing failure (`tests/webhook/test_routes.py::test_incoming_call_vip_lead`). |

Worth doing in the same pass (found in testing, not yet fixed):
- The confirm-then-book rule lives only in the prompt. Consider a code gate in `book_appointment`.
- The agent sometimes says its own filler ("Okay, booking that in for you"); the runtime already covers waits.
- The booking turn takes 2 to 3 s (several Supabase round-trips from the Netherlands to Tokyo). Look for sequential queries in `_book_appointment_impl` that can run concurrently.
- The greeting starts about 2 s after dispatch.

### 3.3 Next app (`homeservice_agent`)
- `src/app/admin/demo/page.js`, admin-gated like `/admin/test-agent`, plus a "Demo Studio" tab in `src/app/admin/layout.js`.
- Extract the shared call logic from `src/app/admin/test-agent/page.js` (924 lines: mic picker and meter, room connect, dispatch, captions, result polling) into `src/hooks/useAgentCall.js` so both pages use one implementation.
- Registries: `src/lib/demo/scenarios.js` (Scheduling live; others shown as "coming soon") and `src/lib/demo/destinations.js` (Google Calendar; Outlook "connect to enable"; Voco calendar only).
- Routes: `GET /api/admin/demo/status` (destinations and health, with a real token refresh), `POST /api/admin/demo/session` (room `test-web-<tenant>-<ts>` with metadata `{ test_call: true, web_test: true, tenant_id, to_number, demo: { task: "scheduling", destination: "google", keep_booking: true } }`; keeping the `test-web-` prefix lets the existing dispatch and result routes be reused), `POST /api/admin/demo/cleanup` (delete the calendar event, cancel the appointment).
- Page layout for a 16:9 screen recording, in the new brand style: setup column (task, "Save to" with health dot and connect button, voice, mic), call column (voice visual, live captions), live-actions column ending in the created event with an "Open in Google Calendar" link. Presentation mode hides setup. After the call: transcript, recording download, "Remove demo booking".
- Keep `Permissions-Policy: microphone=(self)` in `next.config.js` or the browser cannot capture audio.

### 3.4 Order and verification
1. Google connected and verified.
2. Agent changes on a branch, tests, local dev worker run ([[Run a local dev worker and measure]]).
3. Next app page and routes.
4. With the owner's go-ahead: push agent `main` (Railway), then the Next app.
5. Scripted call books a slot → read the event back through the Google Calendar API → cleanup removes it. Then the owner records.
6. Update [[Demo Studio]], add a "Record a demo" runbook, update [[Now]].

## 4. Task 3: the public-site rebrand

Everything is in [[Plan 2 - Frontend rebrand to voice integration for any backend]]: positioning, the inventory of what exists, scope table, retired pages, the new landing-page section list, build order, and the decisions in its section 6. Points to keep in mind:
- It follows the Demo Studio because the landing page and the new public `/demo` page feature the recorded video. Until the video exists, build designed placeholders.
- First deliverable is the palette, type and primitives plus the hero and one section, shown to the owner as screenshots for sign-off.
- Do not touch dashboard, onboarding, billing or emails. `pricingData.js` and the plan ids stay as they are: [[Billing - Plans and limits at a glance (verified)]].
- Remove fabricated proof ("Trusted by 500+ home service businesses", invented testimonials).
- Existing tests pin old copy (`tests/unit/landing-sections.test.js` and the `seo-*` tests) and must be rewritten with the pages.
- When done: delete the `public-site-i18n` and `scroll-line-path` skill stubs, rewrite `Systems/Public Site/` from the new code, update [[Positioning]].

## 5. Rules of engagement
- Never push either repo's `main` without the owner's go-ahead; both deploy to production from `main`.
- Both GitHub repos are public: no secrets, tokens or personal data in the vault or in commits.
- Keep the vault in sync as you go (system notes, [[Now]], a Log entry for notable work) and run `python vault/_meta/tools/check_vault.py`.
- Claude's working agreements with the owner are in `vault/Memory/MEMORY.md`.

## 6. Evidence and history
[[2026-11-23 Pipeline health check before the demo]] (measurements, model bake-off, what was rejected and why) · [[Decision - Rebrand to voice integration for any backend]] · [[Decision - Test calls are sandboxed]] · [[Scheduling - Booking to calendar on agent calls (verified path)]] · [[Demo Studio]]
