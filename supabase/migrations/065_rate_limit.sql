-- Migration 065: Durable, Supabase-backed rate limiting
--
-- Replaces the in-memory per-instance Maps in /api/public-chat and /api/demo-voice
-- with a shared, instance-independent fixed-window counter table. Counters are keyed
-- by (bucket, key, window_start) where window_start is now() floored to the bucket's
-- window size. A SECURITY DEFINER RPC performs an atomic upsert-and-increment so the
-- limiter survives serverless cold starts and works across multiple Vercel instances.
--
-- Pattern source: 037 / 062 SECURITY DEFINER RPC + REVOKE-from-public / GRANT-to-service_role.
-- RLS: service-role-only (no anon access). The Next.js routes call the RPC via the
-- service-role client (src/lib/supabase.js), so no anon/auth policies are needed.

begin;

-- ============================================================
-- Section 1: Counter table
-- ============================================================
-- One row per (bucket, key, window). count is incremented atomically by the RPC.
-- Rows are disposable — a daily cleanup cron deletes anything older than 1 day.

create table if not exists rate_limit_hits (
  bucket        text        not null,
  key           text        not null,
  window_start  timestamptz not null,
  count         integer     not null default 0,
  primary key (bucket, key, window_start)
);

-- Index to support the cleanup cron's window_start range delete.
create index if not exists idx_rate_limit_hits_window_start
  on rate_limit_hits(window_start);

-- ============================================================
-- Section 2: RLS — service-role only (no anon access)
-- ============================================================

alter table rate_limit_hits enable row level security;

-- Service-role bypasses RLS for all access. The explicit policy documents intent;
-- absence of any anon/authenticated policy blocks all non-service-role access.
create policy service_role_all_rate_limit_hits on rate_limit_hits
  for all
  using (auth.role() = 'service_role');

-- ============================================================
-- Section 3: increment_rate_limit RPC (SECURITY DEFINER)
-- ============================================================
-- Atomic upsert-and-increment. Returns the new count for the current window.

create or replace function increment_rate_limit(
  p_bucket       text,
  p_key          text,
  p_window_start timestamptz
)
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  insert into rate_limit_hits (bucket, key, window_start, count)
  values (p_bucket, p_key, p_window_start, 1)
  on conflict (bucket, key, window_start)
  do update set count = rate_limit_hits.count + 1
  returning count into v_count;

  return v_count;
end;
$$;

-- ============================================================
-- Section 4: Lock down the RPC — service_role only
-- ============================================================

revoke execute on function public.increment_rate_limit(text, text, timestamptz) from public;
grant execute on function public.increment_rate_limit(text, text, timestamptz) to service_role;

commit;
