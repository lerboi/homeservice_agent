---
type: status
status: current
description: "Current state of the project: what is in flight, what is broken, what is waiting on the owner. Keep this short and overwrite it as things change."
verified: 2026-11-23
tags: [voco/hub]
---

# Now

Last updated 2026-11-23 (end of day). This note is overwritten, not appended: history belongs in [[Log]].

## Where things stand

| Work | State | Note |
|---|---|---|
| Obsidian vault | Done and pushed | [[Plan 1 - Obsidian vault migration]] |
| Fast voice path (scheduling prompt + Groq Qwen with OpenAI fallback) | **Deployed** to Railway, agent commit `c1b048e`; verified with two scripted calls | [[Voice Agent - Scheduling profile and fast LLM path (verified)]] |
| Google Calendar connection | **Half done**: old connection disconnected; the Google "Choose an account" screen is waiting for the owner to pick an account | below |
| Demo Studio (recording page, calendar push for demo calls) | Approved, not started | [[Plan 3 - Demo Studio]] |
| Public site rebrand | Approved, not started; follows the Demo Studio | [[Plan 2 - Frontend rebrand to voice integration for any backend]] |

## Verified on 2026-11-23

- Deployed agent: Groq `qwen/qwen3.8-27b` active with gpt-4.1-mini fallback, no fallbacks in two scripted six-turn calls, production voice Alexandra resolved without the "not in My Voices" error, both calls offered times, read back, waited for yes, booked, said goodbye; test appointments auto-cancelled.
- Voice-to-voice gap on Railway: 0.98 to 1.50 s on ordinary turns (was 1.65 to 2.10 s). The turn that books takes 2.1 to 2.9 s because the booking does several database round-trips to Tokyo.
- The demo tenant is `24141cd0-5735-4c7a-82d5-994c6b821861`, renamed "Voco" (was "Make It AI"). It is the only tenant with a real phone number, and its owner login is the admin. The tenant that was already called `voco` has an empty phone number and cannot take calls.
- Both GitHub repos are public.

## Next task: Demo Studio ([[Plan 3 - Demo Studio]])

Decisions already made by the owner: browser call only (phone calls set aside); agent answers as Voco; demo and production use the same fast configuration; Google Calendar first (Outlook later). Remaining work:

1. Finish the Google connection (owner picks the account), then verify with a create-and-delete test event.
2. Agent: a server-set `demo` flag on test calls that allows the calendar push and keeps the booking; calendar event title and body suited to scheduling (the current body prints "Service Address" and "Urgency"); live tool events for the page.
3. Next app: `/admin/demo` page (task picker, "Save to" dropdown with health check, captions, live actions, cleanup button); fix `is_primary` being cleared on reconnect (`src/app/api/google-calendar/callback/route.js:48`).
4. Tests for the scheduling profile and the provider selection (none exist yet).

## Known problems

1. **Google Calendar is currently disconnected** on the demo tenant (deliberately, mid-reconnect). If the Google OAuth app is in "Testing" mode a new connection expires after 7 days.
2. **Test calls never reach a calendar**, by design ([[Decision - Test calls are sandboxed]]) until item 2 above is built.
3. **Phone calls now get the scheduling agent too** (no address intake, no urgency triage). `VOCO_AGENT_PROFILE=home_service` on Railway restores the old behaviour.
4. **Confirm-then-book is enforced only by the prompt.** A different Groq model (`gpt-oss-120b`) booked before the caller confirmed; Qwen has not, in six scripted calls.
5. **The booking turn is slow (2 to 3 s)** because Supabase is in Tokyo and the worker is in the Netherlands.
6. Public repos contain audit findings ([[Log]]).

## Waiting on the owner

- Which Google account to connect.
- Whether to make the GitHub repos private.

## Carried over from earlier logs (not re-verified)

- Stripe live-mode parity, meter mapping and webhook endpoint: [[2026-06-16 Stripe MCP setup and billing audit]].
- Launch blockers from the July audit: [[2026-07-04 Full end-to-end audit (summary)]] and [[2026-07-09 P0-2 to P0-5 verification and fix plan]].
