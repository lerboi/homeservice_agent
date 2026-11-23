---
type: system
system: Billing
status: legacy-app
description: "Fires on customer.subscription.trial_will_end (3 days before trial end) Covers: `handleTrialWillEnd` (Webhook); `handleInvoicePaymentFailed` (Webhook); Email Templates"
source: .claude/skills/payment-architecture/SKILL.md § 8. Billing Notifications
migrated: 2026-11-23
verified:
tags: [voco/system/billing]
---

# Billing Notifications

Part of [[Billing]]. Migrated verbatim from the `payment-architecture` skill; check `verified` before trusting details.

### `handleTrialWillEnd` (Webhook)

- Fires on `customer.subscription.trial_will_end` (3 days before trial end)
- **Idempotency**: Checks `billing_notifications` table before sending, upserts after
- Sends email (`TrialReminderEmail`) + SMS via `Promise.allSettled`
- Notification failures are logged but NEVER thrown (prevents Stripe retry)

### `handleInvoicePaymentFailed` (Webhook)

- Fires on `invoice.payment_failed`
- Generates Stripe Customer Portal URL for direct payment method update
- Sends SMS + email (`PaymentFailedEmail`) via `Promise.allSettled`
- Notification failures logged, never thrown

### Email Templates

| Template | File | Purpose |
|----------|------|---------|
| `TrialReminderEmail` | `src/emails/TrialReminderEmail.jsx` | Dynamic heading/body based on trial stage, usage stats, upgrade CTA |
| `PaymentFailedEmail` | `src/emails/PaymentFailedEmail.jsx` | Amber-700 header (urgency), portal URL for payment update |

Both use React Email components with inline styles matching design tokens.

---
