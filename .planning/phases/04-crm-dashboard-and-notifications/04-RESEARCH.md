# Phase 4: CRM, Dashboard, and Notifications - Research

**Researched:** 2026-03-21
**Domain:** Next.js 16 dashboard (Supabase Realtime, Twilio SMS, Resend email, shadcn/ui, Recharts)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Separate leads table** linked to calls — a lead is the "customer journey", calls are events within it
- **Smart merge for repeat callers (CRM-03):** If existing lead from same phone number is in New/Booked status, attach new call to it. If existing lead is Completed/Paid, create a new lead (it's a new job)
- **Lead creation trigger:** After call ends, in `processCallAnalyzed` webhook handler, once transcript + triage result + booking info are available
- **Short call filter:** Calls under 10-15 seconds or with no detected intent are logged as calls but don't create leads
- **5 pipeline statuses:** New → Booked → Completed → Paid + Lost
- **AI creates leads as "New"; booking during call auto-promotes to "Booked"**
- **Owner manually moves leads through Completed → Paid (with revenue amount)**
- **Card-style lead rows** with icon, key details, and action buttons
- **Full filter bar:** Status, Urgency, Date range, Job type, Search by caller name/number
- **Default sort:** Newest first
- **Lead detail flyout panel** from the right (consistent with AppointmentFlyout pattern)
- **Inline audio player** in flyout for call recording playback — HTML5 player with play/pause/scrub alongside transcript
- **Both list and kanban views** — list view as primary, kanban toggle available
- **Home page at /dashboard** — today's summary: new leads count, upcoming appointments, quick stats, recent activity feed
- **Sidebar nav:** Home + Leads + Analytics + Calendar + Services + Settings (6-item nav, extending existing DashboardSidebar)
- **Supabase Realtime** subscriptions for live dashboard updates
- **SMS via Twilio** — owner alert with caller name, job type, urgency, address, one-tap callback link AND dashboard link
- **Email via Resend** — same lead details, richer formatting with React Email templates
- Both owner alerts fire within 60 seconds of lead/booking creation
- **Auto-SMS to caller** who hangs up before booking completes — 60 seconds after hangup
- **Caller recovery SMS tone:** Warm + helpful — "Hi [Name], thanks for calling [Business]…"
- **Manual amount entry** on status change — dollar amount input when moving to Completed or Paid
- Amount optional on Completed, required on Paid
- **Dedicated analytics tab** at /dashboard/analytics for revenue summary, conversion funnels, charts

### Claude's Discretion
- Kanban board column layout and mobile responsiveness approach
- Leads table schema design (columns, indexes, relationships to calls and appointments)
- Supabase Realtime subscription design (which tables, which events)
- Email template design (React Email)
- Analytics page chart types and layout
- Dashboard home page widget arrangement
- Filter bar component design and state management
- Audio player styling

### Deferred Ideas (OUT OF SCOPE)
- Push notifications (browser/mobile) — v2
- In-app notification center — v2
- Invoicing integration — out of scope, lead tracker only
- Outbound follow-up automation — out of scope for v1
- Advanced analytics (cohort analysis, LTV, churn prediction) — v2
- Drag-and-drop kanban reordering within columns — not required for v1
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CRM-01 | Lead pipeline with statuses: New → Booked → Completed → Paid | New `leads` table with `status` enum; API PATCH /api/leads/[id] for status transitions; revenue_amount column for Paid |
| CRM-02 | Each lead card shows: caller ID, job type, address, urgency score, call recording, transcript, triage label | `leads` table JOIN `calls` — recording_url, transcript_text, urgency_classification already on calls; lead row joins this |
| CRM-03 | Phone number as unique ID — repeat caller updates existing lead (not duplicate) | Upsert logic in `createOrMergeLead()`: query leads by tenant_id + from_number + status IN (New, Booked); if found, attach call; otherwise create new |
| CRM-04 | Dashboard with filterable list view of all leads and calls | GET /api/leads with query params (status, urgency, job_type, date_from, date_to, search); client-side Supabase Realtime for live updates |
| CRM-05 | Owner can see total revenue funneled through AI (booked → completed → paid tracking) | `revenue_amount` on leads table; analytics API aggregates SUM by status; Recharts line + funnel charts |
| TRIAGE-06 | Urgency score and triage label visible on each lead card without replaying call | Stored in `calls.urgency_classification` + `urgency_confidence`; joined on leads query; rendered as Badge on LeadCard |
| NOTIF-01 | Owner receives SMS alert with lead summary when new lead/booking is created | Twilio `client.messages.create()` in `sendOwnerNotifications()`; triggered via `after()` in processCallAnalyzed |
| NOTIF-02 | Owner receives email alert with lead details when new lead/booking is created | Resend `resend.emails.send()` with React Email template; triggered same location as NOTIF-01 |
| NOTIF-03 | If caller hangs up before booking, auto-SMS sent to caller's number within 60 seconds | Detect via `disconnection_reason !== 'hangup_after_booking'`; schedule delay via `setTimeout` or Supabase cron; send to `from_number` via Twilio |
</phase_requirements>

---

## Summary

Phase 4 requires three interconnected systems: a leads data layer (new DB table + API routes), a dashboard UI (list/kanban views, flyout detail, analytics), and a notification system (Twilio SMS + Resend email for owner, Twilio SMS for caller recovery). All three integrate with infrastructure already built in Phases 1-3.

The codebase is well-prepared: `processCallAnalyzed` is the correct injection point for lead creation; `after()` is already used for async operations including calendar sync; Supabase Realtime client (`supabase-browser.js`) is in place for live dashboard subscriptions; the AppointmentFlyout + Sheet pattern is directly reusable as LeadFlyout. The only missing packages are `twilio`, `resend`, and `recharts` — all three are verified published and match the versions seen in the npm registry.

The most technically complex area is NOTIF-03 (caller recovery SMS) — it requires detecting "abandoned call" vs "completed call" from Retell's `disconnection_reason` field and scheduling a 60-second delay without blocking the webhook response. The `after()` pattern with a delayed execution or a Supabase pg_cron job are the two viable approaches; `after()` with `setTimeout(60_000)` inside the deferred block is simpler and consistent with existing patterns.

**Primary recommendation:** Build in 5 waves: (1) DB migration + lead creation logic, (2) API routes + notification service, (3) lead list + filter UI, (4) lead flyout + audio player, (5) analytics + dashboard home. This ordering delivers the core data pipeline first, enabling all subsequent UI to work against real data.

---

## Standard Stack

### Core (already installed — verify no new installs needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.99.2 | DB, Realtime, Storage | Already in use — leads table, Realtime subscriptions |
| @supabase/ssr | ^0.9.0 | Server-side auth | Already in use for dashboard API routes |
| next | ^16.1.7 | App router, Server Actions, after() | Project foundation |
| lucide-react | ^0.577.0 | Icons | Already in use throughout dashboard |
| shadcn/ui (radix-ui) | ^1.4.3 | UI components | Already initialized (new-york style) |
| sonner | ^2.0.7 | Toast notifications | Already installed |
| framer-motion | ^12.38.0 | Animations (stat counter, lead arrival) | Already installed (used on landing page) |

### New Packages Required
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| twilio | 5.13.0 (latest) | SMS delivery — owner alerts + caller recovery | Industry standard Node.js SMS SDK; Retell uses Twilio under the hood |
| resend | 6.9.4 (latest) | Email delivery — owner lead alerts | Modern email API with React Email support; simpler than SendGrid for transactional email |
| recharts | 3.8.0 (latest) | Analytics charts (revenue line, funnel bar, pipeline donut) | Composable, React-native, no D3 setup; standard for Next.js dashboards |
| @react-email/components | latest | React Email template primitives | Renders email HTML/text from React components for Resend |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-email | latest | Email preview server (dev only) | Optional: preview email templates at localhost:3001 |
| date-fns | ^4.1.0 | Date formatting in notifications + UI | Already installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts | tremor, nivo, chart.js | Recharts is simplest API for React 19, no extra setup; tremor requires additional dependencies |
| resend | nodemailer + SMTP | Resend is managed, no infrastructure; nodemailer requires SMTP server or Gmail OAuth |
| twilio | sinch, messagebird | Twilio is already implicit in Retell provisioned numbers; consistent vendor |

**Installation:**
```bash
npm install twilio resend recharts @react-email/components
```

**Version verification (confirmed 2026-03-21):**
```bash
npm view twilio version    # 5.13.0
npm view resend version    # 6.9.4
npm view recharts version  # 3.8.0
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── api/
│   │   ├── leads/
│   │   │   ├── route.js          # GET (list), POST (internal only)
│   │   │   └── [id]/
│   │   │       └── route.js      # PATCH (status change + revenue)
│   │   └── notifications/
│   │       └── route.js          # POST (test endpoint for dev)
│   └── dashboard/
│       ├── page.js               # /dashboard home — stats + activity
│       ├── leads/
│       │   └── page.js           # /dashboard/leads — list/kanban view
│       ├── analytics/
│       │   └── page.js           # /dashboard/analytics — charts
│       └── settings/
│           └── page.js           # /dashboard/settings stub
├── components/dashboard/
│   ├── LeadCard.jsx
│   ├── LeadFlyout.jsx
│   ├── LeadFilterBar.jsx
│   ├── KanbanBoard.jsx
│   ├── KanbanColumn.jsx
│   ├── AudioPlayer.jsx
│   ├── TranscriptViewer.jsx
│   ├── RevenueInput.jsx
│   ├── DashboardHomeStats.jsx
│   ├── RecentActivityFeed.jsx
│   └── AnalyticsCharts.jsx
├── lib/
│   ├── leads.js                  # createOrMergeLead(), getLeads() logic
│   └── notifications.js         # sendOwnerSMS(), sendOwnerEmail(), sendCallerRecoverySMS()
└── emails/
    └── NewLeadEmail.jsx          # React Email template for owner alert
supabase/migrations/
└── 004_leads_crm.sql             # leads table, activity_log table
```

### Pattern 1: Lead Creation in processCallAnalyzed (CRM-01, CRM-03)

**What:** After triage + recording upload complete, call `createOrMergeLead()` and then `sendOwnerNotifications()` — both via `after()` (already the pattern for async work post-webhook).

**When to use:** Always — triggered by `call_analyzed` Retell webhook event.

**Key logic:**
```javascript
// src/lib/leads.js
export async function createOrMergeLead({ tenantId, callId, fromNumber, triageResult, appointmentId }) {
  // Short call filter: skip if duration < 15 seconds
  // Check for existing open lead from same phone
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('from_number', fromNumber)
    .in('status', ['new', 'booked'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingLead) {
    // Attach call to existing lead (repeat caller in open pipeline)
    await supabase.from('lead_calls').insert({ lead_id: existingLead.id, call_id: callId });
    return existingLead;
  }
  // Create new lead
  const status = appointmentId ? 'booked' : 'new';
  const { data: lead } = await supabase.from('leads').insert({
    tenant_id: tenantId,
    from_number: fromNumber,
    status,
    appointment_id: appointmentId || null,
    // ... other fields from call triage
  }).select().single();
  return lead;
}
```

### Pattern 2: Owner Notifications via after() (NOTIF-01, NOTIF-02)

**What:** Trigger SMS + email in `processCallAnalyzed` after lead creation, using `after()` to avoid blocking webhook response.

**When to use:** Every time a new lead or booking is created.

```javascript
// In processCallAnalyzed (call-processor.js) — add after lead creation:
after(async () => {
  const lead = await createOrMergeLead({ ... });
  await sendOwnerNotifications({ tenantId, lead });
});
```

### Pattern 3: Caller Recovery SMS with setTimeout (NOTIF-03)

**What:** After `call_analyzed` fires, check if call ended without booking. If so, schedule recovery SMS 60s later.

**When to use:** When `disconnection_reason` is not `'hangup_after_booking'` AND no appointment was linked AND call has detected intent (not short/empty).

```javascript
// In the after() block in processCallAnalyzed:
if (shouldSendRecoverySMS) {
  after(async () => {
    await new Promise(resolve => setTimeout(resolve, 60_000));
    await sendCallerRecoverySMS({ fromNumber, businessName, bookingLink, ownerPhone });
  });
}
```

**Note on setTimeout in after():** Vercel Serverless Functions have a max execution time (typically 60s for Hobby, up to 800s on Pro). The `after()` API extends execution past response send, but the 60-second delay approaches the free tier limit. **Recommendation:** Use Supabase pg_cron or a simple `/api/cron/send-recovery-sms` route with Vercel Cron (runs every minute) as the safer production approach. The `after() + setTimeout` approach works for development and staging.

### Pattern 4: Supabase Realtime Lead Subscription

**What:** Client component subscribes to `INSERT` and `UPDATE` events on the `leads` table, filtered by `tenant_id`.

**When to use:** In the LeadsList client component on /dashboard/leads.

```javascript
// Client component pattern — using existing supabase-browser.js
import { supabase } from '@/lib/supabase-browser';

useEffect(() => {
  const channel = supabase
    .channel('leads-realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'leads',
      filter: `tenant_id=eq.${tenantId}`,
    }, (payload) => {
      // Animate new lead card in from top
      setLeads(prev => [payload.new, ...prev]);
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'leads',
      filter: `tenant_id=eq.${tenantId}`,
    }, (payload) => {
      setLeads(prev => prev.map(l => l.id === payload.new.id ? payload.new : l));
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [tenantId]);
```

**CRITICAL:** Realtime Postgres Changes requires RLS to be enabled on the `leads` table AND a Realtime publication to include the table. Supabase requires explicit opt-in: run `ALTER PUBLICATION supabase_realtime ADD TABLE leads;` in the migration.

### Pattern 5: Twilio SMS

**What:** Use `twilio` Node.js SDK with service-role context (not client-side).

```javascript
// src/lib/notifications.js
import twilio from 'twilio';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function sendOwnerSMS({ to, businessName, callerName, jobType, urgency, address, callbackLink, dashboardLink }) {
  const body = `${businessName}: New ${urgency} lead — ${callerName}, ${jobType} at ${address}. Call back: ${callbackLink} | Dashboard: ${dashboardLink}`;
  await twilioClient.messages.create({
    body,
    from: process.env.TWILIO_FROM_NUMBER,
    to,
  });
}

export async function sendCallerRecoverySMS({ to, callerName, businessName, bookingLink, ownerPhone }) {
  const firstName = callerName?.split(' ')[0] || 'there';
  const body = `Hi ${firstName}, thanks for calling ${businessName}. We'd love to help — book online at ${bookingLink} or call us back anytime at ${ownerPhone}.`;
  await twilioClient.messages.create({
    body,
    from: process.env.TWILIO_FROM_NUMBER,
    to,
  });
}
```

**Env vars required:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

### Pattern 6: Resend Email with React Email

**What:** Use `resend` SDK with `@react-email/components` to send owner alerts.

```javascript
// src/lib/notifications.js
import { Resend } from 'resend';
import { NewLeadEmail } from '@/emails/NewLeadEmail';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOwnerEmail({ to, lead, businessName }) {
  await resend.emails.send({
    from: `${businessName} AI <alerts@yourdomain.com>`,
    to,
    subject: `New ${lead.urgency} lead — ${lead.caller_name}`,
    react: NewLeadEmail({ lead, businessName }),
  });
}
```

**Env vars required:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

### Pattern 7: API Route for Lead Status Update

**What:** PATCH /api/leads/[id] — auth check, status transition validation, revenue amount handling.

```javascript
// src/app/api/leads/[id]/route.js
export async function PATCH(request, { params }) {
  const supabaseServer = createServerClient(); // supabase-server.js pattern
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { status, revenue_amount } = await request.json();
  // Validate: Paid requires revenue_amount
  if (status === 'paid' && !revenue_amount) {
    return Response.json({ error: 'revenue_amount required for Paid status' }, { status: 422 });
  }
  // RLS ensures tenant isolation — no explicit tenant check needed
  const { data } = await supabaseServer.from('leads')
    .update({ status, revenue_amount, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select().single();
  return Response.json({ lead: data });
}
```

### Anti-Patterns to Avoid

- **Querying leads with service role in client components:** Use `supabase-browser.js` (anon key + RLS) for client-side queries, not the service-role client.
- **Blocking processCallAnalyzed with SMS/email:** Both notifications MUST go in `after()` — never synchronous in the webhook response path.
- **Enabling Realtime without publication:** Supabase Realtime does NOT automatically broadcast all tables. Must add `ALTER PUBLICATION supabase_realtime ADD TABLE leads;`.
- **Sending recovery SMS from a non-Twilio-provisioned number:** If Retell's provisioned number doesn't support outbound SMS (most don't), must use a dedicated Twilio number.
- **Rendering full transcript in lead list rows:** Transcript text can be 2000+ words. Only load in LeadFlyout on demand; lead list rows join only the metadata columns.
- **Using window.setTimeout for the recovery SMS delay in production:** Vercel may reclaim resources. Use Vercel Cron for production-grade 60s delay.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SMS delivery + retries | Custom HTTP to Twilio REST API | `twilio` SDK | Handles auth, retries, error codes, international numbers |
| Transactional email rendering | Custom HTML string templating | `resend` + `@react-email/components` | Email client compatibility (Outlook, Gmail, Apple Mail) is extremely complex; React Email handles it |
| Audio player seek bar | Custom `<input type="range">` + Web Audio API | Native HTML5 `<audio>` with custom CSS | Browser handles codec support, buffering, seeking; only style the UI |
| Charts | Custom SVG/Canvas charts | `recharts` | Responsive, accessible, tooltip, legend handling are weeks of work |
| Supabase Realtime connection management | Custom WebSocket | `@supabase/supabase-js` channel API | Handles reconnect, auth token refresh, channel cleanup |
| Lead deduplication at query time | SQL DISTINCT + complex GROUP BY | Application-level merge in `createOrMergeLead()` | Clear business rules (status-aware) are easier to maintain and test in JS than SQL |

**Key insight:** The notification stack (Twilio + Resend) is pure infrastructure wiring — the value is in the lead data model and UI, not in reimplementing email/SMS transport.

---

## Common Pitfalls

### Pitfall 1: Supabase Realtime Not Working for Leads
**What goes wrong:** Lead INSERT events don't arrive in the client subscription.
**Why it happens:** Supabase Realtime only broadcasts changes for tables added to the `supabase_realtime` publication AND when `REPLICA IDENTITY` is set correctly. New tables default to `REPLICA IDENTITY DEFAULT` (primary key only) which may not include all columns in the change payload.
**How to avoid:** In migration 004: `ALTER PUBLICATION supabase_realtime ADD TABLE leads;` AND `ALTER TABLE leads REPLICA IDENTITY FULL;` to get full row data in change events.
**Warning signs:** Subscription `subscribe()` succeeds but no INSERT events arrive.

### Pitfall 2: Twilio "From" Number Mismatch
**What goes wrong:** Owner recovery SMS fails or goes to spam.
**Why it happens:** Caller recovery SMS must be sent from a number the recipient recognizes OR from the business's Retell number. Most Retell-provisioned numbers are voice-only and do NOT support outbound SMS.
**How to avoid:** Provision a separate Twilio SMS-capable number (`TWILIO_FROM_NUMBER`) for outbound SMS. This is separate from `retell_phone_number` in the tenants table.
**Warning signs:** Twilio SDK throws `21606 From number not SMS-capable`.

### Pitfall 3: Revenue Amount Lost on Status Change Race
**What goes wrong:** Owner clicks "Paid" and enters amount, but a concurrent Realtime UPDATE event from another tab overwrites the revenue_amount with null.
**Why it happens:** Realtime UPDATE events trigger `setLeads()` replacement, overwriting the locally updated record including revenue_amount before it's saved.
**How to avoid:** Optimistically update the local state BEFORE the PATCH request, and on Realtime UPDATE, only apply if the `updated_at` from the event is newer than the local optimistic update.
**Warning signs:** Revenue disappears after status save in multi-tab scenarios.

### Pitfall 4: calls Table Join Performance on Lead List
**What goes wrong:** Lead list page loads slowly as lead count grows.
**Why it happens:** Fetching all call metadata (transcript_text, recording_url) for every lead row is expensive — transcript_text can be 5KB+ per call.
**How to avoid:** Lead list API (`GET /api/leads`) should SELECT only list-view columns: `leads.*, calls.urgency_classification, calls.urgency_confidence, calls.recording_url, calls.duration_seconds` — NOT `transcript_text`. Transcript loads only in LeadFlyout.
**Warning signs:** Network tab shows large response payloads for the leads list endpoint.

### Pitfall 5: after() Recovery SMS Not Firing in Development
**What goes wrong:** NOTIF-03 recovery SMS never sends during local testing.
**Why it happens:** `after()` in Next.js 16 requires the runtime to keep the function alive after response. In development with fast refresh, the process may terminate before the 60-second delay completes.
**How to avoid:** In development, use a shorter delay (5s) controlled by an env var: `RECOVERY_SMS_DELAY_MS=5000`. In production, set to `60000`.
**Warning signs:** SMS logs never appear in Twilio console during dev testing.

### Pitfall 6: Breadcrumb Layout Missing "leads" and "analytics" Labels
**What goes wrong:** Dashboard breadcrumb shows nothing (or just "Dashboard") for /dashboard/leads and /dashboard/analytics.
**Why it happens:** `DashboardLayout.js` has a hardcoded `BREADCRUMB_LABELS` object with only `services`, `calendar`, `settings`.
**How to avoid:** Add `leads: 'Leads'`, `analytics: 'Analytics'`, `settings: 'Settings'` to `BREADCRUMB_LABELS` in `src/app/dashboard/layout.js`.
**Warning signs:** Breadcrumb reads just "Dashboard" on the leads page.

### Pitfall 7: Lead List Card Wrapping the full Transcript
**What goes wrong:** Lead list shows truncated transcript text in card rows, degrading to thousands of characters in the DOM.
**Why it happens:** Joining `calls.transcript_text` in the lead list query and accidentally passing it to LeadCard props.
**How to avoid:** LeadCard receives only: `id, from_number, caller_name, job_type, address, urgency, status, created_at, recording_url, duration_seconds`. Transcript is loaded on-demand in LeadFlyout via a separate call to `/api/leads/[id]`.

---

## Code Examples

### Migration 004: Leads Table
```sql
-- 004_leads_crm.sql
CREATE TABLE leads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_number      text NOT NULL,
  caller_name      text,
  job_type         text,
  service_address  text,
  urgency          text NOT NULL DEFAULT 'routine'
    CHECK (urgency IN ('emergency', 'routine', 'high_ticket')),
  status           text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'booked', 'completed', 'paid', 'lost')),
  revenue_amount   numeric(10,2),
  primary_call_id  uuid REFERENCES calls(id) ON DELETE SET NULL,
  appointment_id   uuid REFERENCES appointments(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Junction table for repeat callers (one lead, many calls)
CREATE TABLE lead_calls (
  lead_id  uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  call_id  uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  PRIMARY KEY (lead_id, call_id)
);

CREATE INDEX idx_leads_tenant_status ON leads(tenant_id, status);
CREATE INDEX idx_leads_tenant_phone  ON leads(tenant_id, from_number);
CREATE INDEX idx_leads_tenant_created ON leads(tenant_id, created_at DESC);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_tenant_own" ON leads
  FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));
CREATE POLICY "service_role_all_leads" ON leads
  FOR ALL USING (auth.role() = 'service_role');

-- Realtime support (CRITICAL)
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER TABLE leads REPLICA IDENTITY FULL;

-- Activity log for dashboard home feed
CREATE TABLE activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type  text NOT NULL, -- 'lead_created', 'status_changed', 'notification_sent', 'booking_created'
  lead_id     uuid REFERENCES leads(id) ON DELETE SET NULL,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_log_tenant ON activity_log(tenant_id, created_at DESC);
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_log_tenant_own" ON activity_log
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));
CREATE POLICY "service_role_all_activity_log" ON activity_log
  FOR ALL USING (auth.role() = 'service_role');
```

### React Email Template (Owner Alert)
```jsx
// src/emails/NewLeadEmail.jsx
import { Html, Head, Body, Container, Heading, Text, Button, Hr } from '@react-email/components';

export function NewLeadEmail({ lead, businessName, dashboardUrl }) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'Inter, sans-serif', background: '#F5F5F4' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }}>
          <Heading style={{ color: '#0F172A', fontSize: '20px', fontWeight: 600 }}>
            New {lead.urgency} lead — {lead.caller_name}
          </Heading>
          <Text style={{ color: '#475569', fontSize: '14px' }}>
            <strong>Job:</strong> {lead.job_type}<br />
            <strong>Address:</strong> {lead.service_address}<br />
            <strong>Phone:</strong> {lead.from_number}<br />
            <strong>Urgency:</strong> {lead.urgency}
          </Text>
          <Button href={dashboardUrl} style={{ background: '#C2410C', color: 'white', padding: '12px 24px', borderRadius: '8px' }}>
            View Lead in Dashboard
          </Button>
          <Hr />
          <Text style={{ color: '#94a3b8', fontSize: '12px' }}>
            {businessName} AI Receptionist
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

### AudioPlayer Component (HTML5 pattern)
```jsx
// src/components/dashboard/AudioPlayer.jsx — key structure
'use client';
import { useState, useRef, useEffect } from 'react';

export function AudioPlayer({ src }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Use native <audio> for codec/buffering; only style the controls
  return (
    <div className="bg-stone-50 rounded-xl border border-stone-200/60 p-4">
      <audio ref={audioRef} src={src} preload="metadata"
        onTimeUpdate={() => setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => setDuration(audioRef.current.duration)}
      />
      {/* Custom play/pause + scrub bar — see UI-SPEC for exact styles */}
      <input
        type="range"
        aria-label="Seek audio"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        min={0}
        max={duration}
        value={currentTime}
        onChange={e => { audioRef.current.currentTime = e.target.value; }}
      />
    </div>
  );
}
```

### Recharts Analytics (verified API — recharts 3.x)
```jsx
// Revenue over time — LineChart
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={revenueData}>
    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
    <XAxis dataKey="date" />
    <YAxis tickFormatter={(v) => `$${v}`} />
    <Tooltip formatter={(v) => [`$${v}`, 'Revenue']} />
    <Line type="monotone" dataKey="revenue" stroke="#C2410C" strokeWidth={2} dot={false} />
  </LineChart>
</ResponsiveContainer>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling for new leads | Supabase Realtime (WebSocket) | 2022+ | Instant lead arrival, no 30s delay |
| sendgrid/nodemailer | Resend + React Email | 2023+ | JSX templates, managed infrastructure |
| Custom kanban with drag-and-drop | Read-only kanban + flyout status change | Phase 4 CONTEXT.md | Simpler, no dnd-kit dependency |
| Global setTimeout for SMS | after() + setTimeout or Vercel Cron | Next.js 15/16 | after() is the idiomatic deferred async pattern |
| recharts 2.x | recharts 3.x | 2024 | Better React 19 compatibility, improved responsive API |

**Deprecated/outdated:**
- `react-email` v1 render method: Use `@react-email/components` primitives with Resend's native React support (Resend renders the JSX directly — no manual `render()` call needed).
- Supabase Realtime v1 `from().on()` syntax: Use `channel().on('postgres_changes', ...)` syntax (already shown in code examples above).

---

## Open Questions

1. **Retell disconnection_reason values for NOTIF-03**
   - What we know: `disconnection_reason` is stored on the calls table. Common values include `user_hangup`, `agent_hangup`, `call_transfer`.
   - What's unclear: Exact string Retell uses when the call ends after a successful booking — is it `user_hangup` either way? How to distinguish "hung up without booking" vs "hung up after booking"?
   - Recommendation: Check `appointments` table for a linked appointment with this `call_id` as the definitive "was this call booked?" signal — not `disconnection_reason`. This is more reliable and already established in `processCallAnalyzed` (line 158-165 in call-processor.js).

2. **Twilio number for outbound SMS to caller**
   - What we know: Owner SMS sends from `TWILIO_FROM_NUMBER`. Caller recovery also needs an outbound number.
   - What's unclear: Whether the Retell-provisioned phone number can be used for outbound Twilio SMS, or if a separate Twilio number must be purchased.
   - Recommendation: Use the same `TWILIO_FROM_NUMBER` for both owner alerts and caller recovery SMS. Document that this number must be SMS-capable in the env setup notes.

3. **Vercel Function timeout for 60-second after() delay (NOTIF-03)**
   - What we know: Vercel Hobby plan has 60s max function duration. `after()` extends past response send but counts against this limit.
   - What's unclear: Whether the project is on Hobby or Pro tier.
   - Recommendation: Implement NOTIF-03 as a Vercel Cron job (`/api/cron/send-recovery-sms` running every minute) that queries for calls that: ended > 60s ago, have no linked appointment, and haven't received recovery SMS yet. This is production-safe regardless of plan tier. Add `recovery_sms_sent_at` column to calls table.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 with ESM (`--experimental-vm-modules`) |
| Config file | `jest.config.js` (implied from package.json test script) |
| Quick run command | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/crm/ --passWithNoTests` |
| Full suite command | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CRM-01 | Lead pipeline status transitions | unit | `jest tests/crm/leads.test.js` | ❌ Wave 0 |
| CRM-02 | Lead card data join (urgency, recording_url from calls) | unit | `jest tests/crm/leads.test.js` | ❌ Wave 0 |
| CRM-03 | Repeat caller merge logic — New/Booked attaches, Completed/Paid creates new | unit | `jest tests/crm/lead-merge.test.js` | ❌ Wave 0 |
| CRM-04 | GET /api/leads filter params (status, urgency, date range) | unit | `jest tests/crm/leads-api.test.js` | ❌ Wave 0 |
| CRM-05 | Revenue amount stored on Paid status change | unit | `jest tests/crm/leads.test.js` | ❌ Wave 0 |
| TRIAGE-06 | Urgency classification visible on lead card data | unit | covered by CRM-02 above | ❌ Wave 0 |
| NOTIF-01 | Owner SMS sent after lead creation with correct content | unit | `jest tests/notifications/owner-sms.test.js` | ❌ Wave 0 |
| NOTIF-02 | Owner email sent after lead creation with correct content | unit | `jest tests/notifications/owner-email.test.js` | ❌ Wave 0 |
| NOTIF-03 | Caller recovery SMS sent when no appointment exists after call ends | unit | `jest tests/notifications/caller-recovery.test.js` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/crm/ tests/notifications/ --passWithNoTests`
- **Per wave merge:** `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/crm/leads.test.js` — covers CRM-01, CRM-02, CRM-05, TRIAGE-06
- [ ] `tests/crm/lead-merge.test.js` — covers CRM-03 repeat caller merge logic
- [ ] `tests/crm/leads-api.test.js` — covers CRM-04 API filter params
- [ ] `tests/notifications/owner-sms.test.js` — covers NOTIF-01
- [ ] `tests/notifications/owner-email.test.js` — covers NOTIF-02
- [ ] `tests/notifications/caller-recovery.test.js` — covers NOTIF-03
- [ ] `tests/__mocks__/twilio.js` — mock Twilio SDK (pattern: same as existing `tests/__mocks__/`)
- [ ] `tests/__mocks__/resend.js` — mock Resend SDK

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/lib/call-processor.js`, `src/app/api/webhooks/retell/route.js`, `src/components/dashboard/AppointmentFlyout.js` — direct code inspection, confirmed patterns
- `supabase/migrations/001_initial_schema.sql`, `002_onboarding_triage.sql`, `003_scheduling.sql` — confirmed existing schema
- `src/lib/supabase-browser.js` — confirmed browser client for Realtime subscriptions
- `package.json` — confirmed installed dependencies and versions
- `.planning/phases/04-crm-dashboard-and-notifications/04-UI-SPEC.md` — full design contract verified
- npm registry (`npm view twilio/resend/recharts version`) — confirmed current package versions

### Secondary (MEDIUM confidence)
- `@supabase/supabase-js` Realtime postgres_changes API — pattern from Supabase docs (channel + postgres_changes event names)
- Twilio Node.js SDK `messages.create()` API — standard SDK usage, matches twilio@5.x
- Resend SDK `emails.send()` with React component — matches resend@6.x documented API
- Recharts 3.x `LineChart`/`ResponsiveContainer` — matches published recharts API

### Tertiary (LOW confidence)
- Vercel `after()` behavior with 60s setTimeout — behavior may vary by plan tier; recommend Vercel Cron as alternative (see Open Questions #3)
- Retell `disconnection_reason` exact string values — derived from existing code observation, not official Retell docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing packages confirmed via package.json; new packages (twilio, resend, recharts) confirmed via npm registry
- Architecture: HIGH — patterns derived directly from existing codebase (call-processor.js, AppointmentFlyout, supabase-browser.js)
- Pitfalls: HIGH — most pitfalls derived from direct code inspection (breadcrumb gap confirmed in layout.js, Realtime publication requirement from Supabase docs)
- NOTIF-03 implementation: MEDIUM — setTimeout-in-after() approach functional but has Vercel tier constraints; Cron alternative recommended

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable stack — recharts/twilio/resend APIs change slowly)
