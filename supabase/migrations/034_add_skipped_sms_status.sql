-- Add 'skipped' to recovery_sms_status CHECK constraint.
-- Used for short calls (<15s) and booked callers where SMS is intentionally not sent.
ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_recovery_sms_status_check;
ALTER TABLE calls ADD CONSTRAINT calls_recovery_sms_status_check
  CHECK (recovery_sms_status IN ('pending', 'sent', 'failed', 'retrying', 'skipped'));
