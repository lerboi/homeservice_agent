-- 075: M16 P2 — Owner-adjustable travel buffer
--
-- The only live buffer between back-to-back jobs has been a hardcoded flat 30
-- minutes inside the slot calculator (the zone-differentiated path is dormant —
-- zone_id is always NULL — so the literal 30 executes on every booking, in both
-- the Python live path and the JS dashboard twin). A contractor with a wide
-- territory has no way to ask the AI to leave MORE drive time. This migration
-- adds the one setting that fixes that.
--
-- Single additive, backward-compatible change (no table rewrite, no RLS change —
-- the existing tenant-owner + service_role policies already cover the new column):
--
--   tenants.travel_buffer_mins — minimum minutes the slot calculator leaves
--   between adjacent jobs. Threaded through calculate_available_slots exactly
--   like slot_duration_mins (migration 003), so it applies automatically at BOTH
--   offer-time and book-time. DEFAULT 30 reproduces today's exact buffer value,
--   so every existing tenant is unchanged. Mirrors the slot_duration_mins shape
--   (int NOT NULL DEFAULT). The owner picks it on the Working Hours settings page.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS travel_buffer_mins int NOT NULL DEFAULT 30;

COMMENT ON COLUMN public.tenants.travel_buffer_mins IS
  'Minimum drive time (minutes) the slot calculator leaves between back-to-back jobs. The default buffer path in calculate_available_slots / calculateAvailableSlots reads this instead of a hardcoded 30, and enforces it on BOTH sides of every booking (forward + backward adjacency). DEFAULT 30 = pre-M16-P2 behavior (zero regression). Owner-set on the Working Hours page; 0 disables buffering. Tenant-wide flat value — NOT per-day or per-zone; the dormant zone_travel_buffers matrix is unrelated (M16 P2).';
