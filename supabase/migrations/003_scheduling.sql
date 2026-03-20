-- ============================================================
-- 003_scheduling.sql
-- Phase 3: Scheduling and Calendar Sync Foundation
-- ============================================================

-- Extend tenants table with scheduling config
ALTER TABLE tenants
  ADD COLUMN tenant_timezone text NOT NULL DEFAULT 'America/Chicago',
  ADD COLUMN slot_duration_mins int NOT NULL DEFAULT 60;

-- ============================================================
-- appointments table
-- ============================================================
CREATE TABLE appointments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_id         uuid REFERENCES calls(id) ON DELETE SET NULL,
  start_time      timestamptz NOT NULL,
  end_time        timestamptz NOT NULL,
  service_address text NOT NULL,
  caller_name     text NOT NULL,
  caller_phone    text NOT NULL,
  urgency         text NOT NULL DEFAULT 'routine'
    CHECK (urgency IN ('emergency', 'routine', 'high_ticket')),
  zone_id         uuid,
  status          text NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  booked_via      text NOT NULL DEFAULT 'ai_call'
    CHECK (booked_via IN ('ai_call', 'manual')),
  google_event_id text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, start_time)
);

CREATE INDEX idx_appointments_tenant_start ON appointments(tenant_id, start_time);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments_tenant_own" ON appointments
  FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_appointments" ON appointments
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- service_zones table
-- ============================================================
CREATE TABLE service_zones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  postal_codes text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_zones_tenant ON service_zones(tenant_id);

ALTER TABLE service_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_zones_tenant_own" ON service_zones
  FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_service_zones" ON service_zones
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- zone_travel_buffers table
-- ============================================================
CREATE TABLE zone_travel_buffers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  zone_a_id   uuid NOT NULL REFERENCES service_zones(id) ON DELETE CASCADE,
  zone_b_id   uuid NOT NULL REFERENCES service_zones(id) ON DELETE CASCADE,
  buffer_mins int NOT NULL DEFAULT 30,
  UNIQUE (zone_a_id, zone_b_id)
);

ALTER TABLE zone_travel_buffers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zone_travel_buffers_tenant_own" ON zone_travel_buffers
  FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_zone_travel_buffers" ON zone_travel_buffers
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- calendar_credentials table
-- ============================================================
CREATE TABLE calendar_credentials (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider          text NOT NULL DEFAULT 'google'
    CHECK (provider IN ('google', 'outlook')),
  access_token      text NOT NULL,
  refresh_token     text NOT NULL,
  expiry_date       bigint,
  calendar_id       text NOT NULL DEFAULT 'primary',
  calendar_name     text,
  watch_channel_id  text,
  watch_resource_id text,
  watch_expiration  bigint,
  last_sync_token   text,
  last_synced_at    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

ALTER TABLE calendar_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_credentials_tenant_own" ON calendar_credentials
  FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_calendar_credentials" ON calendar_credentials
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- calendar_events table
-- ============================================================
CREATE TABLE calendar_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider            text NOT NULL DEFAULT 'google',
  external_id         text NOT NULL,
  title               text,
  start_time          timestamptz,
  end_time            timestamptz,
  is_all_day          boolean NOT NULL DEFAULT false,
  appointment_id      uuid REFERENCES appointments(id) ON DELETE SET NULL,
  conflict_dismissed  boolean NOT NULL DEFAULT false,
  synced_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_id)
);

CREATE INDEX idx_calendar_events_tenant_times ON calendar_events(tenant_id, start_time, end_time);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_events_tenant_own" ON calendar_events
  FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_calendar_events" ON calendar_events
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- Add FK from appointments to service_zones (deferred constraint)
-- ============================================================
ALTER TABLE appointments
  ADD CONSTRAINT appointments_zone_id_fkey
  FOREIGN KEY (zone_id) REFERENCES service_zones(id) ON DELETE SET NULL;

-- ============================================================
-- book_appointment_atomic function
-- Acquires a non-blocking advisory lock per (tenant, slot_start),
-- checks for overlapping appointments, and inserts if clear.
-- Returns: { success: true, appointment_id: uuid }
--      or: { success: false, reason: 'slot_taken' }
-- ============================================================
CREATE OR REPLACE FUNCTION book_appointment_atomic(
  p_tenant_id      uuid,
  p_call_id        uuid,
  p_start_time     timestamptz,
  p_end_time       timestamptz,
  p_service_address text,
  p_caller_name    text,
  p_caller_phone   text,
  p_urgency        text,
  p_zone_id        uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lock_key    bigint;
  v_lock_ok     boolean;
  v_overlap_cnt int;
  v_new_id      uuid;
BEGIN
  -- Derive a deterministic 63-bit advisory lock key from tenant + slot start
  v_lock_key := abs(hashtext(p_tenant_id::text || extract(epoch FROM p_start_time)::text));

  -- Non-blocking try-lock; if another transaction holds this key, bail immediately
  v_lock_ok := pg_try_advisory_xact_lock(v_lock_key);

  IF NOT v_lock_ok THEN
    RETURN jsonb_build_object('success', false, 'reason', 'slot_taken');
  END IF;

  -- Check for any non-cancelled appointment that overlaps the requested window
  SELECT COUNT(*) INTO v_overlap_cnt
  FROM appointments
  WHERE tenant_id = p_tenant_id
    AND status    <> 'cancelled'
    AND tsrange(start_time, end_time, '[)') && tsrange(p_start_time, p_end_time, '[)');

  IF v_overlap_cnt > 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'slot_taken');
  END IF;

  -- Safe to insert
  INSERT INTO appointments (
    tenant_id,
    call_id,
    start_time,
    end_time,
    service_address,
    caller_name,
    caller_phone,
    urgency,
    zone_id
  )
  VALUES (
    p_tenant_id,
    p_call_id,
    p_start_time,
    p_end_time,
    p_service_address,
    p_caller_name,
    p_caller_phone,
    p_urgency,
    p_zone_id
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'appointment_id', v_new_id);
END;
$$;
