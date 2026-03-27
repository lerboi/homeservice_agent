-- Owner notification mode: controls when SMS + email alerts are sent to the business owner.
-- 'all' = notify on every lead (current default behavior)
-- 'booked_only' = only notify when a booking is made (lead.status = 'booked')
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_notify_mode text NOT NULL DEFAULT 'all';
ALTER TABLE tenants ADD CONSTRAINT chk_owner_notify_mode CHECK (owner_notify_mode IN ('all', 'booked_only'));

Starter – 99 / 40 calls (≈2.48/call)
• Growth – 249 / 120 calls (≈2.08/call)
• Scale – 599 / 400 calls (≈1.50/call)
