# Phase 16: Notification Priority System - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Update the owner notification system (SMS + React Email template) to deliver urgency-appropriate alerts. Emergency bookings surface with high-priority formatting — "EMERGENCY" prefix, urgent tone, red visual treatment — so owners can triage their inbox at a glance. Routine bookings use the existing standard notification flow. Notification priority is driven by the urgency tag on the booking record (sourced from the triage pipeline), not by the call routing path.

This is a formatting/presentation change only. No new notification channels, no new Twilio/Resend wiring, no new database tables. The existing `sendOwnerNotifications()` wrapper is the call site — only the message construction inside `sendOwnerSMS()`, `sendOwnerEmail()`, and `NewLeadEmail` changes.

</domain>

<decisions>
## Implementation Decisions

### SMS Priority Formatting (NOTIF-P01, NOTIF-P02)
- **D-01:** Emergency SMS starts with "EMERGENCY: " prefix — visually distinct on lock screen without opening the message.
- **D-02:** Emergency SMS uses urgent verb: "{businessName} — {callerName} needs urgent {jobType} at {address}. Call NOW: {callbackLink} | Dashboard: {dashboardLink}"
- **D-03:** Routine SMS keeps existing structure but updates "lead" to "booking" to match Phase 15 terminology: "{businessName}: New booking — {callerName}, {jobType} at {address}. Callback: {callbackLink} | Dashboard: {dashboardLink}"
- **D-04:** Urgency detection uses the same field the codebase already reads: `urgency_classification || urgency`. No new fields needed.
- **D-05:** Only 'emergency' triggers high-priority formatting. 'high_ticket' and 'routine' both use standard formatting (consistent with Phase 14 D-11).

### Email Priority Formatting
- **D-06:** Emergency email subject: "EMERGENCY: New booking — {callerName}" (no emoji — SMS deliverability and inbox filter concerns)
- **D-07:** Routine email subject: "New booking — {callerName}" (changed from "lead" to "booking" to match Phase 15 terminology)
- **D-08:** Emergency email uses red header (#DC2626) instead of navy (#0F172A) — immediately visible in email clients that show sender photo/color
- **D-09:** Emergency email adds an "EMERGENCY BOOKING" text badge in the header section — scannable without reading the body
- **D-10:** All other email structure (detail rows, CTA button, footer) remains unchanged — no layout rework needed

### What Phase 15 Provides
- `booking_outcome` column on calls table (booked / attempted / not_attempted)
- Urgency tags retained on booking records (emergency / routine / high_ticket)
- Call processor updated to pass urgency from triage result to notification call
- Phase 16 reads the existing `lead.urgency_classification || lead.urgency` field — no new data needed

### Scope Boundaries
- **In scope:** SMS body copy, email subject line, email header color/badge in NewLeadEmail
- **Out of scope:** Recovery SMS (Phase 17), push notifications, Slack/webhook alerts, repeated escalation cadence (deferred per REQUIREMENTS.md)

</decisions>

<canonical_refs>
## Canonical References

- `src/lib/notifications.js` — Main file to modify: sendOwnerSMS, sendOwnerEmail, sendOwnerNotifications
- `src/emails/NewLeadEmail.jsx` — React Email template to modify for emergency visual treatment
- `tests/notifications/owner-sms.test.js` — Existing SMS tests (extend, don't replace)
- `tests/notifications/owner-email.test.js` — Existing email tests (extend, don't replace)
- `tests/__mocks__/twilio.js` — Twilio mock pattern for tests
- `tests/__mocks__/resend.js` — Resend mock pattern for tests

</canonical_refs>

<code_context>
## Existing Code Insights

### Current sendOwnerSMS format (line 52-56 in notifications.js):
```javascript
const body =
  `${businessName}: New ${urgency || 'routine'} lead -- ` +
  `${callerName || 'Unknown'}, ${jobType || 'General inquiry'} ` +
  `at ${address || 'No address'}. ` +
  `Call back: ${callbackLink} | Dashboard: ${dashboardLink}`;
```
- urgency is already passed in as a param — just needs branch logic

### Current sendOwnerEmail subject (line 79):
```javascript
const subject = `New ${lead?.urgency || 'routine'} lead -- ${lead?.caller_name || 'Unknown caller'}`;
```
- Reads from lead object — already has urgency available

### Current NewLeadEmail header color (line 114):
```javascript
const headerStyle = {
  backgroundColor: '#0F172A', // navy
  padding: '20px 32px',
};
```
- Emergency variant: swap navy (#0F172A) to red (#DC2626), add badge text

### sendOwnerNotifications wrapper (line 138-174):
```javascript
export async function sendOwnerNotifications({ tenantId, lead, businessName, ownerPhone, ownerEmail }) {
  // Reads: lead?.urgency_classification || lead?.urgency
  // Passes urgency down to sendOwnerSMS
  // Passes full lead object to sendOwnerEmail (urgency lives on lead)
```
- No changes to the wrapper — priority flows through existing params

### Existing test pattern (owner-sms.test.js):
- jest.unstable_mockModule for twilio/resend/NewLeadEmail
- beforeAll async import after mocks
- mockCreate.mock.calls[0][0].body assertions on SMS content

</code_context>

<specifics>
## Specific Design

### Emergency SMS format:
```
EMERGENCY: Acme Plumbing — Jane Doe needs urgent Pipe repair at 123 Main St. Call NOW: tel:+15551234567 | Dashboard: https://app.example.com/dashboard/leads
```

### Routine SMS format:
```
Acme Plumbing: New booking — Jane Doe, Pipe repair at 123 Main St. Callback: tel:+15551234567 | Dashboard: https://app.example.com/dashboard/leads
```

### Emergency email:
- Subject: "EMERGENCY: New booking — Jane Doe"
- Header: red (#DC2626) background
- Header: "EMERGENCY BOOKING" text below business name

### Routine email:
- Subject: "New booking — Jane Doe"
- Header: navy (#0F172A) — unchanged

</specifics>

<deferred>
## Deferred

- Repeated escalation SMS cadence (explicit REQUIREMENTS.md out of scope)
- Push/browser notifications (different channel, deferred)
- Per-owner notification preference for priority filtering (v2.1+)

</deferred>

---

*Phase: 16-notification-priority-system*
*Context gathered: 2026-03-25*
