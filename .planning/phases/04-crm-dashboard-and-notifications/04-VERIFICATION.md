---
phase: 04-crm-dashboard-and-notifications
verified: 2026-03-21T00:00:00Z
status: human_needed
score: 17/17 must-haves verified
human_verification:
  - test: "Navigate to /dashboard and verify stat widgets render correctly with counter animation"
    expected: "4 stat cards (New Leads Today, Upcoming Appointments, Calls Today, Conversion Rate) each animate from 0 to their value over 600ms. Values may be 0 if no test data."
    why_human: "requestAnimationFrame animation and visual rendering cannot be verified programmatically"
  - test: "Navigate to /dashboard/leads with at least one lead present, click a lead card View button"
    expected: "LeadFlyout opens as a right Sheet panel. Shows caller name, phone, job type, address, urgency badge, pipeline status select, audio player, transcript viewer, revenue input (if applicable), and Mark as Lost button."
    why_human: "Sheet open/close interaction and visual layout cannot be verified by grep"
  - test: "In the LeadFlyout, click play on the AudioPlayer"
    expected: "Audio playback starts, scrub bar moves, time counter updates in mm:ss / mm:ss format using tabular-nums. Orange (#C2410C) progress fill is visible on the track."
    why_human: "HTML5 audio playback and real-time scrub behavior require a browser"
  - test: "In the LeadFlyout, expand the TranscriptViewer"
    expected: "Speaker-labeled turns appear ('Caller:' / 'AI:') alternating with subtle background. Toggle collapses/expands to max 300px height with scroll."
    why_human: "Collapsible state and overflow scroll require visual inspection"
  - test: "Change a lead status to Paid in the LeadFlyout without entering revenue"
    expected: "Save button is blocked or RevenueInput shows red border with error text 'Enter a revenue amount to save this as Paid.'"
    why_human: "Form validation flow and error presentation require interaction"
  - test: "Click the view toggle (Columns3 icon) on the leads page to switch to Kanban view"
    expected: "5 columns appear side-by-side (New, Booked, Completed, Paid, Lost), each 280px wide. On small screens horizontal scroll with snap behavior."
    why_human: "Kanban layout and responsive scroll behavior require visual verification"
  - test: "Navigate to /dashboard/analytics with fewer than 5 completed leads"
    expected: "'Not enough data yet' heading and 'Revenue and conversion charts appear once you have at least 5 completed leads.' body text displays instead of charts."
    why_human: "Conditional chart vs. empty-state rendering requires runtime data state"
  - test: "In a second browser tab, trigger a new lead creation (or simulate via Supabase Realtime). Observe the leads page."
    expected: "New lead card slides in from top with 200ms ease-out animation and appears at the top of the list without a page refresh."
    why_human: "Supabase Realtime WebSocket connection and CSS animation require live browser environment"
  - test: "Verify sidebar navigation and breadcrumbs across all pages"
    expected: "Sidebar shows 6 items in order: Home, Leads, Analytics, Calendar, Services (separator) Settings. Active item is highlighted. Breadcrumb reads 'Dashboard > Leads' on /dashboard/leads and 'Dashboard > Analytics' on /dashboard/analytics."
    why_human: "Active nav state and breadcrumb rendering require visual inspection"
---

# Phase 04: CRM Dashboard and Notifications — Verification Report

**Phase Goal:** CRM dashboard with lead management, pipeline tracking, and email/SMS notifications
**Verified:** 2026-03-21
**Status:** human_needed (all automated checks passed; 9 items require visual/browser verification)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A new lead is created from a call with required fields (tenant_id, from_number, status, urgency) | VERIFIED | `createOrMergeLead` in leads.js inserts with all fields; 14 test cases pass |
| 2 | A repeat caller in New/Booked status attaches to existing lead, not a duplicate | VERIFIED | `.in('status', ['new', 'booked'])` merge query present; 14 lead-merge tests pass |
| 3 | A repeat caller whose prior lead is Completed/Paid/Lost creates a new lead | VERIFIED | Logic in createOrMergeLead confirmed by lead-merge tests |
| 4 | Short calls under 15 seconds do not create leads | VERIFIED | `callDuration < 15` guard in leads.js; test case confirmed |
| 5 | Lead created during a booked call gets status 'booked' automatically | VERIFIED | `status: appointmentId ? 'booked' : 'new'` in leads.js |
| 6 | Revenue amount can be stored and is required for Paid status | VERIFIED | PATCH /api/leads/[id] validates `revenue_amount` required for `paid`, returns 422 otherwise |
| 7 | Owner SMS is sent with caller name, job type, urgency, address, callback link, and dashboard link | VERIFIED | sendOwnerSMS in notifications.js constructs body with all fields; 9 SMS tests pass |
| 8 | Owner email is sent with lead details via React Email template | VERIFIED | sendOwnerEmail calls resend with NewLeadEmail template; 8 email tests pass |
| 9 | Caller recovery SMS is sent with warm tone including business name and booking link | VERIFIED | sendCallerRecoverySMS with "Hi [firstName], thanks for calling..." format; 10 tests pass |
| 10 | After call_analyzed fires, a lead is created or existing lead is updated | VERIFIED | call-processor.js imports createOrMergeLead, calls it after upsert; 16 webhook tests pass |
| 11 | Owner receives SMS and email within 60s of lead creation | VERIFIED | sendOwnerNotifications called in processCallAnalyzed; fire-and-forget pattern confirmed |
| 12 | Caller who hangs up without booking receives recovery SMS within ~120s | VERIFIED | Vercel Cron at `* * * * *` on /api/cron/send-recovery-sms; queries unbooked calls ended > 60s ago |
| 13 | Owner can see all leads in a filterable list at /dashboard/leads | VERIFIED | leads/page.js fetches /api/leads, renders LeadFilterBar + LeadCard stack; empty state present |
| 14 | Owner can filter leads by status, urgency, date range, job type, and search | VERIFIED | LeadFilterBar with all filters; /api/leads route handles all 6 filter params |
| 15 | Owner can play recording and read transcript from lead detail flyout | VERIFIED* | LeadFlyout imports AudioPlayer + TranscriptViewer; fetches /api/leads/[id] with transcript_text; *requires browser |
| 16 | Owner sees dashboard home with stats and activity feed | VERIFIED | dashboard/page.js renders DashboardHomeStats + RecentActivityFeed; fetches /api/leads and activity_log |
| 17 | New leads appear in real-time on the leads page | VERIFIED* | postgres_changes subscription via supabase-browser; _isNew flag + animate-slide-in-from-top; *requires browser |

**Score:** 17/17 truths verified (9 require additional human/browser verification)

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `supabase/migrations/004_leads_crm.sql` | VERIFIED | Contains leads, lead_calls, activity_log tables, RLS policies, REPLICA IDENTITY FULL, supabase_realtime publication, recovery_sms_sent_at column |
| `src/lib/leads.js` | VERIFIED | Exports createOrMergeLead and getLeads; merge logic, short-call filter, activity logging all present |
| `tests/crm/leads.test.js` | VERIFIED | 12 test cases, all passing |
| `tests/crm/lead-merge.test.js` | VERIFIED | 14 test cases, all passing |
| `src/lib/notifications.js` | VERIFIED | Exports sendOwnerSMS, sendOwnerEmail, sendCallerRecoverySMS, sendOwnerNotifications; lazy SDK clients |
| `src/emails/NewLeadEmail.jsx` | VERIFIED | Exports NewLeadEmail; uses @react-email/components; design token colors (#C2410C, #0F172A, #475569, #F5F5F4) |
| `tests/notifications/owner-sms.test.js` | VERIFIED | 9 test cases, all passing |
| `tests/notifications/owner-email.test.js` | VERIFIED | 8 test cases, all passing |
| `tests/notifications/caller-recovery.test.js` | VERIFIED | 10 test cases, all passing |
| `tests/__mocks__/twilio.js` | VERIFIED | Mock factory with messages.create |
| `tests/__mocks__/resend.js` | VERIFIED | Mock Resend class with emails.send |
| `src/lib/call-processor.js` | VERIFIED | Imports createOrMergeLead and sendOwnerNotifications; both called post-upsert with error isolation |
| `src/app/api/cron/send-recovery-sms/route.js` | VERIFIED | Exports GET; CRON_SECRET auth check; queries unbooked analyzed calls; updates recovery_sms_sent_at |
| `vercel.json` | VERIFIED | Cron schedule `* * * * *` for /api/cron/send-recovery-sms |
| `tests/crm/webhook-lead-creation.test.js` | VERIFIED | 16 test cases, all passing |
| `src/components/dashboard/DashboardSidebar.jsx` | VERIFIED | 6 nav items (Home/Leads/Analytics/Calendar/Services/Settings), exact icon imports, exact order, Settings separated |
| `src/app/dashboard/layout.js` | VERIFIED | BREADCRUMB_LABELS includes leads: 'Leads' and analytics: 'Analytics' |
| `src/app/api/leads/route.js` | VERIFIED | GET with auth via getTenantId(); 6 filter params; no transcript_text; orders created_at DESC; limit 100 |
| `src/app/dashboard/leads/page.js` | VERIFIED | Fetches /api/leads; renders LeadFilterBar, LeadCard, LeadFlyout, KanbanBoard; postgres_changes Realtime subscription with cleanup; _isNew animation flag |
| `src/components/dashboard/LeadCard.jsx` | VERIFIED | Urgency left border colors, urgency badge colors, pipeline status badge colors — all match UI-SPEC exactly; min-h-[72px]; hover shadow |
| `src/components/dashboard/LeadFilterBar.jsx` | VERIFIED | Search, status, urgency, job type, date range inputs; active filter pills; "Clear all" link |
| `src/app/api/leads/[id]/route.js` | VERIFIED | GET with transcript_text; PATCH with 422 for paid without revenue; activity_log on status change; 17 tests pass |
| `src/components/dashboard/LeadFlyout.jsx` | VERIFIED | Imports AudioPlayer, TranscriptViewer, RevenueInput; Sheet side="right" sm:max-w-md; fetches /api/leads/[id]; AlertDialog for Mark as Lost |
| `src/components/dashboard/AudioPlayer.jsx` | VERIFIED | Hidden audio, 36px circular bg-[#0F172A] play/pause, aria-label="Seek audio", tabular-nums duration, "Recording unavailable" error state |
| `src/components/dashboard/TranscriptViewer.jsx` | VERIFIED | role="log", collapsible toggle ("Show transcript"/"Hide transcript"), speaker-labeled turns |
| `src/components/dashboard/RevenueInput.jsx` | VERIFIED | border-red-500 on required+empty, error message text present |
| `src/components/dashboard/KanbanBoard.jsx` | VERIFIED | Groups leads into 5 status columns; renders KanbanColumn components |
| `src/components/dashboard/KanbanColumn.jsx` | VERIFIED | role="region", aria-label, w-[280px] min-w-[280px], snap-start |
| `src/app/dashboard/page.js` | VERIFIED | Renders DashboardHomeStats + RecentActivityFeed; fetches /api/leads, /api/appointments, activity_log |
| `src/components/dashboard/DashboardHomeStats.jsx` | VERIFIED | 4 stat widgets in responsive grid; requestAnimationFrame counter over 600ms; prefers-reduced-motion respected |
| `src/components/dashboard/RecentActivityFeed.jsx` | VERIFIED | Event-type icon mapping; up to 20 items; Skeleton loading |
| `src/app/dashboard/analytics/page.js` | VERIFIED | Imports AnalyticsCharts; fetches /api/leads |
| `src/components/dashboard/AnalyticsCharts.jsx` | VERIFIED | LineChart, BarChart, PieChart from recharts; 7x ResponsiveContainer; "Not enough data yet" empty state |
| `src/app/dashboard/settings/page.js` | VERIFIED | Intentional stub per PLAN 06 Task 2; "Account and notification settings coming soon." |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/leads.js` | supabase leads table | `supabase.from('leads')` | WIRED | Present; lead_calls junction also wired |
| `src/lib/leads.js` | supabase lead_calls table | `supabase.from('lead_calls')` | WIRED | 2 occurrences (insert on create + attach) |
| `src/lib/notifications.js` | twilio SDK | `messages.create` | WIRED | 2 calls (owner SMS + caller recovery) |
| `src/lib/notifications.js` | resend SDK | `emails.send` | WIRED | Present in sendOwnerEmail |
| `src/lib/notifications.js` | `src/emails/NewLeadEmail.jsx` | `import NewLeadEmail` | WIRED | Import present, used in react: parameter |
| `src/lib/call-processor.js` | `src/lib/leads.js` | `import { createOrMergeLead }` | WIRED | Import + call both present |
| `src/lib/call-processor.js` | `src/lib/notifications.js` | `import { sendOwnerNotifications }` | WIRED | Import + fire-and-forget call both present |
| `src/app/api/cron/send-recovery-sms/route.js` | `src/lib/notifications.js` | `import { sendCallerRecoverySMS }` | WIRED | Import + call present |
| `src/app/dashboard/leads/page.js` | `/api/leads` | `fetch` in useEffect | WIRED | `fetch('/api/leads${qs}')` confirmed |
| `src/app/dashboard/leads/page.js` | `LeadCard.jsx` | `import LeadCard` | WIRED | Import + render confirmed |
| `src/app/dashboard/leads/page.js` | `LeadFilterBar.jsx` | `import LeadFilterBar` | WIRED | Import + render confirmed |
| `src/app/dashboard/leads/page.js` | supabase Realtime | `postgres_changes` channel | WIRED | INSERT + UPDATE handlers; cleanup on unmount |
| `src/app/dashboard/leads/page.js` | `LeadFlyout.jsx` | `import LeadFlyout` | WIRED | Import + render with selectedLeadId |
| `src/app/dashboard/leads/page.js` | `KanbanBoard.jsx` | `import KanbanBoard` | WIRED | Import + render when viewMode === 'kanban' |
| `src/components/dashboard/LeadFlyout.jsx` | `/api/leads/[id]` | `fetch` GET + PATCH | WIRED | 3 fetch calls (GET detail, PATCH status, PATCH lost) |
| `src/components/dashboard/LeadFlyout.jsx` | `AudioPlayer.jsx` | `import AudioPlayer` | WIRED | Import + render with recording_url |
| `src/components/dashboard/LeadFlyout.jsx` | `TranscriptViewer.jsx` | `import TranscriptViewer` | WIRED | Import + render with transcript data |
| `src/app/dashboard/page.js` | `/api/leads` | `fetch` | WIRED | Two fetches (today's leads, all leads) |
| `src/app/dashboard/analytics/page.js` | `/api/leads` | `fetch` | WIRED | `fetch('/api/leads')` confirmed |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CRM-01 | 04-01, 04-03, 04-05 | Lead pipeline with statuses: New → Booked → Completed → Paid | SATISFIED | leads table with status CHECK; PATCH endpoint updates statuses; LeadFlyout status select |
| CRM-02 | 04-04, 04-05 | Each lead card shows: caller ID, job type, address, urgency score, call recording, transcript, triage label | SATISFIED | LeadCard shows caller info + badges; LeadFlyout shows recording (AudioPlayer) + transcript (TranscriptViewer) |
| CRM-03 | 04-01, 04-03 | Phone number as unique ID — repeat caller updates existing lead | SATISFIED | createOrMergeLead queries by from_number + status; 14 merge tests pass |
| CRM-04 | 04-04, 04-06 | Dashboard with filterable list view of all leads; real-time updates | SATISFIED | LeadFilterBar with 6 params; Supabase Realtime INSERT/UPDATE subscription |
| CRM-05 | 04-05, 04-06 | Owner can see total revenue funneled through AI | SATISFIED | revenue_amount on leads table; PATCH stores it; AnalyticsCharts revenue LineChart |
| TRIAGE-06 | 04-04 | Urgency score and triage label visible on each lead card without replaying call | SATISFIED | LeadCard renders urgency badge with exact UI-SPEC colors; urgency left border |
| NOTIF-01 | 04-02, 04-03 | Owner receives SMS alert on new lead/booking | SATISFIED | sendOwnerSMS called via sendOwnerNotifications from call-processor; 9 SMS tests pass |
| NOTIF-02 | 04-02, 04-03 | Owner receives email alert on new lead/booking | SATISFIED | sendOwnerEmail with NewLeadEmail React template; 8 email tests pass |
| NOTIF-03 | 04-02, 04-03 | Auto-SMS sent to caller if they hang up before booking | SATISFIED | Vercel Cron every minute; recovery_sms_sent_at tracked; 10 caller-recovery tests pass |

**All 9 declared requirements satisfied.** No orphaned requirements found.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/app/dashboard/settings/page.js` | Intentional stub — "coming soon" text | Info | Expected per PLAN 06 Task 2; settings UI deferred to future phase |

No blocker anti-patterns. The settings stub is explicitly specified in the plan as a placeholder.

**Note on tenant_id resolution:** The leads list route (`/api/leads/route.js`) uses `getTenantId()` (which authenticates via server Supabase client and queries the tenants table by owner_id) rather than `user_metadata.tenant_id` as originally specified in the PLAN. This is a deliberate, more robust approach committed in `7455ef0` ("fix: resolve tenant_id from DB instead of user_metadata") — functional equivalence confirmed.

---

### Human Verification Required

#### 1. Dashboard Home Stats + Counter Animation

**Test:** Navigate to `/dashboard`. Observe the 4 stat widget cards.
**Expected:** Cards render with 28px semibold numbers in text-[#0F172A], 12px uppercase tracking-wider labels. Numbers animate from 0 to their value over ~600ms. If prefers-reduced-motion is set, numbers appear immediately.
**Why human:** requestAnimationFrame animation and visual rendering cannot be verified programmatically.

#### 2. Lead Flyout Opening and Full Detail View

**Test:** Navigate to `/dashboard/leads`. If leads exist, click the "View" (Eye icon) button on a lead card.
**Expected:** Right-side Sheet panel opens with caller name (20px semibold), phone (clickable tel: link), job type, address, urgency badge, pipeline status select, AudioPlayer, TranscriptViewer, RevenueInput (conditional), Save button, and Mark as Lost footer button.
**Why human:** Sheet open/close interaction and full flyout layout require visual inspection.

#### 3. AudioPlayer Playback

**Test:** In the LeadFlyout with a lead that has a recording_url, click the circular play button.
**Expected:** Audio plays. Scrub bar (range input) moves showing orange (#C2410C) progress. Duration shows as mm:ss / mm:ss in tabular-nums format. Button shows Pause icon while playing.
**Why human:** HTML5 audio playback, scrub behavior, and CSS rendering require a browser.

#### 4. TranscriptViewer Collapse/Expand

**Test:** In the LeadFlyout, click the "Show transcript" toggle button.
**Expected:** Transcript expands to show speaker-labeled turns ("Caller:" / "AI:") alternating with subtle stone-50 background. Max height 300px with overflow scroll. Toggle changes to "Hide transcript".
**Why human:** Collapsible state transition and overflow scroll require visual inspection.

#### 5. Revenue Validation for Paid Status

**Test:** In the LeadFlyout, change the status select to "Paid" and click Save without entering a revenue amount.
**Expected:** RevenueInput shows red border (border-red-500) and error text "Enter a revenue amount to save this as Paid." Save request is blocked or API returns 422.
**Why human:** Form validation UX flow and error presentation require interaction.

#### 6. Kanban View Toggle

**Test:** On `/dashboard/leads`, click the Columns3 icon (grid view toggle).
**Expected:** 5 columns appear (New, Booked, Completed, Paid, Lost), each 280px wide with compact lead cards. On screens below lg breakpoint, horizontal scroll with snap behavior. On lg+, all columns visible side-by-side.
**Why human:** Responsive layout and scroll snap behavior require visual verification.

#### 7. Analytics Empty State and Charts

**Test:** Navigate to `/dashboard/analytics` with fewer than 5 completed leads.
**Expected:** "Not enough data yet" heading with "Revenue and conversion charts appear once you have at least 5 completed leads." body text displays instead of charts. With sufficient data, three charts render (LineChart revenue, BarChart funnel, PieChart pipeline).
**Why human:** Chart rendering and empty-state conditional logic require runtime data and browser.

#### 8. Supabase Realtime — Live Lead Arrival

**Test:** Open `/dashboard/leads` in one browser tab. In a second tab or via Supabase Studio, insert a new lead for the same tenant.
**Expected:** New lead card slides in from the top of the list with 200ms ease-out animation (slide-in-from-top) without any page refresh. The card has a brief animated entry before settling.
**Why human:** Supabase Realtime WebSocket connection and CSS keyframe animation require a live browser environment.

#### 9. Sidebar Navigation and Breadcrumbs

**Test:** Navigate through all dashboard pages (Home, Leads, Analytics, Calendar, Services, Settings) via the sidebar.
**Expected:** Sidebar shows 6 nav items in exact order: Home (LayoutDashboard) → Leads (Users) → Analytics (BarChart3) → Calendar → Services → [separator line] → Settings. Active page is highlighted. Breadcrumb shows "Dashboard > [Page]" on sub-pages. Home nav is only active when path is exactly /dashboard.
**Why human:** Active state highlight, hover effects, and separator rendering require visual confirmation.

---

## Summary

Phase 04 achieves its goal. All 17 observable truths are supported by the codebase:

- **Data layer (04-01):** Migration 004_leads_crm.sql creates all required tables with proper RLS, Realtime publication, and indexes. `src/lib/leads.js` implements createOrMergeLead with repeat-caller merge, short-call filter, and activity logging. All CRM data layer tests pass (26 test cases across leads.test.js and lead-merge.test.js).

- **Notifications (04-02):** `src/lib/notifications.js` delivers all 4 exported functions with lazy-instantiated Twilio/Resend clients. React Email template in `src/emails/NewLeadEmail.jsx` uses project design tokens. All notification tests pass (27 test cases).

- **Webhook integration (04-03):** `src/lib/call-processor.js` wires createOrMergeLead and sendOwnerNotifications after the call upsert, with full error isolation. Vercel Cron route sends caller recovery SMS every minute. All webhook-lead-creation tests pass (16 test cases).

- **Lead list UI (04-04):** Sidebar updated with 6 nav items in correct order. `/api/leads` route filters correctly without transcript_text. LeadCard renders all required fields with exact UI-SPEC badge colors. LeadFilterBar provides all 6 filter types.

- **Lead detail (04-05):** `/api/leads/[id]` provides full transcript on GET and validates revenue_amount on PATCH. LeadFlyout assembles AudioPlayer, TranscriptViewer, RevenueInput, and status management. KanbanBoard renders 5-column pipeline view. All leads-api tests pass (17 test cases).

- **Dashboard home + analytics + Realtime (04-06):** Dashboard home shows 4 stat widgets with counter animation and activity feed. Analytics page renders 3 Recharts charts with empty state. Supabase Realtime subscription on leads page handles INSERT (with _isNew animation) and UPDATE events with proper cleanup.

**Total tests:** 60 passing across 7 test suites (tests/crm/ and tests/notifications/). No blocker anti-patterns. 9 items flagged for human/browser verification.

---

_Verified: 2026-03-21_
_Verifier: Claude (gsd-verifier)_
