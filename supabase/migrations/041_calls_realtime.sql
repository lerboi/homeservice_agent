-- Migration 041: Enable Realtime for calls table
--
-- The calls page (dashboard/calls/page.js) has a Realtime subscription
-- listening for INSERT and UPDATE events, but the calls table was never
-- added to the supabase_realtime publication. This silently caused
-- the subscription to receive zero events.

ALTER PUBLICATION supabase_realtime ADD TABLE calls;
ALTER TABLE calls REPLICA IDENTITY FULL;
