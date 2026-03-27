-- Granular notification preferences: per-booking-outcome SMS/email toggles.
-- Replaces the simple owner_notify_mode text column from migration 014.
--
-- Default: only booked calls notify. Other outcomes are off by default.
-- Emergency calls bypass these preferences entirely (safety override in code).

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{
  "booked":        { "sms": true,  "email": true  },
  "declined":      { "sms": false, "email": false },
  "not_attempted": { "sms": false, "email": false },
  "attempted":     { "sms": false, "email": false }
}'::jsonb;

-- Drop the old simple column + constraint from migration 014
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS chk_owner_notify_mode;
ALTER TABLE tenants DROP COLUMN IF EXISTS owner_notify_mode;
