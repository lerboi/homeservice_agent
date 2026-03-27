-- Migration 019: Replace UNIQUE(tenant_id, start_time) with GiST exclusion constraint
--
-- The old UNIQUE constraint only prevents exact same start_time, not overlapping ranges.
-- It also blocks rebooking a cancelled slot at the same time (bug).
--
-- The new exclusion constraint:
--   1. Prevents any overlapping non-cancelled appointments per tenant
--   2. Allows rebooking cancelled slots at the same time
--   3. Enforces at DB level what book_appointment_atomic enforces at application level

-- Enable btree_gist extension (required for exclusion constraints with non-GiST types like uuid)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop the old UNIQUE constraint (idx_appointments_tenant_start still exists for query performance)
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_tenant_id_start_time_key;

-- Add range-based exclusion constraint: no two non-cancelled appointments may overlap per tenant
ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    tenant_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (status <> 'cancelled');
