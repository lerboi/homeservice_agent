---
type: status
status: current
description: "Current state of the project: what is in flight, what is broken, what is waiting on the owner. Keep this short and overwrite it as things change."
verified: 2026-11-25
tags: [voco/hub]
---

# Now

Last updated 2026-11-25. **Continuing the work? Read [[Handoff - Public site changes (start here)]] next.** The owner's next step is front-end changes to the rebranded site on the `rebrand` branch. This note is overwritten, not appended: history belongs in [[Log]].

## Where things stand

| Work | State | Note |
|---|---|---|
| Obsidian vault | Done and pushed | [[Plan 1 - Obsidian vault migration]] |
| Fast voice path (scheduling prompt + Groq Qwen with OpenAI fallback) | **Deployed** to Railway, agent commit `c1b048e` | [[Voice Agent - Scheduling profile and fast LLM path (verified)]] |
| Appointments agent (dedicated agent: book, find, move, cancel; model switch) | **Deployed** 2026-11-24: agent `5c0d395` on Railway, Next app `a307ce1` on Vercel. Final production check: 4 of 4 scripted booking calls correct (3 Groq, 1 gpt-4.1-mini). Demo Studio calls use it; phone calls do not until `VOCO_DEFAULT_AGENT=appointments`. Production check: see the build record, section 7 | [[Voice Agent - Appointments agent (verified)]] · [[2026-11-24 Appointments agent build]] |
| Demo call (script, clinic business name, rehearsal and reset scripts, dedicated demo agent) | **Deployed from `main` in both repos, 2026-11-24.** The owner's first spoken take failed (the agent asked what the appointment was for instead of booking); the Demo Studio now runs a dedicated demo agent (`livekit-agent/src/agents/demo`) on GPT-4.1 mini. Rehearsals of it with the scripted caller: 3 of 3 locally, then 5 of 5 on Railway (agent `3138fa8`, 43 to 51 s as run, every check passed). Since then (2026-11-25): respectful register, same-call lookup, and it now asks what time the caller wants instead of offering two. Spoken takes have been made; none is yet a clean take. Next: the owner records again | [[2026-11-24 Demo call script and persona]] · [[Record a demo]] |
| Google Calendar connection | **Connected and verified** (token refresh, create, read, delete) on the demo tenant, with the owner's personal Google account | [[2026-11-23 Demo Studio build]] |
| Demo Studio (Task 2) | **Deployed** (agent `f7c632d` on Railway, Next app `123e543` on Vercel). Verified in production with two scripted calls. One step left: a spoken call through `/admin/demo` | [[Demo Studio]] |
| Public site rebrand (Task 3) | **Pushed to `main` on 2026-11-24** (GitHub `main` = `229789b`, fast-forward from `rebrand`), so Vercel deploys it. Two products (Voco Voice, Voco Agent), no sign-in links, no integrations pages, new identity. Production has not been looked at after the deploy. `/pricing`, `/about`, `/demo` and `/contact` still carry voice-only copy | [[2026-11-24 Public site second pass - two products and identity]], [[Public Site]] |

## What is left of Task 2

1. A spoken call through `/admin/demo` on production. Only a person at a microphone can do it; the page has so far been exercised on a local server up to starting a call. Then the owner records: [[Record a demo]].
2. The owner's confirmation that Task 2 is done, before Task 3 starts.

## What is left of Task 3

1. Look at the production site after the deploy. Then rewrite `/pricing`, `/about`, `/demo` and `/contact` for two products (their copy still speaks only of calls).
2. The recorded demo video: record it ([[Record a demo]]), then set `DEMO_VIDEO.src` in `src/data/site.js`. Until then the site shows a labelled still.
3. The mobile nav drawer and a real contact-form submission (page layouts were checked at 390 px on 2026-11-24).
4. Owner's review of `/privacy` and `/terms`: the body text still says "AI receptionist" and describes a 14-day free trial.

## Verified in production on 2026-11-24 (agent `f7c632d`)

- Two scripted demo calls against the Railway agent: both booked, both events read back from Google Calendar through the API (`Alex Tan: Product demo`, "Booked by the Voco voice agent", 12:00 Asia/Singapore), `booked` and `calendar_saved` events received, cleanup removed both.
- The booking turn took 1.44 s and 1.54 s (it was 2.1 to 2.9 s before the three writes were made concurrent). Two calls only. Other turns: 0.94 to 2.87 s.
- `/api/admin/demo/status` exists on production and refuses unauthenticated requests (403).

## Verified on 2026-11-23

- Local dev worker, six scripted demo calls: five booked and the event was read back from Google Calendar (`Alex Tan: Product demo`, "Booked by the Voco voice agent", correct time and timezone) and removed by cleanup. One, before the guard existed, claimed a booking it never made.
- Agent tests: 771 pass, 1 pre-existing failure. Next app: the Demo Studio and test-console tests pass (56). The full Next suite has about 24 failing suites that fail on `main` too and touch none of this work.
- `/admin/demo` in Chrome on a local server: loads, shows Google as healthy with the connected account, presentation mode works, a call starts and dispatches.
- The demo tenant is `24141cd0-5735-4c7a-82d5-994c6b821861` ("Voco"). Its owner login is the admin, so the Demo Studio resolves it without configuration.

## Known problems

1. **The model can try to tell a caller "you're booked" without booking.** Seen once in three scripted calls before the guard. The booking-claim guard is now deployed; it reads English only: [[2026-11-23 Demo Studio build]].
2. **If the Google OAuth app is in "Testing" mode the new connection expires on 2026-11-30.** Google's consent flow does not say which mode it is in; the Cloud Console does.
3. **Post-call triage layer 2 always fails**: it calls `gpt-4.1-nano`, which OpenAI rejects as deprecated. Calls are still recorded.
4. **Phone calls get the scheduling agent too** (no address intake, no urgency triage). `VOCO_AGENT_PROFILE=home_service` on Railway restores the old behaviour.
5. **The "filler before booking" is mostly the runtime's own line**, not the model: with the 0.6 s delay it starts as the booking finishes and the caller waits for it to end. Fixed in the appointments agent (per-tool delay, and model preambles are dropped); the deployed scheduling profile still has it: [[2026-11-24 Appointments agent build]].
6. **A local dev worker refuses jobs when this machine is above 70% CPU**, which a running `next dev` can cause: [[Run a local dev worker and measure]].
7. **The public site presents integrations, and a whole second product (Voco Agent), that are not built** (owner's decision; done-for-you framing). The list of what is real is in [[Public Site - Content data and copy rules]].
8. **Sign-up is still reachable** from `/auth/signin` (by URL only: no public page links to sign-in any more) and leads to the trade-based onboarding wizard.
9. Public repos contain audit findings ([[Log]]).

## Waiting on the owner

- LiveKit recording quota: call recordings are refused with `egress minutes exceeded` since 2026-11-25. A plan with more egress minutes, or wait for the quota to reset. Production phone calls record through the same account.
- The glitchy voice: after the next call that sounds wrong, the line under the call on `/admin/demo` and the `tts_metrics` log lines say which side it is on ([[2026-11-24 Demo call script and persona]] section 14).
- A spoken test call through `/admin/demo`.
- A look at the rebranded site in production.
- Google Cloud Console: is the OAuth consent screen "Testing" or "In production"?
- Whether to make the GitHub repos private.
- Appointments agent: try both models with the Model switch on `/admin/demo` and choose one for production (Groq Qwen: about 0.4 s to first token, 9 of 10 scripted bookings correct with the guards; gpt-4.1-mini: about 1.0 s, 8 of 8). The production setting is the Railway variable `VOCO_APPT_LLM_PROVIDER` (`groq` or `openai`); unset, it is Groq.
- The `rebrand` branch was cut before this work: merge `main` into it before it ships (`vault/Now.md` is edited on both).

## Carried over from earlier logs (not re-verified)

- Stripe live-mode parity, meter mapping and webhook endpoint: [[2026-06-16 Stripe MCP setup and billing audit]].
- Launch blockers from the July audit: [[2026-07-04 Full end-to-end audit (summary)]] and [[2026-07-09 P0-2 to P0-5 verification and fix plan]].
