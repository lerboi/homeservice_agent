# Pitfalls Research

**Domain:** AI voice receptionist + home service booking platform (SaaS)
**Researched:** 2026-03-22 (updated — v1.1 milestone pitfalls appended)
**Confidence:** MEDIUM-HIGH (v1.0 pitfalls: MEDIUM from training knowledge; v1.1 pitfalls: MEDIUM-HIGH from live web search + codebase inspection)

---

## Critical Pitfalls

### Pitfall 1: Treating Latency as a Voice Quality Problem, Not a System Architecture Problem

**What goes wrong:**
Teams focus on picking the best TTS voice and lowest-latency STT model, but the real latency killer is the round-trip time of function calls (tool calls) during the conversation. When the AI needs to check calendar availability or look up a time slot mid-conversation, the user experiences a 2-4 second silence — which feels like the call dropped. Callers hang up or assume the system is broken.

**Why it happens:**
Vapi and Retell both use function/tool calls to invoke external APIs during conversations. Developers build these as synchronous blocking calls to their own backend, which then calls Google Calendar or a database. Each hop adds latency: voice platform → your server → calendar API → your server → voice platform → TTS render. Even at 300ms per hop, four hops = 1.2 seconds of dead air. If calendar API is slow (Google Calendar can spike to 1-2s under load), total dead air hits 3-4 seconds.

**How to avoid:**
- Pre-load availability windows into a fast in-memory cache (Redis) at the start of each call
- Use a slot reservation table in your own database — never query Google Calendar live during a call
- Calendar sync runs async on a background job (poll every 60-120 seconds, or via webhook push)
- Keep all function call responses under 800ms by measuring p95 latency in staging with realistic data
- Use Vapi's `background_denoising` and filler audio (brief "let me check that for you") to mask unavoidable pauses

**Warning signs:**
- Function call round-trip exceeds 800ms in load testing
- Average call duration is short (callers hanging up mid-booking flow)
- "Silence felt weird" feedback in early user tests
- Calendar availability queries hitting Google Calendar API directly from the function call handler

**Phase to address:** Voice Infrastructure phase (earliest possible — establishes the async availability pattern before any booking logic is built on top of it)

---

### Pitfall 2: Non-Atomic Slot Locking Creates Double-Bookings

**What goes wrong:**
Two calls arrive within seconds of each other. Both query available slots, both see 2pm Tuesday as open, both proceed to book it. The owner gets two jobs at the same time, one customer gets a no-show, and trust in the platform collapses. For home service owners, a double-booking isn't just an inconvenience — it's a broken promise to a customer who may have taken time off work to be home.

**Why it happens:**
The naive implementation reads available slots, picks the best one, then writes the booking as two separate operations. Between read and write, another concurrent booking can sneak in. This is a classic TOCTOU (time-of-check to time-of-use) race condition. It's especially likely at peak times (morning rush, after a weather event when emergency calls spike).

**How to avoid:**
- Implement optimistic locking with a slot reservation table: `SELECT ... FOR UPDATE` or equivalent atomic compare-and-swap
- Use a two-phase commit pattern: (1) soft-reserve the slot with a short TTL (e.g., 90 seconds) at the start of the booking conversation, (2) hard-confirm on booking completion, (3) release reservation if call ends without confirmation
- Never use application-level "check then write" — the lock must be at the database layer
- For PostgreSQL: use `SELECT ... FOR UPDATE SKIP LOCKED` to safely claim a slot in a concurrent environment
- Write an explicit concurrency test that fires 10 simultaneous booking attempts at a single slot and asserts exactly 1 succeeds

**Warning signs:**
- No concurrency tests in the booking flow
- Slot availability check and booking write are separate database calls with no transaction
- Calendar sync reads and booking writes share the same lock scope (or no lock scope at all)
- "Available slots" are computed in application code from raw calendar data rather than a dedicated reservation table

**Phase to address:** Scheduling & Booking phase (must be designed atomically from day one — retrofitting locking logic into an existing booking flow is high risk)

---

### Pitfall 3: Triage Logic That Works in Testing, Fails on Real Callers

**What goes wrong:**
The keyword-based emergency detection works perfectly in scripted tests ("I have a gas leak") but misclassifies real callers who speak indirectly, use regional language, or describe symptoms without naming the emergency. A caller who says "my basement is completely underwater and I don't know what to do" doesn't say "flooding" — but it's an emergency. Conversely, a caller saying "I need this fixed urgently" for a non-urgent job gets over-triaged into an emergency slot, wasting the owner's premium availability.

**Why it happens:**
Developers build against idealized test inputs. Real callers are stressed, speak in fragments, use non-standard vocabulary, describe context rather than label the problem, and mix urgency signals with routine requests. Keyword lists are brittle — they match what the developer imagined callers would say, not what callers actually say.

**How to avoid:**
- Use LLM-based intent classification for triage, not keyword matching alone — keywords can be a fast pre-filter but LLM should make the final call
- Include a confidence threshold: below threshold, default to a clarifying question ("Is this something that needs immediate attention today, or can we schedule for later this week?")
- Seed the triage prompt with real-world examples gathered from home service industry call recordings or operator feedback
- Build an override path: callers can always say "this is an emergency" and override the classification
- Log every triage decision with the reasoning so misclassifications can be reviewed and corrected
- Run the triage prompt against a test set of 50+ realistic caller scenarios before shipping

**Warning signs:**
- Triage test cases are all clean, unambiguous sentences
- No fallback question when confidence is low
- Owner reports receiving wrong-urgency notifications in first week
- No mechanism to review or correct past triage decisions

**Phase to address:** AI Intelligence / Triage phase — triage logic must be tested against realistic messy inputs, not idealized ones, before it's connected to real calendar slots

---

### Pitfall 4: Google Calendar Sync as the Source of Truth

**What goes wrong:**
The system treats Google Calendar as the authoritative availability database. When Google Calendar has a brief outage, rate-limits the API, revokes an OAuth token, or a calendar event is deleted outside the system, the booking platform either crashes, shows phantom availability, or silently stops syncing. Owners don't notice until they've received double-bookings or callers are told no slots are available during what should be open time.

**Why it happens:**
Google Calendar feels like the natural source of truth because the owner already lives in it. Teams build a direct-read architecture where every availability check queries the Calendar API, then discover that Calendar APIs have rate limits (10,000 requests/day on free tier, but still limited), OAuth tokens expire, and the API is not designed for sub-second booking confirmation queries.

**How to avoid:**
- The platform's own database is the source of truth for availability, not Google Calendar
- Google Calendar sync is a bidirectional background sync: your DB is authoritative, Calendar reflects it
- Implement OAuth token refresh proactively with health monitoring — alert the owner if calendar sync breaks
- Build a "sync health" indicator in the dashboard so owners can see if calendar is connected
- Store the last sync timestamp; if stale by more than 5 minutes, surface a warning
- Handle calendar API errors gracefully: fall back to last-known availability rather than crashing

**Warning signs:**
- Availability query logic reads directly from Google Calendar API
- No sync health monitoring or alerting
- OAuth token expiry causes silent sync failure
- No retry/backoff logic on calendar API calls

**Phase to address:** Scheduling & Booking phase (architecture decision must be made before any calendar integration code is written)

---

### Pitfall 5: Voice AI Hallucinating Business Information

**What goes wrong:**
The AI confidently tells callers incorrect information — wrong business hours, a service the business doesn't offer, a price range it invented, an address that's slightly wrong. The caller shows up at the wrong time, expects a service that isn't available, or loses trust. Worse, in regulated trades (gas fitting, electrical), an AI casually offering safety assessments or quoting compliance-related work can create liability.

**Why it happens:**
LLMs have a strong tendency to fill knowledge gaps with plausible-sounding completions. If the system prompt doesn't explicitly constrain the AI to only speak from configured business data, the LLM will improvise when asked questions outside its configured scope. This is especially dangerous for specifics (prices, addresses, certifications, availability of specific technicians).

**How to avoid:**
- System prompt must explicitly instruct: "If you don't know, say 'I'll have [owner name] call you back with that information' — never guess"
- All business-specific facts (services, hours, service area, pricing ranges) must be injected as structured data into the prompt at call start — never rely on the LLM's training knowledge
- Implement a "knowledge boundary" test: call the agent and ask 10 questions it shouldn't know — verify it defers rather than invents
- For regulated trades: add explicit guardrails against providing safety diagnoses, compliance assessments, or permit advice
- Review call transcripts in the first week specifically hunting for hallucinated facts

**Warning signs:**
- System prompt allows open-ended responses without a fallback instruction
- Business information isn't injected dynamically at call start
- No transcript review process in early operation
- Caller asks about pricing and AI quotes a specific number that doesn't come from configuration

**Phase to address:** Voice Intelligence / Prompt Engineering phase — hallucination guardrails must be in the initial system prompt design, not added after complaints

---

### Pitfall 6: Multi-Language Support as an Afterthought

**What goes wrong:**
The system is built English-first with language support "to be added later." When multi-language is added, it requires restructuring the prompt system, the triage keyword lists (which are English-specific), the notification templates, the onboarding flow, and the voice model selection logic. The retrofit costs 3x more than building it in from the start, and the result is an inconsistent experience (English UI, Spanish voice, English SMS notifications).

**Why it happens:**
"We'll add Spanish later" is a common deferral that underestimates how deeply language assumptions are woven into every layer — not just the voice, but all text content, date/time formatting, address formats, and even the triage logic (emergency keywords vary by language).

**How to avoid:**
- Design the language selection mechanism from day one: detect caller language in first 2-3 turns, or allow the owner to configure a default language
- All user-facing text (prompts, notifications, UI labels) must be stored in translatable strings from the start — no hardcoded English strings
- Triage keyword lists and urgency patterns must be language-aware
- SMS/email notification templates must support multiple languages
- Vapi/Retell voice model selection must be parameterized by language, not hardcoded to an English model

**Warning signs:**
- All system prompts written as literal English strings in code
- Notification templates with hardcoded English text
- Triage keyword lists with no language parameter
- "Language support" is listed as a later phase with no architecture placeholder

**Phase to address:** Voice Infrastructure phase — language abstraction layer must be in place before any language-specific content is written

---

### Pitfall 7: Onboarding Complexity That Prevents Owner Activation

**What goes wrong:**
The platform requires owners to configure 15+ fields before making their first call — services list, tiers, availability windows, greeting script, emergency keywords, notification preferences, calendar connection. Most SME owners are non-technical, pressed for time, and will abandon a multi-step setup without getting value first. The product dies in the onboarding funnel before anyone hears the AI's voice.

**Why it happens:**
Developers build onboarding to match the system's internal data model rather than the owner's mental model. Every feature requires configuration, so developers expose every configuration field. The result is an enterprise-grade setup flow for a business owner who just wants calls answered.

**How to avoid:**
- Design a "30-second onboarding" path: business name, phone number, business type (plumber/HVAC/electrician), and done — AI uses sensible defaults for everything else
- Use business type to auto-populate a starter configuration (services list, emergency keywords, default availability template)
- Defer all advanced configuration to a "settings" section — make it optional, not required
- Show live demo capability immediately after minimal setup (call your number now, hear the AI answer)
- Progressive disclosure: surface advanced settings only after the owner has completed their first call

**Warning signs:**
- Onboarding flow requires calendar connection before first call can be made
- No default/starter configurations by trade type
- Setup has more than 5 required fields before a test call can be made
- No guided tour or contextual help for non-technical owners

**Phase to address:** Onboarding & Dashboard phase — validate with real SME users that setup to first call takes under 5 minutes

---

## v1.1 Milestone Pitfalls

The following pitfalls are specific to adding the v1.1 feature set (pricing page, unified onboarding wizard, contact/about pages, Outlook sync, multi-language E2E, concurrency QA, 5-min gate) to the existing system. These are integration-addition pitfalls, not greenfield design pitfalls.

---

### Pitfall 8: Breaking Existing Users When Unifying the Auth+Onboarding Flow

**What goes wrong:**
The current system has two separate flows: `/auth/signin` creates a Supabase account, then redirects to `/onboarding` (3-step wizard: business name → services → contact details). Unifying means moving account creation INTO the wizard (CTA → enter email/password → business setup → test call). Existing users who have already completed `/auth/signin` and `/onboarding` have auth state and a partially-or-fully-seeded `tenants` row. If the new unified flow applies onboarding redirect logic to ALL authenticated users (including existing ones), every existing user gets looped back through onboarding on next login.

**Why it happens:**
The redirect guard logic checks `if (!user) → /auth/signin` but doesn't distinguish between a returning user with complete onboarding and a new user who just created an account. Middleware that says "if logged in and no onboarding_complete flag → /onboarding" traps existing users who don't have that flag set in the database (because the flag was added after they onboarded).

**How to avoid:**
- Add an `onboarding_completed_at` timestamp column to the `tenants` table (nullable = incomplete) before deploying any new flow logic
- Backfill `onboarding_completed_at` for all existing tenants that have a `business_name` set — this is the safe migration step
- New unified wizard sets `onboarding_completed_at` on final step; existing users already have it set
- Auth callback redirect logic: `if (onboarding_completed_at IS NULL) → /signup-wizard ELSE → /dashboard`
- Deploy backfill migration and verify existing user count matches before deploying new flow
- Test explicitly: log in as an existing user, confirm they go to `/dashboard` not back through onboarding

**Warning signs:**
- New redirect logic added before backfill migration runs
- `onboarding_completed_at` column added but not backfilled for existing records
- No E2E test that verifies existing-user login still lands on `/dashboard`
- New unified wizard assumes `step=1` for any user that reaches it (including returning users)

**Phase to address:** Unified Onboarding Wizard phase — run the backfill migration as the very first step, before any frontend changes ship to production

---

### Pitfall 9: Outlook Calendar Sync is Significantly More Complex Than Google Calendar Sync

**What goes wrong:**
Teams treat Outlook sync as "Google Calendar sync but for Microsoft." It is not. Outlook sync via Microsoft Graph API involves Azure AD app registration, multi-tenant OAuth consent flows, admin approval requirements that can block individual SMB users (many of whom use Office 365 Business accounts where their employer's IT admin controls app consent), delta token management for incremental sync, and subscription-based webhooks that expire and must be renewed every 3 days. A naive implementation that mirrors the Google Calendar integration will fail silently for a significant portion of SMB users who cannot grant consent without IT administrator involvement.

**Why it happens:**
The Microsoft Graph API surface looks similar to Google's — OAuth2, access tokens, REST calendar endpoints. Developers assume the consent and permission model is the same. It is not: Microsoft's enterprise model distinguishes between personal Microsoft accounts (no admin) and Microsoft 365 work/school accounts (admin consent may be required), and many home service business owners who use Outlook are on Microsoft 365 business plans managed by an IT provider or Microsoft partner who controls app consent.

**How to avoid:**
- Register the Azure AD app as multi-tenant but request only `Calendars.ReadWrite` and `offline_access` delegated permissions — avoid any scopes requiring admin consent (like `Calendars.ReadWrite.Shared` or application-level permissions)
- Surface a clear "Your organization may require admin approval" error state with a mailto link to forward the admin consent URL to their IT contact
- Implement Microsoft Graph delta query with stored `@odata.deltaLink` for incremental calendar sync — do not poll full calendar on every sync cycle
- Webhook subscriptions (change notifications) expire in 4230 minutes (approximately 3 days) and must be renewed proactively; build a background job that renews all active subscriptions before expiry
- Store the delta token per tenant in the database; if a delta token is lost or expired, fall back to full re-sync of the calendar window (current day + next 30 days)
- Test specifically with a Microsoft 365 Business account, not just a personal @outlook.com account — the consent flows are different

**Warning signs:**
- Azure app registration requests application-level permissions instead of delegated permissions
- No handling for "admin approval required" error response during OAuth consent
- Webhook subscription renewal is not scheduled as a background job
- Delta token stored only in memory (lost on server restart → full re-sync on every restart)
- Only tested with personal @outlook.com accounts, not enterprise Office 365 accounts

**Phase to address:** Outlook Calendar Sync phase (Hardening & Launch) — treat this as a distinct integration from Google Calendar, not a copy-paste

---

### Pitfall 10: Pricing Page That Lists Features Instead of Selling Outcomes

**What goes wrong:**
The pricing page renders a feature matrix ("10 call recordings/month", "API access", "Priority support") instead of communicating the value at each tier. Home service SMB owners don't know what "API access" means and can't reason about "10 call recordings" vs "unlimited." They abandon the page without converting because they can't figure out which tier fits them. The pricing page looks complete but converts poorly.

**Why it happens:**
Developers and product teams copy competitors' feature-comparison tables because they're straightforward to build and seem comprehensive. The table answers "what do you get?" but not "who is this for?" or "why should I pay more?"

**How to avoid:**
- Lead each tier with a customer persona, not a feature list: "Starter — Solo plumber answering 20-50 calls/month", "Growth — HVAC shop with 2-3 technicians"
- The tier description should state the concrete outcome: "Never miss a lead when you're on a job"
- Feature comparison table can exist below the fold but should not be the primary content
- The recommended/hero tier ("Growth" at $249) should be visually prominent with a "Most Popular" badge — the center-stage effect drives middle-tier selection
- Price anchoring: the Enterprise tier ($Custom) makes $599 (Scale) feel reasonable; the $99 (Starter) makes $249 (Growth) look like a bargain
- For a product that isn't yet taking payment (display-only pricing per out-of-scope decision), the CTA should be "Start Free Trial" or "Get Started" — not a dead "Contact Sales" link with no next step

**Warning signs:**
- Pricing page primary content is a feature comparison table
- No visual differentiation between the recommended tier and others
- CTAs are the same across all tiers ("Get Started") without any behavioral difference
- No social proof near pricing (testimonials, number of businesses using the platform)
- Mobile view shows all 4 tiers horizontally, creating a scrolling mess

**Phase to address:** Pricing Page phase — review against conversion principles before ship, not after

---

### Pitfall 11: Unified Wizard Loses Step State on Page Refresh

**What goes wrong:**
The multi-step signup+onboarding wizard uses React component state (`useState`) to track which step the user is on and what data they've entered. If the user refreshes, navigates away, or the session expires mid-wizard, all state is lost and they restart from step 1. For a 5-step wizard (email entry → email verification → business name → services → test call), losing state at step 4 is a major drop-off point. This is especially bad for email verification flows where the user must leave the browser to click a link, come back, and resume.

**Why it happens:**
The current onboarding is split across URL routes (`/onboarding`, `/onboarding/services`, `/onboarding/verify`) which naturally persist step state via the URL and server-side session. Merging into a single-page wizard with client-side step management loses this property. Developers don't notice because they test by clicking through without refreshing.

**How to avoid:**
- Use URL-based step routing even within the wizard: `/signup/step/1`, `/signup/step/2`, etc. — or use query params `?step=business-name`
- Alternatively, persist wizard progress to the database after each step: once step 1 (business name) is saved via `/api/onboarding/start`, the user can return and pick up at step 2
- The wizard entry point should check for existing incomplete onboarding and resume at the correct step
- For the email verification step specifically: after the user clicks the email link and is redirected back, the `/auth/callback` route must carry forward the wizard step context (e.g., via the `next` query param: `?next=/signup?step=verify`)
- Test the refresh scenario explicitly at every step

**Warning signs:**
- Wizard step is tracked only in `useState` with no URL or DB persistence
- No "resume where you left off" logic at wizard entry
- `/auth/callback` redirects to `/onboarding` root without step context
- No test for the email verification mid-wizard flow (user must leave browser to click link)

**Phase to address:** Unified Onboarding Wizard phase — decide URL-vs-state persistence strategy as the first architectural decision, before building any wizard steps

---

### Pitfall 12: Concurrency QA That Tests the Happy Path, Not Contention

**What goes wrong:**
The concurrency QA phase runs load tests that simulate 50 concurrent users booking slots — but all users book different slots. The test passes. In production, a weather event causes 12 calls to arrive in 30 seconds, all trying to book the next available emergency slot (which is the same slot). The database locking that "passed QA" was never actually contended. Double-bookings happen.

**Why it happens:**
Load test scripts are written to simulate realistic traffic distribution — different users, different times, different slots. This tests throughput but not contention. Testing actual atomic locking requires deliberately sending multiple concurrent requests for the exact same resource simultaneously, which feels artificial but is the only way to verify the lock works.

**How to avoid:**
- Write a dedicated contention test separate from the load test: fire 20 simultaneous POST requests to `/api/bookings` all targeting slot ID `X` within a 100ms window
- Assert: exactly 1 request returns 201 Created; the rest return 409 Conflict with "slot already taken"
- Run this test in CI so it cannot be skipped
- Also test the soft-reservation TTL: reserve a slot, wait for TTL to expire without confirming, verify the slot becomes bookable again
- For Supabase/PostgreSQL specifically: verify that `SELECT ... FOR UPDATE` or the equivalent RPC function actually acquires a row-level lock — test this by inspecting `pg_locks` during a slow transaction

**Warning signs:**
- Load test script distributes requests evenly across many different slots — no contention simulation
- No test that deliberately fires concurrent requests at the same resource
- Soft-reservation TTL is not tested for expiry and release
- QA declared "passed" after throughput test but before contention test

**Phase to address:** Hardening & Launch phase — add the contention test to CI as a non-optional check during this phase

---

### Pitfall 13: Multi-Language E2E Testing That Stops at the Voice Layer

**What goes wrong:**
Multi-language E2E testing verifies that the Retell voice agent responds in Spanish when a Spanish-speaking caller calls. It does not verify that: (1) the triage output is language-aware (urgency classification for a Spanish emergency call), (2) the SMS notification to the owner includes the Spanish-language job description without garbling, (3) the booking confirmation SMS to the caller is in Spanish, and (4) the dashboard renders the Spanish transcript correctly without Unicode mangling. The "multi-language" test passes for voice but the non-English call still produces English notifications and garbled transcript text.

**Why it happens:**
Multi-language testing is scoped to "does the voice respond in Spanish?" because that's the obvious layer. The downstream chain — triage → booking → notification → dashboard display — is tested separately (if at all) and only in English.

**How to avoid:**
- Define multi-language E2E as a chain test that follows a call from inbound audio to dashboard display:
  `Spanish audio → Retell STT → triage (Spanish classification) → booking → SMS notification (Spanish) → email notification (Spanish) → dashboard transcript display (UTF-8 preserved)`
- Test each link in the chain explicitly, not just the first link
- Use a realistic Spanish test scenario: a caller describing a plumbing emergency in Spanish colloquial language ("se me rompió una tubería y hay agua por todas partes")
- Verify SMS and email notification bodies are in the caller's detected language, not the owner's UI language
- Test Unicode edge cases: Portuguese accented characters (ã, õ, ç), Chinese characters, Arabic right-to-left text in transcript display

**Warning signs:**
- Multi-language test only tests the Retell layer in isolation
- SMS notification templates have hardcoded English strings not passing through the i18n layer
- No test for what happens when ASR detects language mid-call (code-switching: English-Spanish mix)
- Dashboard transcript field is VARCHAR not TEXT — may truncate or corrupt long non-ASCII content

**Phase to address:** Hardening & Launch phase — define the chain test as the acceptance criterion for multi-language E2E before the phase begins

---

### Pitfall 14: 5-Minute Onboarding Gate Tested Only by Developers

**What goes wrong:**
The 5-minute onboarding gate ("a non-technical user can go from landing page → hearing their AI answer a test call in under 5 minutes") is validated by having a developer or teammate click through the wizard. Developers know what every field means, know to expect an email verification step, have a phone number ready, and complete the wizard in 3 minutes. A real SME owner (on a job site, unfamiliar with "AI agent," unsure what "business tone" means) takes 12 minutes, gets stuck on the phone number format, and never reaches the test call. The gate "passes" but the product fails real users.

**Why it happens:**
Convenience. Testing with a real non-technical user requires scheduling, a test environment, and willingness to observe awkward moments. Teams substitute their own judgment ("this is obvious") for user observation.

**How to avoid:**
- Recruit one actual home service SME owner (or someone who runs a small service business) to do a timed walkthrough on a staging environment
- Observer should not help — watch where they pause, what they re-read, what they skip
- Measure time-to-test-call from landing page CTA click, not from wizard step 1
- If the walkthrough takes more than 5 minutes, treat it as a blocking bug, not a nice-to-have
- Specific UX items that commonly block non-technical users: phone number format ambiguity ("+1 555..." vs "555..."), unclear distinction between "business phone" (where AI answers) and "owner notification phone" (where alerts go), multi-step email verification requiring app-switching

**Warning signs:**
- 5-minute gate tested only by people who built the product
- No real user recruited before declaring gate passed
- Time measurement starts at wizard step 1, not at the public landing page CTA
- No observation of where users hesitate or re-read

**Phase to address:** Hardening & Launch phase — schedule the non-technical user test before the phase is declared complete, not as an optional nice-to-have

---

### Pitfall 15: Contact and About Pages Treated as "Just Static Content"

**What goes wrong:**
The contact page's form submissions are not routed anywhere (or route to an email inbox that nobody monitors). The about page has placeholder team bio text that ships to production. The contact form has no spam protection, generating hundreds of spam submissions per day within 48 hours of launch. None of these pages are included in the sitemap or have meta descriptions, limiting SEO value. These pages "look done" in a design review but are broken in the functional sense.

**Why it happens:**
Contact and about pages are low-effort UI work that get built in an afternoon and deprioritized in QA. The form backend plumbing (where do submissions go? which email? what confirmation does the submitter see?) is often deferred to "later" and forgotten. Spam protection is added reactively after the inbox floods.

**How to avoid:**
- Contact form backend must be wired before the page ships: decide the destination (Resend/SendGrid to an ops inbox, or a Supabase table for CRM tracking)
- Add reCAPTCHA v3 or honeypot field at form build time, not after first spam wave
- Confirm email back to the submitter (even a simple "We'll get back to you within 1 business day")
- About page: ship with real (even minimal) content — a founder photo, one-paragraph mission statement, founding year — not placeholder "Lorem ipsum" or "Team bio coming soon"
- Both pages need `<title>` and `<meta description>` before going live; these cannot be retrofitted without a new crawl cycle
- Test: submit the contact form and verify the email arrives in the ops inbox within 60 seconds

**Warning signs:**
- Contact form `onSubmit` posts to an API route that returns 200 without actually sending email
- About page content is still placeholder text at code review
- No spam protection on the contact form
- Pages are not listed in the sitemap or have `noindex` meta tag from a dev environment config that wasn't removed

**Phase to address:** Contact & About Pages phase — treat form wiring and spam protection as acceptance criteria, not post-launch tasks

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Query Google Calendar directly per function call | No cache to maintain | Latency spikes, rate limits, silent failures | Never — build the async cache layer from the start |
| Store triage rules as hardcoded keyword arrays | Fast to implement | Language brittle, hard to update per-owner, missed classifications | Only in a throwaway prototype, never in production |
| English-only prompts and templates | Faster first version | Massive retrofit cost when multi-language needed; inconsistent UX | Never — use translatable strings from day one |
| No soft-reservation TTL (book immediately) | Simpler flow | Race conditions under concurrent load | Never for a booking system |
| Single-environment Vapi/Retell config | One less thing to manage | Can't test without hitting production webhook/phone number | Only in solo developer with no users; add staging before first external tester |
| Store call recordings only in Vapi/Retell platform | No storage cost | Recordings lost if you switch platforms or account is suspended | Only in early dev; migrate to own storage before first real customer |
| Track wizard step in React useState only | Simpler component code | State lost on refresh; email verification mid-wizard fails | Never for a multi-step wizard with an email verification step |
| Outlook sync copy-pasted from Google Calendar sync | Faster implementation | Silent failures for enterprise M365 users; delta token drift; webhook subscription expiry | Never — Outlook Graph API has fundamentally different consent and sync mechanics |
| Contact form without spam protection | Ship faster | Inbox flooded within 48 hours of public launch | Only behind an auth wall; never on a public page |
| Backfill migration skipped for onboarding_completed_at | Avoid migration complexity | All existing users looped back through onboarding on next login | Never — backfill is 2 lines of SQL and must run before flow logic deploys |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Vapi/Retell webhook | Not validating webhook signatures — anyone can POST fake call events | Always verify HMAC signature on every inbound webhook before processing |
| Google Calendar OAuth | Using a single OAuth token for all customer calendars in dev, not per-customer tokens in production | Each owner authorizes their own Google account; store per-owner refresh tokens encrypted |
| Google Calendar API | Not handling `410 Gone` (deleted event) responses — causes phantom availability | Treat 410 as a sync signal: delete the local event record and re-sync |
| Twilio/phone number provisioning | Buying a phone number but not configuring the webhook URL before first test | Configure webhook at number-purchase time; test with a call immediately after provisioning |
| Vapi function calls | Returning errors as HTTP 500 — Vapi retries aggressively, causing duplicate bookings | Return HTTP 200 with an error payload; let the AI handle the error gracefully in the conversation |
| Retell custom LLM endpoint | Using streaming responses without handling partial JSON — causes silent parse failures | Test streaming endpoint with a mock that sends partial chunks; verify assembly logic |
| Google Calendar events | Creating events without a timezone — Calendar assumes UTC, owner sees wrong times | Always specify `timeZone` in every event create/update call, derived from owner's configured timezone |
| SMS notifications (Twilio/etc.) | Not handling delivery failures — owner never knows a notification was lost | Implement delivery status webhooks; surface failed notifications in the dashboard |
| Microsoft Graph API (Outlook) | Requesting application-level calendar permissions instead of delegated — blocks all personal and most SMB accounts | Use delegated permissions (`Calendars.ReadWrite` + `offline_access`) only; never application permissions for user-calendar access |
| Microsoft Graph API (Outlook) | Not renewing webhook subscriptions before 3-day expiry — silent sync stoppage | Background job renews all active Graph subscriptions every 48 hours; alert on renewal failure |
| Microsoft Graph API (Outlook) | Losing delta token on server restart — triggers full calendar re-sync on every deploy | Persist `@odata.deltaLink` per tenant in the database; read from DB, not memory, on every sync cycle |
| Microsoft Graph API (Outlook) | Assuming SMB users can self-approve OAuth consent — many are on managed M365 plans requiring IT admin | Surface a clear "Your organization may need admin approval" error state with instructions for the admin consent URL |
| Supabase auth / unified wizard | Auth callback `next` param only carries the path, not wizard step state | Encode wizard step into the `next` param: `/auth/callback?next=/signup%3Fstep%3Dverify` |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous calendar availability check during voice function call | 2-4s dead air during booking conversation | Async cache with pre-loaded availability windows | At 1 concurrent call — it's always slow |
| Loading all leads into dashboard with no pagination | Dashboard hangs for owners with 6+ months of history | Cursor-based pagination from day one | ~500 leads (common after 3 months for active business) |
| Storing call transcripts as full text in the main CRM table | Full-text search and list queries slow | Store transcripts in separate object/blob storage; reference by ID in CRM | ~200 calls (transcripts are large) |
| No database indexes on lead status + created_at | Lead pipeline queries slow | Add composite index (status, created_at, business_id) at migration time | ~1,000 leads |
| Polling calendar sync every 5 seconds per connected business | DB and Calendar API hammering | Exponential backoff sync; use webhook push where available (Google Calendar push notifications) | ~20 connected businesses |
| Logging every STT word event to the database | Write amplification, DB bloat | Buffer in memory, write completed transcripts only | ~50 concurrent calls |
| Concurrency load test with no slot contention | False "pass" on locking correctness | Dedicated contention test: 20 concurrent requests targeting same slot ID | Discovered only in production under real emergency call surge |
| Microsoft Graph delta query without stored token | Full calendar re-sync on every server restart | Persist delta link token per tenant in DB | Every deploy cycle (daily in active development) |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing caller phone numbers in client-side API responses without auth | PII leak; caller data harvested by competitors | All caller PII behind authenticated API; no PII in public endpoints or logs |
| Storing call recordings as publicly accessible URLs | Any person with the URL can listen to a private call | Store recordings in private object storage with signed/expiring URLs |
| Not encrypting Google OAuth refresh tokens at rest | Compromised DB = attacker can access every connected owner's Google Calendar | Encrypt refresh tokens with app-level key (AES-256); never store plaintext |
| Allowing Vapi/Retell webhooks without signature validation | Attacker can POST fake "call completed" events, inject fake bookings | Validate HMAC signatures on every webhook; reject unsigned requests |
| Multi-tenant data leakage (missing business_id filter) | Owner A sees Owner B's leads | Every DB query must include business_id scoping; integration test for cross-tenant access |
| Logging full call transcripts to application logs | Transcripts contain PII (caller name, address, phone) that appears in log aggregators | Never log transcript content; log metadata only (call ID, duration, outcome) |
| Weak Vapi/Retell API key rotation policy | Leaked key = attacker can make calls billed to your account | Rotate API keys on any suspected exposure; store in secrets manager, not .env files in repo |
| Microsoft Graph refresh token stored in plaintext | Compromised DB = attacker reads/modifies any connected owner's Outlook calendar | Encrypt Graph refresh tokens with the same AES-256 pattern used for Google OAuth tokens |
| Contact form without CSRF protection or rate limiting | Bot abuse, spam inbox flooding, potential data injection | Add reCAPTCHA v3 or honeypot field; rate-limit submissions per IP to 5/hour |
| Pricing page CTAs that link to an unauthenticated internal API to start trial | Bots can trigger account creation at scale | Rate-limit the signup endpoint; add email verification before tenant row is created |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| AI says "I'll book you for [time]" before slot is actually confirmed | Caller told a time that later fails to book; creates broken promises | Only confirm a time slot after the database reservation is committed; say "checking availability" while doing so |
| Greeting too long ("Hello, thank you for calling ABC Plumbing, your trusted local plumber since 1987, how can I help?") | Callers hang up in first 5 seconds; "just answer the call" frustration | Greeting under 5 words plus pause: "ABC Plumbing, go ahead." Callers speak immediately |
| No way for caller to reach a human | Callers who want a real person feel trapped; creates distrust in AI | Always offer "press 0 or say 'operator' to leave a voicemail for [owner name]" as an escape hatch |
| Dashboard notifications without context | Owner sees "New lead" with no job type, no address, no urgency — wastes time clicking in | Every notification includes: caller name, job type, urgency level, address, and a one-tap "call back" link |
| No confirmation to the caller after booking | Caller hangs up uncertain — "did I actually get booked?" | End every booking with a verbal confirmation summary AND an SMS confirmation to the caller |
| Owner can't listen to calls from the dashboard | Owner can't verify what was promised or coach on misclassifications | Call recordings accessible (1-click play) directly from the lead detail view |
| Showing raw AI transcript without structure | Hard to scan; owner can't find the key info quickly | Lead detail shows extracted fields (job type, urgency, address, time slot) prominently; transcript is secondary/expandable |
| Pricing page with 4 horizontal tiers on mobile | Tiny cards, hard to compare, high abandon rate | Stack tiers vertically on mobile; show recommended tier first with expand-to-compare |
| Unified wizard that asks for email twice (in wizard and in existing verify step) | User confusion, perception of broken flow | Email collected once in step 1; verification happens in-flow via Supabase magic link or OTP, not a separate page |
| About page with no real humans visible | Low trust for a product that handles sensitive business calls | Show at minimum one founder's name, photo, and one-line bio — even a LinkedIn link is better than nothing |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Voice agent answers calls:** Verify it handles mid-sentence interruptions (barge-in) without losing context — most demos show clean turn-by-turn only
- [ ] **Calendar booking works:** Verify two simultaneous booking attempts for the same slot result in exactly one confirmation and one "next available" offer — concurrency test must exist
- [ ] **Triage classifies emergencies:** Verify it correctly handles indirect emergency descriptions ("water everywhere in my garage" not "flooding") — test with 20+ realistic non-idealized phrases
- [ ] **Google Calendar syncs:** Verify behavior when owner deletes an event in Google Calendar directly — does the slot re-open? Does a booking get orphaned?
- [ ] **Outlook Calendar syncs:** Verify with a Microsoft 365 Business account (not personal @outlook.com) — consent flow, delta sync, and webhook subscription renewal all work
- [ ] **Multi-language works (full chain):** Verify that a Spanish-speaking caller gets Spanish triage, Spanish SMS notifications, Spanish booking confirmation, and Spanish transcript stored without corruption — not just a Spanish voice response
- [ ] **Owner notifications fire:** Verify SMS and email notifications work when the SMS provider has a temporary failure — do they retry? Does the owner get told?
- [ ] **Call recordings are stored:** Verify recordings survive a Vapi/Retell account token rotation — are they in your storage or only in their platform?
- [ ] **Unified onboarding works for existing users:** Verify that an existing user who completed onboarding before the wizard was deployed logs in and lands on `/dashboard`, not in the wizard
- [ ] **Unified onboarding handles mid-wizard refresh:** Verify that refreshing the browser at step 3 of the wizard does not reset to step 1
- [ ] **Unified onboarding handles email verification mid-flow:** Verify that clicking the email verification link, switching back to the browser, and continuing the wizard works end-to-end
- [ ] **Pricing page converts:** Verify all CTA buttons link to the correct destinations; verify the page renders correctly on mobile (no horizontal overflow); verify the Enterprise "Contact Sales" CTA triggers an action (form/email), not a dead link
- [ ] **Contact form actually delivers submissions:** Submit the form and verify the email arrives in the ops inbox — do not assume the API route works without end-to-end verification
- [ ] **About page has no placeholder text:** Search codebase for "Lorem ipsum", "Coming soon", "TBD", "Team bio" strings before shipping
- [ ] **Onboarding is complete (5-minute gate):** Verify with an actual non-technical user (not a developer or teammate) — measure time from public landing page CTA to hearing the test call, not from wizard step 1

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Double-booking discovered | HIGH | (1) Contact both customers immediately, (2) manually re-slot one, (3) audit the slot locking code for the race condition, (4) replay recent bookings to check for other doubles, (5) write regression test |
| Voice AI hallucinated business info to caller | MEDIUM | (1) Review transcript, (2) correct the system prompt with explicit constraints, (3) if caller was given wrong commitment, owner calls back to correct, (4) audit other calls for same pattern |
| Google Calendar OAuth token expired silently | LOW-MEDIUM | (1) Alert owner to re-authorize, (2) replay missed sync window by pulling calendar events for last 24h, (3) check for bookings made in the gap against calendar events |
| Triage misclassified emergency as routine | HIGH | (1) Owner calls back immediately, (2) review and update triage prompt, (3) add the misclassified phrase as a labeled example in the test set, (4) re-run full triage test suite |
| Call recording lost (platform-only storage) | HIGH | (1) Contact Vapi/Retell support for recovery, (2) accept data loss for past calls, (3) immediately implement recording export to own storage, (4) communicate transparently to affected owners |
| Multi-tenant data leak (owner sees wrong leads) | CRITICAL | (1) Immediately audit all API endpoints for missing business_id scoping, (2) notify affected owners, (3) rotate all API keys, (4) engage security review before reopening access |
| Existing users looped back through onboarding after wizard deploy | HIGH | (1) Roll back the redirect logic, (2) run the backfill migration for onboarding_completed_at on all tenants with business_name set, (3) re-deploy with backfill verified, (4) monitor login success rate |
| Outlook sync silently broken (webhook subscription expired) | MEDIUM | (1) Check subscription expiry timestamps in DB, (2) manually re-register all expired subscriptions, (3) deploy the background renewal job, (4) trigger a full re-sync for affected tenants |
| Outlook admin consent blocking SMB user signup | MEDIUM | (1) Surface better error state ("Your IT admin needs to approve this app"), (2) provide admin consent URL for their IT contact, (3) consider offering Google Calendar as the primary path for affected users |
| Contact form spam flooding ops inbox | LOW | (1) Add rate limiting at the API route (5 submissions/IP/hour), (2) add honeypot field to the form, (3) add reCAPTCHA v3 async, (4) delete spam submissions from inbox |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Voice latency (function call dead air) | Voice Infrastructure (Phase 1) | Function call p95 latency < 800ms in load test before connecting to booking |
| Non-atomic slot locking | Scheduling & Booking (Phase 2) | Concurrency test: 10 simultaneous attempts on one slot → exactly 1 succeeds |
| Triage misclassification | AI Intelligence / Triage (Phase 2-3) | Triage accuracy test set: 50+ realistic caller phrases, >90% correct classification |
| Google Calendar as source of truth | Scheduling & Booking (Phase 2) | Architecture review: calendar sync is async background job; availability reads from own DB |
| AI hallucinating business info | Voice Intelligence / Prompts (Phase 1-2) | Knowledge boundary test: 10 out-of-scope questions all result in "I'll have [owner] call you" |
| Multi-language as afterthought | Voice Infrastructure (Phase 1) | All text content uses translatable string keys; switching language mid-config works end-to-end |
| Onboarding complexity | Onboarding & Dashboard (Phase 3-4) | Non-technical user (not developer) completes setup to first test call in < 5 minutes |
| Webhook signature not validated | Voice Infrastructure (Phase 1) | Unsigned webhook POST returns 401; duplicate event POST is idempotent |
| Call recordings in platform-only storage | Voice Infrastructure (Phase 1) | Recordings stored in own object storage within 24h of call completion |
| Multi-tenant data leakage | Any DB/API phase | Automated cross-tenant access test: Owner A's token cannot retrieve Owner B's leads |
| Breaking existing users (wizard unification) | Unified Onboarding Wizard | Run backfill migration first; verify existing user login → /dashboard before any flow changes deploy |
| Outlook sync complexity (consent, delta, webhooks) | Outlook Calendar Sync (Hardening) | Test with M365 Business account; verify delta token persists across restarts; webhook renewal scheduled |
| Pricing page feature-list antipattern | Pricing Page phase | Outcome-led tier descriptions reviewed before ship; mobile render verified; all CTAs functional |
| Wizard state lost on refresh | Unified Onboarding Wizard | Refresh-at-each-step test passes; email verification mid-flow E2E test passes |
| Concurrency QA missing contention test | Hardening & Launch phase | Dedicated contention test (20 concurrent requests, same slot) in CI; exactly 1 succeeds |
| Multi-language E2E stops at voice layer | Hardening & Launch phase | Full chain test: Spanish call → Spanish triage → Spanish SMS → dashboard UTF-8 intact |
| 5-minute gate tested only by developers | Hardening & Launch phase | Non-technical user timed walkthrough on staging; time measured from landing page CTA |
| Contact/about pages incomplete on ship | Contact & About Pages phase | Contact form email delivery verified; no placeholder text in about page; spam protection in place |

---

## Sources

- Microsoft Graph API documentation (Outlook Calendar, permissions reference, delta query, webhook subscriptions) — HIGH confidence [https://learn.microsoft.com/en-us/graph/outlook-calendar-concept-overview](https://learn.microsoft.com/en-us/graph/outlook-calendar-concept-overview)
- Microsoft Q&A: OAuth scope accumulation and admin consent pitfalls — MEDIUM confidence [https://learn.microsoft.com/en-us/answers/questions/2287394/issues-with-microsoft-graph-api-oauth-scope-handli](https://learn.microsoft.com/en-us/answers/questions/2287394/issues-with-microsoft-graph-api-oauth-scope-handli)
- Microsoft Entra: multi-tenant consent requirements — HIGH confidence [https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/grant-admin-consent](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/grant-admin-consent)
- Microsoft Graph webhook best practices (delta token + subscription renewal) — HIGH confidence [https://www.voitanos.io/blog/microsoft-graph-webhook-delta-query/](https://www.voitanos.io/blog/microsoft-graph-webhook-delta-query/)
- Supabase / PostgreSQL SERIALIZABLE isolation and race condition patterns — MEDIUM confidence [https://github.com/orgs/supabase/discussions/30334](https://github.com/orgs/supabase/discussions/30334)
- PostgreSQL SELECT FOR UPDATE and SKIP LOCKED for booking contention — HIGH confidence [https://on-systems.tech/blog/128-preventing-read-committed-sql-concurrency-errors/](https://on-systems.tech/blog/128-preventing-read-committed-sql-concurrency-errors/)
- Hamming AI: multilingual voice agent testing framework — MEDIUM confidence [https://hamming.ai/resources/multilingual-voice-agent-testing](https://hamming.ai/resources/multilingual-voice-agent-testing)
- SaaS pricing page psychology and conversion (center-stage effect, anchor pricing) — MEDIUM confidence [https://pipelineroad.com/agency/blog/saas-pricing-page-best-practices](https://pipelineroad.com/agency/blog/saas-pricing-page-best-practices)
- Auth0: user onboarding strategies and existing user migration pitfalls — MEDIUM confidence [https://auth0.com/blog/user-onboarding-strategies-b2b-saas/](https://auth0.com/blog/user-onboarding-strategies-b2b-saas/)
- SaaS launch checklist: contact/about page, analytics, accessibility oversights — MEDIUM confidence [https://designrevision.com/blog/saas-launch-checklist](https://designrevision.com/blog/saas-launch-checklist)
- Codebase inspection: `/src/app/auth/signin/page.js`, `/src/app/onboarding/page.js`, `/src/app/auth/callback/route.js`, `/src/app/onboarding/layout.js` — HIGH confidence (direct code evidence)

---
*Pitfalls research for: AI voice receptionist + home service booking platform (v1.1: pricing, unified onboarding, Outlook sync, launch hardening)*
*Researched: 2026-03-22*
