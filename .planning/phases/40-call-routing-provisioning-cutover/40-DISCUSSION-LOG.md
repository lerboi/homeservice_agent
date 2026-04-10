# Phase 40: Call Routing Provisioning Cutover - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 40-call-routing-provisioning-cutover
**Areas discussed:** Blocked/unknown tenant behavior, Fallback-to-AI continuity, Migration strategy, Owner-pickup call lifecycle

---

## Blocked/Unknown Tenant Webhook Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Fail-open (always AI) | Route all calls to AI regardless of tenant status; existing agent-side subscription gate handles blocked tenants | Y |
| Fail-closed (reject/busy) | Return busy signal or reject for blocked/unknown tenants | |
| Not-in-service message | Play a "this number is not in service" recording | |

**User's choice:** Fail-open (always AI) -- accepted Claude's recommendation
**Notes:** Maintains behavior parity with current SIP trunk routing. Agent's existing BLOCKED_STATUSES gate handles edge cases.

---

## Fallback-to-AI Call Continuity

| Option | Description | Selected |
|--------|-------------|----------|
| Fallback-aware greeting | AI acknowledges the missed call with a different greeting ("Thanks for your patience...") | |
| Same greeting (no context) | AI treats fallback call identically to a direct AI call -- same greeting, no special behavior | Y |

**User's choice:** Same greeting -- user explicitly rejected the fallback-aware option
**Notes:** User wants all AI calls to have a consistent experience regardless of how the call arrived. Simplifies implementation and avoids confusion.

---

## Migration Rollback Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Gradual rollout with dry-run | Migration script with dry-run mode, batch migration, monitoring | |
| Direct update (no migration ceremony) | Update all existing tenant numbers directly since app is in development | Y |
| Keep SIP trunk as rollback safety net | Don't remove SIP trunk associations; clearing voice_url restores SIP routing | Y |

**User's choice:** Direct update + keep SIP trunk
**Notes:** User clarified the app is still in development, so a formal migration script with dry-run/gradual rollout is unnecessary overhead. SIP trunk retention for rollback safety was accepted.

---

## Owner-Pickup Call Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal row, no pipeline | Insert basic calls row (tenant_id, from_number, routing_mode, created_at); dial-status adds duration; no AI pipeline | Y |
| Partial pipeline | Run some subset of post-call (e.g., lead creation) for owner-pickup calls | |
| Full pipeline | Run the entire post-call pipeline including triage and notifications | |

**User's choice:** Minimal row, no pipeline -- accepted Claude's recommendation
**Notes:** Owner talked to the customer directly; they don't need triage, transcripts, or notifications for their own conversation.

---

## Claude's Discretion

- Dial-status callback row identification strategy (CallSid vs from/to + timestamp)
- Existing-tenant update implementation form (Python script vs Node.js script vs admin endpoint)
- sms_messages table indexes
- Webhook subscription check implementation (direct query vs shared module)
- Test organization for Phase 40 tests

## Deferred Ideas

- Fallback-aware AI greeting (explicitly rejected by user)
- Cap-breach event table (warning log only for now)
- MMS forwarding (text note only)
- Per-recipient SMS retry logic
