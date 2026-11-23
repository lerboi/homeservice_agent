---
type: system
system: Voice Agent
status: current
description: "Three JSON files in livekit-agent/:"
source: .claude/skills/voice-call-architecture/SKILL.md § 2. SIP Configuration
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# SIP Configuration

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

Three JSON files in `livekit-agent/`:

- `sip-inbound-trunk.json` — Twilio media server IP allowlist; Krisp on;
  empty numbers array (all routed via trunk).
- `sip-outbound-trunk.json` — used for outbound test calls.
- `sip-dispatch-rule.json` — `dispatchRuleIndividual` with
  `roomPrefix: "call-"` and `agentName: "voco-voice-agent"`.

Each inbound call creates a unique room. Twilio `voice_url` is the
primary routing lever since Phase 40 — but a number associated with a SIP
trunk *ignores* its `voice_url` (the trunk wins), so webhook-routed numbers are
**removed from the trunk** (provisioning + `cutover-existing-numbers.js` both
disassociate it; R2 fix). Rollback = re-add the number to the trunk.

---
