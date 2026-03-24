-- ============================================================
-- 007_outlook_calendar.sql
-- Phase 8: Outlook Calendar Sync - Dual-Provider Support
-- ============================================================

-- Add is_primary column to calendar_credentials (per D-10)
ALTER TABLE calendar_credentials
  ADD COLUMN is_primary boolean NOT NULL DEFAULT false;

-- Backfill: set existing Google credentials as primary (per D-03)
UPDATE calendar_credentials SET is_primary = true
  WHERE provider = 'google';

-- Rename appointments.google_event_id to external_event_id (per D-09)
ALTER TABLE appointments
  RENAME COLUMN google_event_id TO external_event_id;

-- Add external_event_provider column (per D-09)
ALTER TABLE appointments
  ADD COLUMN external_event_provider text
    CHECK (external_event_provider IN ('google', 'outlook'));

-- Backfill existing Google event IDs
UPDATE appointments
  SET external_event_provider = 'google'
  WHERE external_event_id IS NOT NULL;
