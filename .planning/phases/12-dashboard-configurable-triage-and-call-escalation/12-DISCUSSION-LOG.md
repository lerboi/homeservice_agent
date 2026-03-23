# Phase 12: Dashboard-configurable triage and call escalation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 12-dashboard-configurable-triage-and-call-escalation
**Areas discussed:** Triage rule customization, Call escalation actions, Dashboard UI location, Escalation notifications

---

## Triage Rule Customization

### Q1: How much triage control should owners get?

| Option | Description | Selected |
|--------|-------------|----------|
| Custom keywords per business | Owner adds their own emergency/routine keywords. Extends Layer 1 with per-tenant keyword lists. | |
| Threshold tuning + keywords | Custom keywords PLUS LLM confidence threshold slider. More powerful but complex UI. | |
| Keep tag-per-service only | Don't touch Layer 1/2. Improve existing service-tag UI. Honor Phase 2 "no rule builder" decision. | ✓ |

**User's choice:** Keep tag-per-service only
**Notes:** Honoring Phase 2 decision to keep it simple.

### Q2: Should owners be able to add custom service types beyond trade template defaults?

| Option | Description | Selected |
|--------|-------------|----------|
| Improve existing | Polish current add/remove/tag UI — better empty states, bulk tag editing, drag-to-reorder. | ✓ |
| Add service categories | Group services into categories for businesses with many services. | |
| Leave as-is | Focus purely on escalation behavior. | |

**User's choice:** Improve existing

### Q3: Should urgency tag options expand beyond the current three?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 3 tags | Emergency, Routine, High-Ticket covers all cases. Simple and proven. | ✓ |
| Add 'Low Priority' | 4 tiers with Low Priority for informational/spam. Requires triage engine changes. | |
| Custom tags | Owner defines their own urgency labels. Maximum flexibility but complex. | |

**User's choice:** Keep 3 tags

---

## Call Escalation Actions

### Q1: What should happen when AI classifies a call as emergency?

| Option | Description | Selected |
|--------|-------------|----------|
| Escalation chain | Ordered list of contacts. Try A → B → C with configurable timeouts. | ✓ |
| Simple multi-contact | All contacts notified simultaneously. SMS blast + transfer to primary. | |
| Keep single owner transfer | Transfer to owner phone only. Make phone number configurable from dashboard. | |

**User's choice:** Escalation chain

### Q2: Should escalation chains differ by urgency level?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-urgency escalation | Each urgency level has its own escalation action. | |
| Emergency-only chain | Only emergency gets the chain. Others behave as today. | |
| You decide | Claude picks best approach for SMB owners. | ✓ |

**User's choice:** You decide

### Q3: How should escalation chain timeout work?

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed 30-second timeout | 30 seconds per contact, non-configurable. Simple and predictable. | |
| Configurable per contact | Owner sets timeout per contact (15-60 seconds). More flexible. | ✓ |
| You decide | Claude picks sensible default. | |

**User's choice:** Configurable per contact

### Q4: What's the fallback if nobody in the chain answers?

| Option | Description | Selected |
|--------|-------------|----------|
| SMS blast + lead | SMS to all contacts + urgent lead. Caller hears callback promise. | |
| Voicemail + lead | Caller leaves voicemail, saved to lead. SMS notification with voicemail link. | |
| Both options | SMS blast + voicemail option for caller. | |
| Slot-first fallback (Other) | AI offers emergency slot first → callback 15min → voicemail last resort. SMS blast regardless. | ✓ |

**User's choice:** Slot-first fallback waterfall
**Notes:** User specified custom approach: AI first offers next available emergency slot to lock in the job, then callback within 15 min if declined, voicemail as last resort. SMS blast to all chain contacts fires regardless of outcome with full call details and recording link.

---

## Dashboard UI Location

### Q1: Where should triage and escalation config live?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend Settings page | Add sections to Settings. Grows to 5 sections. | |
| Extend Services page | Add escalation config below services table. Services becomes the triage hub. | ✓ |
| New sidebar item | Add 'Escalation' to sidebar nav (6 items). Dedicated page. | |

**User's choice:** Extend Services page

### Q2: Should the Services page be renamed?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 'Services' | Page is still fundamentally about services. | ✓ |
| Rename to 'Services & Triage' | Makes expanded scope clear in nav. | |
| Rename to 'Call Rules' | Broader name covering services, triage, escalation. | |

**User's choice:** Keep 'Services'

### Q3: How should escalation chain config be laid out?

| Option | Description | Selected |
|--------|-------------|----------|
| Card below services table | Stacked card consistent with dashboard pattern. | |
| Tabbed sections | Services page gets tabs for each concern. | |
| You decide | Claude picks best layout. | ✓ |

**User's choice:** You decide

---

## Escalation Notifications

### Q1: What notification channels should escalation support?

| Option | Description | Selected |
|--------|-------------|----------|
| SMS + email only | Keep existing Twilio + Resend. No new integrations. | ✓ |
| Add push notifications | Browser push + PWA alongside SMS/email. Requires service worker. | |
| Add webhook integration | Configurable webhook URL for Slack/Teams/PagerDuty/Zapier. | |

**User's choice:** SMS + email only

### Q2: Should contacts be configurable per notification type?

| Option | Description | Selected |
|--------|-------------|----------|
| All contacts get both | Every contact gets SMS + email. Simple. | |
| Per-contact channel choice | Owner picks per contact: SMS only, Email only, or Both. | ✓ |
| You decide | Claude picks based on SMB needs. | |

**User's choice:** Per-contact channel choice

### Q3: Should escalation notification include a link to lead card?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, deep link to lead | Link to lead detail in dashboard with recording/transcript/urgency. | ✓ |
| Yes, plus one-tap callback | Deep link + tel: callback link for instant customer callback. | |
| You decide | Claude picks best format. | |

**User's choice:** Yes, deep link to lead

---

## Claude's Discretion

- Per-urgency escalation mapping (emergency vs high-ticket vs routine behavior)
- Escalation config layout on Services page
- Escalation chain max contact count
- Default timeout values
- Notification template design
- Chain contact handling (with/without dashboard accounts)

## Deferred Ideas

- Webhook integration for Slack/Teams/PagerDuty
- Push notifications (service worker + PWA)
- Custom keyword rules per business
- LLM confidence threshold tuning
- One-tap callback link in notification SMS
