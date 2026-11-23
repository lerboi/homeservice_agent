---
type: system
system: Auth and Database
status: current
description: "Two forward-fix-only migrations. PENDING manual application (apply in order; additive + behavior-preserving). Covers: 072_calendar_blocks_provider.sql — M15 calendar_blocks provider attribution; 073_book_appointment_atomic_slot_taken.sql — LOW-26 clean slot_taken on exclusion race"
source: ".claude/skills/auth-database-multitenancy/SKILL.md § 2026-06-12 Audit (cont.): Migrations (072 / 073) — quick-win wave 2026-06-20"
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# 2026-06-12 Audit (cont.) Migrations (072 073) - quick-win wave 2026-06-20

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

Two forward-fix-only migrations. **PENDING manual application** (apply in order; additive + behavior-preserving).

### 072_calendar_blocks_provider.sql — M15 calendar_blocks provider attribution

Adds nullable `calendar_blocks.external_event_provider text` (metadata-only `ADD COLUMN IF NOT EXISTS`, no rewrite). Manual time-block mirrors recorded only `external_event_id`, and the PATCH/DELETE cleanup (`src/app/api/calendar-blocks/[id]/route.js`) resolved the provider by `is_primary` — so a tenant who switched their primary calendar between creating and editing/deleting a block had cleanup hit the WRONG provider. Both write sites (`calendar-blocks/route.js` POST, the `[id]` PATCH/DELETE readers) now record/prefer this column with an `is_primary` fallback for legacy NULL rows, mirroring the appointment-cancel reader (`appointments/[id]/route.js`, hardened in WAVE 1). **Deploy the calendar_blocks code only AFTER this column exists** — the writers/readers reference it. Also: `appointments/route.js` manual-booking POST now writes the already-existing `appointments.external_event_provider` (the appointments half of M15; no migration needed there).

### 073_book_appointment_atomic_slot_taken.sql — LOW-26 clean slot_taken on exclusion race

`CREATE OR REPLACE` of `book_appointment_atomic` (17-arg signature unchanged; SECURITY DEFINER + `search_path` pin + existing ACL all preserved by REPLACE) wrapping ONLY the INSERT in `EXCEPTION WHEN exclusion_violation OR unique_violation THEN RETURN {success:false, reason:'slot_taken'}`. The advisory lock is keyed per (tenant_id, exact start_time) and the pre-check only COUNTs, so a concurrent overlapping-but-DIFFERENT-start booking could pass both and lose the race at the `appointments_no_overlap` GiST constraint, raising a raw 23P01 → dashboard 500 / agent rpc_error. The advisory lock is taken in the OUTER block, so the inner subtransaction rollback doesn't release it. Pure behavior improvement (a former 500 becomes the existing slot_taken contract); no caller change needed (`/api/appointments` POST already maps `reason:'slot_taken'` → 409; the voice agent already recalculates on slot_taken).

---
