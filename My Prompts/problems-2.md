# Voco Dashboard — Full System Audit & UX Improvement Report

## Context

This is a comprehensive audit of the entire Voco platform — all frontend pages/components, backend API routes, Supabase schema/RLS, the LiveKit voice agent, and all integrations — evaluated from both a technical and user-experience perspective. The goal: identify bugs, broken integrations, security concerns, performance issues, and anything not production-ready, then provide detailed UX recommendations from the perspective of a home service business owner.

---

# PART 1: TECHNICAL AUDIT

## 1.1 Dashboard Frontend (50 components, 20 pages)

### Structure
| Tab | Route | Components |
|-----|-------|-----------|
| Home | `/dashboard` | SetupChecklist, RecentActivityFeed, DashboardHomeStats |
| Leads | `/dashboard/leads` | LeadCard, LeadFlyout, LeadFilterBar, KanbanBoard, KanbanColumn |
| Calendar | `/dashboard/calendar` | CalendarView, AppointmentFlyout, CalendarSyncCard, ConflictAlertBanner |
| Calls | `/dashboard/calls` | Inline page logic (no dedicated components) |
| Invoices | `/dashboard/invoices` | InvoiceEditor, InvoiceStatusBadge, PaymentLog, RecordPaymentDialog, RecurringSetupDialog, LineItemRow |
| Estimates | `/dashboard/estimates` | EstimateStatusBadge, EstimateSummaryCards, TierEditor, ConvertToInvoiceDialog |
| More | `/dashboard/more` | 11 sub-pages with individual components |

### Issues Found

**Critical:**
1. **No TypeScript** — All files are `.js`/`.jsx`. No type safety for API responses, props, or state. Runtime errors are possible with unexpected data shapes.
2. **Silent error handling** — Multiple `.catch(() => {})` patterns hide real failures (e.g., in realtime subscriptions, inline actions). Errors silently fail with no user notification.
3. **Realtime memory leak** — `leads/page.js` (lines 172-220) creates new Supabase channel subscriptions on filter changes without properly cleaning up old ones. Rapid filter toggling can accumulate zombie channels.
4. **No input validation** — Forms accept any data shape without client-side validation before API calls.

**High:**
5. **Mobile table UX** — Invoices and estimates show horizontal-scrolling tables on small screens. Cards exist but the experience is still rough.
6. **Inconsistent styling** — Hardcoded `#C2410C`, `#0F172A`, `text-stone-900` across components instead of using design tokens from `design-tokens.js`.
7. **No offline support** — All features require a live connection. Contractors in basements/attics/rural areas lose functionality completely.
8. **Accessibility gaps** — Urgency badges (emergency/routine/high_ticket) differentiated by color only. Missing `role="tablist"`/`role="tab"` on status tab components. Touch targets below 44px minimum (view toggle buttons are 32x36px).

**Medium:**
9. **Dead code** — `/dashboard/analytics/page.js` and `/dashboard/settings/page.js` are redirect-only files (3-5 lines each). Should be handled at routing/middleware level.
10. **Missing error states** — Network failures during realtime updates are invisible to the user.
11. **No pagination** — Large datasets (calls, leads, invoices) can cause performance issues. No cursor-based pagination implemented.
12. **Incomplete realtime** — Only leads have realtime. Calls, calendar, invoices have no live updates. DELETE events not handled on leads either.
13. **Missing loading states** — Flyout panels and inline actions (batch invoice creation) lack loading indicators.
14. **Empty state ambiguity** — No distinction between "no data yet" (new user) vs "no results for this filter" (experienced user).

**Low:**
15. **Animation performance** — Multiple AnimatePresence components with varying hardcoded durations (0.2s, 0.3s, 0.5s) and curves. No standardized animation tokens.
16. **Only `sm:` and `lg:` breakpoints** — No `md:` tablet breakpoint. iPad users get the mobile layout in portrait.
17. **No dark mode** — Sidebar is dark, content is light, no theme toggle. Not requested but worth noting.
18. **Z-index chaos** — Hardcoded values (z-50, z-40, z-39, z-30) without a centralized scale.

### Design Token Gaps
The `design-tokens.js` file defines colors, buttons, cards, glass, grid textures, heading, body, focus, and selected tokens — but is missing:
- Spacing scale (all inline Tailwind)
- Typography scale (no h1/h2/body variants)
- Animation tokens (durations/curves hardcoded)
- Z-index scale
- Shadow variants (only card shadow defined)

---

## 1.2 Backend API Routes (69 total)

### Auth Coverage
- **59 routes** properly authenticated via `getTenantId()` or `getUser()` + tenant verification
- **10 routes** intentionally public with proper alternative auth (Stripe signature, OAuth HMAC state, honeypot, rate limiting)
- **6 cron routes** protected with `Authorization: Bearer ${CRON_SECRET}`
- **RLS coverage: 100%** — All 31 tables have Row Level Security enabled

### Security Concerns

**High:**
1. **CSRF protection gaps** — No explicit CSRF token validation on state-changing routes (POST/PATCH/DELETE). Relies on SameSite=Strict cookies only. Recommendation: add CSRF tokens for sensitive operations (billing, account changes).
2. **Rate limiting is in-memory only** — `/api/demo-voice/route.js` uses an in-memory `Map` that resets on serverless cold starts. A determined attacker can bypass IP limits. Move to Redis (Upstash) for production.
3. **Missing CSP headers** — `next.config.js` has no `headers()` export for Content-Security-Policy, X-Frame-Options, or X-Content-Type-Options.
4. **No admin audit logging** — Admin operations (create/modify tenants) are not logged. Add an audit trail table.

**Medium:**
5. **Proxy console.log exposes email** — `proxy.js:131` logs user email to server logs. Should be debug-level or removed.
6. **Fire-and-forget delete in Stripe webhook** — `stripe/webhook/route.js:432-442` doesn't await the `billing_notifications` delete. Use `Promise.allSettled`.
7. **OAuth state timeout** — `verifyOAuthState()` checks HMAC signature but the expiration window should be verified to be 5-10 minutes, not hours.

### Performance Issues

**N+1 Query in invoices/route.js (GET):**
- Lines 81-117: 4-5 separate aggregate queries (total sent+overdue, total overdue, total paid this month, status counts) that should be a single `GROUP BY status` query.
- Lines 35-40: Bulk update of overdue invoices on every GET request (expensive scan).

**Estimates aggregation:**
- `estimates/route.js` lines 167-176: Fetches all estimates just to compute `status_counts`. Should use `count()` aggregate.

**Positive:**
- Leads query correctly excludes `transcript_text` for performance (documented in code).
- Appointments correctly fetches in 3 parallel queries.
- Trial reminders batch-fetch with `in()` operator (no N+1).

---

## 1.3 Database Schema (31 tables, 34 migrations)

### Tables and RLS — All Clean
Every table has RLS policies following the pattern: `tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())`. Service role has full access for webhooks/crons. Special cases properly handled (phone_inventory_waitlist allows anonymous INSERT).

### Key RPCs (all locked to service_role via migration 027):
- `assign_sg_number(p_tenant_id)` — Atomic SG phone assignment with `FOR UPDATE SKIP LOCKED`
- `book_appointment_atomic(...)` — 11-param atomic booking with conflict detection
- `get_next_invoice_number(p_tenant_id, p_year)` — Sequential numbering
- `get_next_estimate_number(p_tenant_id, p_year)` — Sequential numbering
- `set_updated_at()` trigger on leads

### Index Coverage
20+ indexes on tenant_id + filtered queries. Key performance indexes on invoices (status, created_at), subscriptions (is_current, stripe_subscription_id), calendar_credentials (watch_channel_id). No critical missing indexes found.

---

## 1.4 LiveKit Voice Agent (Python, Railway)

### Architecture
- Entry: `src/agent.py` (400 lines) — Connects to LiveKit room, tenant lookup, system prompt build, tool creation, session management
- Model: Gemini 3.1 Flash Live (native audio-to-audio, temperature 0.3, minimal thinking)
- 6 tools: `check_availability`, `book_appointment`, `capture_lead`, `check_caller_history`, `transfer_call`, `end_call`
- Post-call pipeline: 10-step process (transcript, usage tracking, triage, lead creation, notifications)
- Triage: 3-layer system (keywords -> Groq LLM -> owner rules, escalation-only)

### Issues Found

**Medium:**
1. **Silent context leakage risk** — `check_caller_history` returns history to Gemini with "never mention" instruction. If Gemini leaks context, caller privacy is violated. Consider filtering entirely from system prompt if privacy is critical.
2. **No circuit breaker for Gemini** — If Gemini API is down, agent fails with no fallback script or error recovery.
3. **Calendar sync fire-and-forget** — `push_booking_to_calendar()` errors are logged but not retried. Failed syncs create "ghost appointments" visible in Voco but not on the contractor's Google Calendar.
4. **LLM triage 5-second timeout** — Falls back to keywords if Groq is slow. Consider pre-caching common patterns.
5. **Language detection regex** — Only 10 Spanish markers. Could misclassify Spanish-English mixed calls.

**Positive:**
- Async-first architecture prevents audio latency (`asyncio.to_thread()` + `asyncio.gather()`)
- In-process tools (no webhook round-trips)
- Non-blocking greeting (DB queries run in background)
- Atomic booking via Postgres RPC
- Test call isolation with auto-cleanup
- Recovery SMS with exponential backoff (30s -> 120s, 3 max attempts)
- Idempotent Stripe webhook processing

---

## 1.5 Integration Health

| Integration | Status | Issues |
|-------------|--------|--------|
| **Twilio SIP** | Healthy | Provisioning has admin fallback on failure |
| **LiveKit** | Healthy | Egress recording, SIP dispatch working |
| **Gemini 3.1 Flash Live** | Healthy | No circuit breaker |
| **Stripe** | Healthy | Idempotent webhooks, signature verification |
| **Supabase** | Healthy | 100% RLS coverage, proper client separation |
| **Resend** | Healthy | Used for notifications + contact form |
| **Google Calendar** | Partial | Fire-and-forget sync, no retry on failure |
| **Outlook Calendar** | Partial | Same fire-and-forget pattern |
| **Groq (triage LLM)** | Healthy | 5s timeout with keyword fallback |
| **QuickBooks/Xero/FreshBooks** | Unknown | Integrations page exists but couldn't verify full flow |

---

# PART 2: UI/UX IMPROVEMENT RECOMMENDATIONS

*From the perspective of a home service business owner who checks their dashboard between jobs on their phone.*

## 2.1 Tab Consolidation — Restructure the More Menu

**Problem:** 11 items in More is overwhelming. The mental model is broken — a contractor looking for "Invoice Settings" goes to Invoices first, not More.

### Items to Relocate

| Current Location | Move To | Why |
|-----------------|---------|-----|
| More > Invoice Settings | Invoices tab (gear icon in header) | Contractors think "invoices" not "more > invoice settings" |
| More > Analytics | Promote to sidebar (own tab, between Estimates and More) | Analytics is a daily check, not a setting |
| More > AI & Voice Settings | Absorb into Account page | One-time setup (phone number + test call), only 37 lines of code |
| More > Escalation Contacts | Merge with Notifications -> "Notifications & Escalation" | Both answer "what happens when a call comes in" |
| More > Integrations | Rename to "Integrations & Connections" | Calendar connections already shown inline on Calendar page |

### Resulting More Menu (6 items, down from 11)
1. Services & Pricing
2. Working Hours
3. Service Zones & Travel
4. Notifications & Escalation *(merged)*
5. Billing
6. Account *(absorbs AI & Voice Settings)*

### Resulting Sidebar (7 tabs, same count but better organized)
1. Home
2. Leads
3. Calendar
4. Calls
5. Invoices *(absorbs Estimates as a sub-view toggle)*
6. Analytics *(promoted from More)*
7. More *(6 items instead of 11)*

**Why merge Estimates into Invoices:** They share 80% of UI code (`DocumentListShell`, `StatusTabs`, `ListSkeleton`, `useDocumentList` hook). Add a segmented control "Invoices | Estimates" at the top. The estimate-to-invoice conversion flow (`ConvertToInvoiceDialog`) already exists and is well-implemented.

---

## 2.2 Dashboard Home — Make it a Morning Briefing

**Current:** Greeting, setup checklist, today's schedule, new leads count, invoice snapshot, 3 recent activities.

### Recommended Visual Hierarchy (top to bottom)

**1. Greeting bar (single line, not a card)**
`Good morning, John — 3 jobs today, 2 new leads`

**2. Missed Calls / Action Required card (orange alert, only when items exist)**
Shows calls from last 24h where `booking_outcome = not_attempted` or `duration < 15s`. Each row has the caller's number and a "Call Back" button (`tel:` link). This is the #1 fear for contractors: losing a job because they missed a call.

**3. Today's Schedule (with inline Confirm buttons)**
Current schedule card is good but treats pending and confirmed appointments the same visually. Add an explicit "Confirm" button on pending appointments (amber left border). The PATCH endpoint at `/api/appointments/[id]` already supports status changes.

**4. New Leads (full-width, not squeezed into 2-col grid)**
Show the 3 most recent leads with name, job type, phone, and urgency. Each has "Call Back" and "Book" quick actions. "View All" link pre-filters to `?status=new`.

**5. Revenue Snapshot**
Current invoice stats card, but add "Collected this week" and "Collected this month" amounts alongside "Outstanding" and "Overdue".

**6. Recent Activity (keep trimmed to 3)**

### Mobile Quick Action FAB
Add a floating "+" button on mobile (similar to the one already on Invoices page) that opens a bottom sheet: "New Invoice", "New Estimate", "Book Appointment", "Add Lead".

### Pull-to-Refresh
The Home page fetches data once on mount. Add pull-to-refresh on mobile and a subtle refresh button on desktop. `loadActiveData` is already a standalone async function.

---

## 2.3 Leads Tab — Make Lead Management Feel Natural

### Current Gaps

**a. Lead-to-appointment is invisible:**
When a lead is "booked", there's no way to see or navigate to the appointment from the LeadFlyout. Add an "Appointment" section showing date/time/address with "View on Calendar" link. If no appointment exists, show "Book Appointment" button.

**b. Lead-to-invoice is too subtle:**
LeadCard shows a tiny dot for invoice status (`INVOICE_DOT` map). Replace with a small badge like "INV-001" that links directly to the invoice detail page.

**c. Repeat callers are fragmented:**
When someone calls multiple times, separate leads are created (linked via `lead_calls`). Add a "2 calls" badge on LeadCard and show all associated calls in a timeline in the flyout (currently only reads `lead_calls?.[0]?.calls`).

**d. Default filter should be "new":**
When a contractor opens Leads, they want new leads first. Default the status filter to "new" when no URL params are set.

**e. Mobile swipe actions:**
Allow swiping right on a lead card to reveal: "Call Back" (tel: link), "Book" (booking flow), "Invoice" (invoice creation).

---

## 2.4 Calendar Tab — Make Scheduling Seamless

### Recommendations

**a. Add month view:**
Contractors need to see workload distribution across a month. Add a third view option showing a grid with appointment count badges per day. Click a day to switch to day view.

**b. Quick-book from empty time slots:**
Tap an empty slot -> bottom sheet (mobile) or popover (desktop) with quick booking form: customer name, phone, job type, duration. The available-slots API already exists.

**c. Better travel time visualization:**
Travel buffers are already passed as props to CalendarView. Render them as distinct lighter-colored blocks with a car icon and estimated minutes between appointments. Use a gray hatched pattern distinct from appointment blocks.

**d. Inline conflict resolution:**
Replace the top banner (`ConflictAlertBanner`) with red overlays directly on the calendar grid at overlap zones, each with a "Resolve" button.

**e. Drag to reschedule:**
Allow dragging appointments to different time slots in week/day view. On drop, PATCH `/api/appointments/[id]` with updated times.

---

## 2.5 Calls Tab — Make Call History Actionable

### Critical Gap: No Quick Actions
The expanded call card is read-only. Add action buttons:
- **"View Lead"** — link to the associated lead (via `lead_calls` table)
- **"Call Back"** — `tel:` link using `call.from_number`
- **"Create Lead"** — for short calls where no lead was auto-created, pre-fill with caller's number
- **"Listen"** — render AudioPlayer inline (component exists but is only used in LeadFlyout)

### Add Realtime
Calls page fetches once with no Supabase subscription. Add realtime for the `calls` table so new calls appear immediately. Follow the pattern from `leads/page.js` lines 172-220.

### Urgency Accessibility
Currently differentiated by color only (fails WCAG). Add text labels and icons:
- Emergency: red + exclamation triangle + "EMERGENCY" text
- High Ticket: amber + dollar sign + "HIGH VALUE" text
- Routine: stone, no special marker

### Call-to-Outcome Timeline
Below each expanded call card, show a mini timeline: "Lead created -> Appointment booked -> Invoice sent -> Payment received". Data relationships exist in the DB (`lead_calls`, `appointments.call_id`).

---

## 2.6 Invoices + Estimates — Merge as Sub-View

**Recommendation:** Keep Estimates as a sub-view within the Invoices tab (segmented control toggle), not a separate top-level tab. This frees a sidebar slot for Analytics.

### Additional Improvements

**a. Payment progress bar:** On partially-paid invoices in the list view, show a visual progress bar (amount paid / total).

**b. Quick "Record Payment":** On mobile, allow a quick action on overdue invoices that opens `RecordPaymentDialog` without navigating to the detail page.

**c. "Send Reminder" button:** On overdue invoices, add a reminder action. Track `last_reminder_sent` to prevent spamming. Show "Reminder sent 2d ago" if already sent.

**d. Estimate-to-invoice flow:** Already well-implemented (`ConvertToInvoiceDialog`). Just add a toast notification after conversion with "View Invoice" action.

---

## 2.7 Cross-Tab Connectivity — The Biggest UX Win

**Problem:** Entities are siloed. A customer journey (call -> lead -> appointment -> estimate -> invoice -> payment) is fragmented across 5 tabs with minimal linking.

### a. Customer Timeline Component
Create a shared `CustomerTimeline` showing full history for a customer (matched by phone number). Render in: LeadFlyout, AppointmentFlyout, Invoice detail, Estimate detail.

### b. Command Palette (`Cmd+K` / `Ctrl+K`)
Universal search across leads (name/phone), appointments (name/date), invoices (number/customer), calls (phone number). Mount at dashboard layout level. Add a search icon in the mobile top bar.

### c. Smart Back Navigation
When navigating from a lead to an invoice (via "Create Invoice" in LeadFlyout), the invoice back button currently goes to `/dashboard/invoices`. Use URL params like `?from=lead&from_id=<id>` to go back to the originating context.

### d. Notification Bell
Add a bell icon in the sidebar header (desktop) / top bar (mobile) showing unread count: new leads, missed calls, overdue invoices, pending appointments. Click opens a grouped notification dropdown.

---

## 2.8 Accessibility

| Issue | Fix |
|-------|-----|
| Focus states inconsistently applied | Audit all `<button>` and `<Link>` elements, apply `focus.ring` from design tokens |
| Touch targets below 44px | Increase view toggles from h-8 to h-11 on mobile, filter selects from h-8 to h-11 |
| Color-only urgency indicators | Add text labels and icons (exclamation triangle, dollar sign) |
| Missing ARIA roles | Add `role="tablist"`/`role="tab"` to StatusTabs, `aria-label` to urgency indicators |
| No high-contrast mode | Add toggle in Account settings for outdoor use (increase text weight, add borders, swap stone-400 for stone-700) |
| Keyboard navigation | Add shortcuts: `N` (new), `L` (leads), `C` (calendar), `?` (help), arrows for list navigation |

---

## 2.9 Mobile-First Improvements

### a. Replace Hamburger Drawer with True Bottom Tab Bar
Current mobile nav requires 2 taps (hamburger -> item). Replace with a persistent 5-tab bottom bar (Home, Leads, Calendar, Calls, Documents) + More overflow. This is the pattern used by Jobber, ServiceTitan, and Housecall Pro. Every competitor does this.

### b. Bottom Sheets Instead of Modals
Replace `AlertDialog` confirmations with bottom sheets on mobile. shadcn/ui `Sheet` already supports `side="bottom"`.

### c. Pull-to-Refresh Everywhere
Add pull-to-refresh on all list pages (Leads, Calls, Invoices, Estimates, Calendar).

### d. Offline Support for Critical Data
Cache in localStorage/IndexedDB: today's appointments (name, address, phone, time), last 20 leads with phone numbers, draft invoices. Show "You're offline" banner, queue actions for sync.

### e. Add `md:` Tablet Breakpoint
Many contractors use iPads. Add `md:` (768px) for: two-column grids on tablet, sidebar visible on landscape, 3-day calendar view.

---

# PART 3: PRIORITIZED ACTION PLAN

## Phase 1 — Highest Impact, Lowest Effort
1. Add quick actions to call cards (call back, view lead, play recording inline)
2. Add missed calls alert card to Dashboard Home
3. True bottom tab bar on mobile (replace hamburger drawer)
4. Default leads filter to "new" status
5. Fix urgency accessibility (add text + icons alongside colors)

## Phase 2 — High Impact, Medium Effort
6. Promote Analytics to sidebar, merge Estimates into Invoices tab
7. Move Invoice Settings into Invoices tab header (gear icon)
8. Add Realtime to calls page
9. Add Cmd+K command palette for universal search
10. Merge Notifications + Escalation in More

## Phase 3 — High Impact, Higher Effort
11. Customer timeline component across all entity flyouts
12. Quick-book from calendar empty time slots
13. Month view on calendar
14. Offline support for today's critical data
15. Refactor invoices/route.js N+1 queries into single aggregate

## Phase 4 — Security & Performance
16. Add CSP + security headers to next.config.js
17. Move rate limiting to Redis (Upstash)
18. Add CSRF tokens on sensitive POST/PATCH/DELETE routes
19. Fix realtime channel memory leak on filter changes
20. Add admin audit logging

## Phase 5 — Polish
21. Focus state audit + apply design tokens consistently
22. Swipe actions on mobile lead/call cards
23. Drag-to-reschedule on calendar
24. Pull-to-refresh on all list pages
25. Add `md:` tablet breakpoint throughout

---

# PART 4: FILES TO MODIFY

### Navigation
- `src/components/dashboard/DashboardSidebar.jsx` — Update NAV_ITEMS for tab restructure
- `src/components/dashboard/BottomTabBar.jsx` — Replace hamburger with persistent bottom tabs

### Dashboard Home
- `src/app/dashboard/page.js` — Add missed calls alert, reorder hierarchy, quick action FAB

### Calls
- `src/app/dashboard/calls/page.js` — Add quick actions, realtime, inline audio, urgency icons

### Leads
- `src/components/dashboard/LeadFlyout.jsx` — Add appointment section, multi-call timeline
- `src/components/dashboard/LeadCard.jsx` — Add invoice badge, repeat caller indicator

### Calendar
- `src/components/dashboard/CalendarView.js` — Month view, quick-book, drag-to-reschedule

### Documents
- `src/app/dashboard/invoices/page.js` — Add estimates sub-view toggle, invoice settings gear
- `src/app/dashboard/estimates/page.js` — Integrate as sub-view

### More Tab
- `src/app/dashboard/more/page.js` — Reduce to 6 items
- `src/app/dashboard/more/notifications/page.js` — Merge escalation contacts
- `src/app/dashboard/more/account/page.js` — Absorb AI & Voice Settings

### Backend
- `src/app/api/invoices/route.js` — Refactor N+1 aggregate queries
- `next.config.js` — Add security headers
- `src/proxy.js:131` — Remove console.log of user email

### New Files Needed
- `src/components/dashboard/CommandPalette.jsx` — Universal search
- `src/components/dashboard/CustomerTimeline.jsx` — Cross-entity timeline
- `src/app/api/search/route.js` — Universal search endpoint
