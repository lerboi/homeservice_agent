# Phase 17: Recovery SMS Enhancement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 17-recovery-sms-enhancement
**Areas discussed:** Recovery trigger scope, Urgency-aware content, Delivery failure handling, Manual booking link

---

## Recovery Trigger Scope

| Option | Description | Selected |
|--------|-------------|----------|
| attempted | Slot was taken during call — caller was trying to book but failed technically | ✓ |
| declined | Caller explicitly said no to booking — recovery could feel pushy | |
| not_attempted | Info-only call or caller hung up — already handled by existing cron | |

**User's choice:** Only `attempted` triggers recovery SMS
**Notes:** `declined` respects caller's choice; `not_attempted` stays with existing cron

### Timing Sub-question

| Option | Description | Selected |
|--------|-------------|----------|
| Real-time from webhook | Fire immediately via after() when atomicBookSlot fails | ✓ |
| Cron job post-call | Expand existing cron to check booking_outcome='attempted' | |

**User's choice:** Real-time from webhook

### Cron Update Sub-question

| Option | Description | Selected |
|--------|-------------|----------|
| Update both | Cron recovery SMS also gets urgency-aware content and delivery logging | ✓ |
| New path only | Leave existing cron untouched | |

**User's choice:** Update both paths for consistency

---

## Urgency-Aware Content

| Option | Description | Selected |
|--------|-------------|----------|
| Urgent empathy | Emergency: empathetic urgency tone. Routine: standard warm tone | ✓ |
| Minimal difference | Same structure, just prepend 'URGENT:' | |
| You decide | Claude picks based on Phase 16 patterns | |

**User's choice:** Urgent empathy, but dialed back — "don't sound too urgent"
**Notes:** Empathetic warmth, not alarm-bell. Caller-facing differs from owner-facing Phase 16 pattern.

### Language Sub-question

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, match Phase 15 | Multi-language (en/es) via detected_language | ✓ |
| English only for now | Add i18n later in Phase 18 | |

**User's choice:** Multi-language from day one

---

## Delivery Failure Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Single retry with delay | Wait 30s, retry once | |
| Exponential backoff (3 attempts) | Retry at ~30s, ~2min, ~5min | ✓ |
| Cron-based retry | Log failure, cron picks up on next run | |

**User's choice:** Exponential backoff, 3 attempts

### Retry Location Sub-question

| Option | Description | Selected |
|--------|-------------|----------|
| Database + cron pickup | Log status to DB, cron retries with backoff counter | ✓ |
| In-process setTimeout | setTimeout in after() block — fragile in serverless | |
| You decide | Claude picks most robust approach | |

**User's choice:** Database + cron pickup (survives serverless lifecycle)

### Log Detail Sub-question

| Option | Description | Selected |
|--------|-------------|----------|
| Full error details | Twilio error code, message, timestamp per attempt | ✓ |
| Simple status only | Just pending/sent/failed + retry_count | |

**User's choice:** Full error details

---

## Manual Booking Link

### Initial Exploration

| Option | Description | Selected |
|--------|-------------|----------|
| Per-business public page | /book/{tenant-slug} on SaaS platform | |
| Generic landing with phone | Main landing page or callback encouragement | |
| Deep link with pre-fill | URL with caller info as query params | |

**User's choice:** User paused — raised important constraint about SaaS model (business owners may not have websites)

### Revised Options After Discussion

| Option | Description | Selected |
|--------|-------------|----------|
| Retell number callback | AI answers with caller context, reattempts booking | |
| Retell + owner fallback | Both numbers provided | |
| Owner's personal phone | Direct human contact | Initially selected |

**User's choice:** Initially picked owner's phone, then reconsidered — owner would have no context about the caller's failed AI booking, leading to confused/frustrated interaction.

### Phone Number Pivot

| Option | Description | Selected |
|--------|-------------|----------|
| Retell number | AI handles callback with full caller history | Considered |
| Owner's personal phone | Direct human path | Rejected (no context problem) |

**User's choice:** Reconsidered both — neither is ideal for Phase 17

### Final Decision — SMS Chatbot Idea

User proposed: recovery SMS reply triggers an AI chatbot for text-based booking. Noted as **deferred idea** (OMNI-01 scope, new capability).

### Final CTA Decision

| Option | Description | Selected |
|--------|-------------|----------|
| Retell number callback | AI answers, reattempts booking | |
| Retell + owner fallback | Both numbers | |
| Just empathy, no link | Acknowledge failure, signal business will follow up | ✓ |

**User's choice:** Empathy-first, no link. "This will change" — placeholder until SMS chatbot or public booking page is built.

---

## Claude's Discretion

- Schema migration approach
- Exact backoff timing
- Cron endpoint structure (extend vs new)
- i18n template structure
- Emergency vs routine exact SMS copy

## Deferred Ideas

- **SMS chatbot for text-based booking** — caller replies to recovery SMS, AI books via text conversation (OMNI-01 aligned)
- **Dashboard SMS log** — owner sees all outbound SMS to callers on dashboard (must-have, do next)
- **Public booking page** — hosted per-tenant booking page on SaaS platform
