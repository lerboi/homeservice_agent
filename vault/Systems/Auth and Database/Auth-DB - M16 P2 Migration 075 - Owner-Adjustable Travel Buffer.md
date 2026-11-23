---
type: system
system: Auth and Database
status: current
description: "Written 2026-06-20, PENDING manual application (additive, no table rewrite; apply after 068–074). File-map entry above."
source: ".claude/skills/auth-database-multitenancy/SKILL.md § M16 P2: Migration 075 — Owner-Adjustable Travel Buffer"
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# M16 P2 Migration 075 - Owner-Adjustable Travel Buffer

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

**Written 2026-06-20, PENDING manual application** (additive, no table rewrite; apply after 068–074). File-map entry above.

`075_travel_buffer.sql` adds a single column:

- **`tenants.travel_buffer_mins int NOT NULL DEFAULT 30`** — the minimum drive time the slot calculator leaves between back-to-back jobs. The calculator's default-buffer path (`_get_travel_buffer_mins` in `livekit_agent/src/lib/slot_calculator.py`; `getTravelBufferMins` in `src/lib/scheduling/slot-calculator.js`) reads this **instead of a hardcoded `30`**, threaded through `calculate_available_slots`/`calculateAvailableSlots` via a `travel_buffer_mins`/`travelBufferMins` parameter exactly like `slot_duration_mins`. So it applies automatically at **both** offer-time and book-time, and is now enforced **forward + backward** of every existing booking (P2 also added the forward adjacency case). `DEFAULT 30` reproduces the exact pre-P2 buffer value → zero regression for every existing tenant; `0` disables buffering. Owner-set on the Working Hours page (`PUT /api/working-hours`, validated int 0–240). Mirrors the `slot_duration_mins` shape (migration 003).

**No RLS policy changes** — the existing `tenants` direct-owner policy covers the new column.

**Deployment ordering:** apply 075 BEFORE deploying the Next.js app. The JS `available-slots` + `working-hours` routes name `travel_buffer_mins` directly and will error against a DB that lacks the column. The **Python agent is pre-migration-safe** — every tenant read uses `select("*")` (incl. `book_appointment`, switched to `select("*")` for parity with `agent.py` so the live booking path has no named-column dependency) and resolves the value via `tenant.get("travel_buffer_mins", 30)`, so a missing column simply defaults to 30.

---
