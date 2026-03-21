# Project Research Summary

**Project:** HomeService AI Agent — v1.1 Site Completeness & Launch Readiness
**Domain:** AI voice receptionist + booking SaaS for home service SMEs
**Researched:** 2026-03-22
**Confidence:** MEDIUM-HIGH

## Executive Summary

The v1.1 milestone is an additive layer on top of a working v1.0 platform. The core voice, triage, scheduling, and CRM infrastructure is already built and validated. What is missing is the public-facing site completeness required to convert marketing traffic into paying customers: a pricing page, a unified signup-to-test-call onboarding wizard, a contact page, an about page, Outlook Calendar sync, and a QA hardening pass. These features share a clear dependency graph — the pricing page CTAs point to the wizard, the wizard depends on existing onboarding APIs, and the hardening phase gates on everything else being functional end-to-end.

The recommended build sequence runs from least risky to most risky: update shared nav/footer once, build the three static public pages (pricing, about, contact), then unify the onboarding wizard by adding an auth step as step 0, and finally add Outlook Calendar sync as the most complex independent integration. The wizard change is the highest-risk work because it touches middleware, auth callback routing, and the onboarding_complete flag that must be backfilled for existing users before any new redirect logic deploys. The Outlook integration is the most complex technical feature because Microsoft Graph's consent model, webhook validation handshake, and 3-day subscription TTL all differ significantly from the Google Calendar pattern it mirrors.

The biggest launch risk is not technical — it is activation quality. The 5-minute onboarding gate (CTA click to live AI answering the owner's phone in under 5 minutes) is the product's core promise. If the unified wizard does not deliver this, the pricing page becomes a liability rather than an asset. All hardening QA should be organized around validating that gate with a real non-technical SME user, not just internal team members.

## Key Findings

### Recommended Stack

The existing stack (Next.js 15/React 19, Tailwind v4, shadcn/ui, Supabase, Retell, Framer Motion, next-intl, Twilio, Resend, googleapis) needs only targeted additions for v1.1. Three new npm packages cover the wizard and Outlook sync. Load and E2E testing require two tooling additions. No payment library, no new state manager, and no wizard framework library should be added.

**Core technology additions:**
- `react-hook-form ^7.71.2` + `zod ^4.3.6` + `@hookform/resolvers ^5.2.2`: wizard form state with per-step Zod validation — the standard trio; RHF v7 is React 19 compatible; Zod v4 must be paired with resolvers v5 (do not mix versions — silent parse failures result)
- `@azure/msal-node ^5.1.1`: Microsoft OAuth2 server-side token exchange for Outlook — mirrors the role of `google-auth-library` in the existing Google Calendar flow; use v5 (Node 20+ required; v3 is maintenance-only for Node < 18)
- `@microsoft/microsoft-graph-client ^3.0.7`: Graph API REST client for Outlook Calendar CRUD and delta sync — the TypeScript SDK (`@microsoft/msgraph-sdk`) is still pre-release (1.0.0-preview.99) and must not be used in production
- `@playwright/test ^1.58.2`: browser-level E2E for i18n flows and wizard navigation — Jest handles unit tests; Playwright handles multi-locale browser scenarios Jest cannot
- `k6 ^1.6.1` (system binary, not npm): concurrent slot-locking load test — imperative JS scripting handles "20 VUs targeting the same slot simultaneously" scenarios that Artillery's declarative model makes awkward

**What not to add:** Stripe or any payment library (pricing is display-only), Formik (slower than RHF for multi-step wizards), opinionated wizard libraries (`react-stepzilla`, `react-multistep` — conflict with App Router routing), Exchange Web Services (EWS deprecated by Microsoft effective October 2026).

See `.planning/research/STACK.md` for full version compatibility matrix.

### Expected Features

The full feature dependency graph and prioritization matrix are in `.planning/research/FEATURES.md`. Summary:

**Must have (table stakes — v1.1 ships these):**
- Pricing page with 4 tiers (Starter $99 / Growth $249 / Scale $599 / Enterprise custom), monthly/annual display toggle, "Most Popular" badge on Growth tier, and ROI-framed hero copy — no Stripe, display-only
- Pricing FAQ section (5-7 questions: cancellation, overages, trials, refunds) and tier feature comparison table below the fold
- Unified signup + onboarding wizard — collapses `/auth/signin` + 3-step `/onboarding` into one flow; auth becomes step 0; live test call is the final step and the activation moment
- Contact page with three segmented inquiry routes (sales, support, partnerships), explicit response SLA copy, and backend wired to Resend ops inbox before ship
- About page with mission statement and founding story targeting trade owners — no placeholder text in production
- Error monitoring (Sentry or Axiom) — non-negotiable for a telephony product where silent failures are invisible
- Outlook Calendar sync (SCHED-03 deferred from v1.0)
- Environment variable audit before demo-ready declaration

**Should have (competitive differentiators):**
- Live test call finale inside the wizard — the activation "aha moment" that correlates with retention
- Routing question at wizard start that pre-populates trade-specific service list — setup feels instant
- ROI framing on pricing page ("pays for itself on day 1") rather than feature-list copy
- Calendly/Cal.com embed on contact page for demo self-booking
- Multi-language E2E validation (manual test script through full pipeline: voice → triage → booking → notifications → dashboard)
- Concurrency/load QA with contention-specific test targeting the same slot, not just throughput

**Defer to v2+:**
- Free trial tier (requires metered infra, abuse prevention, billing integration)
- Per-seat pricing model (requires pricing architecture restructure)
- Functional annual billing toggle with Stripe
- GDPR/cookie consent banner (when EU market is targeted)
- Full team page with professional headshots
- Pricing page A/B testing (meaningful only after ~5,000 monthly unique visitors)

### Architecture Approach

The existing codebase uses URL-based step routing for onboarding (each step is a real App Router route, not in-page state) and middleware protects `/onboarding/*` and `/dashboard/*`. The v1.1 changes are predominantly additive: three new public page routes, one new API route (`/api/contact`), a new onboarding sub-route (`/onboarding/setup`), a DB migration for the `calendar_credentials.provider` column, and a set of Outlook API routes that mirror the Google Calendar pattern. The wizard unification requires the minimum-diff approach: add step 0 at `/onboarding`, move existing step 1 content to `/onboarding/setup`, update middleware PROTECTED_PATHS accordingly. A full wizard rewrite is explicitly an anti-pattern — it risks breaking the working 3-step flow with large scope increase.

See `.planning/research/ARCHITECTURE.md` for the full file-change map (18 new files, 11 modified files).

**Major components and responsibilities:**
1. **LandingNav + LandingFooter (modified)** — shared across all public pages; updated once with Pricing/About/Contact links and mobile menu; never copied per page
2. **PricingSection + `src/lib/pricing-config.js`** — renders tier cards from static config; no API calls at build time or runtime; reusable on landing page
3. **ContactForm + `/api/contact` route** — RHF + Zod form with inquiry type selector; POST to Resend via existing `notifications.js` pattern; no DB table needed for v1.1
4. **Unified Wizard Step 0 (`/onboarding/page.js` replaced)** — public auth step (Supabase signUp or Google OAuth); subsequent steps `/onboarding/setup`, `/services`, `/verify` remain middleware-protected
5. **`/api/onboarding/complete` route (new)** — sets `tenants.onboarding_complete = true`; this field exists in the schema (migration 001) but is currently never written; required for already-onboarded detection
6. **`src/lib/scheduling/outlook-calendar.js` (new)** — MSAL client via `createMSALClient()`, Graph API event CRUD, delta sync with `@odata.deltaLink`, subscription management
7. **Outlook webhook handler (`/api/webhooks/outlook-calendar`)** — must respond to Microsoft's validation token handshake (`text/plain` body, immediate response) before processing sync events; this pattern does not exist in the Google handler
8. **CalendarSyncCard (modified)** — independent Outlook connect/disconnect panel alongside the existing Google panel; `/api/calendar-sync/status` extended to return both providers
9. **Migration 005** — adds `provider` column to `calendar_credentials` with default `'google'` and a unique index on `(tenant_id, provider)`, enabling both Google and Outlook credentials per tenant

### Critical Pitfalls

1. **Breaking existing users when unifying auth+onboarding (Pitfall 8)** — The middleware redirect `if (!onboarding_complete) → /onboarding/setup` will trap existing users who have a `tenants` row but no `onboarding_complete` flag (the field was never written by current code). Mitigation: backfill `onboarding_complete = true` for all tenants with `business_name IS NOT NULL` as the very first migration step, before any frontend flow changes deploy to production. Verify existing tenant count post-backfill. Test explicitly: log in as an existing user, confirm redirect goes to `/dashboard`, not `/onboarding/setup`.

2. **Outlook webhook validation token deadlock (Pitfall 9)** — Microsoft sends a `?validationToken=...` POST to the webhook URL immediately upon subscription creation. The handler must respond with the token as a `Content-Type: text/plain` body within seconds. Processing a full sync before responding causes a timeout and silent subscription creation failure. Mitigation: check for `validationToken` query param at the top of the handler, respond immediately, then fire-and-forget sync.

3. **Wizard step state lost on refresh or email verification app-switch (Pitfall 11)** — The wizard uses URL-based routing which preserves context on refresh. The key risk is the email verification step: the user must leave the browser, click a link in their email, return, and resume. The `/auth/callback` route must carry `?next=/onboarding/setup` so the user lands at the correct step post-verification. Persist form data to `sessionStorage` on each step's `onBlur` as a safety net against accidental refresh.

4. **Pricing page lists features instead of selling outcomes (Pitfall 10)** — Feature comparison matrices fail with SME buyers who think in jobs and revenue. Each tier must lead with a customer persona and concrete outcome ("Solo plumber answering 20-50 calls/month — never miss a lead while on a job"). Feature comparison table belongs below the fold, not as primary content. The Growth tier at $249 must be visually prominent with the "Most Popular" badge — missing this costs 22% conversion according to 2025 UX research.

5. **5-minute onboarding gate validated only by developers (Pitfall 14)** — Developers completing the wizard in 3 minutes proves nothing about real SME users. The gate must be validated with one actual home service business owner on staging, with timing starting from the public landing page CTA click. Common blockers for non-technical users: phone number format ambiguity ("+1 555..." vs "555..."), unclear distinction between "business phone" (where AI answers) and "notification phone" (where alerts go), email verification requiring app-switching mid-wizard.

6. **Outlook admin consent blocking SMB users (Pitfall 9 extension)** — Many home service businesses use Microsoft 365 Business plans where an IT admin controls app consent. Register the Azure AD app with only delegated `Calendars.ReadWrite` and `offline_access` scopes — avoid application-level or Shared permissions which always require admin consent. Surface a "Your organization may require admin approval" error state with a mailto link for the admin consent URL.

7. **Contention test mistaken for load test (Pitfall 12)** — A load test that distributes 50 concurrent users across different slots tests throughput, not slot-locking correctness. The contention test must deliberately fire 20 simultaneous requests at the exact same slot within a 100ms window and assert exactly 1 returns 201 and the rest return 409. This test must run in CI, not just locally during QA.

## Implications for Roadmap

Based on the dependency graph and risk profile from combined research, four phases cover all v1.1 work:

### Phase 1: Public Marketing Pages
**Rationale:** The three static public pages have zero integration risk, deliver immediate demo value, and share LandingNav/LandingFooter — updating those components once unlocks all three pages. This is the fastest path to something showable and the lowest-risk work in the milestone.
**Delivers:** `/pricing`, `/about`, `/contact` pages; LandingNav updated with mobile menu and new links; LandingFooter updated with multi-column layout; contact form wired to Resend ops inbox; spam protection (honeypot or reCAPTCHA v3) added at build time
**Addresses:** Pricing page (4 tiers, monthly/annual toggle, FAQ, comparison table, ROI hero copy, Most Popular badge); about page (mission + founding story, real beta count); contact page (segmented inquiry routes, response SLA, Calendly embed)
**Avoids:** Pitfall 10 (tier cards lead with persona + outcome, not feature lists); Pitfall 15 (contact form backend wired before ship; real content in about page; both pages with title + meta description)
**Stack:** Existing Tailwind/shadcn/Framer Motion; react-hook-form + zod for contact form; Resend (already installed); `src/lib/pricing-config.js` static config file
**Research flag:** No deeper phase research needed — well-documented SaaS patterns; architecture file provides precise component and file plan

### Phase 2: Unified Signup + Onboarding Wizard
**Rationale:** This is the highest-risk feature change — it touches middleware, auth callbacks, onboarding redirect logic, and requires a backfill migration for existing users. It must be E2E validated before pricing page CTAs go live. Building it second, after static pages are stable, keeps the risk isolated and allows Phase 1 to ship independently.
**Delivers:** Single CTA-to-live-AI-receptionist wizard with auth as step 0; routing question pre-populates trade-specific services; 4-step progress indicator; email verification handled inline; live test call as finale; `tenants.onboarding_complete` properly set on wizard completion
**Addresses:** Unified signup + onboarding wizard (P1); routing question at start; progress indicator; email verification inline; live test call finale (5-minute activation gate)
**Avoids:** Pitfall 8 (backfill migration runs as the very first step before any frontend changes deploy); Pitfall 11 (URL-based step state, sessionStorage on blur, auth callback carries next param); Pitfall 14 (gate validated by real SME user, not developer, timing from landing page CTA)
**Stack:** react-hook-form + zod for step forms; `useSearchParams` for URL-step navigation; Supabase browser client for step 0 auth; new `/api/onboarding/complete` route; middleware PROTECTED_PATHS updated
**Research flag:** Medium risk but well-mapped — architecture file provides exact file-by-file change plan based on direct codebase inspection; no new external service; no phase research needed

### Phase 3: Outlook Calendar Sync
**Rationale:** Outlook sync is fully independent of the wizard and public pages — it cannot block demo-readiness and its complexity warrants focused isolation. The MSAL setup, DB migration, webhook subscription model, and delta query pattern are all new territory meaningfully different from Google Calendar.
**Delivers:** Outlook OAuth connect/disconnect in CalendarSyncCard settings; bidirectional calendar event sync via Graph delta query with `@odata.deltaLink`; webhook-driven incremental sync with validation token handshake; daily subscription renewal cron (3-day Graph TTL vs Google's 7-day); migration 005 adding `provider` column and per-tenant-provider unique index
**Addresses:** Outlook Calendar sync (SCHED-03 deferred from v1.0); dual-provider CalendarSyncCard; admin consent UX
**Avoids:** Pitfall 9 (validation token handshake implemented; delegated-only scopes registered; admin consent error state surfaced with mailto link; delta token persisted in DB not memory; webhook renewal as daily cron; tested with enterprise Office 365 account not just personal Outlook)
**Stack:** `@azure/msal-node ^5.1.1`; `@microsoft/microsoft-graph-client ^3.0.7`; migration 005; `createMSALClient()` pattern mirroring `createOAuth2Client()` in existing Google module
**Research flag:** HIGH — needs a focused phase research pass before writing implementation tasks; Microsoft Graph subscription model, admin consent vs delegated permission flows, delta query token lifecycle, and validation token handshake semantics have enough nuance to justify pre-task research

### Phase 4: Hardening & Launch QA
**Rationale:** QA gates on all prior phases being complete. The hardening pass is not optional decoration — it is the difference between a product that looks done and one that is safe to hand to real customers.
**Delivers:** Error monitoring (Sentry) with unhandled exception and API failure capture; environment variable audit; multi-language E2E validation (Spanish minimum, full pipeline chain: voice → triage → booking → SMS/email → dashboard display, not just voice layer); slot-locking contention test in CI (20 simultaneous requests to same slot, assert exactly 1 succeeds); 5-minute onboarding gate validated by real SME user on staging
**Addresses:** Error monitoring (non-negotiable for telephony); multi-language E2E (manual test script); concurrency/load QA; env var audit; 5-minute activation gate
**Avoids:** Pitfall 12 (contention test separate from throughput test; contention test in CI); Pitfall 13 (multi-language chain test covers all layers, not just Retell voice; UTF-8 preservation verified in SMS/email/dashboard); Pitfall 14 (5-minute gate tested by real SME owner, timer starts at landing page CTA)
**Stack:** `@playwright/test ^1.58.2` with `test.use({ locale, timezoneId })` for i18n E2E; k6 CLI for slot-locking contention test; Sentry SDK
**Research flag:** No phase research needed — Playwright, k6, and Sentry are mature tools with comprehensive documentation; execution is the bottleneck, not knowledge gaps

### Phase Ordering Rationale

- Phase 1 before Phase 2 because static pages are lower risk and produce demo-able output quickly; however, pricing page CTAs must not go live to real traffic until Phase 2 (wizard) is functional
- Phase 2 before Phase 3 because the wizard is on the critical path for the 5-minute activation promise; Outlook sync is independent and must not delay that promise
- Phase 3 before Phase 4 because hardening validates everything including the dual-provider calendar flow; starting Phase 4 before Outlook is functional leaves calendar QA incomplete
- Backfill migration for `onboarding_complete` on existing tenants is a hard ordering constraint: it must deploy before any Phase 2 redirect logic reaches production

### Research Flags

**Needs deeper research before task breakdown:**
- **Phase 3 (Outlook Calendar Sync):** Microsoft Graph subscription lifecycle, admin consent vs delegated permission flows, delta query token management, and the validation token handshake are meaningfully different from Google's patterns. A focused research pass before writing Phase 3 implementation tasks will prevent mid-phase surprises.

**Standard patterns, skip research-phase:**
- **Phase 1 (Public Marketing Pages):** SaaS pricing page and static content patterns are well-documented; architecture file provides precise component plan; no unknowns.
- **Phase 2 (Unified Wizard):** Architecture file provides exact file-by-file change plan based on direct codebase inspection; no new external service or unknown API.
- **Phase 4 (Hardening):** Playwright, k6, and Sentry are mature with comprehensive docs; patterns are well-established.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core additions verified via npm search results and official docs; version numbers from search snippets (npm pages not directly fetched); MSAL and Graph client versions confirmed against official Microsoft docs; Zod v4 release confirmed against multiple sources |
| Features | HIGH | Multiple live web sources (Userpilot, UserGuiding, DesignRevision, SaaSUI) with consistent recommendations; feature priorities align across sources; competitor analysis grounded in live product observation (Goodcall, Smith.ai, Ruby) |
| Architecture | HIGH | Based on direct codebase inspection — file structure, middleware, DB schema, and existing API routes all read directly; no speculation; file-by-file change plan is concrete and tested against actual file contents |
| Pitfalls | MEDIUM-HIGH | v1.0 pitfalls from training knowledge (MEDIUM); v1.1 pitfalls from live web search + codebase inspection (HIGH); Microsoft Graph subscription nuances confirmed against official Microsoft docs |

**Overall confidence:** MEDIUM-HIGH — sufficient to begin phase planning immediately. Only Phase 3 (Outlook sync) warrants a pre-task research pass.

### Gaps to Address

- **Outlook admin consent exact error shape:** Research confirms the risk and mitigation but the exact OAuth error response from Microsoft's token endpoint when admin consent is required should be verified against a live Azure AD response during Phase 3 research. The UX error state is designed; the trigger condition needs confirmation with a real Microsoft 365 Business account in a test tenant.
- **`onboarding_complete` backfill safety:** The backfill `UPDATE tenants SET onboarding_complete = true WHERE business_name IS NOT NULL` is the recommended approach. Before running it in production, confirm the actual count of tenants with partial onboarding data (account created but `business_name` not set) to ensure no tenant is incorrectly marked complete.
- **k6 availability in CI environment:** k6 is a system binary, not an npm package. Confirm whether the CI environment (GitHub Actions or equivalent) supports k6 binary installation before Phase 4 task scoping. If not, contention tests may need to run in a Docker-based CI step or locally as a required pre-merge gate.
- **Calendly vs Cal.com embed:** Research recommends Cal.com for its self-hostable zero-dependency nature, but the contact page design should confirm which embed approach fits the existing page width and layout before either is committed to Phase 1 tasks.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection (`src/app/`, `src/middleware.js`, `src/lib/scheduling/google-calendar.js`, `package.json`, `supabase/migrations/`) — architecture facts, existing integration patterns, current file structure
- [Microsoft Graph delta query for calendar events](https://learn.microsoft.com/en-us/graph/delta-query-events) — official Microsoft docs
- [Zod v4 release notes and dual-package export](https://zod.dev/v4) — version compatibility confirmed across multiple sources

### Secondary (MEDIUM confidence)
- npm search results (2026-03-22): react-hook-form 7.71.2, @hookform/resolvers 5.2.2, zod 4.3.6, @azure/msal-node 5.1.1, @playwright/test 1.58.2 — version numbers from search snippets, npm pages not directly fetched
- [SaaS Pricing Page Best Practices 2026 — InfluenceFlow](https://influenceflow.io/resources/saas-pricing-page-best-practices-complete-guide-for-2026/)
- [SaaS Pricing Page Best Practices — PipelineRoad](https://pipelineroad.com/agency/blog/saas-pricing-page-best-practices)
- [SaaS Onboarding Flows That Actually Convert in 2026 — SaaSUI](https://www.saasui.design/blog/saas-onboarding-flows-that-actually-convert-2026)
- [What is an Onboarding Wizard — UserGuiding](https://userguiding.com/blog/what-is-an-onboarding-wizard-with-examples)
- [Microsoft Graph webhook + delta query pattern — Voitanos](https://www.voitanos.io/blog/microsoft-graph-webhook-delta-query/)
- [EWS deprecation October 2026](https://www.mckennaconsultants.com/ews-to-microsoft-graph-the-api-migration-every-outlook-add-in-developer-must-complete-by-october-2026/)
- [k6 v1.6.1 February 2026](https://k6.io/)

### Tertiary (MEDIUM-LOW confidence)
- [@microsoft/msgraph-sdk pre-release status](https://www.npmjs.com/package/@microsoft/msgraph-sdk) — 1.0.0-preview.99 as of ~Jan 2026; verified but snapshot in time; recheck before Phase 3 begins in case GA has shipped

---
*Research completed: 2026-03-22*
*Ready for roadmap: yes*
