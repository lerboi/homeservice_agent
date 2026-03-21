# Stack Research

**Domain:** AI voice receptionist + scheduling CRM for home service SMEs — v1.1 milestone additions
**Researched:** 2026-03-22
**Confidence:** MEDIUM-HIGH (WebSearch verified; WebFetch blocked; version numbers sourced from npm search results and official sources)

---

## Scope

This document covers ONLY the stack additions needed for the v1.1 milestone. The existing stack (Next.js 15/React 19, Tailwind v4, shadcn/ui, Supabase, Retell, Framer Motion, next-intl, Twilio, Resend, Google Calendar via `googleapis`) is validated and unchanged.

New capabilities required:

1. **Pricing page** — display-only, 4 tiers, monthly/annual toggle (no Stripe — explicitly out of scope)
2. **Unified onboarding wizard** — multi-step form replacing separate auth + onboarding flows
3. **Contact page** — form that sends email via Resend (Resend already installed)
4. **About/company page** — static marketing page (no new libraries needed)
5. **Outlook Calendar sync** — Microsoft Graph API OAuth + bidirectional event sync
6. **Multi-language E2E validation** — Playwright test suite covering i18n flows
7. **Concurrency / load QA** — k6 load testing for slot-locking under concurrent calls

---

## Recommended Stack — New Additions

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `react-hook-form` | ^7.71.2 | Multi-step wizard form state, per-step validation | The standard for form management in React. Minimal re-renders, first-class Zod resolver integration, and `useFormContext` for sharing state across wizard steps without external state manager. Does not conflict with existing code — project has no forms today. |
| `zod` | ^4.3.6 | Schema validation for wizard steps and contact form | Zod v4 (released July 2025) is production-stable and the current ecosystem standard. Use the `zod/v4` subpath export (Zod 4's dual-package design). Pairs with `@hookform/resolvers` for RHF integration. Each wizard step gets its own Zod schema for incremental validation. |
| `@hookform/resolvers` | ^5.2.2 | Bridge between React Hook Form and Zod v4 | Required adapter — RHF does not consume Zod schemas natively. v5.x supports Zod v4. Do not install v3.x (Zod v3 only). |
| `@azure/msal-node` | ^5.1.1 | Microsoft OAuth 2.0 auth code flow with PKCE for Outlook Calendar | The official Microsoft Authentication Library for Node.js server-side code. Handles the Azure Entra ID OAuth dance — authorization URL generation, token exchange, token refresh — mirroring exactly how `google-auth-library` handles Google OAuth today. v5.x is the current major; v3.x is a parallel maintenance branch. Use v5. |
| `@microsoft/microsoft-graph-client` | ^3.0.7 | Microsoft Graph API client for Outlook Calendar CRUD + delta sync | The established stable client for Graph API. The TypeScript SDK (`@microsoft/msgraph-sdk`) is still in pre-release preview (1.0.0-preview.99) — do not use it yet. `microsoft-graph-client` v3.0.7 is the production-safe choice. Provides the same pattern as `googleapis`: authenticated client → calendar events CRUD + delta queries + webhook subscriptions. |
| `@playwright/test` | ^1.58.2 | End-to-end multi-language test suite | Project uses Jest for unit tests. Playwright covers the browser-level E2E flows that Jest cannot test: i18n routing, locale switching, wizard step navigation, calendar OAuth redirect flows. v1.58.x includes first-class TypeScript support and native Next.js App Router support. |
| `k6` (CLI, not npm) | ^1.6.1 | Concurrency and load testing for slot-locking and booking APIs | k6 is the industry-leading open-source load testing tool (29.9k GitHub stars, Feb 2026). Write test scripts in JavaScript. Tests the atomic slot-locking API (`/api/appointments`) under concurrent call load. Install as a system binary, not an npm package. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@microsoft/microsoft-graph-types` | ^2.x | TypeScript type definitions for Graph API responses | Install alongside `microsoft-graph-client` when event and calendar types are needed in JS/TS code. Provides `MicrosoftGraph.Event`, `MicrosoftGraph.Calendar`, etc. |
| `@hookform/resolvers` | ^5.2.2 | Already listed above — include in install block | — |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **k6 CLI** | Load testing `/api/appointments` booking endpoint under simulated concurrent Retell webhooks | Install via package manager or Docker: `brew install k6` / `choco install k6` / `docker run grafana/k6`. Write scripts in plain JS. Not a Node.js package. |
| **Playwright browsers** | Browser binaries for E2E tests | After installing `@playwright/test`, run `npx playwright install chromium` — only Chromium needed for i18n/wizard E2E. |

---

## Pricing Page — No New Libraries Needed

The pricing page (monthly/annual toggle, 4 tier cards) is built with existing stack:

- `useState` for the billing toggle — a single boolean controlling price display
- Framer Motion (already installed at ^12.38.0) for tier card animations
- Tailwind v4 CSS Grid for the 4-column responsive layout
- shadcn/ui `Badge` + `Button` for tier highlights and CTA buttons

No charting, payment, or pricing library is needed. The page is display-only — payment processing is explicitly out of scope for v1.1.

---

## Contact Page — No New Libraries Needed

The contact form sends an email via Resend (already installed at ^6.9.4). The contact form itself uses React Hook Form + Zod (new additions above). No additional library.

---

## About/Company Page — No New Libraries Needed

Static marketing page built with existing landing page patterns (AnimatedSection, Framer Motion, Tailwind). No new dependencies.

---

## Unified Onboarding Wizard — Pattern, Not a Library

The wizard is an application-level pattern, not a library install. The approach:

1. A wizard state context holds accumulated form data across steps
2. Each step renders a React Hook Form instance scoped to its Zod schema
3. `useFormContext` shares field values across steps without lifting state to a global store
4. URL-based step tracking (`/onboarding?step=2`) enables back-button navigation and deep linking
5. Supabase Auth signup happens at step 1; subsequent steps write to the `tenants` table via existing `/api/onboarding/start` route

The existing onboarding pages (`/onboarding`, `/onboarding/services`, `/onboarding/verify`, `/onboarding/complete`) are refactored into steps within the wizard, not replaced wholesale.

---

## Outlook Calendar Sync — Implementation Pattern

Mirrors the existing Google Calendar implementation exactly:

| Concern | Google (existing) | Outlook (new) |
|---------|-------------------|---------------|
| OAuth library | `google-auth-library` | `@azure/msal-node` |
| API client | `googleapis` | `@microsoft/microsoft-graph-client` |
| OAuth callback route | `/api/google-calendar/callback` | `/api/outlook-calendar/callback` |
| Token storage | `calendar_integrations` table | Same table, new `provider = 'outlook'` row |
| Delta sync | Google Calendar push notifications + `syncToken` | Graph API delta query + `@odata.deltaLink` |
| Webhook subscription | Google Calendar watch channel | Graph `POST /subscriptions` (max 4230-min TTL, requires renewal cron) |

The Microsoft Graph delta query pattern:
1. Initial sync: `GET /me/calendarView/delta?startDateTime=...&endDateTime=...` → paginate and store all events, save `@odata.deltaLink`
2. Incremental sync triggered by Graph webhook: re-query with saved `deltaLink` → only changed events returned
3. Webhook subscription renewal: existing cron job `renew-calendar-channels` extended to renew Microsoft Graph subscriptions before the 4230-minute expiry

Key difference from Google: Microsoft's tenant consent model requires the Azure app to be registered with appropriate Calendar scopes (`Calendars.ReadWrite`) and the user must be on Microsoft 365 (not just a personal Outlook.com account for organizational use cases). This affects onboarding UX — document clearly in settings page.

---

## Installation

```bash
# Form state — wizard + contact form
npm install react-hook-form zod @hookform/resolvers

# Outlook Calendar sync
npm install @azure/msal-node @microsoft/microsoft-graph-client @microsoft/microsoft-graph-types

# E2E testing
npm install -D @playwright/test
npx playwright install chromium

# Load testing (system binary — not npm)
# macOS: brew install k6
# Windows: choco install k6
# Docker: docker run --rm -i grafana/k6 run -
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `react-hook-form` + `zod` for wizard | Zustand wizard store + manual validation | Use Zustand if wizard steps need to share non-form state (file uploads, async side-effects between steps). For this wizard (text fields, toggles, one phone number input), RHF is sufficient and avoids a new global store. |
| `@azure/msal-node` v5 | `@azure/msal-node` v3 | v3 is a parallel maintenance branch for teams on Node < 18. This project is on Node 20+, use v5. |
| `@microsoft/microsoft-graph-client` v3 | `@microsoft/msgraph-sdk` (TypeScript SDK) | The TypeScript SDK is still 1.0.0-preview.99 (pre-release, last published Jan 2026). It will be the recommended choice once stable. Switch on 1.0.0 GA. |
| `@playwright/test` | Cypress | Cypress has historically better DX for component testing but Playwright is faster for full E2E, has better multi-locale/timezone support (`test.use({ locale, timezoneId })`), and the project already uses Jest for unit tests — Playwright for E2E avoids dual runner overhead. |
| k6 for load testing | Artillery | Artillery supports declarative YAML config which is easier for non-developers. k6 is preferred here because the slot-locking tests require precise concurrency scripting (multiple virtual users hitting the same slot simultaneously) which k6's imperative JS model handles more naturally. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Stripe or any payment library | Payment processing is explicitly out of scope for v1.1. The pricing page is display-only. Adding Stripe now couples PCI compliance concerns to a milestone that doesn't need it. | No library — build display-only tier cards with Tailwind |
| `@microsoft/msgraph-sdk` (TypeScript SDK) | Still in pre-release (1.0.0-preview.99 as of Jan 2026). Breaking changes are likely before GA. Do not use pre-release SDKs in production booking logic. | `@microsoft/microsoft-graph-client` v3.0.7 (stable) |
| `adal-node` (ADAL) | Microsoft deprecated the Azure Active Directory Authentication Library (ADAL) in June 2023. Using it for new integrations is a security and maintenance risk. | `@azure/msal-node` v5 |
| `formik` | Formik is significantly slower than React Hook Form (re-renders entire form on every keystroke). With a 5-step wizard, this becomes noticeable. Also, Formik's Zod integration requires an adapter that's less maintained than `@hookform/resolvers`. | `react-hook-form` |
| `react-stepzilla` / `react-multistep` | Opinionated wizard libraries that impose layout and routing structure. They conflict with the existing App Router URL-step pattern and shadcn/ui component system. | Application-level wizard pattern with RHF + `useFormContext` |
| Exchange Web Services (EWS) | Microsoft has confirmed EWS will stop accepting connections from Outlook add-ins on 1 October 2026. Starting a new EWS integration now means a mandatory rewrite in months. | Microsoft Graph API |

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `zod@^4.3.6` | `@hookform/resolvers@^5.2.2` | resolvers v5 added Zod v4 support. Do not pair zod v4 with resolvers v3 — the resolver will fail silently on schema parse. |
| `react-hook-form@^7.71.2` | `react@^19.0.0` (project uses React 19) | RHF v7.x is compatible with React 19. No issues. |
| `@azure/msal-node@^5.1.1` | Node.js 20+ | v5 requires Node 18+. Project is on Next.js 15/Node 20. Compatible. |
| `@microsoft/microsoft-graph-client@^3.0.7` | `@azure/msal-node@^5.1.1` | microsoft-graph-client requires an `AuthenticationProvider` interface. Implement a thin adapter that calls `msal-node`'s `acquireTokenSilent` and returns the access token. This adapter is ~15 lines of code. |
| `@playwright/test@^1.58.2` | `next@^16.1.7` | Playwright works with any Next.js version via `webServer` config in `playwright.config.js`. Specify `command: 'npm run dev'` and `port: 3000`. |
| `zod@^4.3.6` | existing `next-intl@^4.8.3` | No conflict. next-intl does not depend on Zod. |

---

## Stack Patterns by Variant

**For the Outlook OAuth flow (App Router server-side):**
- Use a Next.js API route (`/api/outlook-calendar/auth`) to generate the MSAL authorization URL and redirect the user — same pattern as the existing `/api/google-calendar/auth` route
- Store the MSAL auth code flow instance in a server-side session (encrypted cookie via `@supabase/ssr`), not in the browser
- Exchange code for tokens in `/api/outlook-calendar/callback`, store encrypted tokens in `calendar_integrations` table with `provider = 'outlook'`

**For the wizard (App Router, client component):**
- Wrap the wizard in a single `'use client'` boundary at the layout level
- Keep each step as a separate file in `/app/onboarding/steps/` for code clarity
- Use `useSearchParams` to read/write `?step=N` for bookmarkable navigation
- Persist form data to `sessionStorage` on each step's `onBlur` to survive accidental refreshes

**For Playwright i18n E2E:**
- Use `test.use({ locale: 'es', timezoneId: 'America/Los_Angeles' })` at the test file level for Spanish locale tests
- Load `messages/es.json` directly in test helpers to assert UI text without hardcoding translated strings
- Run two test projects in `playwright.config.js`: `{ name: 'en', use: { locale: 'en-US' } }` and `{ name: 'es', use: { locale: 'es-419' } }`

---

## Sources

- npm search results (WebSearch, 2026-03-22): react-hook-form 7.71.2, @hookform/resolvers 5.2.2, zod 4.3.6, @azure/msal-node 5.1.1, @playwright/test 1.58.2 — MEDIUM confidence (npm page not directly fetched; version numbers from search snippets)
- [Microsoft Graph delta query for calendar events](https://learn.microsoft.com/en-us/graph/delta-query-events) — official Microsoft docs — HIGH confidence
- [Microsoft Graph webhook + delta query pattern](https://www.voitanos.io/blog/microsoft-graph-webhook-delta-query/) — MEDIUM confidence
- [EWS deprecation October 2026](https://www.mckennaconsultants.com/ews-to-microsoft-graph-the-api-migration-every-outlook-add-in-developer-must-complete-by-october-2026/) — MEDIUM confidence (confirms Microsoft's official EWS deadline)
- [k6 v1.6.1, February 2026](https://k6.io/) — MEDIUM confidence (from WebSearch snippet)
- [Zod v4 release July 2025, latest 4.3.6](https://zod.dev/v4) — HIGH confidence (multiple sources agree)
- [@microsoft/msgraph-sdk pre-release status](https://www.npmjs.com/package/@microsoft/msgraph-sdk) — HIGH confidence (1.0.0-preview.99 as of ~Jan 2026)
- Existing codebase analysis (`google-calendar.js`, `package.json`, app route structure) — HIGH confidence (direct code read)

---

*Stack research for: v1.1 milestone additions — pricing page, onboarding wizard, contact, about, Outlook sync, E2E/load QA*
*Researched: 2026-03-22*
