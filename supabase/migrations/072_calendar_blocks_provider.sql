-- 072: M15 — calendar_blocks provider attribution
--
-- Manual time-block mirrors recorded only external_event_id, and the PATCH/
-- DELETE cleanup resolved the provider by is_primary. If the tenant switched
-- their primary calendar between creating and editing/deleting a block, cleanup
-- targeted the WRONG provider (orphaned event on the old provider, or a 404 on
-- the new one). Record the owning provider at push time so cleanup is exact.
--
-- Nullable + additive (metadata-only, no table rewrite). Legacy NULL rows fall
-- back to the primary provider in the readers, preserving current behavior.

ALTER TABLE public.calendar_blocks
  ADD COLUMN IF NOT EXISTS external_event_provider text;

COMMENT ON COLUMN public.calendar_blocks.external_event_provider IS
  'Calendar provider (google|outlook) that owns external_event_id, recorded at push time. NULL for legacy rows -> readers fall back to the primary provider (M15).';
