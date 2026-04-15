# Phase 49 — Manual Verification Checklist

Completed as part of Task 4 (checkpoint:human-verify) after Tasks 1–3 land.

## How to Use

1. Start dev server: `npm run dev`
2. Navigate to `/dashboard`
3. Click the theme toggle (between Ask Voco AI and Log Out in sidebar)
4. Fill in PASS/FAIL for each row
5. Sign off by typing "approved" in the execution thread

---

## Surface Checklist

| Surface | Light PASS/FAIL | Dark PASS/FAIL | Notes |
|---------|-----------------|----------------|-------|
| **Layout Shell — Sidebar** (navy preserved, toggle renders, Ask Voco AI above, Log Out below) | | | Sidebar stays navy in both modes — intentional |
| **Layout Shell — Top Bar / Glass** (bg-card/80 backdrop-blur in dark mode) | | | |
| **Layout Shell — Main Background** (bg-background flips light↔dark) | | | |
| **Layout Shell — Bottom Tab Bar** (mobile, 375px viewport) | | | |
| **Banner — Impersonation** (amber sticky, readable in dark) | | | |
| **Banner — TrialCountdown** (blue/amber countdown, readable in dark) | | | |
| **Banner — BillingWarning** (amber past_due, readable in dark) | | | |
| **Flyout — Lead Flyout** (leads page lead detail panel) | | | |
| **Flyout — Appointment Flyout** (calendar quick-view panel) | | | |
| **Flyout — QuickBook Flyout** (book appointment from lead card) | | | |
| **Flyout — Chatbot Sheet** (Ask Voco AI chat panel) | | | |
| **LeadStatusPills — new** (blue pill) | | | |
| **LeadStatusPills — contacted** (yellow pill) | | | |
| **LeadStatusPills — booked** (green pill) | | | |
| **LeadStatusPills — completed** (gray pill) | | | |
| **LeadStatusPills — paid** (dark green pill) | | | |
| **BookingStatusBadge** (pending/confirmed/cancelled states) | | | |
| **EstimateStatusBadge** (draft/sent/approved/declined/expired states) | | | |
| **SetupChecklist** (accordion theme cards, undo toast) | | | |
| **DashboardTour** (guided tour overlay steps) | | | |
| **CommandPalette** (keyboard shortcut search overlay) | | | |

---

## Perception Checks

| Check | PASS/FAIL | Notes |
|-------|-----------|-------|
| **150ms body fade feel** — body background crossfades smoothly over ~150ms on toggle click | | |
| **No flash on hard reload (cmd+shift+R x5)** — zero flash of light content when dark mode is persisted | | |
| **localStorage persistence across tab close** — reopening /dashboard shows the last-selected theme | | |
| **Cross-tab sync** — toggling in one tab updates another tab | | |
| **Theme key in localStorage** — DevTools > Application > Local Storage shows key `theme` = `light` or `dark` | | |
| **Tooltip on hover** — hovering the toggle shows "Switch to {target} mode" tooltip to the right | | |
| **Keyboard focus ring** — Tab key focus on toggle shows orange ring visible against navy sidebar | | |
| **axe DevTools AA on /dashboard/leads in dark** — no critical color-contrast violations | | |
| **375px viewport in both modes** — layout readable on mobile in light and dark | | |

---

## Sign-off

Signed by: ___________________  
Date: ___________________  
Status: PENDING
