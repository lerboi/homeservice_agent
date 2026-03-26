# Phase 24: Subscription Lifecycle and Notifications - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 24-subscription-lifecycle-and-notifications
**Areas discussed:** Grace Period UX, Notification Content and Tone, Trial Reminder Timing, Middleware Gate Behavior

---

## Grace Period UX

| Option | Description | Selected |
|--------|-------------|----------|
| Persistent warning banner | Dismissible-but-recurring banner across all dashboard pages with payment update link | ✓ |
| Banner + degraded mode | Same banner, plus grey out non-essential features for urgency | |
| Banner + countdown timer | Persistent banner with live countdown to service block | |

**User's choice:** Persistent warning banner
**Notes:** No feature degradation during grace period.

| Option | Description | Selected |
|--------|-------------|----------|
| Relative countdown | "X days remaining" — simpler, no timezone complexity | ✓ |
| Exact date | "Service stops March 30" — requires timezone handling | |
| You decide | Claude picks whichever is simpler | |

**User's choice:** Relative countdown

---

## Notification Content and Tone

| Option | Description | Selected |
|--------|-------------|----------|
| Helpful and direct | Business-friendly, no panic. Clear action, no guilt. | ✓ |
| Formal and professional | Corporate tone with "Dear [name]" style | |
| Urgent and action-oriented | "Action required" framing with urgency | |

**User's choice:** Helpful and direct

| Option | Description | Selected |
|--------|-------------|----------|
| Direct link in SMS | SMS includes Stripe Customer Portal URL directly | ✓ |
| SMS points to email | SMS says "Check your email for payment details" | |

**User's choice:** Direct link in SMS

| Option | Description | Selected |
|--------|-------------|----------|
| React email template | Branded HTML with Voco logo, usage stats, upgrade CTA | ✓ |
| Plain text | Simple text email, faster to implement | |
| You decide | Claude picks based on complexity | |

**User's choice:** React email template

---

## Trial Reminder Timing

| Option | Description | Selected |
|--------|-------------|----------|
| DB column on subscriptions | Add trial_reminder_7/12_sent_at columns to subscriptions | |
| Separate tracking table | New billing_notifications table (tenant_id, type, sent_at) | ✓ |
| You decide | Claude picks simplest approach | |

**User's choice:** Separate tracking table
**Notes:** More flexible for future notification types.

| Option | Description | Selected |
|--------|-------------|----------|
| Vercel Cron route | /api/cron/trial-reminders, same pattern as existing crons | ✓ |
| You decide | Claude follows existing patterns | |

**User's choice:** Vercel Cron route

---

## Middleware Gate Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate redirect | Middleware redirects to /billing/upgrade instantly | ✓ |
| Interstitial message | Brief "subscription expired" page with CTA | |
| You decide | Claude picks simplest approach | |

**User's choice:** Immediate redirect

| Option | Description | Selected |
|--------|-------------|----------|
| Exempt /billing/* routes | All /billing/* paths bypass subscription gate | ✓ |
| Only exempt /billing/upgrade | Just the upgrade page exempt | |

**User's choice:** Exempt all /billing/* routes

---

## Claude's Discretion

- Banner component implementation details
- React email template design
- Cron frequency
- billing_notifications table schema details
- trial_will_end notification channel (SMS, email, or both)

## Deferred Ideas

None — discussion stayed within phase scope
