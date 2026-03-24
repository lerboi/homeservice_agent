-- ============================================================
-- 008_call_outcomes.sql
-- Phase 15: Call Processor + Triage Reclassification
-- Per D-01, D-03, D-11 from 15-CONTEXT.md
-- ============================================================

-- Add booking_outcome, exception_reason, and notification_priority columns to calls table
ALTER TABLE calls
  ADD COLUMN booking_outcome text
    CHECK (booking_outcome IN ('booked', 'attempted', 'declined', 'not_attempted')),
  ADD COLUMN exception_reason text
    CHECK (exception_reason IN ('clarification_limit', 'caller_requested')),
  ADD COLUMN notification_priority text
    CHECK (notification_priority IN ('high', 'standard'));

-- Indexes for analytics queries and Phase 16 handoff
CREATE INDEX idx_calls_booking_outcome ON calls(tenant_id, booking_outcome);
CREATE INDEX idx_calls_notification_priority ON calls(tenant_id, notification_priority);
