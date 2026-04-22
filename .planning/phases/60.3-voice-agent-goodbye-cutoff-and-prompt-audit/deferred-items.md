# Phase 60.3 — Deferred Items

Items discovered during execution that are out of scope for the current
plan but should be tracked for future resolution.

---

## Pre-existing test failure (discovered during 60.3-01 execution)

**Test:** `tests/webhook/test_routes.py::test_incoming_call_vip_lead`

**Location:** `C:\Users\leheh\.Projects\livekit-agent\tests\webhook\test_routes.py:847`

**Symptom:**
```
assert '<Number>+22222</Number>' in '<?xml version="1.0" encoding="UTF-8"?>\n<Response><Dial><Sip>sip:test@sip.livekit.cloud</Sip></Dial></Response>'
```

Test expects VIP-lead routing to produce a `<Number>` TwiML element when a
caller matches a tenant's VIP list, but the current `src/webhook/app.py`
route emits a `<Sip>` element unconditionally (routing every call to
LiveKit, ignoring the VIP branch).

**Verification that this is pre-existing (NOT caused by 60.3-01 Stream A):**
- Reproduced on `HEAD~2` (before Task 1) with `src/agent.py`,
  `src/tools/end_call.py`, and `tests/conftest.py` reverted to their
  pre-60.3 states. Same failure. Confirmed out-of-scope for Stream A.
- Touches `src/webhook/app.py` (HTTP routing layer), which 60.3-01 does
  NOT modify.

**Scope disposition:** Not fixed in 60.3-01. Unrelated to goodbye-race
instrumentation. Captured here for a future webhook-layer plan. The
101-test baseline figure in the plan's done criteria was inherited from
60.2; actual baseline before 60.3-01 was 100/101 passing with this test
already failing. After 60.3-01: 107/108 passing.

**Suggested follow-up:** Investigate whether VIP-lead routing was
intentionally removed/changed (e.g., when Twilio SIP + LiveKit replaced
direct Twilio dials in an earlier phase) and either fix the route or
update the test to match current behavior.

---
