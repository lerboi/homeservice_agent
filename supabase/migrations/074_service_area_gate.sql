-- 074: M16 P1 — Service-Area gate (Capability A)
--
-- The AI receptionist must stop booking jobs the contractor cannot reasonably
-- reach, WITHOUT ever silently dropping a caller (a lost lead is the owner's
-- #1 fear). At validate_address time the agent now classifies the caller's
-- Google-normalized postal code / town against the tenant's coverage list and,
-- when it is clearly outside, follows the owner's chosen out-of-area action
-- instead of booking a slot. This migration adds the storage that gate needs.
--
-- Three additive, backward-compatible changes (no table rewrites, no RLS
-- changes — existing tenant-owner + service_role policies already cover new
-- columns; no record_call_outcome RPC overload — capture_lead stamps the flag
-- with a follow-up service-role UPDATE, mirroring its existing calls update):
--
--   1. service_zones.cities — the town/city half of the coverage list. The
--      zone already stores postal_codes[]; market practice (Jobber, Housecall
--      Pro, ServiceTitan) is to match coverage on ZIP *and* town-name strings,
--      so the gate unions both. The multi-zone rows are repurposed as one flat
--      coverage list (the dashboard now presents a single "Service Area"); the
--      dormant zone_travel_buffers matrix is being retired separately.
--   2. tenants.out_of_area_action — ONE owner setting deciding what the AI does
--      with a confirmed out-of-area caller. Default 'callback' (take a message
--      and promise a call-back) is the safest, never-lose-the-lead posture.
--      Mirrors the tone_preset CHECK-enum style.
--   3. tenants.out_of_area_referral_note — optional free text the AI may share
--      only in the 'decline_referral' mode (e.g. "try ABC Plumbing 555-1234").
--   4. inquiries.out_of_area — durable flag so an out-of-area lead is visible in
--      the CRM, not just in the moment's owner SMS/email. Default false keeps
--      every existing/legacy inquiry unflagged.

-- 1. Town/city coverage list (parallels postal_codes[]).
ALTER TABLE public.service_zones
  ADD COLUMN IF NOT EXISTS cities text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.service_zones.cities IS
  'Town/city names the tenant serves (Google-normalized locality strings, case-insensitive matched). The town half of the Service-Area coverage list; postal_codes[] is the ZIP half. The agent unions both across all of the tenant''s rows (M16 P1, Capability A).';

-- 2. Owner setting: what the AI does with a confirmed out-of-area caller.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS out_of_area_action text NOT NULL DEFAULT 'callback'
    CHECK (out_of_area_action IN ('callback', 'decline_referral', 'trip_fee'));

COMMENT ON COLUMN public.tenants.out_of_area_action IS
  'How the AI handles a caller confirmed outside the Service Area: callback = take a message + promise a call-back, do NOT book (default, never loses the lead); decline_referral = politely decline + optionally share out_of_area_referral_note; trip_fee = proceed to book but warn an extra travel charge may apply. All three still capture the lead + flag the owner (M16 P1, Capability A).';

-- 3. Optional referral text, shared only in 'decline_referral' mode.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS out_of_area_referral_note text;

COMMENT ON COLUMN public.tenants.out_of_area_referral_note IS
  'Optional free-text referral the AI may offer an out-of-area caller when out_of_area_action = decline_referral (e.g. another company + number). NULL = no referral offered (M16 P1).';

-- 4. Durable out-of-area flag on the lead for CRM visibility.
ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS out_of_area boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.inquiries.out_of_area IS
  'TRUE when the caller''s confirmed address was outside the tenant''s Service Area at capture time. Stamped by the agent capture_lead tool via a follow-up service-role UPDATE (no RPC change). Default false for all existing/legacy rows (M16 P1, Capability A).';
