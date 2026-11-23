---
type: idea
date: 2026-04-12
status: idea
description: "Future feature — owner selects specific numbers or leads whose calls bypass AI and route directly to owner"
source: "Claude memory note project_vip_caller_routing.md"
migrated: 2026-11-23
tags: [voco/idea]
---

# Idea - VIP caller direct routing
Owner wants a setting where specific phone numbers or leads are flagged as "VIP" so any incoming call from them routes directly to the owner's phone instead of the AI receptionist. This is separate from the schedule-based call routing (Phase 41) — it's caller-identity-based routing regardless of time of day.

**Why:** Some contractors have key clients (property managers, repeat customers) they always want to answer personally.

**How to apply:** This should be its own phase. It touches the webhook routing logic (livekit-agent), the tenant settings API, and the dashboard UI. Depends on Phase 41's pickup_numbers infrastructure for the dial-out leg.
