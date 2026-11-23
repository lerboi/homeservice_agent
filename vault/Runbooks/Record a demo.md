---
type: runbook
status: current
description: "Record the product demo from /admin/demo: checks before the take, the take itself, and removing the booking afterwards. Includes what to do when the calendar connection or the agent fails."
verified: 2026-11-24
tags: [voco/runbook]
---

# Record a demo

## When to use
To record a browser call in which the agent books an appointment and it appears in Google Calendar. How the pieces work: [[Demo Studio]].

Needs the `demo-studio` work deployed in both repos (see [[Now]] for whether it is).

## The script (needs branch `demo-persona` deployed; see [[Now]])

One caller rings a clinic, books a cleaning and moves it, in under a minute. Under **Answer as** the page says "Brightside Dental". Record on a Monday, Tuesday or Wednesday (Singapore time) so "tomorrow" and "Friday" are two different working days.

| You say | The agent should | On screen |
|---|---|---|
| (nothing) | "Thanks for calling Brightside Dental. Calls are recorded — how can I help?" | Captions start |
| "Hi, it's Alex Tan. Can I book a cleaning for tomorrow at two?" | Say two tomorrow is free and ask to book it | Checked availability · open |
| "Yes, please." | Confirm the booking, ask if there is anything else | Booked, Saved to Google Calendar, the event card; the event appears in Google |
| "Actually, sorry, I've got a meeting then. Could you move it to Friday at ten?" | Say Friday at ten is free and ask to move it | Found the appointment, Checked availability · open |
| "Yes, please." | Confirm the move, ask if there is anything else | Moved, Updated in Google Calendar; the card shows the old time struck through; the event moves in Google |
| "That's all, thanks. Bye." | Say goodbye and hang up | Ended the call |

Say each line in one breath: a pause inside a line lets the agent start answering early. Say "two" and "ten" as plain numbers.

Rehearse it without a microphone first: `BASELINE_SCRIPT=demo BASELINE_DEMO=google BASELINE_AGENT=appointments BASELINE_LLM=openai BASELINE_BUSINESS="Brightside Dental" python vault/_meta/tools/baseline_call.py <tenant_id> <phone>` speaks these lines, prints the call length (`TIMING`) and checks the result (`CHECKS`, `VERDICT`). Then reset: `node --env-file=.env.local vault/_meta/tools/demo_reset.mjs <tenant_id>`. Rehearsal results so far: [[2026-11-24 Demo call script and persona]].

Screen for the recording: 1920×1080, the Demo Studio in Presentation mode on the left, Google Calendar in week view on the right with tomorrow and Friday both visible. Keep them as two windows so the video edit can crop them separately. Download the call audio from the page afterwards.

## Before the take
1. Sign in with the admin account and open `/admin/demo`.
2. Under **Save to**, Google Calendar must show a green dot and the account it writes to. The check is a real token refresh. If it shows "Connection failed its check", press **Reconnect**, finish the Google sign-in in the new tab, come back and press **Re-check**.
3. Under **Microphone**, pick the device and press **Check**. The bar must move when you speak.
4. If **Still on the calendar** lists earlier demo bookings, remove them so the times you plan to ask for are free.
5. Open Google Calendar in another window on the day you will book, so the event can be seen arriving.
6. Know what you will say. The tenant is open Monday to Friday, 08:00 to 17:00 (Asia/Singapore), in 60-minute slots, and same-day slots need an hour's notice.

## The take
1. Press **Presentation** (Esc leaves it). Start the screen recorder (OS recorder or OBS; the page does not record the screen).
2. Press **Start call**. The agent greets first.
3. Ask for an appointment: your name, what it is for, a day and time. The agent offers times, reads the booking back and waits for your yes.
4. The right-hand column shows each action as it happens and ends with the event card. **Open in Google Calendar** opens the real event.
5. Say goodbye; the agent ends the call. Or press **End call**.

## After the take
- **Download audio (MP4)** appears within about two minutes.
- **Remove demo booking** deletes the calendar event and cancels the appointment. Do this before the next take if you want the same time again.

## How to tell it worked
The event is in Google Calendar titled `<your name>: <reason>` with the body "Booked by the Voco voice agent", at the time you agreed, in the tenant's timezone.

From a terminal, without the page: `node --env-file=.env.local vault/_meta/tools/demo_event_check.mjs <tenant_id>` prints the latest test call's appointment and the Google event read back through the API. Add `--cleanup` to remove both.

## If it does not work
| Symptom | Likely cause | What to do |
|---|---|---|
| Start call is greyed out | The chosen destination is not connected or failed its check | Reconnect under Save to, then Re-check |
| Google Calendar turns red a week after connecting | The Google OAuth app is in "Testing" mode; refresh tokens expire after 7 days | Reconnect; to stop it recurring, publish the app in Google Cloud Console (OAuth consent screen) |
| "The agent has not joined yet" | Voice worker down or at capacity | Railway logs for `registered worker`; [[Deploy]] |
| Agent greets, then hears nothing | Wrong or silent microphone | Pick another device; the level bar shows what the agent hears |
| Timeline shows "Could not save to Google Calendar" | The push failed after the booking was made | The booking is in Voco. Check the connection, remove the booking, retake |
| The agent says it is booked but no event card appears | The model claimed a booking without making one | It should not happen: a guard forces the booking ([[Voice Agent - Scheduling profile and fast LLM path (verified)]]). Search the Railway logs for `claim-guard` and report it |
| Cleanup says the event could not be deleted | Calendar connection died between the take and the cleanup | Delete the event by hand in Google Calendar; the appointment is already cancelled |

## Verifying a deploy without speaking
`BASELINE_DEMO=google python vault/_meta/tools/baseline_call.py <tenant_id> <phone>` places a scripted call that books "tomorrow afternoon" and prints the event stream; then run `demo_event_check.mjs --cleanup`. Details: [[Run a local dev worker and measure]].
