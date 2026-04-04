-- Migration 036: Rename urgency tier 'high_ticket' -> 'urgent'
--
-- "High Ticket" is a revenue qualifier, not urgency. "Urgent" is intuitive
-- and aligns with how business owners think about call priority:
--   Emergency = safety risk, happening now
--   Urgent    = needs attention soon, not life-threatening
--   Routine   = can wait, schedule at convenience

-- 1. calls.urgency_classification
ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_urgency_classification_check;
UPDATE calls SET urgency_classification = 'urgent' WHERE urgency_classification = 'high_ticket';
ALTER TABLE calls ADD CONSTRAINT calls_urgency_classification_check
  CHECK (urgency_classification IN ('emergency', 'routine', 'urgent'));

-- 2. leads.urgency
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_urgency_check;
UPDATE leads SET urgency = 'urgent' WHERE urgency = 'high_ticket';
ALTER TABLE leads ADD CONSTRAINT leads_urgency_check
  CHECK (urgency IN ('emergency', 'routine', 'urgent'));

-- 3. appointments.urgency
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_urgency_check;
UPDATE appointments SET urgency = 'urgent' WHERE urgency = 'high_ticket';
ALTER TABLE appointments ADD CONSTRAINT appointments_urgency_check
  CHECK (urgency IN ('emergency', 'routine', 'urgent'));

-- 4. services.urgency_tag
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_urgency_tag_check;
UPDATE services SET urgency_tag = 'urgent' WHERE urgency_tag = 'high_ticket';
ALTER TABLE services ADD CONSTRAINT services_urgency_tag_check
  CHECK (urgency_tag IN ('emergency', 'routine', 'urgent'));
