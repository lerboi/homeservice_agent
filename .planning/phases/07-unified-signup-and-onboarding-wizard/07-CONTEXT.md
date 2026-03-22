# Phase 7: Unified Signup and Onboarding Wizard - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Any visitor who clicks a CTA is carried through account creation and full business setup into a live test call with their AI receptionist — in a single, uninterrupted flow. Replaces the current split `/auth/signin` + `/onboarding/*` paths with a unified wizard at `/onboarding/*`. The wizard is 5 URL-routed steps: auth, business profile, services, contact details, and test call finale.

</domain>

<decisions>
## Implementation Decisions

### Wizard step sequence
- **5 steps, URL-routed** at `/onboarding/*`:
  - Step 1 (`/onboarding`): Create Account — Google OAuth button + email/password with OTP verification
  - Step 2 (`/onboarding/profile`): Business Profile — trade type selection + business name + tone preset (combined step)
  - Step 3 (`/onboarding/services`): Services — pre-populated from trade template, editable
  - Step 4 (`/onboarding/contact`): Contact Details — owner phone + email for notifications
  - Step 5 (`/onboarding/test-call`): Test Call Finale — display AI phone number, trigger test call, wait for completion
- Each step is its own page component under the shared `/onboarding/layout.js`
- Progress bar in layout reads pathname to determine current step (existing pattern, updated to 5 steps)
- `/auth/signin` redirects to `/onboarding` — single entry point

### Auth placement and methods
- Auth is step 1 — account creation before any business configuration
- **Three auth methods:** Google OAuth, email+password with OTP verification, and sign-in link for existing users
- Google OAuth users skip email verification entirely (already verified)
- Email+password users get immediate OTP verification after signup (Supabase `signInWithOtp` / `verifyOtp`)

### Email verification (OTP inline)
- After email+password signup, step 1 transforms in-place to show OTP input
- 6-digit code sent to email via Supabase native email OTP
- "Enter the code we sent to owner@example.com" with `[_ _ _ _ _ _]` input
- Resend code link available
- On successful verification, auto-advance to step 2
- Uses Supabase `signInWithOtp({ email, options: { shouldCreateUser: true } })` and `verifyOtp()`

### Session persistence
- **sessionStorage** for wizard form data (trade type, business name, tone, service edits)
- On page refresh: check Supabase auth session + read sessionStorage to restore state
- If sessionStorage is empty but user is authenticated, detect progress from DB (tenant record) and skip to next incomplete step
- Clear sessionStorage on wizard completion

### Step guards and routing
- Steps 2-5 require authenticated session — unauthenticated users redirected to `/onboarding` (step 1)
- Guard enforced via middleware or layout auth check
- **Returning user routing:**
  - Not logged in → show step 1 (auth)
  - Logged in + `onboarding_complete=true` → redirect to `/dashboard`
  - Logged in + `onboarding_complete=false` → detect progress, skip to next incomplete step

### Test call finale
- Step 5 shows the AI phone number prominently
- Two options: "Call My AI Now" button (triggers Retell outbound call to owner's phone from step 4) AND display number for manual dial
- **Test call is required** — `onboarding_complete` only set to true after a successful test call
- No skip option — user must hear their AI before completing onboarding
- **Detection via polling:** Step 5 polls `GET /api/onboarding/test-call-status` every 4 seconds
- Retell webhook handler sets `onboarding_complete=true` when test call from this tenant completes
- **Step 5 states:** Ready → Calling → In Progress → Complete

### Success state
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — WIZARD-01 through WIZARD-07 (unified onboarding wizard)

### Prior phase context
- `.planning/phases/02-onboarding-and-triage/02-CONTEXT.md` — Original onboarding decisions: 3-step sprint, trade templates, tone presets, progressive disclosure, test call philosophy
- `.planning/phases/06-public-marketing-pages/06-CONTEXT.md` — CTA routing decisions, visual continuity (Heritage Copper palette), (public) route group structure

### Existing auth code
- `src/app/auth/signin/page.js` — Current sign-in page (to be replaced/redirected)
- `src/app/auth/callback/route.js` — OAuth callback handler (reuse, may need redirect update)

### Existing onboarding code
- `src/app/onboarding/layout.js` — Wizard layout with progress bar, logo, AnimatedSection wrapper (extend to 5 steps)
- `src/app/onboarding/page.js` — Step 1: business name + tone preset (becomes step 2 content)
- `src/app/onboarding/services/page.js` — Step 2: service list (becomes step 3)
- `src/app/onboarding/verify/page.js` — Step 3: contact details (becomes step 4)
- `src/app/onboarding/complete/page.js` — Completion page (replaced by step 5 test call finale)

### Onboarding API routes
- `src/app/api/onboarding/start/route.js` — Creates/updates tenant record
- `src/app/api/onboarding/sms-confirm/route.js` — Saves owner phone + email
- `src/app/api/onboarding/test-call/route.js` — Triggers Retell outbound test call
- `src/app/api/onboarding/provision-number/route.js` — Provisions Retell phone number

### Project context
- `.planning/PROJECT.md` — Core value prop, auth approach (Google OAuth + email/password via Supabase)
- `.planning/ROADMAP.md` — Phase 7 success criteria (6 test scenarios)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `onboarding/layout.js` — Wizard layout with progress bar, GridTexture, AnimatedSection. Needs step count update (3→5) and pathname mapping update
- `AnimatedSection` / `AnimatedStagger` / `AnimatedItem` — Framer Motion animation wrappers, already used in onboarding steps
- `supabase-browser.js` — Client-side Supabase for auth operations (signInWithOtp, verifyOtp, signInWithOAuth)
- shadcn components: Button, Input, Label, Card, Alert, Progress — all already imported in onboarding pages
- Heritage Copper design tokens in `globals.css` — `#C2410C`, `#0F172A`, `#F5F5F4`, `#475569`
- Existing tone preset selection UI (radio cards with icons) in `onboarding/page.js`
- Existing service list editor in `onboarding/services/page.js`

### Established Patterns
- URL-routed wizard steps with shared layout (existing pattern, extending it)
- `'use client'` for interactive pages, Server Components for static content
- Supabase Auth with `createSupabaseServer()` for server-side, `supabase` from `supabase-browser` for client-side
- API routes at `src/app/api/onboarding/*` for wizard backend operations
- `after()` for deferred processing in webhook handlers

### Integration Points
- `auth/callback/route.js` — OAuth callback, default redirect to `/onboarding` (already correct)
- Retell webhook handler — already sets `onboarding_complete=true` on test call completion
- `api/onboarding/test-call/route.js` — Existing endpoint for triggering outbound test call
- All CTA buttons in `(public)/*` pages route to `/onboarding` (already correct from Phase 6)
- `middleware.js` or layout-level auth check needed for step guards

</code_context>

<specifics>
## Specific Ideas

- The wizard is ONE continuous URL-routed sequence — no dead-end pages, no separate auth flow
- "Speed to aha moment" philosophy carries forward from Phase 2 — trade template pre-population means the AI is useful immediately
- OTP verification transforms step 1 in-place (same page, different state) rather than navigating to a verification page
- Test call is the mandatory finale — the user's first experience with THEIR configured AI is the graduation moment
- Celebration animation on completion should feel earned — this is the "aha moment" the entire wizard builds toward

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-unified-signup-and-onboarding-wizard*
*Context gathered: 2026-03-22*
