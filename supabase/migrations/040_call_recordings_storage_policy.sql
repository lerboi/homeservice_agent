-- Migration 040: Add storage RLS policy for call-recordings bucket
--
-- The call-recordings bucket was created via the Supabase dashboard.
-- Recordings are uploaded by the LiveKit agent via S3 protocol (service-role,
-- bypasses RLS). But the dashboard needs to create signed URLs to play them
-- back — this requires a SELECT policy on storage.objects.
--
-- Recording path format: {tenant_id}/{call_id}.ogg
-- The policy scopes read access to the tenant's own folder.

-- Ensure bucket exists (no-op if already created via dashboard)
INSERT INTO storage.buckets (id, name, public)
VALUES ('call-recordings', 'call-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Allow tenant owners to read their own call recordings
CREATE POLICY "tenant_read_recordings" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'call-recordings'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM tenants WHERE owner_id = auth.uid()
    )
  );
