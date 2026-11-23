---
type: system
system: Auth and Database
status: current
description: "Three forward-fix-only migrations from the 2026-06-12 audit wave 1. PENDING manual application along with 068 — apply in order. Full file-map entries above. Covers: 069_rpc_and_token_lockdown.sql — RPC + OAuth-token lockdown; 070_ai_voice_labels.sql — ai_voice label CHECK; 071_meter_event_outbox.sql"
source: ".claude/skills/auth-database-multitenancy/SKILL.md § 2026-06-12 Audit: Migrations (069 / 070 / 071)"
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# 2026-06-12 Audit Migrations (069 070 071)

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

Three forward-fix-only migrations from the 2026-06-12 audit wave 1. **PENDING manual application along with 068** — apply in order. Full file-map entries above.

### 069_rpc_and_token_lockdown.sql — RPC + OAuth-token lockdown

**Section 1 — SECURITY DEFINER RPC lockdown.** Supabase grants EXECUTE on every new public function to `anon` and `authenticated` EXPLICITLY, so the `REVOKE ... FROM PUBLIC` in migrations 027/033/062/065 was a no-op against those grants. Verified live (2026-06-12): all 7 SECURITY DEFINER functions — `book_appointment_atomic`, `record_call_outcome`, `merge_customer`, `unmerge_customer`, `set_primary_calendar`, `assign_sg_number`, `increment_rate_limit` — were executable by the anon role via `/rest/v1/rpc/*` with the public anon key (cross-tenant appointment injection, SG inventory drain, CRM corruption, rate-limiter poisoning). A **catalog-driven DO block** (`pg_proc WHERE prosecdef` in schema public) REVOKEs from PUBLIC/anon/authenticated, GRANTs to service_role, and pins `search_path = public, pg_temp` on each — exact signatures always correct, idempotent, and future SECURITY DEFINER functions get covered on re-run. Every caller in both repos uses the service-role client, so nothing breaks.

**Section 2 — search_path pinning for advisor-flagged SECURITY INVOKER functions**: `set_updated_at`, `increment_calls_used`, `get_next_invoice_number`, `get_next_estimate_number`, `try_acquire_oauth_refresh_lock`, `release_oauth_refresh_lock`. No privilege changes except `increment_calls_used`, which additionally gets the anon/authenticated EXECUTE revoke (sole caller is the Python agent's service-role client).

**Section 3 — OAuth token tables locked to service_role**: `REVOKE ALL ON accounting_credentials, calendar_credentials FROM anon, authenticated`. Both store `access_token`/`refresh_token` as plaintext and had tenant-own RLS policies + authenticated table grants — a logged-in owner's browser session (or any XSS in it) could SELECT live OAuth tokens via PostgREST. No browser-side code reads either table (verified), so revoking client-role privileges breaks nothing. The tenant-own RLS policies remain but are unreachable for client roles.

### 070_ai_voice_labels.sql — ai_voice label CHECK

Drops 067's OpenAI-name CHECK on `tenants.ai_voice`, clears any non-label values to NULL (live DB already all NULL), and adds `CHECK (ai_voice IS NULL OR ai_voice IN ('professional', 'friendly', 'local_expert'))`. The Phase 66 cascade agent resolves `ai_voice` as a stable label via `ELEVENLABS_VOICE_MAP` and silently falls back to the tone-preset voice for anything else — under 067's CHECK the picker wrote OpenAI names the agent ignored (silent no-op) and a label-writing picker would have 500'd on the CHECK. This migration realizes the "migration 068 stores labels" that agent code comments referenced (068 turned out to be billing hardening). **Deploy before the main-repo picker change** (`src/lib/ai-voice-validation.js` `VALID_VOICES` → labels); the agent needs no coordination.

### 071_meter_event_outbox.sql — meter-failure outbox + enum values

Creates `stripe_meter_failures` (see Complete Table Reference) — the durable outbox that makes failed Stripe Billing Meter overage posts recoverable (`increment_calls_used` has already consumed the call_id, so the post-call pipeline could never retry; see `payment-architecture` skill for the outbox/cron flow). Service-role only: RLS enabled with no policies + client-role privileges revoked. Outside the transaction (Postgres can't `ALTER TYPE ... ADD VALUE` in the same transaction that uses it): adds `integration_fetch` + `integration_fetch_fanout` to `activity_event_type` (both `IF NOT EXISTS` — file re-runnable), unblocking the Phase 58 integration telemetry inserts that had silently failed the enum cast since Phase 58.
