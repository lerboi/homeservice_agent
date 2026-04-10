-- Migration 042: Enable Realtime for appointments table
--
-- The calendar page (dashboard/calendar/page.js) should reflect new bookings
-- from the AI agent in real-time. Previously the page only refreshed on
-- manual navigation or the refresh button, so AI-booked appointments were
-- invisible until the user moved the calendar.
--
-- REPLICA IDENTITY FULL is required so DELETE events carry the full row
-- (needed by the client to filter/remove from local state).

ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
ALTER TABLE appointments REPLICA IDENTITY FULL;
