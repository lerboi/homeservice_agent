-- Migration 062: Phase 61 — Google Maps Address Validation + structured address storage
--
-- Adds 6 nullable validated-address columns to appointments + inquiries (D-F1' override of D-F1).
-- Creates gmaps_validate_events sibling table for per-validate telemetry (D-C2' override of D-C2 —
-- usage_events schema is call-billing-idempotency-only and cannot hold per-validate rows).
-- Extends book_appointment_atomic and record_call_outcome with backward-compat NULLABLE params (D-F2).
--
-- All changes additive. Historical rows remain valid (new columns NULL). Existing 11-arg
-- book_appointment_atomic and 8-arg record_call_outcome callers continue to work unchanged.
--
-- Pattern source: 026_address_fields.sql (drop-loop overload eviction) +
--                 027_lock_rpc_functions.sql (REVOKE/GRANT must reference exact new signature) +
--                 052_integrations_schema.sql (sibling-table RLS pattern).
--
-- Deviations from plan spec (recorded for SUMMARY traceability):
--   1. Plan <interfaces> claimed record_call_outcome is 5-arg
--      (uuid, text, text, text, text, text DEFAULT 'routine'). Actual current signature in
--      060_phase59_rpcs.sql is 8-arg
--      (uuid, text, text, text, uuid, text, uuid, text DEFAULT NULL).
--      This migration extends the ACTUAL 8-arg signature with 6 new defaulted-NULL params
--      (final arity 14). Rule 1 deviation — plan spec was wrong; we use ground truth from 060.
--   2. Plan stated gmaps_validate_events.call_id should be `text` "matches calls.id text shape".
--      Actual calls.id is uuid (per 001_initial_schema.sql). Fixed call_id to uuid.
--      Rule 1 deviation — plan spec was wrong; calls.id is uuid in the live schema.

begin;

-- ============================================================
-- Section 1: New columns on appointments (D-F1')
-- ============================================================
-- All NULLABLE — historical rows stay NULL.
-- service_address, postal_code, street_name are RETAINED unchanged (D-F3') for
-- backward compat with calendar flyout, SMS templates, Jobber read-side.

alter table appointments
  add column formatted_address           text,
  add column place_id                    text,
  add column latitude                    numeric(10,7),
  add column longitude                   numeric(10,7),
  add column address_components          jsonb,
  add column address_validation_verdict  text;

alter table appointments
  add constraint appointments_address_validation_verdict_check
  check (address_validation_verdict is null or address_validation_verdict in (
    'confirmed', 'confirmed_with_changes', 'unconfirmed',
    'error', 'skipped', 'unsupported_region'
  ));

-- ============================================================
-- Section 2: Same columns on inquiries (D-F1')
-- ============================================================
-- Symmetry — capture_lead writes here via record_call_outcome.
-- inquiries' existing service_address text column is RETAINED (D-F3' partial —
-- postal_code and street_name don't exist on inquiries pre-Phase-61).

alter table inquiries
  add column formatted_address           text,
  add column place_id                    text,
  add column latitude                    numeric(10,7),
  add column longitude                   numeric(10,7),
  add column address_components          jsonb,
  add column address_validation_verdict  text;

alter table inquiries
  add constraint inquiries_address_validation_verdict_check
  check (address_validation_verdict is null or address_validation_verdict in (
    'confirmed', 'confirmed_with_changes', 'unconfirmed',
    'error', 'skipped', 'unsupported_region'
  ));

-- ============================================================
-- Section 3: Index on place_id (both tables) for future dedup queries
-- ============================================================

create index idx_appointments_place_id on appointments(place_id) where place_id is not null;
create index idx_inquiries_place_id    on inquiries(place_id)    where place_id is not null;

-- ============================================================
-- Section 4: New sibling table gmaps_validate_events (D-C2' override)
-- ============================================================
-- usage_events schema is call-billing-idempotency-only and cannot hold per-validate rows.
-- gmaps_validate_events captures per-validate telemetry: latency, cost, region, verdict.
-- Tenant-scoped RLS pattern mirrors usage_events / activity_log.

create table gmaps_validate_events (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  call_id           uuid references calls(id) on delete set null,  -- nullable; calls.id is uuid (deviation #2)
  verdict           text not null check (verdict in (
                      'confirmed', 'confirmed_with_changes', 'unconfirmed',
                      'error', 'skipped', 'unsupported_region')),
  latency_ms        integer,
  cost_micro_cents  integer,
  region_code       text,                          -- ISO 'US' | 'CA' | 'SG' | etc.
  created_at        timestamptz not null default now()
);

create index idx_gmaps_validate_events_tenant_created
  on gmaps_validate_events(tenant_id, created_at desc);

alter table gmaps_validate_events enable row level security;

-- SELECT: tenant owner can read own rows
create policy gmaps_validate_events_select_own on gmaps_validate_events
  for select
  using (tenant_id in (select id from tenants where owner_id = auth.uid()));

-- service-role bypasses RLS for SELECT/INSERT (Python agent inserts via service-role client).
-- No INSERT policy means non-service-role inserts blocked by RLS.
create policy service_role_all_gmaps_validate_events on gmaps_validate_events
  for all
  using (auth.role() = 'service_role');

-- ============================================================
-- Section 5: book_appointment_atomic RPC overload (D-F2)
-- ============================================================
-- Drop ALL existing overloads dynamically (matches 026's pattern verbatim),
-- then CREATE OR REPLACE the new 17-arg signature. Existing 11-arg callers continue
-- to work because the 6 new params have DEFAULT NULL.
-- Body copied verbatim from 026 with the INSERT INTO appointments column list extended.

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as func_sig
    from pg_proc
    where proname = 'book_appointment_atomic'
      and pronamespace = 'public'::regnamespace
  loop
    execute 'DROP FUNCTION IF EXISTS ' || r.func_sig;
  end loop;
end $$;

create or replace function book_appointment_atomic(
  p_tenant_id      uuid,
  p_call_id        uuid,
  p_start_time     timestamptz,
  p_end_time       timestamptz,
  p_service_address text,
  p_caller_name    text,
  p_caller_phone   text,
  p_urgency        text,
  p_zone_id        uuid          default null,
  p_postal_code    text          default null,
  p_street_name    text          default null,
  p_formatted_address           text          default null,
  p_place_id                    text          default null,
  p_latitude                    numeric(10,7) default null,
  p_longitude                   numeric(10,7) default null,
  p_address_components          jsonb         default null,
  p_address_validation_verdict  text          default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_lock_key    bigint;
  v_lock_ok     boolean;
  v_overlap_cnt int;
  v_new_id      uuid;
begin
  v_lock_key := abs(hashtext(p_tenant_id::text || extract(epoch from p_start_time)::text));
  v_lock_ok := pg_try_advisory_xact_lock(v_lock_key);

  if not v_lock_ok then
    return jsonb_build_object('success', false, 'reason', 'slot_taken');
  end if;

  select count(*) into v_overlap_cnt
  from appointments
  where tenant_id = p_tenant_id
    and status    <> 'cancelled'
    and tstzrange(start_time, end_time, '[)') && tstzrange(p_start_time, p_end_time, '[)');

  if v_overlap_cnt > 0 then
    return jsonb_build_object('success', false, 'reason', 'slot_taken');
  end if;

  insert into appointments (
    tenant_id, call_id, start_time, end_time,
    service_address, caller_name, caller_phone,
    urgency, zone_id, postal_code, street_name,
    formatted_address, place_id, latitude, longitude,
    address_components, address_validation_verdict
  )
  values (
    p_tenant_id, p_call_id, p_start_time, p_end_time,
    p_service_address, p_caller_name, p_caller_phone,
    p_urgency, p_zone_id, p_postal_code, p_street_name,
    p_formatted_address, p_place_id, p_latitude, p_longitude,
    p_address_components, p_address_validation_verdict
  )
  returning id into v_new_id;

  return jsonb_build_object('success', true, 'appointment_id', v_new_id);
end;
$$;

-- ============================================================
-- Section 6: REVOKE/GRANT new book_appointment_atomic signature
-- ============================================================
-- Postgres treats different arities as different functions; the 026/027 GRANT does NOT
-- cover the new 17-arg signature. Type list MUST be in arg-order — Postgres signature
-- match is type-list-positional.

revoke execute on function public.book_appointment_atomic(
  uuid, uuid, timestamptz, timestamptz, text, text, text, text, uuid, text, text,
  text, text, numeric, numeric, jsonb, text
) from public;

grant execute on function public.book_appointment_atomic(
  uuid, uuid, timestamptz, timestamptz, text, text, text, text, uuid, text, text,
  text, text, numeric, numeric, jsonb, text
) to service_role;

-- ============================================================
-- Section 7: record_call_outcome RPC overload (D-F2)
-- ============================================================
-- Drop ALL existing overloads dynamically. CREATE OR REPLACE new 14-arg signature
-- (8 from 060 + 6 new). Body copied from 060_phase59_rpcs.sql verbatim with the
-- INSERT INTO inquiries column list/values extended for the 6 new columns.
-- Job-path INSERT does NOT take new columns — appointments-side cols are populated
-- by book_appointment_atomic when the booking happens; record_call_outcome only
-- writes inquiry-side validated address.

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as func_sig
    from pg_proc
    where proname = 'record_call_outcome'
      and pronamespace = 'public'::regnamespace
  loop
    execute 'DROP FUNCTION IF EXISTS ' || r.func_sig;
  end loop;
end $$;

create or replace function record_call_outcome(
  p_tenant_id      uuid,
  p_phone_e164     text,
  p_caller_name    text,
  p_service_address text,
  p_appointment_id uuid,
  p_urgency        text,
  p_call_id        uuid,
  p_job_type       text          default null,
  p_formatted_address           text          default null,
  p_place_id                    text          default null,
  p_latitude                    numeric(10,7) default null,
  p_longitude                   numeric(10,7) default null,
  p_address_components          jsonb         default null,
  p_address_validation_verdict  text          default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_customer_id  uuid;
  v_job_id       uuid;
  v_inquiry_id   uuid;
begin
  -- Defense-in-depth: verify tenant exists before any write.
  if not exists (select 1 from tenants where id = p_tenant_id) then
    raise exception 'tenant_not_found' using errcode = 'no_data_found';
  end if;

  -- D-05: UPSERT customer by (tenant_id, phone_e164).
  insert into customers (tenant_id, phone_e164, name, default_address)
  values (p_tenant_id, p_phone_e164, p_caller_name, p_service_address)
  on conflict (tenant_id, phone_e164) do update
    set name            = coalesce(excluded.name, customers.name),
        default_address = coalesce(excluded.default_address, customers.default_address),
        updated_at      = now()
  returning id into v_customer_id;

  -- D-10: auto-convert branch.
  --   appointment_id present  → job path  (booked work — appointment row holds
  --                              validated address cols populated by book_appointment_atomic)
  --   appointment_id absent   → inquiry path (unbooked call — write validated address
  --                              cols here for capture_lead's persistence)
  if p_appointment_id is not null then
    insert into jobs (tenant_id, customer_id, appointment_id, urgency)
    values (p_tenant_id, v_customer_id, p_appointment_id, p_urgency)
    returning id into v_job_id;
  else
    insert into inquiries (
      tenant_id, customer_id, job_type, service_address, urgency,
      formatted_address, place_id, latitude, longitude,
      address_components, address_validation_verdict
    )
    values (
      p_tenant_id, v_customer_id, p_job_type, p_service_address, p_urgency,
      p_formatted_address, p_place_id, p_latitude, p_longitude,
      p_address_components, p_address_validation_verdict
    )
    returning id into v_inquiry_id;
  end if;

  -- D-16: always link call → customer.
  insert into customer_calls (customer_id, call_id)
  values (v_customer_id, p_call_id)
  on conflict do nothing;

  -- D-16: link call → job only when job path was taken.
  if v_job_id is not null then
    insert into job_calls (job_id, call_id)
    values (v_job_id, p_call_id)
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'customer_id', v_customer_id,
    'job_id',      v_job_id,
    'inquiry_id',  v_inquiry_id
  );
end;
$$;

-- Lock down: service_role only. Mirror of 027/060 pattern with NEW signature.
revoke execute on function public.record_call_outcome(
  uuid, text, text, text, uuid, text, uuid, text,
  text, text, numeric, numeric, jsonb, text
) from public;

grant execute on function public.record_call_outcome(
  uuid, text, text, text, uuid, text, uuid, text,
  text, text, numeric, numeric, jsonb, text
) to service_role;

commit;
