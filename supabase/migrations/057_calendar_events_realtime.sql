-- Add calendar_events to the Supabase Realtime publication so the
-- dashboard calendar can subscribe to webhook-driven changes (Jobber,
-- Google, Outlook mirrors) and re-render without a manual refresh.
--
-- Matches the pattern used by 041_calls_realtime.sql and
-- 043_appointments_realtime.sql.
--
-- REPLICA IDENTITY FULL is required so UPDATE/DELETE events carry the
-- full old row — otherwise Supabase Realtime can't evaluate RLS on the
-- old-row side and the subscription times out (TIMED_OUT status).

ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events;
ALTER TABLE calendar_events REPLICA IDENTITY FULL;
