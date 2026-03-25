-- 009_recovery_sms_tracking.sql
-- Phase 17: Recovery SMS delivery tracking columns for retry logic (RECOVER-03)

ALTER TABLE calls
  ADD COLUMN recovery_sms_status text
    CHECK (recovery_sms_status IN ('pending', 'sent', 'failed', 'retrying')),
  ADD COLUMN recovery_sms_retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN recovery_sms_last_error text,
  ADD COLUMN recovery_sms_last_attempt_at timestamptz;

-- Index for cron query: find retrying records past their backoff window
CREATE INDEX idx_calls_recovery_sms_retry
  ON calls(tenant_id, recovery_sms_status, recovery_sms_last_attempt_at)
  WHERE recovery_sms_status = 'retrying';
