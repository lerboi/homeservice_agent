---
phase: 13-frontend-public-pages-redesign
plan: 03
subsystem: ui
tags: [auth, dark-theme, tailwind, next-js, supabase, otp, split-layout]

# Dependency graph
requires:
  - 13-01 (Tailwind dark tokens, shared dark palette established)
provides:
  - Auth page with three differentiated layout branches: signup (split), signin (compact), OTP (centered dark card)
  - OtpInput dark-restyled with copper focus border and no ring-offset white gap
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Conditional render branching (mode === 'otp' / mode === 'signin' / default) for structurally distinct layouts from shared state
    - Split layout: left form panel (bg-[#334155]) + right brand panel (hidden lg:flex lg:w-[380px]) within one rounded-2xl container
    - focus:border-[color] + focus:shadow-[0_0_0_3px_rgba(...)] pattern for copper glow without ring-offset white gap on dark backgrounds
    - VocoLogo extracted as local function component to DRY logo across three views

key-files:
  created: []
  modified:
    - src/components/onboarding/OtpInput.js
    - src/app/auth/signin/page.js

# Decisions
decisions:
  - VocoLogo extracted as local function component within auth page — three views share the same logo without prop-drilling or file split
  - handleEmailAuth and handleSignin kept as separate named functions (not a unified handleSubmit) — clearer intent, each form has its own onSubmit handler, matches plan's D-36 handler naming
  - OTP back link points to switchMode('signup') — consistent with existing behavior (OTP is triggered from signup flow)
  - Input focus glow uses focus:shadow-[0_0_0_3px_rgba(194,65,12,0.2)] instead of focus:ring-* to avoid Tailwind ring-offset white gap on dark bg (Pitfall 7 pattern applied consistently across auth and OtpInput)

# Metrics
metrics:
  duration: ~20 minutes
  completed: 2026-03-25
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 13 Plan 03: Auth Page Differentiated Layouts Summary

**One-liner:** Three-branch auth layout — signup split card with brand storytelling, signin compact centered dark card, OTP dark card with copper accents — copper focus system applied consistently across all inputs and OtpInput.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Restyle OtpInput to dark palette | a599ecd | src/components/onboarding/OtpInput.js |
| 2 | Auth page — differentiated signup, signin, and OTP layouts | 92b6656 | src/app/auth/signin/page.js |

## What Was Built

### Task 1: OtpInput dark restyle

OtpInput.js digit boxes updated from light to dark palette per D-35 and Pitfall 7 avoidance:
- `bg-[#0F172A]` (was `bg-white`)
- `text-[#F1F5F9]` (was no explicit text color)
- `border border-white/[0.12]` at rest (was `border-stone-200`)
- `focus:border-[#C2410C] focus:ring-1 focus:ring-[#C2410C]/30` (was `focus:ring-2 focus:ring-[#C2410C] focus:ring-offset-1`)
- `focus:ring-offset` removed entirely — eliminates white ring gap on dark backgrounds

All behavior preserved: useRef, handleChange, handleKeyDown, handlePaste, focus navigation.

### Task 2: Auth page differentiated layouts

Replaced the single tab-toggle layout with three conditional render branches:

**Signup view (default):** Split layout — left form panel in `bg-[#334155]`, right brand panel `hidden lg:flex lg:w-[380px] xl:w-[420px] bg-[#0F172A]`. Brand panel has copper radial glow blobs, SELLING_POINTS chips, and social proof strip. Form has Google OAuth, email+password, copper submit. Toggle link: "Already have an account? Sign in".

**Signin view:** Compact centered card `max-w-[400px] bg-[#1E293B]` on `bg-[#0F172A]` page. Contains logo, "Welcome back" heading, Google OAuth, email+password form, copper submit. No brand panel, no selling points. Toggle link: "Don't have an account? Get started".

**OTP view:** Centered card `max-w-[400px] bg-[#1E293B]` on `bg-[#0F172A]` page. Copper Mail icon (lucide-react), "Check your email" heading, email display, dark-styled OtpInput, resend button with cooldown, back link.

All auth handlers preserved: handleGoogleOAuth, handleEmailAuth, handleSignin, handleVerifyOtp, handleResendOtp. No AnimatePresence or Framer Motion transitions (D-22).

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Minor adaptations (within Claude's discretion per D-34):

- Renamed `handleResendCode` → `handleResendOtp` to match plan's `handleResendOtp` naming consistently (the original file had `handleResendCode` — this is a naming alignment, not a behavior change)
- Renamed `handleSubmit` → `handleEmailAuth` (signup) and added `handleSignin` as separate named function — both were combined in original `handleSubmit`. Clarifies intent per plan structure.
- VocoLogo extracted as local component to avoid repeating the logo JSX across three views.

## Known Stubs

None. All views render real data:
- Email from state, password from state — wired to real supabase auth handlers
- SELLING_POINTS renders actual feature text (existing data, not placeholder)
- Social proof: "500+" is existing copy from the original implementation

## Self-Check: PASSED

- FOUND: src/components/onboarding/OtpInput.js
- FOUND: src/app/auth/signin/page.js
- FOUND: .planning/phases/13-frontend-public-pages-redesign/13-03-SUMMARY.md
- FOUND commit: a599ecd (Task 1)
- FOUND commit: 92b6656 (Task 2)
