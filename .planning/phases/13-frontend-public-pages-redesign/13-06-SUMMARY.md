---
phase: 13-frontend-public-pages-redesign
plan: "06"
subsystem: auth-ui
tags: [auth, color-scheme, ui, contrast, light-dark]
dependency_graph:
  requires: [13-03]
  provides: [auth-page-light-dark-contrast]
  affects: []
tech_stack:
  added: []
  patterns: [light-dark-split-layout, white-card-on-light-bg, stone-color-scale]
key_files:
  created: []
  modified:
    - src/app/auth/signin/page.js
    - src/components/onboarding/OtpInput.js
decisions:
  - "Auth signup left panel changed to bg-white per user override of D-31 — #334155 was dark-on-dark, not the intended contrast"
  - "All three auth views (signup, signin, OTP) use #F1F5F9 page bg — lighter, consistent treatment"
  - "OtpInput digit boxes use bg-stone-50 + border-stone-300 for light card context — copper focus ring preserved"
metrics:
  duration_minutes: 10
  completed_date: "2026-03-25"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 13 Plan 06: Auth Page Color Redo Summary

**One-liner:** Auth page redesigned from dark-on-dark to clean white/dark split — white left form panel, dark right brand panel, #F1F5F9 page background across all three views.

## What Was Built

Complete color scheme redo of the auth page to fix a "horrendous" dark-on-dark contrast problem. The previous implementation had a slate-700 (#334155) left panel against a dark right panel — both panels read as dark, eliminating the intended visual contrast.

**Changes made:**

### src/app/auth/signin/page.js

- Page background: `bg-[#0F172A]` → `bg-[#F1F5F9]` across all three views (signup, signin, OTP)
- Signup left panel: `bg-[#334155]` → `bg-white` (user override of D-31)
- Signin card: `bg-[#1E293B]` → `bg-white shadow-2xl`
- OTP card: `bg-[#1E293B]` → `bg-white shadow-2xl`
- Card container: added `shadow-2xl` on signup split view
- VocoLogo default textColor: `text-[#F1F5F9]` → `text-[#0F172A]`
- All headings: dark text `text-[#0F172A]` on white panels
- All body/subtext: `text-[#94A3B8]` → `text-[#475569]`
- Inputs: `bg-[#1E293B] border-white/[0.12] text-[#F1F5F9]` → `bg-white border-stone-300 text-[#0F172A]`
- Google OAuth buttons: dark outline → light treatment (`bg-white border-stone-200 shadow-sm`)
- Dividers: `border-white/[0.08]` → `border-stone-200`
- Right brand panel: **preserved unchanged** — `bg-[#0F172A]` dark for intentional light/dark split
- All auth handlers preserved exactly (handleGoogleOAuth, handleEmailAuth, handleSignin, handleVerifyOtp, handleResendOtp, setCooldown)

### src/components/onboarding/OtpInput.js

- Digit box background: `bg-[#0F172A]` → `bg-stone-50`
- Digit text: `text-[#F1F5F9]` → `text-[#0F172A]`
- Border at rest: `border border-white/[0.12]` → `border border-stone-300`
- Focus ring: `focus:ring-1 focus:ring-[#C2410C]/30` → `focus:ring-2 focus:ring-[#C2410C]/20`
- Focus border: `focus:border-[#C2410C]` preserved (copper brand accent)
- All behavior preserved: handleChange, handleKeyDown, handlePaste, focus navigation

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 36f08ac | feat(13-06): redo auth page — white left panel, #F1F5F9 bg, clean light/dark contrast |
| 2 | 9354684 | feat(13-06): update OtpInput styling for white card context |

## Deviations from Plan

None — plan executed exactly as written. The user override of D-31 (bg-white instead of bg-[#334155]) was already captured in the plan task spec.

## Known Stubs

None. All UI elements display real data. The social proof section (avatar initials + "500+ home service businesses") is intentional placeholder marketing copy, not a data stub — it does not block the plan's auth functionality goal.

## Verification Results

- `bg-white` count in page.js: 10 (signup panel, signin card, OTP card, inputs, Google buttons)
- `bg-[#334155]` count in page.js: 0 (old dark panel fully removed)
- `bg-[#F1F5F9]` count in page.js: 3 (one per view)
- `shadow-2xl` count in page.js: 3 (card containers across all views)
- `supabase.auth` count in page.js: 6 (all 5 auth methods + signUp)
- OtpInput `bg-[#0F172A]`: 0 (old dark bg removed)
- Build: passes with zero errors

## Self-Check: PASSED
