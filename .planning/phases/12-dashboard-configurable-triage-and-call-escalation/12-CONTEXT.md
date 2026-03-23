# Phase 12: Dashboard-configurable triage and call escalation - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Owner can configure triage behavior and call escalation actions from the dashboard. Extends the existing Services page with escalation chain configuration, improves the service tag UX, and implements a multi-contact escalation chain with configurable timeouts and a slot-first fallback waterfall. No changes to the triage engine's core 3-layer pipeline architecture — only the owner-facing configuration and escalation action layer.

</domain>

<decisions>
## Implementation Decisions

### Triage Rule Customization
- **D-01:** Keep tag-per-service only — no custom keywords, no threshold tuning, no rule builder. The existing 3 urgency tags (emergency/routine/high_ticket) and 3-layer triage pipeline stay unchanged.
- **D-02:** Keep the 3 urgency tags (emergency, routine, high_ticket) — no new tiers added.
- **D-03:** Improve existing service management UX — better empty states, bulk tag editing, drag-to-reorder services. No new data model changes.

### Call Escalation Chain
- **D-04:** Escalation chain — owner configures an ordered list of contacts (try person A, if no answer after timeout try person B, then C). Each contact has name, phone, email, role, and notification preference.
- **D-05:** Configurable timeout per contact (15-60 seconds) — owner sets how long to wait before trying the next person in the chain.
- **D-06:** Slot-first fallback waterfall when nobody in chain answers:
  1. AI offers next available emergency slot to lock in the job
  2. If caller declines slot, offer callback within 15 minutes
  3. If callback declined, offer voicemail as last resort
  4. SMS blast to ALL chain contacts regardless of outcome — includes full call details and recording link

### Per-Urgency Escalation Behavior
- **D-07:** Claude's Discretion — determine per-urgency escalation mapping (e.g., emergency = full chain, high-ticket = owner SMS, routine = lead only) based on what makes sense for SMB owners.

### Dashboard UI
- **D-08:** Extend Services page — escalation config lives below the services table on the same page. Services page name stays "Services" in sidebar nav.
- **D-09:** Claude's Discretion — layout choice (card below table vs tabs) for escalation config section based on existing dashboard patterns.

### Escalation Notifications
- **D-10:** SMS + email only — no push notifications, no webhook integrations. Reuse existing Twilio SMS + Resend email infrastructure.
- **D-11:** Per-contact channel choice — when adding a contact to the escalation chain, owner picks: SMS only, Email only, or Both. Each contact has phone + email + notification preference fields.
- **D-12:** Escalation notifications include deep link to the lead card in dashboard so contacts can see call recording, transcript, and urgency context immediately.

### Claude's Discretion
- Per-urgency escalation mapping (D-07)
- Escalation config layout on Services page (D-09)
- Escalation chain max contact count (reasonable limit)
- Default timeout values for new contacts
- SMS/email notification template design for chain contacts
- How to handle chain contacts who don't have dashboard accounts

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Triage Engine
- `src/lib/triage/classifier.js` — 3-layer triage orchestrator (Layer 1→2→3 pipeline)
- `src/lib/triage/layer1-keywords.js` — Hardcoded emergency/routine keyword patterns
- `src/lib/triage/layer2-llm.js` — LLM-based urgency scoring for ambiguous cases
- `src/lib/triage/layer3-rules.js` — Owner rule override (service urgency tag lookup)

### Call Processing & Escalation
- `src/lib/call-processor.js` — processCallAnalyzed handler (triage + lead creation + notifications)
- `src/app/api/webhooks/retell/route.js` — Retell webhook handler including transfer_call function
- `src/lib/agent-prompt.js` — AI system prompt with triage-aware behavior and booking flow sections

### Dashboard (Services & Settings)
- `src/app/dashboard/services/page.js` — Current services page with urgency tag dropdown
- `src/app/dashboard/settings/page.js` — Settings page with 3 stacked card sections
- `src/lib/notifications.js` — Owner SMS + email notification system (Twilio/Resend)

### Prior Phase Context
- `.planning/phases/02-onboarding-and-triage/02-CONTEXT.md` — Phase 2 triage decisions (tag-per-service, 3-layer pipeline, tone presets)
- `.planning/phases/04-crm-dashboard-and-notifications/04-CONTEXT.md` — Phase 4 dashboard and notification decisions
- `.planning/phases/10-dashboard-guided-setup-and-first-run-experience/10-CONTEXT.md` — Phase 10 settings page and dashboard patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ServicesPage` component: Already has service list with urgency tag dropdown, add/remove services, pending deletion with undo — extend for bulk editing and reorder
- `URGENCY_BADGE_CLASSES` object: Styled badges for emergency (red), high_ticket (amber), routine (gray) — reuse in escalation chain UI
- `sendOwnerNotifications` function: Existing SMS + email notification pipeline — extend for chain contacts
- shadcn/ui components: Button, Input, Badge, Select, Skeleton, Separator already imported on Services page
- `WorkingHoursEditor`, `CalendarSyncCard`, `ZoneManager`: Established dashboard card patterns to follow

### Established Patterns
- Dashboard pages use stacked card sections with consistent padding/spacing
- Supabase realtime subscriptions for live dashboard updates
- `supabase-browser.js` for client-side queries, `supabase.js` for server-side
- Toast notifications via `sonner` for user feedback
- `next-intl` for all user-facing strings

### Integration Points
- `layer3-rules.js` `applyOwnerRules()` — queries `services` table for urgency tags; escalation chain data model needs a new table (e.g., `escalation_contacts`)
- `call-processor.js` `processCallAnalyzed()` — after triage classification, needs to trigger escalation chain logic for emergency calls
- `retell/route.js` `handleFunctionCall()` — transfer_call implementation needs to support escalation chain sequential transfers
- `agent-prompt.js` — fallback waterfall (slot → callback → voicemail) needs prompt engineering for AI behavior during failed transfers

</code_context>

<specifics>
## Specific Ideas

- Slot-first fallback waterfall is key: AI should actively try to book the emergency caller into a slot BEFORE resorting to callback or voicemail — keeps the job moving even if no human answers
- SMS blast to all chain contacts fires regardless of escalation outcome (slot booked, callback promised, or voicemail left) — full team visibility

</specifics>

<deferred>
## Deferred Ideas

- Webhook integration for Slack/Teams/PagerDuty — future phase
- Push notifications (service worker + PWA) — future phase
- Custom keyword rules per business (Layer 1 extension) — future phase if needed
- LLM confidence threshold tuning — future phase
- One-tap callback link in notification SMS — could add later

</deferred>

---

*Phase: 12-dashboard-configurable-triage-and-call-escalation*
*Context gathered: 2026-03-24*
