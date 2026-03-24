# Phase 7: Unified Signup and Onboarding Wizard - Research

**Researched:** 2026-03-22
**Domain:** Next.js multi-step wizard, Supabase Auth OTP, sessionStorage persistence, test call polling
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Wizard step sequence — 5 steps, URL-routed at `/onboarding/*`:**
- Step 1 (`/onboarding`): Create Account — Google OAuth button + email/password with OTP verification
- Step 2 (`/onboarding/profile`): Business Profile — trade type selection + business name + tone preset (combined step)
- Step 3 (`/onboarding/services`): Services — pre-populated from trade template, editable
- Step 4 (`/onboarding/contact`): Contact Details — owner phone + email for notifications
- Step 5 (`/onboarding/test-call`): Test Call Finale — display AI phone number, trigger test call, wait for completion
- Each step is its own page component under the shared `/onboarding/layout.js`
- Progress bar in layout reads pathname to determine current step (existing pattern, updated to 5 steps)
- `/auth/signin` redirects to `/onboarding` — single entry point

**Auth placement and methods:**
- Auth is step 1 — account creation before any business configuration
- Three auth methods: Google OAuth, email+password with OTP verification, and sign-in link for existing users
- Google OAuth users skip email verification entirely (already verified)
- Email+password users get immediate OTP verification after signup (Supabase `signInWithOtp` / `verifyOtp`)

**Email verification (OTP inline):**
- After email+password signup, step 1 transforms in-place to show OTP input
- 6-digit code sent to email via Supabase native email OTP
- "Enter the code we sent to owner@example.com" with `[_ _ _ _ _ _]` input
- Resend code link available
- On successful verification, auto-advance to step 2
- Uses Supabase `signInWithOtp({ email, options: { shouldCreateUser: true } })` and `verifyOtp()`

**Session persistence:**
- sessionStorage for wizard form data (trade type, business name, tone, service edits)
- On page refresh: check Supabase auth session + read sessionStorage to restore state
- If sessionStorage is empty but user is authenticated, detect progress from DB (tenant record) and skip to next incomplete step
- Clear sessionStorage on wizard completion

**Step guards and routing:**
- Steps 2-5 require authenticated session — unauthenticated users redirected to `/onboarding` (step 1)
- Guard enforced via middleware or layout auth check
- Returning user routing:
  - Not logged in → show step 1 (auth)
  - Logged in + `onboarding_complete=true` → redirect to `/dashboard`
  - Logged in + `onboarding_complete=false` → detect progress, skip to next incomplete step

**Test call finale:**
- Step 5 shows the AI phone number prominently
- Two options: "Call My AI Now" button (triggers Retell outbound call to owner's phone from step 4) AND display number for manual dial
- Test call is required — `onboarding_complete` only set to true after a successful test call
- No skip option — user must hear their AI before completing onboarding
- Detection via polling: Step 5 polls `GET /api/onboarding/test-call-status` every 4 seconds
- Retell webhook handler sets `onboarding_complete=true` when test call from this tenant completes
- Step 5 states: Ready → Calling → In Progress → Complete

**Success state:**
- Animated checkmark with celebration animation (confetti particles or radial pulse)
- "Your AI receptionist is live!" heading
- Single "Go to Dashboard" CTA button
- Celebration moment before dashboard transition

### Claude's Discretion
- Exact OTP input component design and auto-focus behavior
- Step guard implementation approach (middleware vs layout-level check)
- sessionStorage key naming and serialization
- Test call polling interval and timeout handling
- Celebration animation implementation (confetti vs radial pulse)
- Step 5 loading/waiting state animations
- Error handling for failed test calls (retry UX)
- Mobile-responsive adaptations within existing onboarding layout
- How to detect wizard progress from tenant record for step-skip logic

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WIZARD-01 | Any CTA (landing, pricing, contact) drops user into a single wizard where account creation is step 1 | All CTA buttons already route to `/onboarding`. Step 1 becomes the auth page. `/auth/signin` redirects to `/onboarding`. |
| WIZARD-02 | Wizard starts with a trade routing question that pre-populates service list and triage rules | TRADE_TEMPLATES already exist in `src/lib/trade-templates.js`. Trade selection already lives in current `onboarding/services/page.js`. It moves to Step 2 (`/onboarding/profile`). |
| WIZARD-03 | Wizard shows progress indicator (step N of M) throughout the flow | `onboarding/layout.js` already implements progress bar with `getStep(pathname)` — needs extension from 3 to 5 steps. |
| WIZARD-04 | Email verification handled inline within the wizard without redirecting to a dead-end page | Supabase `signInWithOtp` + `verifyOtp` enable in-place OTP. Step 1 gains a conditional OTP sub-state. No new route required. |
| WIZARD-05 | Wizard form data persists across page refresh via sessionStorage | sessionStorage read on mount + write on change pattern. Key prefix `gsd_onboarding_` per UI-SPEC. No library needed. |
| WIZARD-06 | Live test call is the wizard finale — user hears their AI receptionist before completing onboarding | `api/onboarding/test-call/route.js` already exists and triggers Retell outbound. Step 5 (`/onboarding/test-call`) is a new page that polls `GET /api/onboarding/test-call-status` (new endpoint needed). |
| WIZARD-07 | Existing users with completed onboarding bypass wizard and go directly to dashboard | Middleware currently blocks unauthenticated users from `/onboarding`. Needs enhancement: if `onboarding_complete=true`, redirect to `/dashboard`. Requires DB lookup in middleware. |
</phase_requirements>

---

## Summary

Phase 7 is a **surgical restructuring** of existing routes and components, not a from-scratch build. The core wizard skeleton already exists in `src/app/onboarding/` — a 3-step URL-routed flow with a shared layout, progress bar, AnimatedSection wrappers, and Heritage Copper design tokens. The task is to extend this to 5 steps by (1) replacing the old step 1 (business name) with a new auth step, (2) combining trade selection + business name + tone into a new `/onboarding/profile` step, (3) keeping services and contact as-is, and (4) replacing the dead-end completion page with an interactive test call finale.

The two genuinely new capabilities are OTP inline verification (Supabase `signInWithOtp`/`verifyOtp` — already in the Supabase client but not yet wired to any UI) and test call status polling (requires a new `GET /api/onboarding/test-call-status` route that reads the `onboarding_complete` flag from the tenant row). All other pieces — Retell outbound call, tenant upsert, sessionStorage, progress bar, middleware auth guard — are either already built or trivial extensions of existing patterns.

The critical routing change is the middleware: it currently redirects unauthenticated users to `/auth/signin`, but after this phase it must (a) allow unauthenticated access to `/onboarding` (step 1 is auth itself) and (b) redirect authenticated users with `onboarding_complete=true` directly to `/dashboard`. This middleware rewrite is the highest-risk change in the phase because it affects all protected routes.

**Primary recommendation:** Plan as 4 waves — (1) new route skeleton + middleware rewrite, (2) step 1 auth + OTP inline, (3) step 2 profile combining, (4) step 5 test call finale + polling endpoint. Keep steps 3 and 4 as near-zero-change migrations to new paths.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | `^0.9.0` (installed) | Server-side auth, middleware session refresh | Required for Next.js App Router cookie-based auth |
| `@supabase/supabase-js` | `^2.99.2` (installed) | Client-side auth: `signInWithOtp`, `verifyOtp`, `signInWithOAuth` | Already used in `supabase-browser.js` |
| `framer-motion` | `^12.38.0` (installed) | AnimatedSection, step transitions, celebration animation | Already used; v12 `initial={false}` pattern for reduced-motion |
| `next` | `^16.1.7` (installed) | App Router, middleware, URL-routed wizard steps | Project foundation |
| `lucide-react` | `^0.577.0` (installed) | Icons throughout wizard (Loader2, CheckCircle, Phone, etc.) | Already used in all onboarding pages |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn components | installed | Button, Input, Label, Alert, Progress, Card | All already installed — do not re-install |
| `retell-sdk` | `^5.9.0` (installed) | Trigger outbound test call | Step 5 "Call My AI Now" via existing route |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native sessionStorage | react-hook-form with persist | Overkill; no new form library dependencies needed |
| Polling every 4s | Supabase Realtime subscription | Polling is simpler, less connection overhead for a one-time flow; Realtime requires `REPLICA IDENTITY FULL` and subscription setup |
| In-place OTP state | Separate `/onboarding/verify-email` route | Separate route causes context loss on navigation; in-place state preserves UX continuity per CONTEXT.md |

**Installation:** No new packages required. All dependencies already installed.

---

## Architecture Patterns

### Existing File Structure (before this phase)
```
src/app/
├── auth/
│   ├── signin/page.js         # Replace with redirect to /onboarding
│   └── callback/route.js      # Keep — update next= default to /onboarding/profile
├── onboarding/
│   ├── layout.js              # Extend: 3→5 steps, new getStep() mapping
│   ├── page.js                # REPLACE: becomes Step 1 (auth)
│   ├── services/page.js       # MIGRATE: becomes Step 3 (same content)
│   ├── verify/page.js         # MIGRATE: becomes Step 4 (same content)
│   └── complete/page.js       # REPLACE: Step 5 (test call finale)
├── api/onboarding/
│   ├── start/route.js         # Extend: add trade_type + business_name in same call
│   ├── sms-confirm/route.js   # Keep as-is (Step 4)
│   ├── test-call/route.js     # Keep as-is (Step 5 trigger)
│   └── test-call-status/      # NEW: polling endpoint
└── middleware.js              # REWRITE: new routing logic
```

### New File Structure (after this phase)
```
src/app/
├── auth/
│   ├── signin/page.js         # Redirect to /onboarding (simple redirect component)
│   └── callback/route.js      # Keep — update default next= to /onboarding/profile
├── onboarding/
│   ├── layout.js              # Updated: 5-step getStep(), progress 20/40/60/80/100
│   ├── page.js                # Step 1: Create Account (Google OAuth + email/password + OTP inline)
│   ├── profile/page.js        # NEW Step 2: Trade selection + Business name + Tone preset
│   ├── services/page.js       # Step 3: Services (near-identical to existing services page)
│   ├── contact/page.js        # NEW Step 4: Contact details (rename from verify/)
│   ├── test-call/page.js      # NEW Step 5: Test call finale with polling
│   └── complete/page.js       # DELETE or redirect to /dashboard (no longer needed)
├── api/onboarding/
│   ├── start/route.js         # Extended: handle combined profile save
│   ├── sms-confirm/route.js   # Keep as-is
│   ├── test-call/route.js     # Keep as-is
│   └── test-call-status/      # NEW GET endpoint
│       └── route.js
└── middleware.js              # Rewritten: allow /onboarding unauthenticated, guard /onboarding/profile+
```

### Pattern 1: Middleware Routing Logic (WIZARD-07)

**What:** Middleware handles three routing cases: (1) unauthenticated on protected steps → step 1, (2) authenticated + onboarding complete → dashboard, (3) authenticated + incomplete → allow through.

**Critical:** `/onboarding` (step 1) must be accessible without auth. Only `/onboarding/profile` and deeper require auth.

**Example:**
```javascript
// src/middleware.js — rewritten
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// Steps 2-5 require auth; step 1 is the auth step itself
const AUTH_REQUIRED_PATHS = [
  '/onboarding/profile',
  '/onboarding/services',
  '/onboarding/contact',
  '/onboarding/test-call',
  '/dashboard',
];

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const isAuthRequired = AUTH_REQUIRED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  // /onboarding (step 1) is public — auth happens here
  const isOnboardingRoot = pathname === '/onboarding';

  if (!isAuthRequired && !isOnboardingRoot) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(/* ... cookie config ... */);
  const { data: { user } } = await supabase.auth.getUser();

  if (isOnboardingRoot && user) {
    // Authenticated user hits step 1 — check if already done
    const { data: tenant } = await supabase
      .from('tenants')
      .select('onboarding_complete')
      .eq('owner_id', user.id)
      .single();

    if (tenant?.onboarding_complete) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    // Incomplete — let through to step 1 (or redirect to next incomplete step)
    return response;
  }

  if (isAuthRequired && !user) {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  // Authenticated on a step — check if onboarding complete (WIZARD-07)
  if (isAuthRequired && user && !pathname.startsWith('/dashboard')) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('onboarding_complete')
      .eq('owner_id', user.id)
      .single();

    if (tenant?.onboarding_complete) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/onboarding/:path*', '/dashboard/:path*'],
};
```

**Warning:** The DB query in middleware adds ~10-50ms latency on every wizard page load. This is acceptable for an onboarding flow (not a hot path) but should NOT be added to dashboard routes without a caching layer.

### Pattern 2: Step 1 — Auth with In-Place OTP Transform

**What:** Single page component with two internal states — `signup` and `otp`. After email+password signup, the form transforms in-place to show the OTP input. No route change.

**Example:**
```javascript
// src/app/onboarding/page.js
'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase-browser';

const STATES = { SIGNUP: 'signup', OTP: 'otp' };

export default function CreateAccountStep() {
  const [phase, setPhase] = useState(STATES.SIGNUP);
  const [email, setEmail] = useState('');

  async function handleEmailSignup(email, password) {
    // Step 1: create account + send OTP simultaneously
    await supabase.auth.signUp({ email, password });
    // Then immediately request OTP
    await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false }, // account already created above
    });
    setEmail(email);
    setPhase(STATES.OTP);
  }

  async function handleVerifyOtp(token) {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (!error) router.push('/onboarding/profile');
  }

  return phase === STATES.OTP
    ? <OtpInput email={email} onVerify={handleVerifyOtp} />
    : <SignupForm onSubmit={handleEmailSignup} onGoogle={handleGoogleSignIn} />;
}
```

**Note on Supabase OTP flow:** `signInWithOtp` with `shouldCreateUser: true` can serve as both signup and OTP trigger in a single call. Alternatively, `signUp` followed by `signInWithOtp` with `shouldCreateUser: false` gives explicit control over the two steps. Confirm which approach is used to avoid duplicate user creation.

### Pattern 3: sessionStorage Persistence (WIZARD-05)

**What:** Write on every meaningful change, read on mount. Key prefix per UI-SPEC: `gsd_onboarding_`.

**Example:**
```javascript
// Custom hook — src/hooks/useWizardSession.js
'use client';
import { useEffect, useState } from 'react';

export function useWizardSession(key, defaultValue) {
  const storageKey = `gsd_onboarding_${key}`;

  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const stored = sessionStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // sessionStorage unavailable (private browsing mode) — degrade gracefully
    }
  }, [value, storageKey]);

  return [value, setValue];
}
```

**Pitfall:** `sessionStorage` is not available during server-side render. Always guard with `typeof window === 'undefined'` or use `useState` initializer + `useEffect`. Never access sessionStorage at module load time.

### Pattern 4: Test Call Status Polling (WIZARD-06)

**What:** Step 5 polls a lightweight endpoint every 4 seconds after triggering the test call. The endpoint reads `onboarding_complete` from the tenant row. Current `test-call/route.js` sets `onboarding_complete=true` atomically when the call is triggered — so polling will immediately return `complete`. This needs revisiting: the CONTEXT.md decision says "Retell webhook handler sets `onboarding_complete=true` when test call completes" — meaning the flag should be set on webhook receipt, not on trigger.

**Conflict to resolve:** Current `api/onboarding/test-call/route.js` sets `onboarding_complete=true` at trigger time (line 34). CONTEXT.md says it should be set by Retell webhook on call completion. The planner must decide: either (a) revert the existing behavior and restore webhook-based completion, or (b) keep trigger-time completion and have the polling endpoint detect it immediately. Option (b) breaks the "user must hear their AI" requirement because the flag is set before the call completes.

**Recommended resolution:** Modify `test-call/route.js` to NOT set `onboarding_complete=true`. Add a new `GET /api/onboarding/test-call-status` route that reads `onboarding_complete` from the DB. The Retell webhook handler (already sets this flag per STATE.md) provides the signal.

```javascript
// src/app/api/onboarding/test-call-status/route.js
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const serverSupabase = await createSupabaseServer();
  const { data: { user } } = await serverSupabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: tenant } = await supabase
    .from('tenants')
    .select('onboarding_complete, retell_phone_number')
    .eq('owner_id', user.id)
    .single();

  return Response.json({
    complete: tenant?.onboarding_complete ?? false,
    retell_phone_number: tenant?.retell_phone_number ?? null,
  });
}
```

```javascript
// Step 5 polling — inside TestCallPanel component
useEffect(() => {
  if (callState !== 'calling' && callState !== 'in_progress') return;

  const interval = setInterval(async () => {
    const res = await fetch('/api/onboarding/test-call-status');
    const data = await res.json();
    if (data.complete) {
      clearInterval(interval);
      setCallState('complete');
    }
  }, 4000);

  // Timeout after 3 minutes — show retry UX
  const timeout = setTimeout(() => {
    clearInterval(interval);
    setCallState('timeout');
  }, 180000);

  return () => { clearInterval(interval); clearTimeout(timeout); };
}, [callState]);
```

### Pattern 5: Progress Detection for Step-Skip (WIZARD-07 extension)

**What:** When an authenticated user with incomplete onboarding hits the wizard, skip them to the first incomplete step.

**Progress detection logic:**
```javascript
// Detect wizard progress from tenant row
function detectNextStep(tenant) {
  if (!tenant) return '/onboarding';                          // No tenant — step 1
  if (!tenant.business_name) return '/onboarding/profile';   // No profile — step 2
  if (!tenant.trade_type) return '/onboarding/profile';      // No trade — step 2
  if (!tenant.owner_phone) return '/onboarding/contact';     // No phone — step 4
  if (!tenant.onboarding_complete) return '/onboarding/test-call'; // No test call — step 5
  return '/dashboard';                                        // Complete
}
```

Note: Steps 3 (services) is implicitly complete when trade_type is set because the API saves services in the same call. Checking `owner_phone` to determine if steps 3 and 4 are done.

### Anti-Patterns to Avoid
- **DB query in middleware for every dashboard request:** Guard middleware DB calls to onboarding paths only (the config.matcher already handles this).
- **Setting `onboarding_complete=true` at trigger time:** Breaks the "must hear AI" requirement. Flag must be set by webhook, not by the trigger route.
- **sessionStorage access outside useEffect:** Will throw during SSR. Always use lazy initializer in useState or guard with `typeof window`.
- **Full page reload after OTP verification:** Supabase `verifyOtp` returns an authenticated session; use `router.push()` not `window.location.href` to preserve React state.
- **Polling without cleanup:** Always return a cleanup function from the polling `useEffect` to clear intervals on unmount.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OTP send/verify | Custom SMTP + code generation | `supabase.auth.signInWithOtp` + `verifyOtp` | Code expiry, rate limiting, delivery via Supabase already handled |
| Google OAuth | Custom OAuth flow | `supabase.auth.signInWithOAuth({ provider: 'google' })` | Already implemented in `auth/signin/page.js` |
| Session cookie management | Manual cookie handling | `@supabase/ssr` createServerClient in middleware | Handles cookie refresh, rotation, and SSR correctly |
| Phone number provisioning | Manual Retell API calls | Existing `api/onboarding/provision-number/route.js` | Already built, tested, in production |
| Outbound test call | New Retell integration | Existing `api/onboarding/test-call/route.js` | Already built and tested |
| Trade template data | DB-stored templates | `TRADE_TEMPLATES` in `src/lib/trade-templates.js` | Already defined for all trades |
| Celebration animation | Third-party confetti library | Custom CSS keyframes + Framer Motion per UI-SPEC | UI-SPEC specifies exact radial pulse + SVG draw-in; no library import needed |

**Key insight:** This phase is ~80% wiring and migration of existing code, ~20% new UI. The test infrastructure, Retell integration, Supabase auth, and trade templates are all production-ready.

---

## Common Pitfalls

### Pitfall 1: Middleware DB Query Scope Creep
**What goes wrong:** Adding `onboarding_complete` check to `/dashboard` routes causes a DB query on every dashboard page load, adding 10-50ms latency to every authenticated request.
**Why it happens:** Trying to be thorough about WIZARD-07 (bypass wizard for complete users).
**How to avoid:** The middleware `matcher` config already limits which routes trigger middleware. Ensure the DB query for `onboarding_complete` is ONLY executed on `/onboarding` paths, not `/dashboard` paths. Dashboard routes only need the user auth check.
**Warning signs:** Dashboard routes feeling slower than expected after phase deployment.

### Pitfall 2: OTP Double-User Creation
**What goes wrong:** Calling both `supabase.auth.signUp()` and `supabase.auth.signInWithOtp({ shouldCreateUser: true })` creates two separate auth records or an error.
**Why it happens:** OTP as a signup method and password signup are different Supabase auth methods. Mixing them can cause "Email already registered" errors or duplicate records.
**How to avoid:** Choose one approach: either (a) use `signUp` for account creation then `signInWithOtp` with `shouldCreateUser: false` for the OTP, or (b) use `signInWithOtp` with `shouldCreateUser: true` as the primary signup method (no password). Since CONTEXT.md specifies email+password, use approach (a): `signUp` first, then `signInWithOtp` to trigger verification.
**Warning signs:** "Email already registered" error on the OTP request step.

### Pitfall 3: `onboarding_complete` Flag Set Too Early
**What goes wrong:** The existing `test-call/route.js` sets `onboarding_complete=true` AND `test_call_completed=true` atomically when the CALL IS TRIGGERED (not completed). The polling endpoint will return `complete: true` immediately, skipping the celebration state and advancing before the owner has heard their AI.
**Why it happens:** Phase 2 decision: "onboarding_complete flag set atomically with test call trigger — not on Retell webhook callback" (STATE.md line 73). This was a Phase 2 shortcut that contradicts the Phase 7 requirement.
**How to avoid:** Remove the `onboarding_complete=true` line from `test-call/route.js`. Keep `test_call_completed` as false until the Retell webhook confirms completion. Verify the existing Retell webhook handler already sets this flag (STATE.md confirms: "Retell webhook handler already sets `onboarding_complete=true` on test call completion").
**Warning signs:** Step 5 celebrates immediately after clicking "Call My AI Now" before the phone rings.

### Pitfall 4: sessionStorage Hydration Mismatch
**What goes wrong:** Component reads sessionStorage during server render (returns undefined), then reads it again on client, causing a React hydration mismatch error.
**Why it happens:** sessionStorage is a browser API; Next.js server-renders components before the browser is available.
**How to avoid:** Use a `useState` initializer that returns the default value, then a `useEffect` to read sessionStorage after mount. Never read sessionStorage in the component body or during render.
**Warning signs:** React hydration error in console: "Text content does not match server-rendered HTML."

### Pitfall 5: Auth Callback Redirect After Google OAuth
**What goes wrong:** Google OAuth users land at `/auth/callback?next=/onboarding` (the old default), which redirects them to `/onboarding` (step 1). But they're already authenticated, so middleware checks `onboarding_complete` and either redirects to `/dashboard` or lets them through. The desired behavior is to land at step 2 (`/onboarding/profile`) since step 1 (auth) is already complete.
**Why it happens:** `auth/callback/route.js` has `next = '/onboarding'` as default. After auth, the correct destination is `/onboarding/profile`.
**How to avoid:** Update `auth/callback/route.js` to use `/onboarding/profile` as the default `next` param. CTAs in public pages that link to `/onboarding` should remain pointing to `/onboarding` (step 1 handles routing for both new and returning users).
**Warning signs:** Google OAuth users land on step 1 (auth form) after completing OAuth, seeing a "Create account" form when they're already logged in.

### Pitfall 6: Missing Phone Number for Test Call
**What goes wrong:** User skips or provides empty phone in step 4, arrives at step 5, clicks "Call My AI Now", and the test call API returns 400 (owner_phone not configured).
**Why it happens:** The existing `verify/page.js` marks phone as "optional". The CONTEXT.md and UI-SPEC both specify phone is now REQUIRED for the test call.
**How to avoid:** Step 4 (`contact/page.js`) must validate that `owner_phone` is non-empty before advancing. Add client-side validation and server-side validation in `sms-confirm/route.js`.
**Warning signs:** Test call API returns 400 "Phone numbers not configured" from step 5.

---

## Code Examples

### Supabase OTP Signup + Inline Verification
```javascript
// Source: Supabase docs — signInWithOtp (email OTP)
// Trigger OTP send after account creation
const { error } = await supabase.auth.signInWithOtp({
  email: 'user@example.com',
  options: {
    shouldCreateUser: false, // Account already created via signUp()
    emailRedirectTo: undefined, // OTP mode, not magic link mode
  },
});

// Verify the code the user typed
const { data, error } = await supabase.auth.verifyOtp({
  email: 'user@example.com',
  token: '123456',  // 6-digit code
  type: 'email',    // Not 'sms' or 'phone_change'
});
// On success: data.session is populated, user is now authenticated
```

### OTP Input Component Pattern (6 digits, auto-advance)
```javascript
// Source: established pattern for OTP inputs per UI-SPEC
'use client';
import { useRef } from 'react';

export function OtpInput({ onComplete }) {
  const inputs = useRef([]);

  function handleChange(index, value) {
    if (value.length > 1) value = value.slice(-1); // paste guard
    inputs.current[index].value = value;
    if (value && index < 5) inputs.current[index + 1].focus();

    const code = inputs.current.map(i => i.value).join('');
    if (code.length === 6) onComplete(code);
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !inputs.current[index].value && index > 0) {
      inputs.current[index - 1].focus();
    }
  }

  return (
    <div role="group" aria-label="Email verification code" className="flex gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={el => inputs.current[i] = el}
          type="text"
          inputMode="numeric"
          maxLength={1}
          aria-label={`Digit ${i + 1} of 6`}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          className="size-11 text-center text-xl font-semibold border border-stone-200 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-[#C2410C] focus:ring-offset-1"
        />
      ))}
    </div>
  );
}
```

### Progress Bar Extension (3 steps → 5 steps)
```javascript
// src/app/onboarding/layout.js — getStep() update
function getStep(pathname) {
  if (pathname === '/onboarding') return 1;
  if (pathname === '/onboarding/profile') return 2;
  if (pathname === '/onboarding/services') return 3;
  if (pathname === '/onboarding/contact') return 4;
  if (pathname === '/onboarding/test-call') return 5;
  return 1;
}
// progressValue = (currentStep / 5) * 100
// Step counter text: t('step_counter', { step: currentStep, total: 5 })
```

### SVG Checkmark Draw-In (Step 5 celebration)
```javascript
// Source: UI-SPEC animation specification
// Pure CSS/SVG — no third-party library
const CIRCLE_PATH_LENGTH = 2 * Math.PI * 45; // r=45 circle
const CHECK_PATH_LENGTH = 60; // approximate check tick path length

// CSS classes (Tailwind v4 custom animation via @keyframes)
// In globals.css:
// @keyframes draw-in { from { stroke-dashoffset: var(--path-len); } to { stroke-dashoffset: 0; } }
// .animate-draw-circle { animation: draw-in 0.5s ease-out forwards; --path-len: 283px; }
// .animate-draw-check  { animation: draw-in 0.3s ease-out 0.4s forwards; --path-len: 60px; stroke-dashoffset: 60; }
```

### Celebration Radial Pulse (CSS keyframes)
```css
/* In globals.css — prefers-reduced-motion handled */
@keyframes radial-pulse {
  from { transform: scale(1); opacity: 0.4; }
  to   { transform: scale(2); opacity: 0; }
}

@media (prefers-reduced-motion: no-preference) {
  .animate-radial-pulse-1 { animation: radial-pulse 0.8s ease-out forwards; }
  .animate-radial-pulse-2 { animation: radial-pulse 0.8s ease-out 0.2s forwards; }
  .animate-radial-pulse-3 { animation: radial-pulse 0.8s ease-out 0.4s forwards; }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate `/auth/signin` + `/onboarding/*` flows | Unified `/onboarding/*` with auth as step 1 | Phase 7 | Eliminates dead-end and context-switching between auth and onboarding |
| 3-step wizard (business name, services, contact) | 5-step wizard (auth, profile, services, contact, test-call) | Phase 7 | Includes both account creation and live AI demo in one flow |
| `onboarding_complete` set at test call trigger | `onboarding_complete` set by Retell webhook on call completion | Phase 7 | Correctly gates completion behind actual AI interaction |
| `/auth/signin` as protected route redirect target | `/onboarding` as the catch-all entry point | Phase 7 | One entry point for all CTAs and unauthenticated access |

**Deprecated/outdated after this phase:**
- `src/app/onboarding/complete/page.js`: Replaced by step 5 test call finale. Delete or convert to redirect.
- `src/app/onboarding/verify/page.js`: Content migrated to `contact/page.js`. Old path should redirect.
- `src/app/auth/signin/page.js`: Replaced by a simple redirect to `/onboarding`. The original UI-SPEC step 1 design supersedes the existing blue-themed signin card.

---

## Open Questions

1. **`signUp` + `signInWithOtp` vs `signInWithOtp` with `shouldCreateUser: true`**
   - What we know: Supabase supports both patterns. The project uses `signUp` in the existing signin page.
   - What's unclear: Whether Supabase email confirmation settings on the project require `shouldCreateUser: true` or whether `signUp` with confirmation disabled + OTP is cleaner.
   - Recommendation: Use `signUp({ email, password })` first (creates account with password for future sign-ins), then `signInWithOtp({ email, options: { shouldCreateUser: false }})` to trigger the 6-digit verification. This keeps passwords functional for returning users.

2. **Middleware DB query performance on onboarding steps**
   - What we know: Middleware currently makes zero DB calls. Adding a tenant lookup adds latency.
   - What's unclear: Whether this is acceptable for the wizard flow (probably yes — 5 page loads over ~5 minutes).
   - Recommendation: Accept the latency. It only applies to `/onboarding/*` paths, not dashboard. Document as acceptable for v1.

3. **Step 5 test call timeout — what happens after 3 minutes?**
   - What we know: CONTEXT.md says polling every 4 seconds. UI-SPEC specifies a "Call in progress..." state.
   - What's unclear: What the retry UX looks like after timeout.
   - Recommendation: After 3 minutes, transition to a "timeout" state with "We couldn't confirm your call completed. Try again or go to dashboard." with a Retry button and a secondary "Skip for now" link. Mark onboarding as complete on skip (acceptable tradeoff for v1 — the user was already in the call).

4. **`/auth/signin` redirect — permanent or component?**
   - What we know: `/auth/signin` needs to redirect to `/onboarding`.
   - What's unclear: Whether this should be a Next.js `redirect()` in the page component, a middleware rule, or a simple `<meta http-equiv="refresh">`.
   - Recommendation: Use Next.js `redirect('/onboarding')` from the server component (no `'use client'` needed). This is the cleanest approach and works for direct links and bookmarks.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 with `--experimental-vm-modules` |
| Config file | Inferred from package.json `test` script (no jest.config.js visible — uses defaults or package.json jest key) |
| Quick run command | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/onboarding/ --passWithNoTests` |
| Full suite command | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WIZARD-01 | CTA routes to `/onboarding` (step 1 is auth) | smoke (manual verify) | n/a — routing verified by build | manual-only |
| WIZARD-02 | Trade selection pre-populates service list | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/onboarding/trade-template.test.js -x` | ❌ Wave 0 |
| WIZARD-03 | Progress bar shows correct step N of 5 | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/onboarding/wizard-layout.test.js -x` | ❌ Wave 0 |
| WIZARD-04 | OTP inline — signInWithOtp called after signup | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/onboarding/auth-step.test.js -x` | ❌ Wave 0 |
| WIZARD-05 | sessionStorage written on field change, read on mount | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/onboarding/session-persistence.test.js -x` | ❌ Wave 0 |
| WIZARD-06 | Test call status polling — complete state set by webhook | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/onboarding/test-call-status.test.js -x` | ❌ Wave 0 |
| WIZARD-07 | Authenticated + onboarding_complete → redirect `/dashboard` | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/onboarding/middleware.test.js -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/onboarding/ --passWithNoTests`
- **Per wave merge:** `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/onboarding/auth-step.test.js` — covers WIZARD-04 (OTP flow: signInWithOtp called with correct email + shouldCreateUser=false)
- [ ] `tests/onboarding/trade-template.test.js` — covers WIZARD-02 (TRADE_TEMPLATES shape validation, service pre-population on trade select)
- [ ] `tests/onboarding/session-persistence.test.js` — covers WIZARD-05 (useWizardSession hook: read/write/clear lifecycle)
- [ ] `tests/onboarding/test-call-status.test.js` — covers WIZARD-06 (new GET route: returns `complete: true` when `onboarding_complete=true` in DB)
- [ ] `tests/onboarding/middleware.test.js` — covers WIZARD-07 (middleware redirect logic: unauthenticated → /onboarding, complete → /dashboard)

Note: `tests/onboarding/wizard-layout.test.js` for WIZARD-03 is low value (pure pathname mapping function) — can be tested inline in the layout unit test or verified manually. Deprioritize.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/app/onboarding/` — all existing wizard files read directly
- Existing codebase: `src/app/auth/` — signin page and callback handler read directly
- Existing codebase: `src/app/api/onboarding/` — all API routes read directly
- Existing codebase: `src/middleware.js` — current middleware logic read directly
- Existing codebase: `src/lib/trade-templates.js` — trade template data read directly
- Existing codebase: `src/lib/supabase-browser.js` — Supabase client setup confirmed
- `.planning/phases/07-unified-signup-and-onboarding-wizard/07-CONTEXT.md` — locked decisions
- `.planning/phases/07-unified-signup-and-onboarding-wizard/07-UI-SPEC.md` — design contract
- `.planning/STATE.md` — accumulated decisions including Phase 2 onboarding_complete behavior

### Secondary (MEDIUM confidence)
- Supabase `signInWithOtp` / `verifyOtp` API: consistent with `@supabase/supabase-js` v2 documentation patterns and the browser client already imported in the project
- sessionStorage persistence pattern: standard browser API, no library needed

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and in active use
- Architecture: HIGH — based on direct code reading of existing files, not assumptions
- Pitfalls: HIGH — pitfall 3 (onboarding_complete timing conflict) is verified from STATE.md line 73 vs CONTEXT.md decision; other pitfalls from direct code inspection
- Validation: MEDIUM — test framework confirmed from package.json; specific test commands derived from project pattern

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable stack; no fast-moving dependencies)
