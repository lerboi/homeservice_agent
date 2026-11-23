---
type: status
status: current
description: "Current state of the project: what is in flight, what is broken, what is waiting on the owner. Keep this short and overwrite it as things change."
verified: 2026-11-23
tags: [voco/hub]
---

# Now

Last updated 2026-11-23 (late). **Continuing the work? Read [[Handoff - Demo Studio and rebrand (start here)]] next.** This note is overwritten, not appended: history belongs in [[Log]].

## Where things stand

| Work | State | Note |
|---|---|---|
| Obsidian vault | Done and pushed | [[Plan 1 - Obsidian vault migration]] |
| Fast voice path (scheduling prompt + Groq Qwen with OpenAI fallback) | **Deployed** to Railway, agent commit `c1b048e` | [[Voice Agent - Scheduling profile and fast LLM path (verified)]] |
| Google Calendar connection | **Connected and verified** (token refresh, create, read, delete) on the demo tenant, with the owner's personal Google account | [[2026-11-23 Demo Studio build]] |
| Demo Studio (Task 2) | **Built and locally verified, not deployed.** Branch `demo-studio` in both repos, committed (agent `f7c632d`), not pushed | [[Demo Studio]] |
| Public site rebrand (Task 3) | Approved, not started. Waits for Task 2 to be verified end to end and the owner's confirmation | [[Plan 2 - Frontend rebrand to voice integration for any backend]] |

## What is left of Task 2

1. Owner's go-ahead to push: agent `demo-studio` → `main` (Railway), then the Next app `demo-studio` → `main` (Vercel). Agent first: the page needs the agent's demo flag and event stream.
2. After deploy: one scripted demo call against production (`BASELINE_DEMO=google`), event read back through the Google API, cleanup. Then measure the booking turn on Railway.
3. A spoken call through `/admin/demo` (only a person at a microphone can do this), then the owner records: [[Record a demo]].

## Verified on 2026-11-23

- Local dev worker, six scripted demo calls: five booked and the event was read back from Google Calendar (`Alex Tan: Product demo`, "Booked by the Voco voice agent", correct time and timezone) and removed by cleanup. One, before the guard existed, claimed a booking it never made.
- Agent tests: 771 pass, 1 pre-existing failure. Next app: the Demo Studio and test-console tests pass (56). The full Next suite has about 24 failing suites that fail on `main` too and touch none of this work.
- `/admin/demo` in Chrome on a local server: loads, shows Google as healthy with the connected account, presentation mode works, a call starts and dispatches.
- The demo tenant is `24141cd0-5735-4c7a-82d5-994c6b821861` ("Voco"). Its owner login is the admin, so the Demo Studio resolves it without configuration.

## Known problems

1. **The deployed agent can tell a caller "you're booked" without booking.** Seen once in three scripted calls before the guard. The fix (booking-claim guard) is on the `demo-studio` branch, not in production: [[2026-11-23 Demo Studio build]].
2. **If the Google OAuth app is in "Testing" mode the new connection expires on 2026-11-30.** Google's consent flow does not say which mode it is in; the Cloud Console does.
3. **Post-call triage layer 2 always fails**: it calls `gpt-4.1-nano`, which OpenAI rejects as deprecated. Calls are still recorded.
4. **Phone calls get the scheduling agent too** (no address intake, no urgency triage). `VOCO_AGENT_PROFILE=home_service` on Railway restores the old behaviour.
5. **The booking turn was 2 to 3 s on Railway** (Supabase is in Tokyo, the worker in the Netherlands). Three of its writes now run concurrently on the branch; not yet measured on Railway.
6. **A local dev worker refuses jobs when this machine is above 70% CPU**, which a running `next dev` can cause: [[Run a local dev worker and measure]].
7. Public repos contain audit findings ([[Log]]).

## Waiting on the owner

- Go-ahead to push both `demo-studio` branches to `main`.
- Google Cloud Console: is the OAuth consent screen "Testing" or "In production"?
- Whether to make the GitHub repos private.

## Carried over from earlier logs (not re-verified)

- Stripe live-mode parity, meter mapping and webhook endpoint: [[2026-06-16 Stripe MCP setup and billing audit]].
- Launch blockers from the July audit: [[2026-07-04 Full end-to-end audit (summary)]] and [[2026-07-09 P0-2 to P0-5 verification and fix plan]].
