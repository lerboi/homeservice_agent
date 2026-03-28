-- Migration 022: Add missing ON DELETE CASCADE constraints
--
-- admin_users.user_id → auth.users(id) had no delete action, blocking
-- deletion of auth users from the Supabase dashboard.
--
-- phone_inventory.assigned_tenant_id → tenants(id) had no delete action,
-- blocking tenant deletion. SET NULL releases the number back to available.

-- 1. admin_users.user_id → auth.users(id) ON DELETE CASCADE
ALTER TABLE admin_users
  DROP CONSTRAINT admin_users_user_id_fkey,
  ADD CONSTRAINT admin_users_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. phone_inventory.assigned_tenant_id → tenants(id) ON DELETE SET NULL
ALTER TABLE phone_inventory
  DROP CONSTRAINT phone_inventory_assigned_tenant_id_fkey,
  ADD CONSTRAINT phone_inventory_assigned_tenant_id_fkey
    FOREIGN KEY (assigned_tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
