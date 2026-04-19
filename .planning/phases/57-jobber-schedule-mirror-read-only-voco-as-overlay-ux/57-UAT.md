---
status: testing
phase: 57-jobber-schedule-mirror-read-only-voco-as-overlay-ux
source: [57-01-SUMMARY.md, 57-02-SUMMARY.md, 57-03-SUMMARY.md, 57-04-SUMMARY.md, 57-05-SUMMARY.md]
started: 2026-04-19T00:00:00Z
updated: 2026-04-19T00:02:00Z
---

## Current Test

number: 5
name: Google/Outlook External Block Regression
expected: |
  Google and Outlook external events still render correctly — muted slate surface, violet "From Google" pill for Google, blue "From Outlook" pill for Outlook. Click behavior unchanged from pre-phase-57.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill the Next.js dev server. Start fresh with `npm run dev`. Server boots without errors, migration 055 columns are queryable (e.g. hitting the dashboard doesn't throw about missing `jobber_visit_id` or `jobber_last_schedule_poll_at`), and the calendar page loads without a 500.
result: pass

### 2. Solo Auto-Skip on Jobber OAuth Connect
expected: With a Jobber sandbox exposing exactly one user, completing the OAuth connect flow auto-skips the bookable-users picker page and redirects straight to `/dashboard/more/integrations?jobber=connected` with a success toast. Picker UI is NOT shown.
result: pass

### 3. Calendar Copy-to-Jobber Banner
expected: On `/dashboard/calendar` with Jobber connected, a blue info banner appears above the grid ("Copy bookings to Jobber..." per UI-SPEC §4). Dismissing it hides it; refreshing the page keeps it hidden. Opening the same page in an incognito window shows the banner again.
result: pass

### 4. Jobber External Event Block
expected: A Jobber-sourced visit on the calendar renders as a muted slate block with a brand-emerald "From Jobber" pill. Clicking it opens `secure.getjobber.com/calendar?date=<yyyy-mm-dd>` in a new tab — the Voco AppointmentFlyout does NOT open.
result: pass
notes: |
  Discovered MIRRORED_STATUSES used stale values ('SCHEDULED', 'IN_PROGRESS') — live Jobber VisitStatusTypeEnum is { ACTIVE, COMPLETED, LATE, TODAY, UNSCHEDULED, UPCOMING }. Fixed to mirror ACTIVE/LATE/TODAY/UPCOMING. Webhook-driven insert + calendar render confirmed.

### 5. Google/Outlook External Block Regression
expected: Google and Outlook external events still render correctly — muted slate surface, violet "From Google" pill for Google, blue "From Outlook" pill for Outlook. Click behavior unchanged from pre-phase-57.
result: [pending]

### 6. "Not in Jobber" Pill on Voco Appointment Block
expected: With Jobber connected, a Voco-booked appointment whose `jobber_visit_id` is null shows an amber "Not in Jobber" pill on the calendar block (when block height ≥ 44px). Appointments with a `jobber_visit_id` do NOT show the pill.
result: [pending]

### 7. "Not in Jobber yet" Flyout Header Pill
expected: Clicking a Voco appointment without a `jobber_visit_id` opens the AppointmentFlyout with an amber "Not in Jobber yet" pill in the header, and a "Copy to Jobber" section below the details.
result: [pending]

### 8. Copy Details + Open in Jobber
expected: In the flyout's "Copy to Jobber" section, clicking "Copy details" shows a "Copied to clipboard" toast and pastes a 6-line block (Client/Phone/Address/Start/Duration/Notes). Clicking "Open in Jobber" opens `secure.getjobber.com/work_orders/new` in a new tab.
result: [pending]

### 9. Jobber Webhook Mirror (Live)
expected: In Jobber sandbox, create/move/delete a visit. Within ~15 seconds, the Voco calendar reflects the change (new visit appears, moved visit shifts, deleted visit disappears) — no page refresh required beyond normal calendar polling.
result: [pending]

### 10. Post-Booking Copy-to-Jobber Email
expected: Booking an appointment through Voco (while Jobber is connected and the new appointment has no `jobber_visit_id`) triggers an email with subject "Don't forget to add this to Jobber" containing the paste block and an "Open Jobber" CTA. Owner email address resolves via business_email → email → personal_email.
result: [pending]

### 11. Dark Mode Rendering
expected: Toggle dark mode. All Phase 57 surfaces render correctly — external event blocks, provider pills, amber "Not in Jobber" pills, flyout Copy-to-Jobber section, JobberCopyBanner, and the BookableUsersPicker in the integrations card. No illegible text, no broken contrast.
result: [pending]

### 12. Mobile 375px Reflow
expected: At 375px viewport width, the calendar, AppointmentFlyout with Copy-to-Jobber section, JobberCopyBanner, and integrations card with BookableUsersPicker all reflow without horizontal overflow. Tap targets ≥ 44px.
result: [pending]

## Summary

total: 12
passed: 2
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps

[none yet]
