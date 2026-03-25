---
phase: 19-codebase-skill-files
plan: 02
subsystem: skill-files
tags: [skill-files, dashboard, crm, onboarding, documentation, architecture]
dependency_graph:
  requires: []
  provides:
    - dashboard-crm-system skill file
    - onboarding-flow skill file
  affects:
    - .claude/skills/dashboard-crm-system/SKILL.md
    - .claude/skills/onboarding-flow/SKILL.md
tech_stack:
  added: []
  patterns:
    - Skill file structure from voice-call-architecture template
    - Progressive disclosure architecture reference (~400-550 lines per skill)
key_files:
  created:
    - .claude/skills/dashboard-crm-system/SKILL.md
    - .claude/skills/onboarding-flow/SKILL.md
  modified: []
decisions:
  - "dashboard-crm-system skill covers all 25 source files across pages, components, API routes, DB migrations, and design system"
  - "onboarding-flow skill covers all 24 source files across wizard pages, components, hooks, API routes, and middleware"
  - "Both skills cross-reference each other for design-tokens.js sharing"
metrics:
  duration_minutes: 25
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_created: 2
---

# Phase 19 Plan 02: Dashboard CRM System and Onboarding Flow Skill Files Summary

Two new skill files providing complete architectural references for the dashboard/CRM and onboarding systems — enabling AI and developers to understand and modify either system from a single document.

---

## What Was Built

### Task 1: dashboard-crm-system SKILL.md (537 lines)

Complete reference for the dashboard and CRM system covering:
- 13 sections: Architecture Overview, File Map (25 files), Dashboard Layout, Lead Lifecycle, Dashboard Pages, CRM Components, Design Tokens, Supabase Realtime, API Routes, Database Tables, Environment Variables, Key Design Decisions, Maintenance reminder
- Actual function signatures: `createOrMergeLead({ tenantId, callId, fromNumber, ... })`, `getLeads({ tenantId, status, urgency, ... })`
- Component props documented: `LeadFlyout({ leadId, open, onOpenChange, onStatusChange })`, `KanbanBoard({ leads, onViewLead })`, `AnalyticsCharts({ leads, loading })`, `CalendarView({ appointments, externalEvents, travelBuffers, currentDate, viewMode, loading, onAppointmentClick })`
- 10 key design decisions with WHY explanations (REPLICA IDENTITY FULL, transcript_text exclusion, repeat caller merge logic, LeadFlyout stacking context, SortableContactWrapper pattern, PATCH reorder tenant_id, etc.)

### Task 2: onboarding-flow SKILL.md (446 lines)

Complete reference for the onboarding wizard covering:
- 10 sections: Architecture Overview (wizard flow diagram), File Map (24 files), Wizard Steps (detailed per step), Onboarding Components, Session Management, API Routes, Trade Templates, Middleware Auth Guards, Database Tables, Key Design Decisions
- All API routes documented with request/response shapes
- Session hook internals: `gsd_onboarding_` prefix, `clearWizardSession()` implementation
- 11 key design decisions with WHY explanations (shouldCreateUser:false, OTP useState toggle, two sequential POSTs, webhook onboarding_complete timing, CelebrationOverlay accessibility, etc.)

---

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | e81e18e | feat(19-02): create dashboard-crm-system skill file |
| 2 | 4b64939 | feat(19-02): create onboarding-flow skill file |

---

## Deviations from Plan

### Structural Adjustments

**1. [Rule 1 - Clarification] Onboarding step numbering**
- **Found during:** Task 2 research
- **Issue:** Plan described "7-step wizard" but the actual layout tracks 4 steps. The auth step is at `/auth/signin` (outside wizard layout), `profile/page.js` and `verify/page.js` are redirects (legacy URL compatibility)
- **Fix:** Documented the actual 4-step wizard (per layout.js `TOTAL_STEPS = 4`) with accurate step mapping. Noted auth separately as the pre-wizard step.
- **Impact:** None — skill file accurately reflects actual code

**2. [Rule 1 - Clarification] `onboarding/page.js` is Step 2 (Profile), not a separate Step 1**
- **Found during:** Task 2 source file reading
- **Issue:** Plan referred to `src/app/onboarding/page.js` as the auth/OTP page, but it's actually the profile (trade + business name) step. Auth is at `/auth/signin`
- **Fix:** Documented correct step assignment and cross-referenced `/auth/signin` as Step 1

---

## Known Stubs

None — skill files are documentation, no stubs applicable.

---

## Self-Check: PASSED

Files verified:
- `.claude/skills/dashboard-crm-system/SKILL.md` — EXISTS (537 lines)
- `.claude/skills/onboarding-flow/SKILL.md` — EXISTS (446 lines)

Commits verified:
- e81e18e — FOUND
- 4b64939 — FOUND
