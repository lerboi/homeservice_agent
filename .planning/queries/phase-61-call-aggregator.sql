-- .planning/queries/phase-61-call-aggregator.sql
-- Phase 61.x production-call aggregator. Run after a regression to find
-- comparable calls. Filter by date range to scope to "post-Phase-61 ship."
--
-- Created in Phase 61.2 Plan 01 (D-15). Three named queries:
--   Q1 — Outcome breakdown for post-Phase-61 calls
--   Q2 — not_attempted calls (the regression bucket)
--   Q3 — Slot-hallucination heuristic (assistant turns proposing times the
--        caller did not say)
--
-- Schema source: 001_initial_schema.sql + 023_livekit_migration.sql.
-- Heuristic in Q3 is conservative; expect 10-30% false-positive rate. For
-- triage, NOT classification. Surface for human review.
--
-- The tenant_id below is "make it ai" — the only tenant in the two known
-- incidents (61.1 + 61.2). Drop or parameterize the filter for broader runs.

-- Q1: Outcome breakdown for post-Phase-61 calls
-- (Phase 61 shipped 2026-05-03 per 61.1-INCIDENT.md frontmatter)
SELECT
  date_trunc('day', created_at) AS day,
  booking_outcome,
  count(*) AS n_calls,
  avg(duration_seconds)::int AS avg_dur_s,
  count(*) FILTER (WHERE disconnection_reason = 'CLIENT_INITIATED') AS caller_hangups
FROM calls
WHERE created_at >= '2026-05-03'
  AND tenant_id = '24141cd0-5735-4c7a-82d5-994c6b821861'  -- "make it ai" — adjust as needed
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- Q2: not_attempted calls — the regression bucket
SELECT
  call_id,
  created_at,
  duration_seconds,
  disconnection_reason,
  detected_language,
  -- First 500 chars of transcript for quick triage:
  left(transcript_text, 500) AS transcript_preview
FROM calls
WHERE created_at >= '2026-05-03'
  AND booking_outcome = 'not_attempted'
  AND duration_seconds >= 30  -- skip short hang-ups
ORDER BY created_at DESC
LIMIT 50;

-- Q3: Slot-hallucination heuristic — assistant turns with specific times
-- not preceded by a caller turn naming the same time. Coarse; for triage.
WITH assistant_time_turns AS (
  SELECT
    c.call_id,
    c.created_at,
    c.booking_outcome,
    (turn->>'content') AS content,
    turn_idx,
    LAG(turn->>'content') OVER (PARTITION BY c.call_id ORDER BY turn_idx) AS prev_content,
    LAG(turn->>'role') OVER (PARTITION BY c.call_id ORDER BY turn_idx) AS prev_role
  FROM calls c,
       jsonb_array_elements(c.transcript_structured) WITH ORDINALITY AS t(turn, turn_idx)
  WHERE c.created_at >= '2026-05-03'
    AND turn->>'role' = 'assistant'
    AND (turn->>'content') ~ '\b(at|on|for)\s+\d{1,2}\s*(am|pm|AM|PM)\b'
)
SELECT
  call_id,
  created_at,
  booking_outcome,
  content AS suspect_assistant_turn,
  prev_content AS preceding_caller_turn
FROM assistant_time_turns
WHERE booking_outcome != 'booked'
  AND (prev_content IS NULL OR prev_content !~ '\b\d{1,2}\s*(am|pm|AM|PM)\b')
ORDER BY created_at DESC
LIMIT 50;
