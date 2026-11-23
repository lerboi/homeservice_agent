---
type: system
system: Auth and Database
status: current
description: "Written 2026-06-20, PENDING manual application (additive, no table rewrites; apply after 068–073). File-map entry above; the three column additions are detai…"
source: ".claude/skills/auth-database-multitenancy/SKILL.md § M16 P1: Migration 074 — Service-Area Gate (Capability A)"
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# M16 P1 Migration 074 - Service-Area Gate (Capability A)

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

**Written 2026-06-20, PENDING manual application** (additive, no table rewrites; apply after 068–073). File-map entry above; the three column additions are detailed here.

`074_service_area_gate.sql` implements the M16 P1 "Service-Area gate" (Capability A):

- **`service_zones.cities text[] NOT NULL DEFAULT '{}'`** — the town/city half of the Service-Area coverage list, alongside the existing `postal_codes[]` ZIP half. Empty-array default leaves existing zones unaffected.
- **`tenants.out_of_area_action text NOT NULL DEFAULT 'callback'`** with `CHECK (out_of_area_action IN ('callback','decline_referral','trip_fee'))` — what the AI does when a caller's address falls outside coverage. The CHECK-enum mirrors the existing `tone_preset` style. Plus **`tenants.out_of_area_referral_note text`** (nullable) — optional free-text referral note for the `decline_referral` action.
- **`inquiries.out_of_area boolean NOT NULL DEFAULT false`** — durable flag marking an out-of-area lead. Set by the agent's `capture_lead` tool via a **follow-up service-role UPDATE**, NOT through `record_call_outcome`. The hardened `record_call_outcome` RPC (069 lockdown) is deliberately untouched; no RPC overload was added.

**No RLS policy changes** — the existing tenant-owner + service_role policies on `service_zones`, `tenants`, and `inquiries` already cover the new columns.

---
