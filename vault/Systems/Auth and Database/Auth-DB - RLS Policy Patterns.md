---
type: system
system: Auth and Database
status: current
description: "Row Level Security enforces tenant isolation at the database level. Every table uses one of two patterns. Covers: Pattern 1: Direct Owner (tenants table only); Pattern 2: Tenant Child (all data tables); Pattern 3: Service Role Bypass"
source: .claude/skills/auth-database-multitenancy/SKILL.md § 4. RLS Policy Patterns
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# RLS Policy Patterns

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

Row Level Security enforces tenant isolation at the database level. Every table uses one of two patterns.

### Pattern 1: Direct Owner (tenants table only)

```sql
CREATE POLICY "tenants_read_own" ON tenants
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "tenants_update_own" ON tenants
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "tenants_insert_own" ON tenants
  FOR INSERT WITH CHECK (owner_id = auth.uid());
```

`auth.uid()` = the Supabase auth user UUID. Applied directly because `tenants.owner_id` IS the auth UID.

### Pattern 2: Tenant Child (all data tables)

```sql
-- Example from calls table (001_initial_schema.sql)
CREATE POLICY "calls_all_own" ON calls
  FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));
```

All child tables (calls, services, appointments, leads, etc.) carry a `tenant_id` FK. The policy traverses `tenant_id → tenants.owner_id` to match the authenticated user.

**WITH CHECK on insert/update**: The `WITH CHECK` clause requires `tenant_id` to be present and correct on every INSERT and UPDATE. This is why PATCH operations (e.g., reorder endpoints) must include `tenant_id` in every upserted row — even when only another column is changing.

### Pattern 3: Service Role Bypass

Every table has a service role bypass policy:

```sql
-- From 001_initial_schema.sql
CREATE POLICY "service_role_all_tenants" ON tenants
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all_calls" ON calls
  FOR ALL USING (auth.role() = 'service_role');
```

This allows webhook handlers (using the service role client) to read/write any tenant's data without knowing which user is "authenticated." Every new table must get a service role bypass policy.

---
