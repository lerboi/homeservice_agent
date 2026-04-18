# Phase 57: Jobber Schedule Mirror (read-only) + Voco-as-Overlay UX — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 57-jobber-schedule-mirror-read-only-voco-as-overlay-ux
**Areas discussed:** Pre-research lock-in, External-event retrofit, Bookable-picker edge case, Resync semantics, Sync window, Poll cadence, Email copy, Banner pattern, Unassigned visits, Visit status filter

---

## Pre-Research Lock-In (Q1 / Q2 / Q3)

| Option | Description | Selected |
|--------|-------------|----------|
| Lock all three (Recommended) | Adopt pre-research recommendations as-is | ✓ |
| Lock Q1 + Q3, revisit Q2 | Dig deeper on overlay calendar UX | |
| Revisit one or more | Concerns about a specific recommendation | |

**User's choice:** Lock all three.
**Notes:** Pre-research in `56-…/57-PRERESEARCH.md` resolved bookable-users subset, thin-overlay calendar, and interim copy-to-clipboard UX.

---

## External Google/Outlook Event Retrofit (JOBSCHED-05 tail)

| Option | Description | Selected |
|--------|-------------|----------|
| Retrofit now (Recommended) | Apply muted pill + non-editable treatment to Google/Outlook in Phase 57 alongside Jobber | ✓ |
| Jobber-only now, retrofit in Phase 58 | Ship Phase 57 scoped to Jobber visuals only | |
| Defer indefinitely | Accept visual inconsistency | |

**User's choice:** Retrofit now.
**Notes:** Universal convention across all external providers; avoids a mixed visual model.

---

## Bookable-Picker Edge Case (zero recent visits)

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-select all users (Recommended) | Safest default — no signal means block everyone | ✓ |
| Pre-select nobody, require manual pick | Explicit but adds friction | |
| Pre-select only connecting user | Solo-owner-friendly default | |

**User's choice:** Pre-select all users.
**Notes:** Prevents under-blocking (AI booking over pending work) when the 30-day signal is absent.

---

## Bookable-Set Change Resync Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate diff-sync (Recommended) | On save: delete removed-user events, fetch+insert added-user events synchronously | ✓ |
| Background job + toast | Async resync with toast; brief window of stale availability | |
| Lazy — next scheduled sync picks it up | Simplest code, worst UX | |

**User's choice:** Immediate diff-sync.
**Notes:** Owner sees update reflected before settings panel closes.

---

## Sync Window

| Option | Description | Selected |
|--------|-------------|----------|
| Past 90 / Future 180 days (Recommended) | Home-service pipelines span quarters; covers callback context + long-lead jobs | ✓ |
| Past 30 / Future 90 days | Matches AI booking horizon but misses long-lead installs | |
| Past 7 / Future 60 days | Minimal — too thin for real home-service workflows | |

**User's choice:** Past 90 / Future 180 days.
**Notes:** User asked for "best real-world UX"; answer reframed around home-service pipeline length (HVAC installs, roofing, maintenance contracts).

---

## Poll-Fallback Cron Cadence

| Option | Description | Selected |
|--------|-------------|----------|
| Every 15 minutes (Recommended) | Aligns with existing calendar cron; webhooks handle common case | ✓ |
| Every 5 minutes | Safer but 3x Jobber API calls per tenant per hour | |
| Hourly | Too coarse — an hour of stale availability is a real double-book risk | |

**User's choice:** Every 15 minutes.
**Notes:** Webhooks are primary path (sub-second); poll is fallback for webhook outages only.

---

## Interim 'Copy to Jobber' Email Fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing booking-complete email, conditional block (Recommended) | Single email, no notification noise; matches Calendly/Acuity pattern | ✓ |
| New dedicated 'Add to Jobber' email | Two emails train the owner to ignore it within a week | |
| Claude's discretion during planning | Defer to planner | |

**User's choice:** Extend existing booking-complete email.
**Notes:** Conditional block appears only when Jobber is connected AND push is unavailable.

---

## Banner + Pill Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Dismissible per-user banner + permanent per-appointment pill (Recommended) | Two-layer: banner teaches once, pill nudges at point of action | ✓ |
| Non-dismissible banner + permanent pill | Higher visibility but banner fatigue after week 2 | |
| Setup-checklist task + pill, no banner | Less intrusive, lower discoverability | |

**User's choice:** Dismissible per-user banner + permanent per-appointment pill.
**Notes:** Banner persists across sessions once dismissed; new team members see it on first visit.

---

## Unassigned Jobber Visits

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, block (Recommended) | Unassigned visits are still real work; prevents AI booking over pending slots | ✓ |
| No, ignore until assigned | Only mirror assigned visits; risks booking over owner's committed work | |
| Block only if created by bookable-user | Use creator as bookable-set check; complicates mental model | |

**User's choice:** Yes, block.
**Notes:** Matches Jobber's own online-booking behavior.

---

## Visit Status Filter

| Option | Description | Selected |
|--------|-------------|----------|
| Scheduled + in-progress only (Recommended) | Mirror only visits with concrete start/end; ignore cancelled/completed/draft | ✓ |
| All non-cancelled (include completed) | Completed visits don't block future availability anyway | |
| Claude's discretion during planning | Planner decides after reading Jobber API enum | |

**User's choice:** Scheduled + in-progress only.
**Notes:** Draft/anytime visits have no concrete time, so they can't block a specific slot.

---

## Claude's Discretion

- Jobber per-visit URL stability — confirm during planning; fall back to schedule day-view if unstable.
- Exact visual tokens for muted external events — designer's call within existing design system.
- Bookable-users picker UI shape (list + checkboxes vs. multi-select chip input).
- Empty-state copy when bookable-set is empty.
- Dismissed-banner storage key (localStorage vs. user profile DB column).
- Bookable-set storage finalization — `jobber_bookable_user_ids text[]` on existing Jobber-connection row vs. new `jobber_connections` table.

## Deferred Ideas

- Per-service bookable-member subsets — Phase 58+.
- Role-based auto-sync of bookable set — Phase 58.
- Technician-specific booking — out of scope.
- Inline edit of Jobber visits in Voco — Phase 999.3+.
- "Hide Jobber visits" per-user toggle — wait for user signal.
- Crew notification when Voco books — covered by Jobber native notifications once 999.3 push ships.
