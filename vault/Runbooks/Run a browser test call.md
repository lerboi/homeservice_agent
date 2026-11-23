---
type: runbook
status: current
description: "Talk to the production voice agent from the browser through /admin/test-agent, and what to check when it does not work."
verified: 2026-11-23
tags: [voco/runbook]
---

# Run a browser test call

## When to use
After any agent deploy, and to hear the agent without placing a phone call. Test calls are sandboxed: [[Decision - Test calls are sandboxed]].

## Steps
1. Sign in with an account listed in the `admin_users` table and open `/admin/test-agent`.
2. Pick a tenant that has a phone number (the agent resolves the tenant by that number).
3. Choose the microphone and click "Check microphone". The level bar must move when you speak.
4. Optional: a simulated caller number (exercises the repeat-caller path) and a voice override.
5. Start the call. The agent greets first. Captions appear live.
6. Hang up. Within about two minutes the results card shows the outcome, the transcript and an MP4 audio recording.

## How to tell it worked
A `calls` row with `is_test_call = true`, `status = 'analyzed'` and a `recording_storage_path`.

## If it does not work
| Symptom | Likely cause | Where to look |
|---|---|---|
| "Microphone is blocked by the site's Permissions-Policy" | Header no longer `microphone=(self)` | `next.config.js:83` |
| Agent greets, then hears nothing | Wrong or silent input device | Device picker; [[2026-09-05 Test console mic picker]] |
| "Waiting for the agent to join…" never resolves | Worker down or not registered | Railway logs for `registered worker`; [[Deploy]] |
| Long silence before the greeting, or a flat robotic voice | ElevenLabs key invalid, falling back to OpenAI TTS | [[2026-09-05 Voice quality fix (ElevenLabs key, conversational voices)]] |
| Non-JSON error from the session route | Vercel function crash or timeout | The error text includes the Vercel error code and request id |

System notes: [[Demo Studio]].
