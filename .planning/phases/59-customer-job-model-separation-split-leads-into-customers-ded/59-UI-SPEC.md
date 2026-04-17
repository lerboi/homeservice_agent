---
phase: 59
slug: customer-job-model-separation
status: draft
shadcn_initialized: true
preset: new-york (neutral baseColor, CSS variables, lucide icons)
created: 2026-04-18
---

# Phase 59 — UI Design Contract

> Visual and interaction contract for the Customer detail page (new) and the rewritten Jobs tab (source of truth shifts from `leads` → `jobs`/`appointments`). New Inquiries tab reuses the Jobs visual contract. All tokens inherit from the existing dashboard design system (`src/lib/design-tokens.js`, `src/app/globals.css` CSS variables). **Do not invent new tokens.**

Scope: `/dashboard/customers/[id]` (new), `/dashboard/jobs` (rewrite, visual parity required), `/dashboard/inquiries` (new, mirrors Jobs visual contract), overflow-menu Merge flow, Customer Edit modal, Inquiry Flyout.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (initialized) |
| Preset | new-york style, `baseColor: neutral`, `cssVariables: true`, `rsc: true`, `tsx: false` (JSX) — source: `components.json` |
| Component library | shadcn/ui on Radix primitives (Sheet, Dialog, Tabs, Dropdown, Command, Popover, Tooltip, Badge, Button, Input, Textarea, Switch, Toast via sonner) |
| Icon library | lucide-react (`iconLibrary: lucide` in components.json) |
| Font | Inherits `--font-sans` from `src/app/globals.css` (system-defined, existing) |
| Styling | Tailwind v4 utilities + CSS variable tokens (`var(--brand-accent)`, `var(--warm-surface)`, `var(--sidebar)`, `var(--body-text)`, `var(--selected-fill)`) — consumed via `src/lib/design-tokens.js` exports (`card`, `btn`, `glass`, `heading`, `body`, `focus`, `selected`) |
| Dark mode | next-themes (already wired). All new surfaces MUST use `dark:` variants or CSS-variable-backed tokens. No hardcoded hex. |

New shadcn primitives needed (all from official registry — no third-party):
- `tabs` (Customer detail 3-tab layout, if not already installed)
- `command` (typeahead picker in Merge dialog)
- `alert-dialog` (Merge confirm; destructive pattern)
- `dropdown-menu` (Customer header overflow menu)

Verify installed via `npx shadcn diff` at Wave 0; add via `npx shadcn add {name}` if missing.

---

## Spacing Scale

Declared values (8-point base, multiples of 4). Inherits from existing Tailwind spacing — no override.

| Token | Value | Usage in Phase 59 |
|-------|-------|-------------------|
| xs | 4px | Icon-to-label gaps in pills/badges; stat card inner gaps |
| sm | 8px | Tab list gap; dropdown item padding; merge preview list row gap |
| md | 16px | Default card padding; form field vertical spacing in Edit modal; activity timeline row padding |
| lg | 24px | Customer header section padding (top/bottom); tab panel padding |
| xl | 32px | Page-level padding (desktop `px-8`); gap between header and tab content |
| 2xl | 48px | Major section breaks on Customer detail (between header card and tabs block) |
| 3xl | 64px | Empty-state vertical padding (Jobs tab / Inquiries tab / customer tabs when empty) |

Exceptions:
- Sticky customer-detail header uses `py-6` (24px) top/bottom so it collapses cleanly under the dashboard top bar.
- Status pill strip reuses existing `LeadStatusPills` metrics verbatim: `h-8 px-3` (pill), `gap-2` (between pills), `pt-1 pb-4 px-6` (strip container). **Do not modify — parity is a requirement.**
- Merge dialog content uses shadcn `DialogContent` default `p-6` — no override.

---

## Typography

Inherits from existing dashboard typography. 3 sizes + 2 weights + 1 display role for the customer name.

| Role | Size | Weight | Line Height | Tailwind class |
|------|------|--------|-------------|----------------|
| Label / meta | 12px | 500 (medium) | 1.4 | `text-xs font-medium` |
| Body | 14px | 400 (regular) | 1.5 | `text-sm` |
| Subheading / stat value | 16px | 600 (semibold) | 1.4 | `text-base font-semibold` |
| Display (customer name in header) | 24px | 600 (semibold) | 1.2 | `text-2xl font-semibold tracking-tight` |

Rules:
- Headings use `text-foreground tracking-tight` (from `design-tokens.js` `heading` export).
- Body and secondary text use `text-muted-foreground` (from `body` export).
- Tabular numerics (counts in pills, lifetime value, outstanding balance) MUST use `tabular-nums`.
- Phone numbers in the Customer header render at body size in `font-mono tabular-nums` for alignment against copy-to-clipboard affordance.
- No new font families. No size outside the 4 declared above.

---

## Color

60 / 30 / 10 distribution on the Customer detail page and the Jobs/Inquiries tab shells. All values are CSS-variable tokens — the literal hex differs per light/dark mode; the **role** is what this contract locks.

| Role | Token | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--warm-surface)` / `bg-background` | Page background, main scroll area |
| Secondary (30%) | `bg-card` + `border-border` | Customer header card, stat cards, tab panels, activity timeline rows, flyout body |
| Accent (10%) | `var(--brand-accent)` (copper) | See reserved list below |
| Destructive | `bg-red-600 dark:bg-red-500` (existing `lost` pill color) + shadcn `destructive` button variant | Merge confirm button, "Mark as Lost" inquiry button, `lost` status pill |

Accent reserved for (exclusive list — accent MUST NOT appear on any other element):
1. Primary CTA button(s) only: **Save Changes** (Customer Edit modal), **Convert to Job** (Inquiry Flyout), **Merge Customer** (final confirm in Merge dialog only after typeahead + preview).
2. Active state of the currently-viewed tab on Customer detail page (`Activity` / `Jobs` / `Invoices`) — underline or filled pill following existing shadcn Tabs active style (already uses `--brand-accent` via `data-[state=active]`).
3. "New" status pill fill in the Jobs tab strip (existing — preserved verbatim from `LeadStatusPills.jsx` line 4).
4. Focus ring on all interactive elements: `focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1` (from `design-tokens.js` `focus.ring`).
5. Selected state on the Jobs/Inquiries list card (`border-[var(--brand-accent)] bg-[var(--selected-fill)]` — from `design-tokens.js` `selected.card`).

Semantic status colors (Jobs tab pills — reuse existing palette verbatim, no changes):
- `scheduled` → `bg-blue-600 dark:bg-blue-500 text-white` (currently labeled "booked"/"Scheduled" in `LeadStatusPills.jsx` line 5)
- `completed` → `bg-stone-700 dark:bg-stone-600 text-white` (line 6)
- `paid` → `bg-[#166534] dark:bg-emerald-600 text-white` (line 7)
- `lost` → `bg-red-600 dark:bg-red-500 text-white` (line 8, preserves `ml-2` Lost-gap from Phase 52)
- `cancelled` → `bg-stone-500 dark:bg-stone-600 text-white` (**new**; sits next to `lost` with same `ml-2` visual gap pattern — executor confirms exact shade against existing cancelled-appointment treatment in CalendarView)

Inquiry tab pill palette (new statuses, same visual treatment pattern):
- `open` → `bg-[var(--brand-accent)] text-[var(--brand-accent-fg)]` (mirrors "new" in Jobs — entry status gets brand accent)
- `converted` → `bg-[#166534] dark:bg-emerald-600 text-white` (success terminal; mirrors `paid`)
- `lost` → `bg-red-600 dark:bg-red-500 text-white` with `ml-2` gap (Phase 52 Lost-gap preserved)

Customer header stat treatment:
- Outstanding balance: `text-foreground` by default; `text-red-600 dark:text-red-400 font-semibold` when > 0.
- Lifetime value: `text-foreground font-semibold` always (not accent — accent is reserved).
- Jobber / Xero context badges (when present): shadcn `Badge variant="secondary"` + provider icon from lucide (`FileSpreadsheet` Xero, `Wrench` Jobber) — matches existing `BusinessIntegrationsClient.jsx` iconography.

VIP indicator (existing Phase 46 pattern preserved on Customer header when any related job/inquiry `is_vip = true`): `bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300` Badge with filled `Star` icon.

---

## Copywriting Contract

Voice: direct, trade-owner-friendly, "Voco" never "HomeService AI". Prefer verbs a plumber would use ("Call back", "Mark paid") over CRM jargon ("Disposition", "Assign").

### Primary CTAs

| Surface | Button copy |
|---------|-------------|
| Customer header (primary) | **Edit Customer** (opens Edit modal) |
| Customer header (overflow → Merge) | **Merge into another customer…** |
| Edit modal (primary save) | **Save Changes** |
| Edit modal (secondary) | **Cancel** |
| Merge dialog step 1 (typeahead selection) | **Continue** |
| Merge dialog step 2 (destructive confirm) | **Merge Customer** (red/destructive variant) |
| Merge dialog (cancel) | **Cancel** |
| Unmerge banner (within 7-day window) | **Undo merge** |
| Inquiry Flyout (primary) | **Convert to Job** |
| Inquiry Flyout (secondary destructive) | **Mark as Lost** |
| Jobs tab — empty state CTA | **View call history** (links to `/dashboard/calls`) |
| Inquiries tab — empty state CTA | **View call history** |
| Customer detail Invoices tab (when invoicing flag ON, no invoices) | **Create invoice** (respects `features_enabled.invoicing`) |

### Empty states

| Context | Icon | Heading | Body |
|---------|------|---------|------|
| Jobs tab (zero jobs, no filter) | `Wrench` (lucide) | **No jobs yet** | "When Voco books an appointment, it shows up here. Check call history to see recent inquiries." |
| Jobs tab (filter yields zero) | `SearchX` | **No jobs match these filters** | "Try clearing a filter or widening the date range." |
| Inquiries tab (zero inquiries) | `PhoneIncoming` | **No open inquiries** | "Callers who didn't book will land here. Nothing to chase right now." |
| Customer → Activity tab (no activity) | `Clock` | **No activity yet** | "Calls, bookings, and notes for this customer will appear here." |
| Customer → Jobs tab (no jobs) | `Wrench` | **No jobs for this customer** | "Once this customer books a service, their jobs show up here." |
| Customer → Invoices tab (invoicing OFF) | `FileText` (muted) | **Invoicing is off** | "Enable invoicing in Settings → Features to track invoices per customer." (link to `/dashboard/more/features`) |
| Customer → Invoices tab (invoicing ON, none) | `FileText` | **No invoices yet** | "Create an invoice from a completed job to start tracking revenue for this customer." |

### Error states (all surfaces — existing retry pattern)

| Context | Copy | Action |
|---------|------|--------|
| Jobs list fetch fails | "We couldn't load your jobs. Check your connection and try again." | **Retry** button (secondary variant) |
| Customer detail fetch fails | "This customer couldn't be loaded." | **Retry** + **Back to Customers** |
| Customer not found (404) | "Customer not found. They may have been merged into another record." | **Back to Customers** (primary) |
| Merge conflict (concurrent update) | "This customer was changed while you were viewing. Refresh to see the latest." | **Refresh** (primary) |
| Save failure in Edit modal | "Couldn't save changes. Please try again." | Inline error above form; **Save Changes** button re-enabled |
| Inquiry conversion failure | "We couldn't convert this inquiry. No changes were saved." | Toast + **Retry** in flyout |

### Destructive confirmations

| Action | Pattern | Confirmation copy |
|--------|---------|-------------------|
| Merge customer | AlertDialog, 2-step (preview then confirm) | Title: **Merge into {Target Name}?** — Body: "{N} jobs, {M} inquiries, {K} invoices, and {L} call recordings will move to {Target Name}. {Source Name} will be hidden. You can undo this for 7 days." — Confirm button: **Merge Customer** (destructive) — Cancel button: **Cancel** |
| Mark inquiry as Lost | shadcn Toast with Undo (sonner) | Toast: "Inquiry marked as lost." — Action: **Undo** (5-second window, mirrors Phase 42 Mark Complete pattern) |
| Unmerge (within 7 days) | AlertDialog, single-step | Title: **Undo merge?** — Body: "{Source Name} will be restored as a separate customer. The {N} jobs, {M} inquiries, {K} invoices, and {L} calls that were moved to {Target Name} will move back." — Confirm: **Undo Merge** — Cancel: **Cancel** |

### Terminology (hard rules — passed to checker)

- Use **"Customer"** (singular) / **"Customers"** (plural) on all surfaces.
- Use **"Job"** for booked work (has an appointment).
- Use **"Inquiry"** for unbooked calls.
- **Never** use "Lead", "Lead record", or "CRM entry" in user-facing copy on Phase 59 surfaces. Component filenames may retain `Lead*` prefix during transition (per CONTEXT canonical refs), but rendered copy must not.
- Phone number shown with country code: **"+1 555 123 4567"** (E.164 with display grouping via `libphonenumber-js` `formatInternational`).
- Currency: use the tenant's existing currency formatting (reuse whatever invoices page uses). Do not invent new formatter.

### Removed UI (legacy lead-merge flow)

Document for executor and planner — these surfaces are **deleted** in this phase, not redesigned:
- Manual "Merge leads" UI inside LeadFlyout (the phone-dedup on Customer replaces this).
- Any "Duplicate leads" warning on lead list.
- The `/api/leads/[id]/merge` endpoint (replaced by `/api/customers/[id]/merge`).
Replacement entry point: per-customer **Merge into another customer…** inside Customer detail header overflow menu only. No global duplicates dashboard in this phase (deferred).

---

## Component Inventory

### New components (create in `src/components/dashboard/customers/`)

| Component | Role | Key primitives |
|-----------|------|----------------|
| `CustomerDetailHeader.jsx` | Sticky header: name (display), phone (mono), default address, lifetime value, outstanding balance, Jobber/Xero badges, VIP indicator, `Edit Customer` CTA, overflow dropdown (`Merge into another customer…`) | shadcn `Card`, `Badge`, `Button`, `DropdownMenu` |
| `CustomerEditModal.jsx` | Full CRUD modal: name, default address, email, notes (`Textarea`), tags (free-form chip input), phone (**read-only** with help text "To change phone, use Merge") | shadcn `Dialog`, `Input`, `Textarea`, `Button` |
| `CustomerMergeDialog.jsx` | 2-step: (1) typeahead picker for target customer, (2) preview counts + destructive confirm | shadcn `Dialog` or `AlertDialog`, `Command` (typeahead), `Button variant="destructive"` |
| `CustomerActivityTimeline.jsx` | Chronological timeline: calls, booking events, invoice events, notes, inquiry events. Flat list, most-recent-first; day separator when date changes | Custom list using `card.base` token + lucide icons per event type |
| `CustomerJobsList.jsx` | Reuses JobCard (see below); filtered by `customer_id`. Empty state uses copy above | Same visual contract as dashboard Jobs tab |
| `CustomerInvoicesList.jsx` | Reuses existing invoice card from `/dashboard/invoices`; filtered by `customer_id`. Gated by `features_enabled.invoicing` — renders "Invoicing is off" empty state when flag is off | Reuse — do not duplicate |
| `UnmergeBanner.jsx` | Inline banner when viewing the target of a recent merge (shown for 7 days post-merge): copy + `Undo merge` button | shadcn Alert-style banner, warm-surface background, `border-l-4 border-[var(--brand-accent)]` |
| `InquiryFlyout.jsx` | Right Sheet for inquiry detail: caller name, phone, transcript link, `Convert to Job`, `Mark as Lost` | shadcn `Sheet` — mirrors LeadFlyout structure |
| `JobFlyout.jsx` | Right Sheet for job detail (renamed/scoped from LeadFlyout). All Phase 33–49 affordances preserved: status change, audio, transcript, Create/View Invoice, VIP toggle | shadcn `Sheet` — visual parity required with current LeadFlyout |

### Reused components (no visual change)

| Component | Notes |
|-----------|-------|
| `LeadStatusPills.jsx` → rename to `JobStatusPills.jsx` | Pill strip — preserve all classes verbatim. Add `cancelled` pill next to `lost` with matching `ml-2` gap. Update statuses list: remove `new`/`booked`, add `scheduled`/`cancelled`. |
| `InquiryStatusPills.jsx` (new, clone of above) | 3 pills: `open` / `converted` / `lost`. Lost-gap (`ml-2`) preserved. |
| `LeadCard.jsx` → rename to `JobCard.jsx` | Unchanged visual; query source shifts to `jobs`+`appointments` join. |
| `InquiryCard.jsx` (new, clone of JobCard) | Same card shape; no appointment row; shows `job_type` + `service_address` + urgency badge. |
| `LeadFilterBar.jsx` → rename/split into `JobFilterBar.jsx` and `InquiryFilterBar.jsx` | Preserve filter controls; swap status enums. |
| `EmptyStateLeads` → split into `EmptyStateJobs` + `EmptyStateInquiries` | Use copy table above. |
| `HotLeadsTile` → rename to `HotJobsTile` (dashboard home) | Queries `jobs` with urgency=emergency + status=scheduled. Visual unchanged. |

### Navigation

- Sidebar (`DashboardSidebar`): existing **Jobs** entry stays. Add **Inquiries** below it. Both use lucide icon (`Wrench` for Jobs — already in use; `PhoneIncoming` for Inquiries). Active state treatment unchanged.
- BottomTabBar (mobile): add **Inquiries** tab proportionally — if this pushes it above 5 tabs, demote the lowest-use tab into the More overflow (planner to decide — flagged as Claude's discretion).
- Breadcrumbs: `Dashboard → Customers → {Customer Name}`. Add `Dashboard → Customers` list page if not in scope, else link customer name directly from Jobs list via row click (flagged: planner confirms whether a Customers index page is in-scope for Phase 59; CONTEXT implies no — entry point is via Job → customer link + search).
- Link from Job/Inquiry row → Customer detail: customer name in `JobCard`/`InquiryCard` becomes a link with existing `hover:underline` treatment; hitting it opens Customer detail page (not a flyout — full page navigation).

---

## Interaction Contracts

### Customer detail page

- **Layout:** Sticky header (top) + shadcn `Tabs` with 3 triggers (Activity | Jobs | Invoices). Default tab: **Activity**. Tab state persists to URL via `?tab=activity|jobs|invoices`.
- **Realtime:** 3 subscriptions (per RESEARCH Pattern 3): `customers` (single row filter), `jobs` (customer_id filter), `inquiries` (customer_id filter). Updates re-render in place without full page refresh.
- **Loading:** Skeleton mirrors final layout (header skeleton with stat placeholders + tab list + 3 skeleton cards). No blank flashes. Use existing skeleton primitives from dashboard-crm-system.
- **Responsive 375px:** Header stats stack vertically; tab labels truncate to icon-only at < 400px is NOT permitted — labels remain visible, page scrolls horizontally within the tab list if needed.

### Jobs tab rewrite — parity checklist

Executor MUST preserve:
- [ ] Status pill strip visual (`LeadStatusPills.jsx` classes line 3-9, 11, 23-51)
- [ ] Filter bar layout + controls (urgency, date range, search, jobType)
- [ ] Single list view (no view toggle)
- [ ] Realtime subscription on tenant-scoped INSERT/UPDATE (new subscription to `jobs` table replaces `leads` table)
- [ ] Card row layout (JobCard identical to current LeadCard)
- [ ] VIP badge (Phase 46: violet-100/violet-700, filled Star)
- [ ] Urgency badge (existing palette)
- [ ] Escalation indicators (if any exist on current LeadCard)
- [ ] Empty state icon + copy slot (text differs; layout identical)
- [ ] Dark mode variants on all of the above

New fields surfaced on JobCard (additive — do not remove anything):
- Customer name link (links to `/dashboard/customers/{customer_id}` on click)
- Appointment time (from joined `appointments.start_time`) — already likely present via existing join

### Inquiries tab

- Same page skeleton as Jobs tab, different status pill set, different empty state.
- Clicking an inquiry row opens `InquiryFlyout` (not a full page — mirrors LeadFlyout UX).
- Flyout actions: `Convert to Job` (primary, brand accent) → opens QuickBook sheet pre-filled with caller name/phone/service_address. `Mark as Lost` (secondary destructive) → updates status + toast with Undo.

### Merge flow

- Trigger: Customer header overflow menu → `Merge into another customer…`.
- Step 1 (Dialog): shadcn `Command` typeahead searching customers by name or phone. Minimum 2 characters. Max 8 results. Keyboard nav (arrows + enter). Disabled items: self, already-merged (`merged_into IS NOT NULL`).
- Step 2 (AlertDialog): shows preview counts `N jobs, M inquiries, K invoices, L calls`. Destructive confirm button. Cancel returns to Step 1.
- Post-merge: full page navigates to target customer's detail page. `UnmergeBanner` shown at top of target for 7 days.
- Concurrency: if merge fails due to target being merged in the meantime, show error copy above and re-enable Continue.

### Edit modal

- Phone field: `readOnly` input with muted treatment + help text "To change phone, use Merge" (inline `Info` icon from lucide).
- Tags: free-form chip input (create on Enter, remove on backspace). No taxonomy — per CONTEXT Deferred Ideas.
- Save triggers single PATCH; optimistic UI on success; error inline + form re-enabled on failure.
- Closing modal with unsaved changes: shadcn AlertDialog "Discard changes?" if form dirty.

---

## Accessibility

- All interactive elements have visible `focus-visible` ring via `design-tokens.js` `focus.ring`.
- Customer header phone number has `aria-label="Phone number, {formatted}"` and a copy-to-clipboard button with `aria-label="Copy phone number"`.
- Tabs use shadcn Radix Tabs (already ARIA-compliant).
- Merge dialog has `role="alertdialog"` at step 2 with `aria-describedby` pointing at the preview copy.
- Status pill strip keeps existing `role="tablist"` + `role="tab"` + `aria-selected` pattern.
- All destructive confirmations reachable via keyboard (Enter on focused button; Escape cancels).
- Color is never the sole signal — status pills carry labels; outstanding balance carries "Outstanding:" label, not just red color.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official (ui.shadcn.com) | `tabs`, `command`, `alert-dialog`, `dropdown-menu` (install if missing), plus existing: `sheet`, `dialog`, `button`, `badge`, `input`, `textarea`, `card`, `switch`, `toast` (sonner) | not required (official registry, maintained) |
| Third-party registries | none | n/a |

No third-party registries declared. Registry vetting gate: not applicable.

---

## Skill File Consumers

Downstream skill updates must reference this contract (do not re-specify tokens there — link back):
- `.claude/skills/dashboard-crm-system/SKILL.md` — add Customer detail page section, Jobs/Inquiries split section, Merge flow section; update status pill table.
- Executor should verify no new design tokens are introduced — if a visual need surfaces that isn't covered here, surface to ui-checker before inventing.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
