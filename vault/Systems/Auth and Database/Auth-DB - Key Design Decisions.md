---
type: system
system: Auth and Database
status: current
description: "Three clients with distinct purposes: Service role bypasses RLS for webhooks (cross-tenant access needed); server client reads session cookie for authenticat…"
source: .claude/skills/auth-database-multitenancy/SKILL.md § 8. Key Design Decisions
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# Key Design Decisions

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

- **Three clients with distinct purposes**: Service role bypasses RLS for webhooks (cross-tenant access needed); server client reads session cookie for authenticated requests; browser client is anon-key for client-side auth and Realtime. Mixing them causes auth failures or over-privileged DB access.

- **`getTenantId` does NOT use `user_metadata`**: Tenant ID is stored in the `tenants` table, resolved via `owner_id = user.id`. Supabase's `user_metadata` is not used for this. This is explicit and deliberate — tenant_id must come from the DB, not from JWT claims.

- **RLS two-pattern design (owner vs tenant child)**: `tenants` table uses direct `owner_id = auth.uid()` because the user IS the owner. All child tables use `tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())` because they're one level removed. This indirection is correct and necessary.

- **Service role bypass on every table**: Every new table needs a `FOR ALL USING (auth.role() = 'service_role')` policy. Without it, webhook handlers can't write to that table.

- **WITH CHECK on insert/update**: The `WITH CHECK` clause means RLS applies on write operations too, not just reads. Any PATCH/upsert that doesn't include `tenant_id` in the row will fail silently or throw an RLS violation.

- **REPLICA IDENTITY FULL for Realtime**: Required on `leads` table so Supabase Realtime can emit old+new row data for tenant-filtered subscriptions. Standard identity only sends the PK on change events, breaking RLS-aware filtering.

- **Migration ordering matters (FK dependencies)**: 001 (tenants, calls) must run before 002 (services FK tenants). 003 adds appointment FK to service_zones (added in same migration). 004 adds leads FK to calls and appointments. All FK dependencies flow downward in migration order.

- **Admin gate returns early from middleware**: The `/admin/*` check returns response immediately after verifying admin status — before the tenant/onboarding redirect logic. Admin users are platform operators who may not have a `tenants` row. Without early return, the middleware would redirect them to `/onboarding`.

- **verifyAdmin uses service_role for admin_users lookup**: `verifyAdmin()` uses the service-role client for the admin_users query. This ensures consistent behavior regardless of RLS policy changes. The session client is used only for `auth.getUser()`. Note that `getTenantId()` takes the opposite approach — it uses the session client for both auth and the tenants query, relying on RLS for defense-in-depth tenant isolation.

- **admin_users has no service_role bypass policy**: Service role bypasses RLS by default in Supabase — no explicit policy is needed. The single SELECT policy allows authenticated users to check their own admin status (used by middleware). All writes (INSERT/UPDATE/DELETE) are done directly via service_role (Supabase CLI or SQL editor) — there are intentionally no INSERT policies.

- **Middleware uses anon key for cookie-based auth**: The middleware creates a `createServerClient` with `NEXT_PUBLIC_SUPABASE_ANON_KEY` (not service_role). Using service_role in middleware would bypass the cookie-based session check entirely — the middleware would never see unauthenticated users.

- **Multi-tenant isolation: ALL data tables carry tenant_id FK**: Every table except `tenants` itself carries a `tenant_id` column as a FK to `tenants.id`. This is non-negotiable — it's the only way RLS can enforce tenant boundaries.

---
