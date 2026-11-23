---
type: decision
date: 2026-11-24
status: current
description: "The appointments agent is its own package inside livekit-agent, chosen per call by a router in the existing entrypoint, instead of another flag inside the home-service code or a second deployment."
verified: 2026-11-24
tags: [voco/decision]
---

# Decision - One worker runs several agents

## Context
After the rebrand Voco is a voice agent for any business, and the first general task is appointments. The agent already had a "scheduling profile" (`VOCO_AGENT_PROFILE`, [[Voice Agent - Scheduling profile and fast LLM path (verified)]]), but it was a flag threaded through the home-service receptionist: nine branch points across `src/agent.py`, `src/tools/__init__.py`, `src/tools/book_appointment.py` and the claim guard. A scheduling call still ran the receptionist's entrypoint, its availability tools told the model to "offer capture_lead" (a tool the profile does not have), and post-call ran urgency triage. It could only create appointments.

The owner asked for a separate agent in the same repo and the same Railway deployment, built for appointments and for the Demo Studio.

## Decision
1. **A package per agent.** `livekit-agent/src/agents/appointments/` holds its own prompt, tools, guards and session wiring. `src/agent.py` remains the receptionist and the worker's entrypoint.
2. **A router, not a second worker.** After connecting and reading the room metadata, `src/agent.py` calls `select_agent` (`src/agents/__init__.py`) and hands an appointments call to the package. One worker name, one Railway service, one Dockerfile, one prewarmed process pool.
3. **Selection is server-side.** Room metadata `agent` is honoured on test calls only; everything else follows `VOCO_DEFAULT_AGENT` (default `receptionist`). Phone calls are unchanged until that variable is set.
4. **One set of voice tuning.** The router passes the loaded `src/agent.py` module to the new agent, which reads every tuning constant from it. `src/agent.py` itself was not refactored: about forty existing tests pin its source text, and it is the code that answers production calls.
5. **Shared where the behaviour is the same.** Slot arithmetic, the atomic booking RPC, `end_call`, the runtime filler, the event stream and the post-call pipeline are reused. The post-call pipeline is shared on purpose: it does usage billing and owner notifications, which a production appointments call must not lose. The new agent only skips triage.

## Rejected
- **More branches on `agent_profile`.** Reschedule and cancel would have added branches to a 994-line booking tool that is mostly address validation.
- **A second worker process with its own agent name.** Twice the idle processes in the same container and a second thing to keep healthy, for no isolation the router does not give.
- **Moving the tuning constants into a shared module now.** Right eventually; it would rewrite the receptionist's entrypoint and its tests in the same change that adds an agent.

## Consequences
- The scheduling profile in `src/agent.py` is now redundant. Once the appointments agent is deployed and `VOCO_DEFAULT_AGENT=appointments` has been run in production, remove the profile so `src/agent.py` is the home-service receptionist only.
- A new agent is a new package plus one line in `select_agent`.
- Both agents read the same env switches, so a tuning change affects both.

## Sources
[[Voice Agent - Appointments agent (verified)]] · [[2026-11-24 Appointments agent build]] · [[Decision - Rebrand to voice integration for any backend]]
