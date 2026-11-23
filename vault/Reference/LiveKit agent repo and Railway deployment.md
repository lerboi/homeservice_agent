---
type: reference
date: 2026-03-29
status: current
description: "Standalone LiveKit voice agent deployed to Railway at C:/Users/leheh/.Projects/livekit-agent/ (repo: lerboi/livekit_agent) — the production agent that handles all voice calls via Twilio SIP + LiveKit + Gemini 3.1 Flash Live. Replaces the old Retell-ws-server."
source: "Claude memory note reference_retell_ws_server.md"
migrated: 2026-11-23
tags: [voco/reference]
---

# LiveKit agent repo and Railway deployment
The production voice agent is a separate repo at `C:/Users/leheh/.Projects/livekit-agent/` (GitHub: `lerboi/livekit_agent`).

**Structure:**
- `src/agent.js` — Main entry point: defineAgent, tenant lookup, Gemini session, Egress recording
- `src/prompt.js` — `buildSystemPrompt()` with all behavioral sections
- `src/post-call.js` — Post-call pipeline (triage, leads, notifications, usage)
- `src/tools/` — All 6 tool implementations (in-process, direct Supabase)
- `src/lib/` — Business logic copies (booking, slot-calculator, leads, notifications, triage, google-calendar)
- `src/messages/en.json`, `src/messages/es.json` — i18n strings
- `sip-*.json` — LiveKit SIP trunk and dispatch rule configs

**Why:** LiveKit agent framework requires a standalone Node.js process — cannot run inside Next.js on Vercel. Deployed to Railway with its own Docker image. The `livekit-agent/` folder in homeservice_agent is a leftover scaffold — ignore it.

**How to apply:** When modifying voice agent behavior (prompts, tools, post-call pipeline), update the agent repo at `C:/Users/leheh/.Projects/livekit-agent/`. Business logic in `src/lib/` is adapted from the main repo — if core logic changes (e.g., slot-calculator, triage, leads), update both repos.
