---
type: system
system: Scheduling and Calendar
status: current
description: "Atomic Booking. Covers: `atomicBookSlot` Signature; `book_appointment_atomic` RPC Flow (created in `003_scheduling.sql`; **current definition: migration 062, 17 args**); Return Shapes; Secondary Defense"
source: .claude/skills/scheduling-calendar-system/SKILL.md § 2. Atomic Booking
migrated: 2026-11-23
verified:
tags: [voco/system/scheduling-and-calendar]
---

# Atomic Booking

Part of [[Scheduling and Calendar]]. Migrated verbatim from the `scheduling-calendar-system` skill; check `verified` before trusting details.

**File**: `src/lib/scheduling/booking.js`

### `atomicBookSlot` Signature

```js
export async function atomicBookSlot({
  tenantId,     // string — UUID of the tenant
  callId,       // string|null — UUID of the originating call
  startTime,    // Date — slot start (UTC Date object)
  endTime,      // Date — slot end (UTC Date object)
  address,      // string — service address (verbally confirmed by caller)
  callerName,   // string — caller's full name
  callerPhone,  // string — caller's phone number
  urgency,      // string — 'emergency' | 'routine' | 'urgent'
  zoneId,       // string|null — service zone UUID
})
// Returns: Promise<{ success: boolean, appointment_id?: string, reason?: string }>
// Throws on Supabase transport/query error
```

`atomicBookSlot` is a thin JS wrapper — all conflict logic lives inside the `book_appointment_atomic` Postgres function.

### `book_appointment_atomic` RPC Flow (created in `003_scheduling.sql`; **current definition: migration 062, 17 args**)

The signature was extended twice — to 11 args, then to **17 args in migration 062** (Phase 61 address validation: `p_formatted_address`, `p_place_id`, `p_latitude`, `p_longitude`, `p_address_components`, `p_address_validation_verdict`, all `DEFAULT NULL` so older callers keep working). The core lock/overlap/insert flow below is unchanged:

```sql
-- Core parameters (003): p_tenant_id, p_call_id, p_start_time, p_end_time,
--             p_service_address, p_caller_name, p_caller_phone, p_urgency, p_zone_id
-- + later additions through migration 062 (17 total)

-- Step 1: Derive advisory lock key
v_lock_key := abs(hashtext(p_tenant_id::text || extract(epoch FROM p_start_time)::text));

-- Step 2: Non-blocking try-lock
v_lock_ok := pg_try_advisory_xact_lock(v_lock_key);
IF NOT v_lock_ok THEN
  RETURN { success: false, reason: 'slot_taken' };
END IF;

-- Step 3: tsrange overlap check on non-cancelled appointments
SELECT COUNT(*) INTO v_overlap_cnt
FROM appointments
WHERE tenant_id = p_tenant_id
  AND status <> 'cancelled'
  AND tsrange(start_time, end_time, '[)') && tsrange(p_start_time, p_end_time, '[)');

IF v_overlap_cnt > 0 THEN
  RETURN { success: false, reason: 'slot_taken' };
END IF;

-- Step 4: Insert and return new appointment ID
INSERT INTO appointments (...) VALUES (...) RETURNING id INTO v_new_id;
RETURN { success: true, appointment_id: v_new_id };
```

### Return Shapes

```js
// Success
{ success: true, appointment_id: "uuid-string" }

// Conflict (lock contention OR overlap)
{ success: false, reason: "slot_taken" }
```

### Secondary Defense

The GiST exclusion constraint `appointments_no_overlap` (migration 019) acts as the final guard:

```sql
ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (tenant_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&)
  WHERE (status <> 'cancelled');
```

Even if two concurrent transactions somehow pass both the advisory lock and the range check, the DB insert fails for the second one. (Migration 019 **replaced** the original `UNIQUE (tenant_id, start_time)` — that constraint only blocked identical start times, not overlapping ranges.)

---
