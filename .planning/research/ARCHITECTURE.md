# Architecture Research

**Domain:** SaaS marketing site + unified onboarding + calendar integrations
**Researched:** 2026-03-22
**Confidence:** HIGH (based on direct codebase inspection)

---

## Existing Architecture Snapshot

The current codebase does NOT use Next.js App Router route groups. The public/authenticated split
is enforced by middleware, not folder structure.

```
src/app/
├── page.js                     ← Landing page (public)
├── layout.js                   ← Root layout (NextIntl provider)
├── globals.css
├── auth/
│   ├── signin/page.js          ← Supabase email/Google auth
│   └── callback/route.js       ← OAuth code exchange → redirect
├── onboarding/
│   ├── layout.js               ← Wizard shell (progress bar, card)
│   ├── page.js                 ← Step 1: business name + tone
│   ├── services/page.js        ← Step 2: trade selection + services
│   ├── verify/page.js          ← Step 3: phone/email contact details
│   └── complete/page.js        ← Success screen
├── dashboard/                  ← Protected by middleware
│   ├── layout.js
│   ├── page.js
│   ├── analytics/page.js
│   ├── calendar/page.js
│   ├── leads/page.js
│   ├── services/page.js
│   └── settings/page.js        ← Stub ("coming soon")
├── components/landing/         ← Landing page components only
│   ├── AnimatedSection.jsx     ← Framer Motion wrappers
│   ├── LandingNav.jsx
│   ├── LandingFooter.jsx
│   ├── HeroSection.jsx
│   ├── FeaturesGrid.jsx
│   ├── HowItWorksSection.jsx
│   ├── SocialProofSection.jsx
│   └── FinalCTASection.jsx
└── api/                        ← Route handlers
    ├── onboarding/             ← start, sms-verify, sms-confirm, provision-number, test-call
    ├── google-calendar/        ← auth, callback
    ├── calendar-sync/          ← status, disconnect
    ├── leads/, appointments/, services/, zones/, working-hours/
    └── webhooks/               ← retell, google-calendar

src/components/
├── dashboard/                  ← Dashboard-only components
└── ui/                         ← shadcn/ui primitives

src/lib/
├── design-tokens.js            ← Shared color/shadow/class constants
├── scheduling/google-calendar.js ← Google OAuth + push/sync
└── ...

src/middleware.js               ← Protects /onboarding/* and /dashboard/*
```

**Auth flow today:**
```
Landing CTA → /auth/signin → Supabase OAuth/email
  → /auth/callback?next=/onboarding
    → /onboarding (step 1) → /onboarding/services (step 2)
      → /onboarding/verify (step 3) → /onboarding/complete
        → /dashboard/services
```

**Key architectural facts discovered from code:**
- Middleware guards `/onboarding` AND `/dashboard` — both require auth
- The CTA in `LandingNav` links directly to `/onboarding`, which triggers auth redirect
- Onboarding wizard uses URL-based step routing (separate pages), not in-page state
- `OnboardingLayout` derives `currentStep` from `usePathname()` — each step is a real route
- API route `/api/onboarding/start` handles BOTH step 1 and step 2 data (body branching on field presence)
- `tenants.onboarding_complete` column exists in schema but wizard never sets it to true
- `tenants.owner_id` is `UNIQUE` — one tenant per user account
- Google Calendar: OAuth stored in `calendar_credentials` table, push webhooks + incremental sync already built
- No `(public)` / `(dashboard)` route groups in current code — the milestone context described a planned structure that does not yet exist

---

## New Features: Integration Analysis

### 1. Pricing Page (`/pricing`)

**Route:** `src/app/pricing/page.js` — new public page, no auth required

**Middleware:** No change needed. Middleware only guards `/onboarding/*` and `/dashboard/*`.

**LandingNav integration:** Must add "Pricing" nav link. LandingNav is a fixed-position dark nav
used only on the landing page. The pricing page will also use it, so LandingNav needs two changes:
- Add `<Link href="/pricing">Pricing</Link>` to the `hidden md:flex` nav links
- Add mobile menu handling — currently has none. With multiple nav links, a hamburger is necessary.

**LandingFooter integration:** Add `/pricing` to footer links column (currently only Terms and Privacy).
Footer needs a proper multi-column layout to accommodate Pricing, About, Contact links.

**Data:** Display-only. No API route needed. Tier data (Starter $99, Growth $249, Scale $599,
Enterprise custom) lives as static config in a `src/lib/pricing-config.js` file.
No DB writes. No Supabase reads.

**Components needed (new):**
- `src/app/pricing/page.js` — page shell with LandingNav + LandingFooter
- `src/app/components/landing/PricingSection.jsx` — tier cards grid, reusable on landing page
- `src/lib/pricing-config.js` — tier definitions (name, price, features list, CTA label)

**Integration points:**
- LandingNav: add Pricing link, add mobile nav
- LandingFooter: add Pricing, About, Contact columns
- FinalCTASection on landing page: link to pricing or show pricing inline

**i18n:** Add `pricing.*` keys to `en.json` and `es.json`

---

### 2. Contact Page (`/contact`)

**Route:** `src/app/contact/page.js` — new public page, no auth required

**Form submissions:** Three inquiry types (sales, support, partnerships). Options:
- Resend email API (already used for lead notifications) — reuse `src/lib/notifications.js` pattern
- New API route: `src/app/api/contact/route.js` — accepts `{ name, email, company, type, message }`, sends via Resend, returns `{ ok: true }`

**No DB table needed.** Contact submissions go straight to email. If a log is needed later, add a
`contact_submissions` table, but that is out of scope for v1.1.

**Components needed (new):**
- `src/app/contact/page.js` — page with LandingNav + LandingFooter
- `src/app/components/landing/ContactForm.jsx` — form with type selector, validation, success state
- `src/app/api/contact/route.js` — POST handler using Resend

**Integration points:**
- LandingNav: add Contact link
- LandingFooter: add Contact link
- Resend: reuse existing pattern from `src/lib/notifications.js`

**i18n:** Add `contact.*` keys

---

### 3. About/Company Page (`/about`)

**Route:** `src/app/about/page.js` — new public page, no auth required

**Data:** Static content only. No API, no DB. Team members as static array in a
`src/lib/team-config.js` file.

**Components needed (new):**
- `src/app/about/page.js` — page shell
- `src/app/components/landing/AboutHero.jsx` — mission statement hero
- `src/app/components/landing/TeamGrid.jsx` — team member cards
- `src/app/components/landing/CompanyStory.jsx` — timeline or narrative section

**Integration points:**
- LandingNav: add About link
- LandingFooter: add About link

**i18n:** Add `about.*` keys

---

### 4. Unified Signup + Onboarding Wizard

This is the most architecturally significant change. Today the flow is:

```
CTA → /auth/signin (separate full-page) → /auth/callback → /onboarding (step 1) ...
```

The unified wizard collapses account creation INTO the wizard as step 0:

```
CTA → /onboarding (step 0: email/password or Google) → step 1 → step 2 → step 3 → complete
```

**Approach: Add step 0 to the existing onboarding layout — not a full rewrite.**

The `OnboardingLayout` already derives `currentStep` from pathname. Add a new sub-route for
step 1 and make the root `/onboarding` the auth step:

```
/onboarding              ← REPLACE: step 0 — account creation (email signup or Google)
/onboarding/setup        ← NEW: was /onboarding (step 1: business name + tone)
/onboarding/services     ← UNCHANGED (step 2: trade + services)
/onboarding/verify       ← UNCHANGED (step 3: contact details)
/onboarding/complete     ← MODIFY: write onboarding_complete=true
```

**Concrete file changes:**

| File | Change Type | Detail |
|------|-------------|--------|
| `src/app/onboarding/page.js` | REPLACE | Becomes auth step: email/Google sign-up form using supabase-browser client |
| `src/app/onboarding/layout.js` | MODIFY | Update `getStep()` to handle 4 steps (0=auth, 1=setup, 2=services, 3=verify), update step_counter |
| `src/app/onboarding/setup/page.js` | NEW | Move content of current `/onboarding/page.js` here |
| `src/middleware.js` | MODIFY | Remove `/onboarding` root from PROTECTED_PATHS (auth step must be public); add `/onboarding/setup` |
| `src/app/auth/callback/route.js` | MODIFY | Default redirect changes from `/onboarding` to `/onboarding/setup` |
| `src/app/components/landing/LandingNav.jsx` | UNCHANGED | CTA still links `/onboarding` — URL same, behavior changes inside |

**Middleware critical change:** Currently both `/onboarding` and `/dashboard` are protected. The
new wizard step 0 must be public — unauthenticated users must reach it. After sign-up in step 0,
user is authenticated and subsequent steps remain protected.

```javascript
// src/middleware.js — new PROTECTED_PATHS
const PROTECTED_PATHS = ['/onboarding/setup', '/onboarding/services', '/onboarding/verify', '/dashboard'];
```

**Already-onboarded detection:** When a user who completed onboarding visits `/onboarding`,
they should be redirected to `/dashboard`. Add a server check in the step 0 page component
(or middleware) using supabase-server to read `tenants.onboarding_complete`:

```
GET /onboarding by auth'd user
  → fetch tenant → onboarding_complete = true → redirect /dashboard
  → fetch tenant → onboarding_complete = false → redirect /onboarding/setup
  → no tenant → render step 0 auth form
```

This requires `tenants.onboarding_complete` to be set to `true` at wizard completion. The field
exists in the DB schema (migration 001) but is never written. A new API route
`/api/onboarding/complete` must set it, called from the `OnboardingComplete` page.

**i18n:** Add `onboarding.step0_*` keys. Update `step_counter` from "Step {step} of 3" to
"Step {step} of 4".

---

### 5. Outlook Calendar Sync

**Pattern mirrors the existing Google Calendar integration exactly.**

```
Existing Google flow:
  /api/google-calendar/auth     → OAuth redirect
  /api/google-calendar/callback → token exchange → store in calendar_credentials
  /api/webhooks/google-calendar → push notification handler
  src/lib/scheduling/google-calendar.js → OAuth, sync, push, revoke

New Outlook flow (mirrors):
  /api/outlook-calendar/auth     → MSAL redirect
  /api/outlook-calendar/callback → token exchange → store in calendar_credentials (provider='outlook')
  /api/webhooks/outlook-calendar → Graph subscription notification handler
  src/lib/scheduling/outlook-calendar.js → MSAL, sync, push, revoke
```

**DB schema change required:** The `calendar_credentials` table currently stores Google tokens
with no `provider` column — it implicitly assumes Google. A migration must add `provider`:

```sql
-- supabase/migrations/005_outlook_calendar.sql
ALTER TABLE calendar_credentials ADD COLUMN provider text NOT NULL DEFAULT 'google';
CREATE UNIQUE INDEX calendar_credentials_tenant_provider ON calendar_credentials(tenant_id, provider);
```

This allows one row per provider per tenant, enabling a user to connect both Google and Outlook.

**MSAL vs googleapis differences:**
- Use `@azure/msal-node` for server-side OAuth token exchange
- Graph API endpoint for events: `https://graph.microsoft.com/v1.0/me/events`
- Graph API endpoint for availability: `https://graph.microsoft.com/v1.0/me/calendarView`
- Subscriptions (push notifications): `https://graph.microsoft.com/v1.0/subscriptions`
- Subscriptions expire after maximum 3 days for calendar — must be renewed more frequently than
  Google's 7-day watch channels. The cron renewal interval must be tightened to daily.

**Critical difference — validation token handshake:** When creating a Graph subscription,
Microsoft immediately sends a POST to the webhook URL with `?validationToken=...` as a query
parameter. The endpoint must respond within seconds with `Content-Type: text/plain` and the
token value as the body. The existing Google webhook handler does not have this pattern.

```javascript
// /api/webhooks/outlook-calendar/route.js
export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const validationToken = searchParams.get('validationToken');
  if (validationToken) {
    // Subscription validation — respond immediately
    return new Response(validationToken, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  // Normal notification processing
  const body = await request.json();
  // fire-and-forget sync to avoid timeout
  syncCalendarEvents(tenantId, 'outlook').catch(console.error);
  return Response.json({ ok: true });
}
```

**Abstraction opportunity:** Since Google and Outlook sync are structurally identical at the
booking-push level, the `pushBookingToCalendar` function in `google-calendar.js` can be wrapped
by a provider-agnostic dispatcher:

```javascript
// src/lib/scheduling/calendar-provider.js
export async function pushBookingToCalendar(tenantId, appointmentId) {
  const creds = await getCredentials(tenantId); // may return multiple rows
  for (const cred of creds) {
    if (cred.provider === 'google') await googlePush(tenantId, appointmentId, cred);
    if (cred.provider === 'outlook') await outlookPush(tenantId, appointmentId, cred);
  }
}
```

This is optional for v1.1 but prevents the booking.js caller from needing to know which
providers are connected.

**Dashboard `CalendarSyncCard`:** Currently shows only Google connect/disconnect. Must show
both providers with independent states. Consider two separate connect buttons in the card,
each with their own "connected" indicator.

**Files needed (new):**
- `src/lib/scheduling/outlook-calendar.js` — MSAL client, Graph API event CRUD, subscription management
- `src/app/api/outlook-calendar/auth/route.js` — MSAL redirect initiation
- `src/app/api/outlook-calendar/callback/route.js` — token exchange + store + register subscription
- `src/app/api/webhooks/outlook-calendar/route.js` — subscription notification handler (with validation token)
- `src/app/api/cron/renew-outlook-subscriptions/route.js` — daily subscription renewal

**Files modified:**
- `src/components/dashboard/CalendarSyncCard.js` — add Outlook connect/disconnect UI
- `src/app/api/calendar-sync/status/route.js` — return status for both google and outlook
- `supabase/migrations/005_outlook_calendar.sql` — provider column + unique constraint

---

## Component Boundary Map

```
Public Routes (no auth required)
├── / (landing)
│   ├── LandingNav               ← MODIFY: add Pricing/About/Contact links + mobile nav
│   ├── [existing sections]
│   └── LandingFooter            ← MODIFY: multi-column with new page links
├── /pricing                     ← NEW
│   ├── LandingNav (shared)
│   ├── PricingSection           ← NEW component
│   └── LandingFooter (shared)
├── /about                       ← NEW
│   ├── LandingNav (shared)
│   ├── AboutHero + TeamGrid + CompanyStory  ← NEW components
│   └── LandingFooter (shared)
└── /contact                     ← NEW
    ├── LandingNav (shared)
    ├── ContactForm              ← NEW component
    └── LandingFooter (shared)

Onboarding (step 0 public, steps 1-3 auth-required)
├── /onboarding                  ← REPLACE: step 0 auth form (public)
├── /onboarding/setup            ← NEW: was /onboarding step 1 (auth required)
├── /onboarding/services         ← UNCHANGED step 2 (auth required)
├── /onboarding/verify           ← UNCHANGED step 3 (auth required)
└── /onboarding/complete         ← MODIFY: write onboarding_complete=true

Protected Routes (auth required)
└── /dashboard/**                ← UNCHANGED structure
    └── settings/page.js         ← MODIFY: CalendarSyncCard gains Outlook panel
```

---

## Data Flow Changes

### Pricing Page

```
src/lib/pricing-config.js (static)
    ↓ import at build time
PricingSection component
    ↓ render
Browser — no API call, no DB read
```

### Contact Form

```
User fills ContactForm → POST /api/contact
    ↓
API route → Resend.emails.send({ to: process.env.CONTACT_EMAIL, ... })
    ↓
Response { ok: true } → ContactForm shows success state
```

### Unified Wizard Auth Step

```
User visits /onboarding (unauthenticated — now public)
    ↓
Google path: supabase.auth.signInWithOAuth({ redirectTo: '/auth/callback?next=/onboarding/setup' })
    → /auth/callback → session established → redirect /onboarding/setup
Email path: supabase.auth.signUp({ email, password }) → session established
    → window.location.href = '/onboarding/setup'
    ↓
/onboarding/setup (protected) — existing step 1 logic, unchanged API calls
    ↓
Steps 2 and 3 unchanged
    ↓
/onboarding/complete → POST /api/onboarding/complete → tenants.onboarding_complete = true
    → redirect /dashboard
```

### Outlook Calendar Sync

```
User clicks "Connect Outlook" in CalendarSyncCard
    ↓
GET /api/outlook-calendar/auth
    → MSAL.getAuthCodeUrl() → 302 to Microsoft login
    ↓
Microsoft → GET /api/outlook-calendar/callback?code=...
    → MSAL.acquireTokenByCode() → tokens
    → INSERT calendar_credentials (provider='outlook', access_token, refresh_token, expiry)
    → POST graph.microsoft.com/v1.0/subscriptions → store subscription_id, expiry
    ↓
GET /api/calendar-sync/status → { google: {...}, outlook: { connected: true } }
CalendarSyncCard updates UI

On booking creation:
    pushBookingToCalendar(tenantId, appointmentId)
        ↓ (reads provider from calendar_credentials)
        → outlook-calendar.js → POST graph.microsoft.com/v1.0/me/events

On Graph notification:
    POST /api/webhooks/outlook-calendar
        ↓ (validation token check first)
        → syncCalendarEvents(tenantId, 'outlook') fire-and-forget
        → upsert calendar_events (provider='outlook')
```

---

## Recommended Build Order

Build order is driven by dependencies, risk, and demo value:

1. **LandingNav + LandingFooter updates** — All three public pages need these. Do once, unblock
   everything. Touch these files exactly once before building any page.

2. **Pricing page** — Highest business value. Static content, zero integration risk. Build immediately
   after nav/footer.

3. **About page** — Static content, no API. Build after pricing while nav/footer changes are fresh.

4. **Contact page + API route** — Form + Resend integration. Slightly more complex than static pages.
   Build last among the three public pages.

5. **Unified wizard (signup as step 0)** — Highest integration risk among site features. Touches
   middleware, auth callback, onboarding layout, and creates `/onboarding/setup`. Must be validated
   E2E (sign up → wizard → dashboard) before moving on. Block no other feature, but is critical path
   for the "5-minute onboarding gate" QA.

6. **Outlook Calendar sync** — Most complex feature. Requires MSAL package install, new API routes,
   DB migration, and CalendarSyncCard update. Google Calendar already works — Outlook is additive.
   Build last so it cannot block demo-readiness.

---

## New vs Modified Files Summary

### New Files

| File | Purpose |
|------|---------|
| `src/app/pricing/page.js` | Pricing page route |
| `src/app/about/page.js` | About page route |
| `src/app/contact/page.js` | Contact page route |
| `src/app/api/contact/route.js` | Contact form POST handler via Resend |
| `src/app/components/landing/PricingSection.jsx` | Tier cards component |
| `src/app/components/landing/AboutHero.jsx` | About page hero with mission |
| `src/app/components/landing/TeamGrid.jsx` | Team member cards |
| `src/app/components/landing/CompanyStory.jsx` | Mission/story section |
| `src/app/components/landing/ContactForm.jsx` | Contact form with inquiry type selector |
| `src/app/onboarding/setup/page.js` | Wizard step 1 (moved from /onboarding) |
| `src/app/api/onboarding/complete/route.js` | Sets tenants.onboarding_complete = true |
| `src/lib/pricing-config.js` | Static tier definitions |
| `src/lib/scheduling/outlook-calendar.js` | MSAL + Graph API calendar operations |
| `src/app/api/outlook-calendar/auth/route.js` | Outlook OAuth redirect initiation |
| `src/app/api/outlook-calendar/callback/route.js` | Outlook OAuth token exchange + subscription |
| `src/app/api/webhooks/outlook-calendar/route.js` | Graph subscription notification handler |
| `src/app/api/cron/renew-outlook-subscriptions/route.js` | Daily subscription renewal cron |
| `supabase/migrations/005_outlook_calendar.sql` | provider column + per-tenant-provider unique index |

### Modified Files

| File | Change |
|------|--------|
| `src/app/components/landing/LandingNav.jsx` | Add Pricing/About/Contact links + mobile nav |
| `src/app/components/landing/LandingFooter.jsx` | Multi-column layout with new page links |
| `src/app/onboarding/page.js` | Replace with auth step (sign-up form, now public) |
| `src/app/onboarding/layout.js` | 4-step progress, updated getStep() for /setup route |
| `src/app/onboarding/complete/page.js` | Call /api/onboarding/complete to set flag |
| `src/app/auth/callback/route.js` | Default redirect changed to /onboarding/setup |
| `src/middleware.js` | Remove /onboarding root, add /onboarding/setup to PROTECTED_PATHS |
| `src/components/dashboard/CalendarSyncCard.js` | Add Outlook connect/disconnect panel |
| `src/app/api/calendar-sync/status/route.js` | Return status for google + outlook providers |
| `messages/en.json` | Add pricing.*, about.*, contact.* namespaces; update onboarding.* |
| `messages/es.json` | Same |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Duplicating LandingNav per public page

**What people do:** Copy-paste LandingNav markup into each new page file.
**Why it's wrong:** Three new pages means three copies. Adding a link (which happens multiple times
in this milestone) requires editing each separately.
**Do this instead:** All public pages import `LandingNav` and `LandingFooter` from
`src/app/components/landing/`. Modify once, applies everywhere.

### Anti-Pattern 2: Rewriting the onboarding wizard from scratch

**What people do:** Interpret "unified wizard" as requiring a single-page component with all steps
in local state, replacing the multi-route approach.
**Why it's wrong:** The existing multi-route wizard is fully functional. The only thing missing
is step 0 (auth). A full rewrite risks breaking the working 3-step flow and dramatically
increases scope.
**Do this instead:** Add `/onboarding/setup` (move step 1 content), keep steps 2-3 unchanged,
replace `/onboarding/page.js` with the auth step. Minimal diff, maximal safety.

### Anti-Pattern 3: DB table for contact form submissions

**What people do:** Create `contact_submissions` table to log inquiries.
**Why it's wrong:** Adds schema complexity, RLS policies, and a migration for purely operational
data that the team reads from email.
**Do this instead:** Send via Resend directly. If logging is needed post-launch, add it then.

### Anti-Pattern 4: Blocking on Graph subscription validation token

**What people do:** Process the full calendar sync before responding to the Graph notification,
causing a timeout on the validation handshake.
**Why it's wrong:** Microsoft requires a 200 response with `validationToken` body within seconds.
A slow sync blocks this and causes subscription creation to fail.
**Do this instead:** Check for `validationToken` query param first, respond immediately with
`text/plain` body, then fire-and-forget the sync.

### Anti-Pattern 5: Single MSAL client instantiation per route

**What people do:** Instantiate `ConfidentialClientApplication` inline inside each API route handler.
**Why it's wrong:** Duplicates MSAL configuration, makes credential rotation error-prone.
**Do this instead:** Export `createMSALClient()` from `outlook-calendar.js` — mirrors how
`createOAuth2Client()` works in `google-calendar.js`.

### Anti-Pattern 6: Forgetting to set onboarding_complete

**What people do:** Build the unified wizard but never write `tenants.onboarding_complete = true`,
leaving every returning user re-routed into the wizard.
**Why it's wrong:** `onboarding_complete` already exists in the schema (migration 001) but is
never written by any current code. The already-onboarded detection in step 0 only works if this
field is set.
**Do this instead:** The `/onboarding/complete` page effect or the new `/api/onboarding/complete`
route must write this field. Confirm in E2E test: sign up, complete wizard, sign out, sign back
in, verify redirect goes to `/dashboard` not `/onboarding/setup`.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 tenants | Current monolith is fine. Calendar sync in API route handlers. Cron is sufficient. |
| 100-1k tenants | Move calendar sync to background job queue. Outlook subscription renewals become critical operational task — monitor expiry. |
| 1k+ tenants | Calendar sync must be async (queue + worker). Contact form needs rate limiting. |

**First bottleneck for this milestone:** Microsoft Graph subscriptions expire after a maximum of
3 days for calendar resources (compared to Google's 7 days). The cron job at
`/api/cron/renew-outlook-subscriptions` must run daily and be registered in `vercel.json`.
Missing renewals result in silent loss of Outlook sync without any error visible to the user.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth | Browser client signUp/signInWithOAuth in wizard step 0 | Same client already used in auth/signin |
| Resend | POST to Resend in /api/contact handler | Same pattern as notifications.js |
| Microsoft MSAL | @azure/msal-node ConfidentialClientApplication | New package install required |
| Microsoft Graph | REST calls in outlook-calendar.js | Events, CalendarView, Subscriptions endpoints |
| Microsoft Graph Webhooks | POST /api/webhooks/outlook-calendar with validation token | Different from Google — requires immediate text/plain response |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Public pages ↔ LandingNav/Footer | Direct component import | All public pages share one nav |
| Wizard step 0 ↔ Supabase | supabase-browser (existing instance) | No new client needed |
| Wizard complete ↔ tenants table | New /api/onboarding/complete route | Sets onboarding_complete = true |
| Outlook sync ↔ calendar_credentials | DB read/write with provider='outlook' | Requires migration 005 |
| CalendarSyncCard ↔ /api/calendar-sync/status | Existing endpoint extended | Returns { google: {...}, outlook: {...} } shape |
| booking.js ↔ calendar push | Existing pushBookingToCalendar call | Must become multi-provider aware |

---

*Architecture research for: HomeService AI v1.1 — Site Completeness & Launch Readiness*
*Researched: 2026-03-22*
