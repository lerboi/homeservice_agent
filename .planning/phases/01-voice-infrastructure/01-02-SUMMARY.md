---
phase: 01-voice-infrastructure
plan: 02
subsystem: api
tags: [retell, webhook, supabase, storage, language-barrier, call-recording, transcript]

# Dependency graph
requires:
  - phase: 01-voice-infrastructure/01-01
    provides: retell.js SDK client, supabase.js client, i18n routing with locales array, DB schema with calls/tenants tables, Jest test infrastructure with mock factories

provides:
  - Retell webhook handler at /api/webhooks/retell with signature verification (401 on invalid)
  - call_inbound returns tenant-specific dynamic_variables including owner_phone
  - call_ended defers processCallEnded via after() — creates initial call record with status 'ended'
  - call_analyzed defers processCallAnalyzed via after() — uploads recording, stores transcripts, detects language barriers
  - call_function_invoked handles transfer_call by calling retell.call.transfer() with tenant owner_phone
  - Language barrier detection: calls with detected_language not in ['en','es'] tagged with language_barrier=true and barrier_language code
  - Idempotent processing via upsert on retell_call_id

affects:
  - All downstream phases that read from the calls table
  - Lead display (will show language barrier tags)
  - Recording playback (depends on recording_storage_path in calls table)
  - Any feature consuming transcript_structured JSONB

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD with jest.unstable_mockModule for ES module mocking — mock functions created outside the mock factory for per-test control"
    - "Mutable mock object pattern: shared mock object with mockReturnValue/mockImplementation per test, not recreated per test"
    - "after() for deferred background work — webhook returns 200 immediately, heavy processing runs post-response"
    - "Upsert with onConflict: 'retell_call_id' for idempotent event handling"

key-files:
  created:
    - src/app/api/webhooks/retell/route.js
    - src/lib/call-processor.js
    - tests/webhooks/retell-signature.test.js
    - tests/webhooks/retell-inbound.test.js
    - tests/webhooks/call-analyzed.test.js
  modified: []

key-decisions:
  - "Webhook returns 200 immediately for call_ended/call_analyzed and defers heavy work (recording fetch, transcript write) via next/server after() — avoids Retell timeout"
  - "transfer_call function looks up owner_phone via two-hop query (calls -> tenants) rather than passing it in dynamic_variables at call start — more resilient to late binding"
  - "Language barrier threshold: any detected_language not in locales array (['en','es']) triggers barrier tag — uses i18n/routing.js as single source of truth for supported languages"

patterns-established:
  - "TDD pattern: jest.unstable_mockModule with shared mutable mock objects for per-test control in ES module context"
  - "Webhook pattern: verify signature -> route on event -> return fast -> defer with after()"
  - "Language barrier pattern: SUPPORTED_LANGUAGES Set built from locales array, nullish detection language = no barrier"

requirements-completed: [VOICE-01, VOICE-08, VOICE-09]

# Metrics
duration: 4min
completed: 2026-03-18
---

# Phase 1 Plan 02: Retell Webhook Pipeline Summary

**Retell webhook at /api/webhooks/retell with Retell.verify() signature check, tenant-scoped dynamic_variables, transfer_call via retell.call.transfer(), and call_analyzed processor uploading recordings to Supabase Storage with language barrier tagging.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-18T19:37:33Z
- **Completed:** 2026-03-18T19:42:19Z
- **Tasks:** 2
- **Files modified:** 5 (created)

## Accomplishments

- Webhook endpoint with Retell.verify() signature validation — invalid requests rejected with 401
- Inbound call handler returns tenant-specific dynamic_variables (business_name, owner_phone, locale) with fallback defaults for unknown numbers
- call_analyzed processor: fetches recording from Retell URL, uploads to Supabase Storage call-recordings bucket, stores transcript_text (plain) and transcript_structured (JSONB) in calls table
- Language barrier detection: detected_language not in ['en','es'] sets language_barrier=true and barrier_language to the detected code (zh, ar, etc.)
- transfer_call function invocation calls retell.call.transfer() with tenant owner_phone; graceful fallback when owner_phone not configured
- 19 tests across 3 test files — all green

## Task Commits

Each task was committed atomically:

1. **Task 1: Retell webhook route with signature verification and transfer_call** - `b78b3b6` (feat)
2. **Task 2: call-processor with recording upload and language barrier detection** - `2c2361a` (feat)

**Plan metadata:** (pending — created in this step)

_Note: TDD tasks had combined test+implementation commits since implementation was fully specified in plan._

## Files Created/Modified

- `src/app/api/webhooks/retell/route.js` — POST handler: signature verification, event routing (call_inbound/call_ended/call_analyzed/call_function_invoked), transfer_call function handling
- `src/lib/call-processor.js` — processCallEnded and processCallAnalyzed: recording upload, dual transcript storage, language barrier detection, idempotent upsert
- `tests/webhooks/retell-signature.test.js` — Tests for 401 on invalid signature, 200 on valid
- `tests/webhooks/retell-inbound.test.js` — Tests for inbound routing, dynamic_variables, transfer_call function
- `tests/webhooks/call-analyzed.test.js` — Tests for recording upload, transcript storage, language barrier detection, idempotency

## Decisions Made

- Used mutable shared mock objects (mockReturnValue/mockImplementation) rather than recreating mocks per test, since jest.unstable_mockModule caches the module in ES module context. Getter pattern does not work reliably.
- transfer_call lookup uses two-hop query (calls table to get tenant_id, then tenants table for owner_phone) rather than embedding owner_phone in function_call arguments — more secure and consistent with how dynamic_variables flow.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `require()` in ES module test context**
- **Found during:** Task 1 (retell-signature.test.js RED run)
- **Issue:** `require('../__mocks__/supabase.js')` inside jest.unstable_mockModule factory throws "require is not defined" in ES module context
- **Fix:** Replaced with inline mock construction using jest.fn() directly in the factory — no require needed
- **Files modified:** tests/webhooks/retell-signature.test.js
- **Verification:** Tests passed after fix
- **Committed in:** b78b3b6 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed supabase mock not updating between tests in retell-inbound.test.js**
- **Found during:** Task 1 (retell-inbound.test.js RED run)
- **Issue:** Getter pattern for supabase mock (`get supabase() { return { from: mockSupabaseFrom } }`) did not propagate `mockFromImpl` updates into the already-imported module because ES module live bindings only apply to primitive exports, not object properties reassigned via getters
- **Fix:** Replaced getter pattern with a shared mock object where `.from` is a permanent function that delegates to `mockFromImpl` — the function reference is stable, only its internal mockImplementation changes per test
- **Files modified:** tests/webhooks/retell-inbound.test.js
- **Verification:** All 7 inbound tests passed after fix
- **Committed in:** b78b3b6 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (Rule 1 — both bugs in test mock setup)
**Impact on plan:** Both fixes were to test infrastructure only, no changes to production code. ES module mocking pattern now established correctly for the project.

## Issues Encountered

- ES module mocking with jest.unstable_mockModule requires careful mock object design. The shared mutable object pattern (described in Decisions Made) is the reliable approach for per-test mock control in this project's ES module context.

## User Setup Required

None — no external service configuration required for this plan. Runtime secrets (RETELL_API_KEY, SUPABASE_SERVICE_ROLE_KEY) were configured in Phase 01-01.

## Next Phase Readiness

- Webhook pipeline is complete — every Retell call event is now captured, stored, and processed
- calls table will accumulate call records with transcripts and recording storage paths after go-live
- Language barrier calls are tagged and ready for lead display in UI phases
- transfer_call function is wired — AI agent can hand off live calls to the business owner

---
*Phase: 01-voice-infrastructure*
*Completed: 2026-03-18*
