# Call Routing — Voco Dashboard

## What this section does
Call Routing controls how incoming calls are handled. By default, every call goes straight to the AI receptionist. You can optionally forward calls to your own phone (or up to 5 team numbers) on a schedule, and mark certain callers as **Priority** so they always ring your phone directly — bypassing the AI and any schedule or caller limits.

## Key features
- **Forwarding schedule** — Turn on call forwarding for specific days and time ranges. Inside the window, Voco rings your pickup numbers; outside, the AI answers. Supports overnight ranges (e.g. `19:00`–`09:00`).
- **Pickup numbers** — Add up to 5 phone numbers to ring in parallel when forwarding is active. Each number has a label and an SMS-forwarding toggle.
- **Dial timeout** — How long pickup numbers ring before Voco falls back to the AI (default 15 seconds).
- **Priority Callers** — Named numbers and tagged customers who always ring your phone immediately, even outside forwarding hours or when you've hit your monthly forwarding cap. Two sources: standalone numbers you add here, and existing leads marked Priority from the Lead flyout. Shown in one unified list.
- **SMS forwarding** — When enabled per pickup number, inbound text messages to your Voco number are forwarded to that phone. A copy of every message is stored for audit.

## How to navigate here
Go to [Call Routing](/dashboard/more/call-routing)

## Common tasks

### How do I forward calls to my phone during business hours?
Go to [Call Routing](/dashboard/more/call-routing). Toggle "Forward calls on a schedule" on. Add time ranges for each day you want your phone to ring first. Add at least one pickup number below. Outside those hours, the AI answers normally.

### How do I add a pickup number?
In the Pickup Numbers section, enter a phone number in full international format (e.g. `+15550001234`), give it a label (e.g. "My cell"), and choose whether to forward SMS to it. You can have up to 5 numbers — all of them ring at the same time when a forwarded call comes in.

### What happens if I don't answer a forwarded call?
After the dial timeout (default 15 seconds), Twilio falls back to the AI receptionist. The caller never hears voicemail — they land in the same AI flow as a direct call.

### How do I mark a caller as Priority?
Two ways:
1. **From Call Routing** — scroll to Priority Callers, enter the phone number and a label, click "Add priority number."
2. **From a lead** — open the lead in the Leads tab, and toggle the Priority switch in the flyout. The number automatically appears in your Priority Callers list.

Priority callers bypass your forwarding schedule and your monthly forwarding cap — they always ring your pickup numbers directly.

### How do I remove Priority status?
Open Call Routing → Priority Callers. Click the trash icon next to the entry. If the Priority came from a lead, this also clears `is_vip` on the lead.

### Why didn't a priority call reach me?
Priority calls only reach you if you have at least one pickup number configured. Without any pickup numbers, the caller falls through to the AI. Check that you have at least one number listed.

### How does SMS forwarding work?
When someone texts your Voco number, the message is forwarded to every pickup number with SMS forwarding enabled. The forwarded message shows `[Voco] From +15555551234: <message>`. MMS attachments show a note — view the full media in your Twilio console.

## Related sections
- [Notifications](/dashboard/more/notifications)
- [Leads](/dashboard/leads)
- [AI Voice Settings](/dashboard/more/ai-voice-settings)
