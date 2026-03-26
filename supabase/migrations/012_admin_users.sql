-- Migration 012: Admin users table for admin dashboard auth gate
-- Phase 28-01: admin-dashboard foundation

CREATE TABLE admin_users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  role       text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own admin status (used by middleware)
CREATE POLICY "Authenticated can read own admin row"
  ON admin_users FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies — all admin user management is via service_role (CLI/direct DB)
