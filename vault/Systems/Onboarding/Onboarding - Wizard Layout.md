---
type: system
system: Onboarding
status: legacy-app
description: "File: src/app/onboarding/layout.js"
source: .claude/skills/onboarding-flow/SKILL.md § 1. Wizard Layout
migrated: 2026-11-23
verified:
tags: [voco/system/onboarding]
---

# Wizard Layout

Part of [[Onboarding]]. Migrated verbatim from the `onboarding-flow` skill; check `verified` before trusting details.

**File**: `src/app/onboarding/layout.js`

`OnboardingLayout({ children })` — wraps everything in `OnboardingProvider`
(`./OnboardingContext`, which exposes `{ completed, markComplete }`; checkout's
success phase calls `markComplete()` so the `StepIndicator` flips all dots to
done). The inner `OnboardingLayoutInner`:
- Outer div carries **`data-onboarding-root`** — see the light-mode pin below.
- Logo link to `/`
- `StepIndicator` (icon dots, NOT a "Step X of 4" text counter): 4 lucide icons
  (Briefcase/Wrench/UserCircle/CreditCard) with connector lines; done = emerald
  check, current = copper ring, future = stone. `getStep(pathname)` maps path → 1–4.
- **Sign-out button** (right cluster, next to `StepIndicator`): `LogOut` icon +
  i18n label (`t('sign_out')` / `t('signing_out')`, hidden `<sm`), `aria-label`,
  `signingOut` state; `supabase.auth.signOut()` → `window.location.href='/auth/signin'`.
- White wizard card: `bg-white rounded-2xl shadow-[...] border border-stone-200/60`,
  wrapped in `<AnimatedSection>`.
- Mobile: full-width flat card (`max-sm:rounded-none max-sm:shadow-none max-sm:border-none`).

**Light-mode pin (dark-mode fix, 2026-06-26)**: dark mode is class-based
(`.dark` on `<html>`, persisted from the dashboard theme toggle) and onboarding
is a deliberately light-only surface (hardcoded `bg-white` card, `text-[#0F172A]`
headings). Form controls with no explicit text color (shadcn `<Input>`, the raw
phone `<input>`) inherit `--foreground`, which `.dark` flips to white → white text
on the white card. `globals.css` re-pins the light token set on
`[data-onboarding-root]` (`color-scheme: light` + `--foreground`/`--input`/`--ring`/
`--primary`/... = their `:root` light values), so the wizard always renders light.
The closer ancestor wins for inherited custom properties, so this overrides the
`.dark` on `<html>` for the subtree. **Known limit**: the country `<Select>`
dropdown is portaled to `document.body` (outside the root) and stays dark-themed
(readable, just inconsistent) — fix would need a portal `container` or a
light-forcing wrapper on `SelectContent`.

**Stuck-spinner guard (2026-06-26)**: steps 1/2/3 call
`useClearLoadingOnPageRestore(setLoading)` (`src/hooks/useClearLoadingOnPageRestore.js`)
— resets the nav `loading` flag on mount + `pageshow` + `popstate`. Without it, a
step that did `setLoading(true)` then `router.push()` on success reappears on Back
with the stale flag, leaving Continue disabled + spinning. Step 4 (checkout) uses a
`phase` state machine instead and is not wired.

Pathname → step mapping:
- `/onboarding` (profile) → Step 1
- `/onboarding/services` → Step 2
- `/onboarding/contact` (contact details) → Step 3
- `/onboarding/checkout` → Step 4

---
