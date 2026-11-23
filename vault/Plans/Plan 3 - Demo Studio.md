---
type: plan
date: 2026-11-23
status: approved
description: "Plan and decisions for the demo recording station: call books an appointment that lands in Google or Outlook Calendar."
source: "My Prompts/Rebrand-2026-11/03-demo-studio-plan.md"
migrated: 2026-11-23
tags: [voco/plan]
---

# Plan 3 — Demo Studio: record "call → appointment appears in Google Calendar"

Status: DECISIONS RECORDED 2026-11-23. Awaiting green light to implement.

## 1. What exists and whether it works

There are two "demo" pages:

| Page | What it is | State |
|---|---|---|
| `/demo` (`src/app/demo/page.js`, 21 lines) | Public "Demo Coming Soon" stub with a button to `/onboarding` | Placeholder only. Nothing to fix; it gets replaced in Plan 2. |
| `/admin/test-agent` (`src/app/admin/test-agent/page.js`, 924 lines) | Admin-only browser console: pick a tenant → browser mic joins a LiveKit room → the production agent on Railway answers → live captions → transcript + MP4 audio recording to download | This is the real recording station. |

Is `/admin/test-agent` working?
- Evidence it works for a conversation: the last six runs (2026-09-08) all finished `analyzed` with a recording stored; the Railway worker is up and re-registered with LiveKit as recently as 2026-11-22; neither the page nor the agent has changed since.
- Not verified: I have not placed a live call today, so "works" is inferred from that evidence. A scripted end-to-end call is step 1 of implementation.
- It cannot produce the demo you want, for four reasons:
  1. Sandbox by design. `livekit-agent/src/tools/book_appointment.py:789` skips the calendar push on test calls, and `src/post_call.py:191` auto-cancels the appointment when the call ends. Nothing ever reaches Google Calendar.
  2. The Google connection is stale. Both connected tenants last synced on 2026-06-18 and their watch channels expired on 2026-06-24 and were never renewed. The stored tokens are very likely dead and need a reconnect. If the Google OAuth app is still in "Testing" mode, refresh tokens expire after 7 days, which would explain it and would break the demo again a week after reconnecting.
  3. The agent is a home-service receptionist. It insists on a service address, validates it against Google Maps, and triages urgency. The calendar event is titled `Name - Business` with "Service Address / Urgency" in the body. That contradicts the new positioning.
  4. The recording is audio only. A demo video needs a screen capture, so the page has to look good on screen. The current UI is a plain engineering form.
- Unverified risk: the ElevenLabs key on Railway. In September it was the key ID rather than the `sk_` secret, which makes every call fall back to the flat OpenAI "alloy" voice. I could not confirm from logs whether that was fixed.

## 2. What gets built

### 2.1 Demo Studio page: `/admin/demo`
Admin-gated (same `verifyAdmin` guard), new "Demo Studio" tab. `/admin/test-agent` stays as the engineering console. The call logic both pages share (mic picker and meter, room connect, dispatch, captions, result polling) is extracted from the 924-line page into `src/hooks/useAgentCall.js` plus small components, so there is one implementation.

Layout, designed for a 16:9 screen recording in the new brand style:

```
┌──────────────┬───────────────────────────┬──────────────────────┐
│ SETUP        │ CALL                      │ LIVE ACTIONS         │
│ Task         │  voice orb / waveform     │ ✓ Checked Thu 3:00pm │
│ ▣ Scheduling │  live captions            │ ✓ Booked appointment │
│ ▢ Lead → CRM │                           │ ✓ Saved to Google    │
│   (soon)     │  [ Start call ] [ End ]   │   Calendar  [Open ↗] │
│ Save to      │                           │ ┌ event card ──────┐ │
│ [Google Cal▾]│                           │ │ Thu 3:00–4:00pm  │ │
│ Voice, Mic   │                           │ └──────────────────┘ │
└──────────────┴───────────────────────────┴──────────────────────┘
```

- Task picker: cards from a registry (`src/lib/demo/scenarios.js`). "Scheduling" is live. Others ("Capture a lead into a CRM", "Create a follow-up task", "Look up an order") render as "coming soon" so the page tells the flexible-backend story without faking anything.
- "Save to" dropdown: destinations from a registry (`src/lib/demo/destinations.js`): Google Calendar, Outlook Calendar, Voco calendar only. Each shows the connected account name and a health dot. A destination that is not connected, or whose token fails a refresh check, shows a "Reconnect" link and cannot be started, so a dead token is caught before you record rather than mid-take.
- Live actions panel: a timeline of what the agent does in your backend as it happens, ending with the created event and an "Open in Google Calendar" link. This panel is what makes the video legible: the viewer sees voice on one side and the system of record changing on the other.
- Presentation mode: hides the setup column and admin chrome for the take.
- After the call: transcript, audio recording download, and a "Remove demo booking" button that deletes the calendar event and cancels the appointment so retakes do not pile up.

### 2.2 API routes (Next app)
- `GET /api/admin/demo/status`: demo tenant, destinations and their health (does a real token refresh for Google/Outlook).
- `POST /api/admin/demo/session`: validates task + destination, creates the room with server-set metadata `{ test_call: true, web_test: true, demo: { task: "scheduling", destination: "google", keep_booking: true } }`. Room keeps the `test-web-` prefix, so the existing dispatch and result routes are reused unchanged.
- `POST /api/admin/demo/cleanup`: removes the calendar event and cancels the appointment for a given demo call.

### 2.3 Agent changes (`livekit-agent` repo)
The demo stays a test call, so it keeps every protection that matters: no billing, no SMS, no owner notifications, no CRM rows. Only two sandbox rules are relaxed, and only when the server-set room metadata carries `demo`:

| File | Change |
|---|---|
| `src/agent.py` | Read `room_meta["demo"]` (honored only when `test_call` is true); put it in `deps`. Select the demo prompt and tool set. Publish tool events on a LiveKit text stream (`voco.events`) for `web_test` rooms. |
| `src/prompt.py` | A `scheduling` scenario prompt: a general scheduling assistant for the business. Collects name, reason for the appointment, and a time. No service address, no urgency triage, no transfer talk. Built from the existing sections so voice behavior, corrections, booking readback and the no-double-booking rules are kept. |
| `src/tools/__init__.py` | Demo tool set: `check_slot`, `check_day`, `next_available_days`, `book_appointment`, `end_call`. |
| `src/tools/book_appointment.py` | In the scheduling scenario skip address validation; when `demo.destination` is external, run the calendar push even though it is a test call (caller SMS still skipped). Emit "booked" and "saved to calendar" events with the event link. |
| `src/lib/calendar_push.py`, `google_calendar.py`, `outlook_calendar.py` | Accept an explicit provider (the dropdown choice) instead of always using the primary; demo-appropriate event title and body ("Name: reason", "Booked by Voco voice agent"); return the event link. |
| `src/post_call.py` | Skip the auto-cancel when `demo.keep_booking` is set (cleanup is the Studio button instead). |
| `tests/` | New tests: `demo` metadata ignored unless `test_call`; SMS, billing, CRM and notifications never fire in demo mode; calendar push fires only for the chosen provider; existing suite (663 tests) stays green. |

### 2.4 Things only you can do
1. Reconnect Google Calendar on the demo tenant, using the Google account whose calendar you want on screen.
2. In Google Cloud Console, confirm the OAuth consent screen is "In production" (or accept reconnecting within 7 days of each recording).
3. Confirm the ElevenLabs `sk_` key is set on Railway and the three production voices are saved to "My Voices".
4. Approve the push to `livekit-agent` main (Railway auto-deploys from it).

## 3. Build order
1. Baseline: scripted end-to-end call against the deployed agent through the existing console path to confirm today's state; check which TTS voice actually speaks.
2. Agent changes on a branch with tests; local worker run against LiveKit Cloud.
3. Next app: hook extraction, registries, API routes, Demo Studio UI.
4. Deploy agent (with your go-ahead), then the Next app.
5. End-to-end verification: scripted call books a slot → read the event back through the Google Calendar API → cleanup removes it. Then you do a live take.
6. Docs: `vault/Systems/Demo Studio/` and `vault/Runbooks/Record a demo.md`.

## 4. Not in scope
- Recording the screen inside the app (use OBS or the OS recorder; the page is built to be captured).
- Making the non-scheduling tasks functional.
- Changing the production (non-test) call path.

## 5. Decisions (2026-11-23)
1. **Browser call.** Phone mode is not built.
2. **The agent answers as Voco.** The `voco` tenant's business name is set to "Voco" and its services and hours are reset for a general scheduling scenario (for example "Intro call", "Product demo", "Consultation").
3. **Tenant:** reuse the existing `voco` tenant (`7954aa5c…`).
4. **Outlook is a real, selectable destination.** The push code exists in both repos and the OAuth flow uses the `common` authority, so personal and work Microsoft accounts are both accepted in principle.

## 6. What I need from you for the calendar connections
- **Google:** sign in to the dashboard as the `voco` tenant owner → Calendar settings → reconnect Google with the account whose calendar should appear in the video. In Google Cloud Console, tell me whether the OAuth consent screen says "Testing" or "In production".
- **Outlook:** on the same screen, connect the Microsoft account you want to use, and tell me whether it is a personal account (outlook.com/hotmail) or a work/school account. If the connect fails, send me the error text: the usual cause is the Azure app registration's "Supported account types" not including that kind of account, or the redirect URI `<app URL>/api/outlook-calendar/callback` not being registered, and both are fixed in the Azure portal.
- I will add both connect buttons to the Demo Studio itself, so you can do this from `/admin/demo` once it is built instead of going through the dashboard.
