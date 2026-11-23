---
type: system
system: Onboarding
status: record
description: "The former onboarding-flow skill's scope statement, preamble and running 'last updated' change history. Read only when you need to know when or why something changed."
source: ".claude/skills/onboarding-flow/SKILL.md § frontmatter description + preamble"
migrated: 2026-11-23
verified:
tags: [voco/system/onboarding]
---

# Scope and change history

Part of [[Onboarding]]. Migrated verbatim from the `onboarding-flow` skill.

## Scope: what the former skill covered

Complete architectural reference for the onboarding wizard — 4-step signup flow (profile, services, contact details, checkout), all onboarding API routes, country-aware phone number provisioning (SG inventory via RPC, US/CA via Twilio API + SIP trunk association), trade templates, Stripe Checkout Session, session persistence, and middleware auth guards. Test call functionality (LiveKit SIP) lives post-payment in dashboard settings, not in the wizard. Use this skill whenever making changes to the onboarding wizard, signup flow, phone provisioning, trade templates, billing checkout, or wizard session management. Also use when the user asks about how onboarding works, wants to modify wizard steps, or needs to debug provisioning or OTP issues.

## Preamble and change history

## Onboarding Flow — Complete Reference

This document is the single source of truth for the onboarding wizard system. Read this before making any changes to onboarding pages, wizard session management, or provisioning routes.

**Last updated**: 2026-08-13 (Owner phone made **COMPULSORY** in the contact step: the "(optional)" label is gone and `validate()` on the contact page rejects an empty phone ("Please enter your phone number."); `sms-confirm` now 400s when the phone is missing (previously `owner_phone` was only saved "if provided") — `owner_name`/`country` remain individually optional server-side. Rationale: SMS notifications, escalation calls, and the test call all deliver to `owner_phone`. No DB constraint added — existing tenants (4 of 6 live rows) have NULL `owner_phone` and the step-1 upsert creates the tenant row before the contact step. Known residual: a deep-link straight to `/onboarding/checkout` still bypasses the contact step entirely — same pre-existing gap as `country`; `checkout-session` deliberately tolerates it.)

**Earlier (2026-06-26)** (Dark-mode + back-nav + checkout-robustness fix wave: (1) **white-on-white inputs in dark mode** — onboarding is a light-only surface but dark mode is class-based (`.dark` on `<html>`, persisted from the dashboard theme toggle), so inputs with no explicit text color inherited the dark `--foreground` over the hardcoded white card. Fixed by a `[data-onboarding-root]` block in `globals.css` that re-pins the LIGHT token set (`--foreground`, `--input`, `--ring`, `--primary`, etc.) + `color-scheme: light`, with `data-onboarding-root` on the layout's outer div. Caveat: the country `<Select>`'s dropdown is portaled to `document.body` (outside the root) so it stays dark-themed but readable. (2) **stuck Continue spinner after Back** — steps 1/2/3 set `loading=true` then `router.push()` on success without resetting it; on Back the step reappeared with the stale flag (button disabled + spinning). New hook `src/hooks/useClearLoadingOnPageRestore.js` resets the flag on mount + `pageshow` + `popstate`, wired into all three steps. (3) **sign-out button** added to the layout header (icon + i18n label `sign_out`/`signing_out`, `aria-label`, `supabase.auth.signOut()` → `window.location.href='/auth/signin'`). (4) **`sg-availability` DB error no longer reads as sold-out** — route returns `{available_count:null}`+503 (not 0) + `await connection()`; the contact page treats a failed check as UNKNOWN (no waitlist, no Continue block). (5) **checkout robustness** — `fetchClientSecret` failures (incl. 409 already-subscribed) now show a recovery screen instead of a blank Stripe iframe; verify-poll has unmount-cancel + concurrency guards; success countdown resets + pluralizes. (6) **signin open-redirect** hardened (`redirect` param validated `startsWith('/') && !startsWith('//')`). (7) `checkout-session` `customer_email` falls back to `user.email`. Signin itself is NOT affected by the white-on-white bug — it hardcodes `text-[#0F172A] bg-white` on every input.)

**Earlier (2026-06-13)** (Onboarding-audit fix wave: DB rehydration via new `GET /api/onboarding/state` + page hydration effects; contact step reordered country→phone, phone no longer wiped on country change, empty phone no longer saved as bare prefix; `sms-confirm` validates E.164, sets `tenant_timezone` (SG pinned to Asia/Singapore, US/CA from browser-detected IANA zone), distinguishes 503 count-errors from 409 sold-out, and 400s when no tenant row exists; `/start` validates business_name/trade_type/services (min 1, max 50, urgency enum); checkout verify polling extended to ~3 min two-stage with a retry button on the error phase, success screen shows the provisioned number (10s countdown); checkout webhook seeds default working_hours + timezone backstop, provisioning is idempotent (SG inventory reuse + Twilio friendlyName tag `voco-tenant-{id}` reuse), sends an idempotent WelcomeEmail with the number, and dedupes the provisioning-failure email via billing_notifications. proxy.js rescues paid-but-unflagged users hitting /dashboard.)

---
