-- Migration 028: Add ON DELETE CASCADE to calls.tenant_id
--
-- calls.tenant_id → tenants(id) was created in 001_initial_schema.sql
-- with no delete action (defaults to RESTRICT), blocking tenant deletion.

ALTER TABLE calls
  DROP CONSTRAINT calls_tenant_id_fkey,
  ADD CONSTRAINT calls_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
