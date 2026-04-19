-- Add calendar_events to the Supabase Realtime publication so the
-- dashboard calendar can subscribe to webhook-driven changes (Jobber,
-- Google, Outlook mirrors) and re-render without a manual refresh.
--
-- Matches the pattern used by 041_calls_realtime.sql and
-- 043_appointments_realtime.sql.

ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events;
