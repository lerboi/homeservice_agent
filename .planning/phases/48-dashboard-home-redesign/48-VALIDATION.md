---
phase: 48
slug: dashboard-home-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 48 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Pre-populated by the planner before execution; execution updates only the `Status` column of the Per-Task Verification Map + `nyquist_compliant` + `Approval` on Wave 0 close.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (node environment) — per 48-RESEARCH.md Validation Architecture |
| **Config file** | `jest.config.js` (existing; no changes required) |
| **Quick run command** | `npx jest --testPathPattern='tests/unit' --no-coverage` |
| **Full suite command** | `npx jest --testPathIgnorePatterns='integration' --no-coverage` |
| **Estimated runtime** | ~15 seconds (RESEARCH-confirmed) |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern='tests/unit' --no-coverage`
- **After every plan wave:** Run `npx jest --testPathIgnorePatterns='integration' --no-coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** < 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 48-01-01 | 01 | 1 | HOME-01, HOME-02, HOME-03, HOME-04, HOME-05, HOME-06, HOME-07 | — | Wave-0 RED scaffolds lock test IDs for all 7 HOME-XX suites | unit (scaffold) | `npx jest --testPathPattern="tests/unit/(setup-checklist-derive\|usage-api\|setup-checklist\.test\|usage-tile\|chat-provider\|chat-panel\|help-discoverability)" --no-coverage 2>&1 \| tail -20` | ✅ | ❌ red (intentional — Wave 0) |
| 48-01-02 | 01 | 1 | HOME-03 | T-48-04 | Migration 050 adds JSONB column with default `{}`; no RLS change | static | `test -f supabase/migrations/050_checklist_overrides.sql && grep -q "ADD COLUMN IF NOT EXISTS checklist_overrides JSONB" supabase/migrations/050_checklist_overrides.sql && grep -q "DEFAULT '{}'::jsonb" supabase/migrations/050_checklist_overrides.sql` | ✅ | ✅ green |
| 48-01-03 | 01 | 1 | HOME-03 | T-48-04 | Schema applied to live DB so Task 4 reads/writes do not 500 | manual (checkpoint) | `echo "Manual verification: run 'supabase db execute --query \"SELECT column_name FROM information_schema.columns WHERE table_name='tenants' AND column_name='checklist_overrides';\"' and confirm column is present"` | ✅ | ⬜ pending |
| 48-01-04 | 01 | 1 | HOME-02, HOME-03 | T-48-01, T-48-02, T-48-03, T-48-06 | zod-validated PATCH body; `getTenantId()` scoping; 401 on unauth; 404 on no subscription | unit | `npx jest --testPathPattern="tests/unit/(setup-checklist-derive\|usage-api)" --no-coverage 2>&1 \| tail -10` | ✅ | ⬜ pending |
| 48-02-01 | 02 | 1 | HOME-05 | T-48-07, T-48-08 | ChatProvider mounts only inside authed layout; ChatMessage sanitization inherited | unit | `npx jest tests/unit/chat-provider.test.js --no-coverage` | ✅ | ⬜ pending |
| 48-02-02 | 02 | 1 | HOME-05 | T-48-09 | Context wrapped inside dashboard layout only; unauthenticated users never mount it | unit | `npx jest tests/unit/chat-provider.test.js --no-coverage && grep -q "useChatContext" src/components/dashboard/ChatbotSheet.jsx && grep -c "const \[messages," src/components/dashboard/ChatbotSheet.jsx \| grep -q "^0$" && grep -q "<ChatProvider currentRoute={pathname}" src/app/dashboard/layout.js` | ✅ | ⬜ pending |
| 48-03-01 | 03 | 2 | HOME-01 | T-48-10 | Row renders only item IDs returned by server; aria-labels on all icon buttons; ≥44px touch targets | static | `grep -q "aria-label" src/components/dashboard/ChecklistItem.jsx && grep -q "min-h-\[44px\]" src/components/dashboard/ChecklistItem.jsx && grep -q "onMarkDone" src/components/dashboard/ChecklistItem.jsx && grep -q "onDismiss" src/components/dashboard/ChecklistItem.jsx` | ✅ | ⬜ pending |
| 48-03-02 | 03 | 2 | HOME-01, HOME-03 | T-48-10, T-48-11, T-48-12 | PATCH bodies derived from server item IDs only; SWR dedupe caps clickstorm; tenant-scoped GET | unit | `npx jest tests/unit/setup-checklist.test.js --no-coverage` | ✅ | ⬜ pending |
| 48-04-01 | 04 | 2 | HOME-02 | — | `usageThresholdClass` helper has pure deterministic branches for 3 thresholds | unit | `npx jest tests/unit/usage-tile.test.js --no-coverage` | ✅ | ⬜ pending |
| 48-04-02 | 04 | 2 | HOME-02 | T-48-13, T-48-14 | Tenant-scoped reads; React-escaped text renders; no `dangerouslySetInnerHTML` | static | `grep -q "View full schedule" src/components/dashboard/TodayAppointmentsTile.jsx && grep -q "View all calls" src/components/dashboard/CallsTile.jsx && grep -q "View all leads" src/components/dashboard/HotLeadsTile.jsx && grep -q "Missed" src/components/dashboard/CallsTile.jsx && grep -q "Nothing booked today" src/components/dashboard/TodayAppointmentsTile.jsx` | ✅ | ⬜ pending |
| 48-04-03 | 04 | 2 | HOME-02 | T-48-15 | Bento grid is pure layout; 4 parallel fetches already SWR-deduped | static | `test -f src/components/dashboard/DailyOpsHub.jsx && grep -q "md:grid-cols-2" src/components/dashboard/DailyOpsHub.jsx && grep -q "md:col-span-2" src/components/dashboard/DailyOpsHub.jsx` | ✅ | ⬜ pending |
| 48-05-01 | 05 | 3 | HOME-04, HOME-05, HOME-06 | T-48-16, T-48-18 | Context-only message rendering; hardcoded help hrefs; ChatMessage sanitization inherited | unit | `npx jest tests/unit/chat-panel.test.js tests/unit/help-discoverability.test.js --no-coverage` | ✅ | ⬜ pending |
| 48-05-02 | 05 | 3 | HOME-04, HOME-05, HOME-06, HOME-07 | T-48-17, T-48-19 | No inline missed-calls alert / Invoices card / setupMode; `position: sticky` adds no JS listeners | static + unit | `grep -q "DailyOpsHub" src/app/dashboard/page.js && grep -q "ChatPanel" src/app/dashboard/page.js && grep -q "HelpDiscoverabilityCard" src/app/dashboard/page.js && grep -q "SetupChecklist" src/app/dashboard/page.js && grep -q "RecentActivityFeed" src/app/dashboard/page.js && ! grep -q "Invoices" src/app/dashboard/page.js && ! grep -q "REQUIRED_IDS" src/app/dashboard/page.js && ! grep -q "setupMode" src/app/dashboard/page.js && npx jest --testPathPattern="tests/unit/(setup-checklist\|usage\|chat-provider\|chat-panel\|help-discoverability)" --no-coverage` | ✅ | ⬜ pending |
| 48-05-03 | 05 | 3 | HOME-07, HOME-05 | — | See Manual-Only Verifications table below | manual (checkpoint) | `grep -q "nyquist_compliant: true" .planning/phases/48-dashboard-home-redesign/48-VALIDATION.md && grep -q "Approval: approved" .planning/phases/48-dashboard-home-redesign/48-VALIDATION.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · `File Exists` ✅ = file pre-exists at task start, `❌ W0` = created by Wave-0 Plan 48-01 Task 1*

---

## Wave 0 Requirements

Plan 48-01 Task 1 creates these 7 RED test scaffolds BEFORE any implementation runs. They lock test IDs + command paths so the rest of Phase 48 has a stable verification surface.

- [ ] `tests/unit/setup-checklist-derive.test.js` — covers HOME-03 (`deriveChecklistItems` pure function)
- [ ] `tests/unit/usage-api.test.js` — covers HOME-02 (`/api/usage` computation — callsUsed, callsIncluded, cycleDaysLeft, overageDollars)
- [ ] `tests/unit/setup-checklist.test.js` — covers HOME-01 (theme accordions render + Dismiss/Mark done PATCH bodies)
- [ ] `tests/unit/usage-tile.test.js` — covers HOME-02 (threshold color logic: copper <75%, amber 75–99%, red ≥100%)
- [ ] `tests/unit/chat-provider.test.js` — covers HOME-05 (context sharing + `currentRoute` forwarding)
- [ ] `tests/unit/chat-panel.test.js` — covers HOME-04 (ChatPanel renders messages + sends via context)
- [ ] `tests/unit/help-discoverability.test.js` — covers HOME-06 (3–4 tiles with `/dashboard/*` hrefs + verb+noun labels)

Framework: Jest is already installed per `jest.config.js` + existing `tests/unit/chat-message-parse.test.js` / `tests/unit/chatbot-knowledge.test.js`. No framework install required.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No horizontal scroll at 375px viewport | HOME-07 | Layout overflow at a specific viewport width is inherently visual; automated headless-DOM checks cannot substitute for a real browser rendering pass | Open Chrome DevTools → Device Toolbar → 375x667. Scroll the dashboard home end-to-end. Confirm no horizontal scrollbar appears and no card overflows viewport. Captured at Plan 48-05 Task 3 checkpoint. |
| Cross-entry-point chat history sharing | HOME-05 | Confirming "messages sent in ChatPanel appear in ChatbotSheet and vice-versa" exercises a user-driven navigation flow (open sheet → send → close → read in panel → navigate → reopen) that synthetic tests only approximate | Plan 48-05 Task 3 checkpoint step 4: send "test 1" in ChatPanel on `/dashboard`, open ChatbotSheet and confirm visible; send "test 2" in ChatbotSheet, close, confirm visible in ChatPanel; navigate to `/dashboard/leads`, open ChatbotSheet, confirm history intact. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (scaffolds referenced in Wave 0 Requirements)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (verified — every task row has a command)
- [ ] Wave 0 covers all MISSING references (7 scaffolds above)
- [ ] No watch-mode flags (all commands use `--no-coverage`; no `--watch`)
- [ ] Feedback latency < 20s (Jest full suite ~15s per RESEARCH)
- [ ] `nyquist_compliant: true` set in frontmatter (flips to true at Plan 48-05 Task 3 checkpoint close)

**Approval:** pending
