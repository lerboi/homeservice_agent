# 2026-06-12 Fix Wave — Your Manual Steps

Wave 1 of the audit fixes is implemented in BOTH repos (main + livekit-agent), build green, tests green (one pre-existing failure, see §7). Everything below is what **you** must do — nothing here happens automatically.

---

## 1. Run this SQL (Supabase SQL editor, IN THIS ORDER)

All four blocks are idempotent (safe to re-run). **068 → 069 → 070 → 071.**

### 1a. Migration 068 (already in repo, STILL NOT APPLIED — verified live 2026-06-12)

Run the full contents of `supabase/migrations/068_billing_and_security_hardening.sql`.
This must run **before** the next main-repo deploy: the new webhook code writes `stripe_webhook_events.processing_started_at` on every event and will 500 on every Stripe event until this column exists.

```sql
BEGIN;

-- Section 1: Dedupe duplicate is_current=true rows per tenant
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY tenant_id
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM subscriptions
  WHERE is_current
)
UPDATE subscriptions s
SET is_current = false
FROM ranked r
WHERE s.id = r.id
  AND r.rn > 1;

-- Section 2: One is_current row per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_current
  ON subscriptions(tenant_id)
  WHERE is_current;

-- Section 3: oauth_refresh_locks lockdown
ALTER TABLE oauth_refresh_locks ENABLE ROW LEVEL SECURITY;

REVOKE EXECUTE ON FUNCTION public.try_acquire_oauth_refresh_lock(uuid, text, int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_acquire_oauth_refresh_lock(uuid, text, int)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_oauth_refresh_lock(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_oauth_refresh_lock(uuid, text, uuid)
  TO service_role;

-- Section 4: Hot-path indexes
CREATE INDEX IF NOT EXISTS idx_activity_log_customer
  ON activity_log(customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_job_id
  ON invoices(job_id);

CREATE INDEX IF NOT EXISTS idx_appointments_external_event_id
  ON appointments(external_event_id)
  WHERE external_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_blocks_external_event_id
  ON calendar_blocks(external_event_id)
  WHERE external_event_id IS NOT NULL;

-- Section 5: Webhook processing claim
ALTER TABLE stripe_webhook_events
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

COMMIT;
```

### 1b. Migration 069 — RPC + token lockdown (NEW: `supabase/migrations/069_rpc_and_token_lockdown.sql`)

Closes the **critical** live hole: all 7 SECURITY DEFINER RPCs (book_appointment_atomic, record_call_outcome, merge_customer, unmerge_customer, set_primary_calendar, assign_sg_number, increment_rate_limit) are currently executable by the public **anon** key. Also makes the plaintext Xero/Jobber/Google/Outlook OAuth tokens unreadable from the browser. Every app caller uses the service-role client (verified in both repos), so nothing breaks.

```sql
BEGIN;

-- Section 1: SECURITY DEFINER RPC lockdown (privileges + search_path)
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn.sig);
  END LOOP;
END $$;

-- Section 2: search_path pinning for advisor-flagged SECURITY INVOKER
-- functions; increment_calls_used also gets the privilege lockdown
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'set_updated_at',
        'increment_calls_used',
        'get_next_invoice_number',
        'get_next_estimate_number',
        'try_acquire_oauth_refresh_lock',
        'release_oauth_refresh_lock'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn.sig);
    IF fn.proname = 'increment_calls_used' THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
    END IF;
  END LOOP;
END $$;

-- Section 3: OAuth token tables — service_role only
REVOKE ALL ON TABLE public.accounting_credentials FROM anon, authenticated;
REVOKE ALL ON TABLE public.calendar_credentials FROM anon, authenticated;

COMMIT;
```

### 1c. Migration 070 — ai_voice labels (NEW: `supabase/migrations/070_ai_voice_labels.sql`)

**Must run before deploying the main repo** — the voice picker now writes labels, and the live CHECK (067, OpenAI names) would reject them with a 500.

```sql
BEGIN;

ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_ai_voice_check;

UPDATE tenants
SET ai_voice = NULL
WHERE ai_voice IS NOT NULL
  AND ai_voice NOT IN ('professional', 'friendly', 'local_expert');

ALTER TABLE tenants
  ADD CONSTRAINT tenants_ai_voice_check CHECK (
    ai_voice IS NULL OR ai_voice IN ('professional', 'friendly', 'local_expert')
  );

COMMIT;
```

### 1d. Migration 071 — meter outbox + telemetry enum (NEW: `supabase/migrations/071_meter_event_outbox.sql`)

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS stripe_meter_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  failure_reason text,
  attempts int NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stripe_meter_failures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE stripe_meter_failures FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_meter_failures_created
  ON stripe_meter_failures(created_at);

COMMIT;

-- Run these two AFTER the commit (ALTER TYPE ADD VALUE can't be used in the
-- same transaction that uses the value; both are IF NOT EXISTS / re-runnable):
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'integration_fetch';
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'integration_fetch_fanout';
```

### 1e. Verify (optional but recommended)

```sql
-- All should return 0 / false:
SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef
  AND has_function_privilege('anon', p.oid, 'EXECUTE');                      -- expect 0

SELECT has_table_privilege('anon', 'oauth_refresh_locks', 'INSERT');          -- expect f
SELECT has_table_privilege('authenticated', 'accounting_credentials', 'SELECT'); -- expect f

-- Should both exist:
SELECT count(*) FROM information_schema.columns
WHERE table_name='stripe_webhook_events' AND column_name='processing_started_at'; -- expect 1
SELECT count(*) FROM pg_indexes WHERE indexname='idx_subscriptions_one_current';  -- expect 1
```

---

## 2. Deploy order

1. Run ALL the SQL above (§1).
2. Deploy the **main repo** (Vercel). New crons appear automatically from vercel.json: `release-churned-numbers` (daily 04:00), `retry-meter-events` (every 6h).
3. Deploy/commit the **livekit-agent** repo (Railway).

Both repos' changes are currently **uncommitted** working-tree changes (on top of your existing uncommitted 2026-06-10 wave) — review and commit when ready.

---

## 3. Railway env (livekit-agent) — check before deploying

The agent now **refuses to boot** if any of these are missing (this is the fix for calls silently dying with a green healthcheck):

- `OPENAI_API_KEY`
- `DEEPGRAM_API_KEY`
- `ELEVEN_API_KEY` (exact name — NOT `ELEVENLABS_API_KEY`)

Also:
- `TWILIO_AUTH_TOKEN` must be set — webhooks now return **503 instead of accepting forgeable requests** when it's blank.
- `PYTHON_ENV=production` recommended. `ALLOW_UNSIGNED_WEBHOOKS` is now **ignored** in production (and when PYTHON_ENV is unset).

## 4. ElevenLabs

Add both mapped voice IDs to the account's **My Voices** (the plugin hard-fails any call otherwise):
- `BIvP0GN1cAtSRTxNHnWS` (professional + local_expert)
- `7EzWGsX10sAS4c9m9cPf` (friendly)

## 5. Stripe

- **Verified in test mode (by me, 2026-06-12):** `ui_mode: 'embedded_page'` was rejected under the Basil pin (signup checkout was broken) — now `'embedded'`. Monthly overage on annual subs is rejected in classic mode — annual checkouts now use flexible billing mode under the new `2025-06-30.basil` pin, verified working.
- Confirm the Billing Meter **`voco_calls`** exists in LIVE mode (customer_mapping key `stripe_customer_id`, value key `value`) — pre-existing requirement, the retry cron depends on it too.
- **Existing LIVE annual subscriptions** (if any) were created in classic mode and still can't take the overage item. Check: Stripe Dashboard → Subscriptions → any yearly-interval subs → if present, they need migrating to flexible billing mode or manual overage handling. (Test data showed none locally; verify live.)
- After deploy, do one **test-mode end-to-end signup** (embedded checkout step 5) and one annual checkout to confirm.

## 6. Audio assets to produce (can't be fixed in code)

- `public/audio/voices/professional.mp3`, `friendly.mp3`, `local_expert.mp3` — short voice-preview samples (generate with the two ElevenLabs voices above). The 6 stale Gemini-era files in that folder (achird/aoede/charon/erinome/sulafat/zephyr, 427 bytes each) can be deleted.
- `public/audio/demo-emergency.mp3` and `public/audio/demo-routine.mp3` are byte-identical copies of the 3-second intro stub against 24–30s transcripts — the landing page's flagship demo is broken until real recordings replace them.

## 7. Build & test status (2026-06-12)

- **Main repo:** `next build` ✅ green (the stale `src/app/dashboard/leads/` page that broke the build is deleted).
- **Main repo jest:** every suite covering this wave's changes passes (ai-voice-settings, subscription-gate, outlook-calendar, booking, slot-calculator, grace-period, trial-countdown, billing-checkout, enforcement-gate — two of those suites were updated because they asserted the deliberately-removed Phase 24 middleware redirect and the retired 10-voice OpenAI list). The full run still shows ~27 failing suites that are **pre-existing**: they import the long-deleted `@/lib/retell` module (Retell→LiveKit migration) or assert pre-2026-06-10-wave UI (dark-mode audits, landing-sections, pricing-calc, jobber suites). None were introduced by this wave; they're cleanup backlog.
- **livekit-agent:** `pytest` — **443 passed, 1 failed**: `test_incoming_call_vip_lead` (pre-existing, legacy leads table; documented since before this wave). Two new security tests added (production bypass refusal + empty-token 503).
- All 6 skill files synced (payment, auth-db, scheduling, voice, integrations, dashboard). NOTE: `CLAUDE.md` still says "62 migrations" — update to 71 when you next touch it.

## 8. Not fixed in this wave (wave-2 backlog, all verified real)

- M1: canceled tenants can re-trial via onboarding checkout (reuse stripe_customer_id + omit trial when a prior sub exists).
- M5: verify-checkout `syncSubscription` still uses `subscription.updated || created` + string timestamp compare (webhook got the fix; this fallback path didn't).
- M12: all-day blocks drop from the busy set during evenings in west-of-UTC timezones (JS + Python `end_time >= now` prefilter before expansion).
- M13: `book_appointment` doesn't re-check external-calendar busy within the 10-min slot-token window.
- M16: zones/travel-buffers dead code — decide: wire zone resolution from postal code, or remove the zones UI (everyone gets a flat 30-min buffer today).
- M21: Xero webhook cacheTags built from raw (non-E.164) phones; the whole JS context cache currently has no consumers.
- M18: dashboard stats "today"/month boundaries computed in UTC (wrong for US tenants from ~4pm).
- M19: `GET /api/invoices` does a bulk overdue UPDATE + full-table aggregate on every list render.
- Public-site items: CSP (Report-Only first), robots.txt disallows, OG images + metadataBase, `.env.example` deletion staged in the tree (restore before committing!), six unused heavy deps, sitemap missing /privacy + /terms, footer newsletter no-op.
- Low tier from the audit report (`My Prompts/audit-2026-06-12.md` §LOW).
