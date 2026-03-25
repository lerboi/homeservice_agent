---
status: partial
phase: 20-dashboard-ux-overhaul
source: [20-VERIFICATION.md]
started: 2026-03-26T00:00:00Z
updated: 2026-03-26T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Joyride Tour Functional Launch
expected: Run `npm run dev`, navigate to `/dashboard`, click "Take a quick tour" — Joyride spotlight appears with orange overlay (#C2410C), 5 steps advance correctly, "Got it" on final step, "Skip tour" visible, localStorage `gsd_has_seen_tour` set after completion
result: [pending]

### 2. Mobile Bottom Tab Bar Layout
expected: Open dashboard at viewport < 1024px — bottom tab bar visible with 5 tabs, hamburger absent, content scrolls without being obscured (72px clearance)
result: [pending]

### 3. Setup Mode vs Active Mode Transition
expected: Log in as user with all 4 required checklist items complete — dashboard shows active mode (hero metric, action-required, this-week, activity) not setup mode
result: [pending]

### 4. More Sub-pages Feature Parity
expected: `/dashboard/more/services-pricing` drag-reorder works; `/dashboard/more/working-hours` edit+save works; `/dashboard/more/ai-voice-settings` shows phone number and test call button
result: [pending]

### 5. SETUP-05: 30-Second Comprehension
expected: Non-technical user identifies all 5 main sections (Home, Leads, Calendar, Analytics, More) and their purpose within 30 seconds
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
