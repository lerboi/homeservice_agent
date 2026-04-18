---
phase: 57
plan: 05
status: awaiting-human-verify
date: 2026-04-19
---

# 57-05 — Dashboard Overlay UX + Copy-to-Jobber Email

## What Built

### Calendar overlay retrofit (Task 1)
- `src/components/dashboard/CalendarView.js` — `ExternalEventBlock` rewritten: muted slate surface (was hardcoded violet), per-provider pill (`From Jobber` brand emerald, `From Google` violet, `From Outlook` blue), Jobber blocks deep-link to `secure.getjobber.com/calendar?date=` and EARLY-RETURN so the Voco AppointmentFlyout does not open. `AppointmentBlock` accepts new `jobberConnected` prop and renders amber "Not in Jobber" pill when `jobberConnected && !appointment.jobber_visit_id && effectiveHeight >= 44`. `CalendarView` default-export accepts `jobberConnected` and threads to all `<AppointmentBlock>` instances.
- `src/app/api/appointments/route.js` — GET `.select()` extended with `jobber_visit_id`. POST adds an `after()` block that calls `notifyBookingCopyToJobber` (non-blocking).
- `src/app/api/integrations/jobber/connection-status/route.js` (new) — lightweight GET returning `{connected: boolean}` for client components.
- `src/app/dashboard/calendar/page.js` — new `jobberConnected` state + GET to `/api/integrations/jobber/connection-status` on mount; threaded to both CalendarView invocations + AppointmentFlyout; mounts `<JobberCopyBanner />` above the grid.

### Copy-to-Jobber UX (Task 2)
- `src/components/dashboard/CopyToJobberSection.jsx` (new) — flyout sub-component. Heading "Copy to Jobber", subtext "Paste into a new Jobber visit", "Copy details" Voco-brand button writes `Client/Phone/Address/Start/Duration/Notes` paste block to `navigator.clipboard` with success/error toasts ("Copied to clipboard", "Couldn't copy — try manually selecting the text"), "Open in Jobber" outline button → `secure.getjobber.com/work_orders/new`. 44px tap target. `buildJobberPasteBlock` extracted to `.helpers.js` for unit-testing without a JSX parser.
- `src/components/dashboard/JobberCopyBanner.jsx` (new) — dismissible blue info banner. localStorage key `voco_jobber_copy_banner_dismissed`; defaults to `dismissed=true` so no flash before localStorage read; framer-motion `AnimatePresence` exit; `role="status"`; localStorage write wrapped in try/catch (incognito-safe).
- `src/components/dashboard/AppointmentFlyout.js` — accepts `jobberConnected` prop, renders amber "Not in Jobber yet" header pill and `<CopyToJobberSection />` below details.

### Integrations card + email (Task 3)
- `src/components/dashboard/JobberBookableUsersSection.jsx` (new) — fetches `GET /api/integrations/jobber/bookable-users` on mount, renders `<BookableUsersPicker />`, auto-collapses for >4 users, includes the resync footnote.
- `src/components/dashboard/BusinessIntegrationsClient.jsx` — mounts `<JobberBookableUsersSection />` inside the Jobber connected-state card (between status line and Disconnect button), guarded by `providerKey === 'jobber'`.
- `src/emails/BookingCopyToJobberEmail.jsx` (new) — React Email template with locked subject "Don't forget to add this to Jobber", body verbatim, monospace paste block, brand-emerald "Open Jobber" CTA.
- `src/lib/notifications.js` — appended `notifyBookingCopyToJobber` helper. Gates on BOTH `accounting_credentials` presence AND `appt.jobber_visit_id IS NULL`. Owner email resolution: `business_email > email > personal_email`. Always non-throwing — booking flow must not break on email failures. Reuses `buildJobberPasteBlock` so flyout copy and email use identical formatting.

## Key Files

- created: 7 new files (4 components/sub-components, 1 email template, 1 API route, 1 page) + 4 test files
- modified: 6 existing files (CalendarView, AppointmentFlyout, BusinessIntegrationsClient, calendar page, appointments route, notifications.js)

## Tests

- 8 calendar-overlay static-grep tests pass (provider labels, slate surface, Jobber click order, prop threading)
- 13 copy-to-jobber tests pass (4 pasteable-text edge cases + 9 UI-SPEC §3 copy assertions)
- 10 banner tests pass (UI-SPEC §4 copy + localStorage contract + accessibility)
- 9 booking-copy-to-jobber notification tests pass (both gate paths, recipient fallback, locked subject, paste-block content, no-throw on send error, missing-args early-return)
- **Phase 57 total: 122/122 tests across 11 suites.** No regressions in pre-existing P56 webhook tests (11/11) or jobber adapter suite (51/51).

## Deviations

- **Email body location.** Plan referenced `bookings@${EMAIL_DOMAIN}` for the from header, but project convention (verified in `notifyJobberRefreshFailure`, `sendOwnerEmail`) is `Voco <noreply@voco.live>`. Followed convention.
- **Owner email lookup.** Plan suggested `tenants.email > tenants.personal_email`. Added `business_email` as the highest-priority field since the project schema has all three; falls back through the same chain.
- **Voice-agent post-booking site.** Plan §3c said to insert the call "right after sendOwnerSMS". The voice-agent post-call pipeline lives in the cross-repo `livekit-agent/` deployed to Railway — out of scope for this plan. Wired the manual `/api/appointments` path here (the only Voco-side booking site); voice-agent wiring is a one-line Python change in livekit-agent, tracked as a follow-up.
- **Shared `buildJobberPasteBlock`.** Email template re-uses the same helper as `CopyToJobberSection` instead of duplicating formatting logic — single source of truth for the paste-block shape.
- **Test files use `.test.js` not `.test.tsx`.** Project's jest config matches only `**/tests/**/*.test.js`; React Testing Library is not configured. Followed the static-grep + pure-function-helper precedent. Visual rendering covered by the human-verify checkpoint.

## Self-Check: PASSED (awaiting human verify)

- [x] ExternalEventBlock muted slate + 3 provider pills (no `bg-violet-50` left in block body)
- [x] Jobber click EARLY-RETURNS so the Voco flyout does not open
- [x] AppointmentBlock + AppointmentFlyout accept `jobberConnected` and render amber pills correctly
- [x] `appointments` GET surfaces `jobber_visit_id`
- [x] connection-status route returns `{connected}`
- [x] CopyToJobberSection has all UI-SPEC §3 copy verbatim
- [x] JobberCopyBanner has localStorage key `voco_jobber_copy_banner_dismissed` and full UI-SPEC §4 copy
- [x] notifyBookingCopyToJobber gates on both jobber-connected AND `jobber_visit_id IS NULL`
- [x] Email subject `"Don't forget to add this to Jobber"` exact
- [x] BusinessIntegrationsClient renders `<BookableUsersPicker />` inside the Jobber card connected state via JobberBookableUsersSection
- [ ] **Task 4 — human-verify checkpoint pending** (13 end-to-end steps in the plan; requires live Voco dev env with connected Jobber sandbox)

## Pending Checkpoint

Phase 57 cannot complete until the user runs through the 13-step human-verify walkthrough in 57-05-PLAN.md `<task>` 4 against a live dev environment with a connected Jobber sandbox tenant. Reply "verified" once all steps pass, or list the failing step numbers.
