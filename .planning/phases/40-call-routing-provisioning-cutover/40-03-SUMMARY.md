---
phase: 40-call-routing-provisioning-cutover
plan: 03
subsystem: infra
tags: [twilio, provisioning, webhook, sip, cutover, skill-update]

# Dependency graph
requires:
  - phase: 40-call-routing-provisioning-cutover
    plan: 01
    provides: "Live incoming-call routing handler, migration 045 (sms_messages + call_sid)"
  - phase: 40-call-routing-provisioning-cutover
    plan: 02
    provides: "Dial-status writeback, dial-fallback AI TwiML, SMS forwarding"
provides:
  - "provisionPhoneNumber sets voice_url/voice_fallback_url/sms_url from RAILWAY_WEBHOOK_URL on new Twilio numbers"
  - "Cutover script for existing tenant Twilio numbers (scripts/cutover-existing-numbers.js)"
  - "voice-call-architecture SKILL.md updated with all Phase 40 live routing changes"
affects: [41-call-routing-dashboard-and-launch]

# Tech tracking
tech-stack:
  added: []
  patterns: ["RAILWAY_WEBHOOK_URL env var for webhook URL construction", "SIP trunk preserved as rollback safety net (D-21)"]

key-files:
  created:
    - "scripts/cutover-existing-numbers.js"
  modified:
    - "src/app/api/stripe/webhook/route.js"
    - ".claude/skills/voice-call-architecture/SKILL.md"

key-decisions:
  - "SIP trunk associations preserved on all numbers as rollback safety net (clearing voice_url restores SIP routing)"
  - "RAILWAY_WEBHOOK_URL env var required in Vercel for provisioning; warning logged if unset"
  - "Cutover script is idempotent and supports --dry-run mode"

patterns-established:
  - "Webhook URL construction: webhookBase + '/twilio/incoming-call' pattern for voice_url, voice_fallback_url, sms_url"

requirements-completed: [ROUTE-12]

# Metrics
duration: 10min
completed: 2026-04-11
---

# Phase 40 Plan 03: Provisioning Cutover and Skill Update Summary

**provisionPhoneNumber updated with RAILWAY_WEBHOOK_URL-based webhook URLs, cutover script migrated all existing tenant numbers, voice-call-architecture skill fully documented with Phase 40 live routing changes**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-10T21:03:23Z
- **Completed:** 2026-04-10T21:13:51Z
- **Tasks:** 4 (3 auto + 1 checkpoint)
- **Files modified:** 3

## Accomplishments
- provisionPhoneNumber in stripe webhook route now sets voice_url, voice_fallback_url, sms_url on both US/CA (at purchase) and SG (after assignment) numbers from RAILWAY_WEBHOOK_URL env var
- Cutover script (scripts/cutover-existing-numbers.js) with --dry-run support successfully migrated all existing tenant numbers to webhook routing
- voice-call-architecture SKILL.md comprehensively updated with Phase 40 routing composition, owner-pickup TwiML, dial-status/fallback, SMS forwarding, migration 045, provisioning changes, and architecture diagram

## Task Commits

Each task was committed atomically:

1. **Task 1: Update provisionPhoneNumber to set webhook URLs on new numbers** - `d7f24ef` (feat)
2. **Task 2: Create cutover script for existing tenant Twilio numbers** - `1aa747b` (feat)
3. **Task 3: Verify cutover on real Twilio numbers** - checkpoint:human-verify (approved)
4. **Task 4: Update voice-call-architecture skill file with Phase 40 changes** - `1de0f77` (docs)

## Files Created/Modified
- `src/app/api/stripe/webhook/route.js` - Added RAILWAY_WEBHOOK_URL webhook URL construction and voice_url/voice_fallback_url/sms_url on new Twilio numbers
- `scripts/cutover-existing-numbers.js` - Standalone cutover script for existing tenant numbers with --dry-run support
- `.claude/skills/voice-call-architecture/SKILL.md` - Updated with complete Phase 40 documentation (routing composition, endpoints, migration 045, provisioning, architecture diagram)

## Decisions Made
- SIP trunk associations preserved on all numbers as rollback safety net per D-21 (clearing voice_url restores SIP trunk routing)
- RAILWAY_WEBHOOK_URL env var is the single source for webhook base URL (Vercel for provisioning, local for cutover)
- Cutover script queries tenants table directly with service_role key, not through API routes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

**RAILWAY_WEBHOOK_URL must be set in Vercel environment variables** (already done as part of Task 3 checkpoint verification). Value from Railway dashboard -> livekit-agent service -> Settings -> Networking -> Public URL.

## Cutover Results

Live cutover completed successfully:
- Mode: LIVE
- Webhook base: https://livekitagent-production.up.railway.app
- 1 tenant with phone number found
- 1 updated (+14783755631, SID: PNd63102b147149f82cb6bf27074cc14d6)
- 0 skipped, 0 failed

## Next Phase Readiness
- All Twilio numbers now route through Railway webhook (voice_url set)
- Phase 41 can build the dashboard UI knowing the routing backend is fully operational
- Phase 41 needs: /dashboard/more/call-routing page, GET/PUT /api/call-routing routes, routing mode badges on calls page

---
*Phase: 40-call-routing-provisioning-cutover*
*Completed: 2026-04-11*
