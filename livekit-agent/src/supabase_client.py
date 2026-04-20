"""Service-role Supabase client. Mirrors sibling livekit-agent repo.

Kept in Voco worktree (Phase 58 dual-locate) so tests can import the real
src.integrations.xero / jobber without a sibling checkout. The sibling
file at C:\\Users\\leheh\\.Projects\\livekit-agent\\src\\supabase_client.py
is the production source-of-truth.
"""
import os
from supabase import create_client, Client

_supabase: Client | None = None


def get_supabase_admin() -> Client:
    """Get a Supabase service-role client (bypasses RLS).
    Same pattern as the Next.js app's src/lib/supabase.js.
    """
    global _supabase
    if _supabase is None:
        url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise RuntimeError("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        _supabase = create_client(url, key)
    return _supabase
