# Stack Research

**Domain:** AI voice receptionist + scheduling CRM for home service SMEs
**Researched:** 2026-03-18
**Confidence:** MEDIUM (training data through Aug 2025; WebSearch/WebFetch unavailable this session — version numbers flagged where verification needed)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Vapi** | API v1 (current) | Voice AI telephony layer — inbound call handling, STT, TTS, LLM orchestration | Purpose-built for voice agents. Handles the full call lifecycle: phone number provisioning, speech-to-text, LLM turn management, text-to-speech, and call recording. Sub-500ms response latency in production. Ships a Node.js SDK and server-side webhook model. Directly referenced in PROJECT.md as primary choice. |
| **Next.js** | 14.x (App Router) | Full-stack web framework — dashboard UI + API routes | App Router colocates server components with API routes, eliminating a separate Express server. Server Actions handle form mutations. Edge runtime available for low-latency webhook endpoints. Industry-standard for TypeScript SaaS dashboards in 2025. |
| **TypeScript** | 5.x | Type safety across frontend, backend, and shared domain types | Vapi, Supabase, and Google Calendar client libraries all ship first-class TypeScript types. Shared types between API routes and UI components eliminates a large class of runtime bugs — critical for scheduling logic where type errors cause double-bookings. |
| **Supabase** | latest (JS client v2.x) | Postgres database, auth, real-time subscriptions, storage | Provides the atomic row-level locking via Postgres transactions needed for slot reservation (no double-bookings). Row-level security (RLS) enforces multi-tenant isolation per business with zero application-layer code. Real-time subscriptions power live dashboard updates when calls come in. Storage for call recordings. Faster to production than raw Postgres + custom auth. |
| **OpenAI GPT-4o** | gpt-4o (via Vapi model config) | LLM backbone for triage intelligence and conversation flow | GPT-4o is the current default in Vapi assistant configs for function-calling accuracy. The triage layer (keyword + urgency classification + owner-configured rules) needs reliable JSON-mode structured outputs. GPT-4o handles multi-language natively, satisfying the multi-language v1 requirement without a separate translation layer. |
| **ElevenLabs** | v1 API (via Vapi voice config) | Text-to-speech voice synthesis | Vapi supports ElevenLabs as the TTS provider. ElevenLabs voices are perceptually more natural than Google WaveNet or Amazon Polly for English — critical for caller trust in a voice receptionist. Multi-language voice clones are available. Can be swapped to Vapi's built-in TTS (Deepgram Aura) if cost matters more than voice quality. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@vapi-ai/server-sdk** | latest (0.x) | Server-side Vapi webhook handling and assistant management | Every call event (call.started, call.ended, tool_calls) arrives as a webhook. This SDK provides typed request/response objects and signature verification. Use in Next.js API routes that receive Vapi events. |
| **@supabase/supabase-js** | 2.x | Supabase client for DB queries, auth, real-time | Primary DB interface. Use the server client (with service role key) in Next.js Server Components and API routes. Use the anon client in browser for auth flows. |
| **@supabase/ssr** | latest | Cookie-based session management for Next.js App Router | Replaces the old `auth-helpers-nextjs`. Required for server-side session reading in Next.js 14 middleware and Server Components. |
| **googleapis** | 144.x | Google Calendar API client | Calendar sync for booking slots, reading availability, writing confirmed appointments. The official Node.js Google API client. Use only server-side — never expose OAuth tokens to the browser. |
| **@microsoft/microsoft-graph-client** | 3.x | Microsoft Graph API for Outlook Calendar sync | Required for Outlook/Office 365 calendar integration. Parallel to googleapis. Use only server-side. |
| **Zod** | 3.x | Runtime schema validation | Validate all inbound Vapi webhook payloads, tool call arguments, and form inputs before they touch the database. Pairs with TypeScript for end-to-end type safety. |
| **Zustand** | 4.x | Client-side state for dashboard UI | Lightweight state manager for the CRM dashboard (lead pipeline, notification feeds, calendar view). Avoid Redux overhead for a single-tenant dashboard. |
| **Tanstack Query (React Query)** | 5.x | Server state, data fetching, cache invalidation | Manages async data in the dashboard (leads list, calendar slots). Pairs with Supabase real-time for optimistic updates when new leads arrive. |
| **Resend** | 3.x | Transactional email (owner notifications) | Modern email API with a React-based template system. Used for "new lead" and "booking confirmed" email notifications to business owners. Better DX than SendGrid for code-first teams. |
| **Twilio (SMS)** | ^5.x | SMS notifications to business owner | Owner notifications via SMS when a call comes in. Twilio remains the standard for programmable SMS. Only use the REST API (not Twilio Voice — Vapi handles telephony). |
| **date-fns** | 3.x | Date/time arithmetic for scheduling logic | Timezone-aware slot availability calculations, travel buffer math, business hours checks. Prefer over Moment.js (deprecated) and Day.js (lacks some TypeScript strictness). |
| **Tailwind CSS** | 3.x | Utility-first CSS for dashboard UI | De facto standard for Next.js SaaS dashboards. Mobile-responsive without custom breakpoint logic. |
| **shadcn/ui** | latest (component registry) | Accessible UI component set built on Radix UI + Tailwind | Provides calendar pickers, data tables, dialogs, and form components needed for the CRM dashboard. Components are copied into the codebase (not a package dependency) — no version lock-in. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **Vitest** | Unit and integration testing | Fast, ESM-native test runner that works with Next.js without config gymnastics. Use for testing triage logic, slot-locking algorithms, and webhook handlers. |
| **Playwright** | End-to-end browser testing | Test the dashboard booking flow and CRM pipeline UI. Use `@playwright/test` with Supabase test database. |
| **ngrok / Vapi CLI** | Local webhook tunneling during development | Vapi webhooks must reach a public URL. ngrok or the Vapi CLI's tunnel feature forwards local Next.js dev server to a public endpoint. Required for all call flow testing. |
| **Prisma** | (Optional) ORM for type-safe DB access | Adds a schema migration layer on top of Supabase Postgres. Use if the team prefers ORM-style queries. Skip if using Supabase client directly with RLS — adds complexity without benefit for a small schema. |
| **ESLint + Prettier** | Code quality and formatting | Standard Next.js eslint config. Add `eslint-plugin-react-hooks` and `@typescript-eslint`. |
| **Vercel** | Hosting and deployment | Next.js is owned by Vercel. Edge functions, serverless API routes, and preview deployments work with zero config. Use for production. Note: Vercel functions have a 10s default timeout — upgrade to Pro or configure `maxDuration` for long-running webhook handlers. |

---

## Installation

```bash
# Core framework
npx create-next-app@14 homeservice-agent --typescript --tailwind --app --use-npm

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# Vapi server SDK
npm install @vapi-ai/server-sdk

# Calendar integrations
npm install googleapis @microsoft/microsoft-graph-client

# Notifications
npm install resend twilio

# Validation and utilities
npm install zod date-fns

# UI state
npm install zustand @tanstack/react-query

# UI components (shadcn is a CLI tool, not an npm package)
npx shadcn@latest init

# Dev dependencies
npm install -D vitest @playwright/test @vitejs/plugin-react
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Vapi** | **Retell AI** | Retell has comparable latency and a slightly simpler "agent" abstraction. Use Retell if Vapi's function-calling reliability proves problematic in testing, or if Retell's built-in agent templates match the triage use case more closely. Both are viable; Vapi has more extensive documentation and a larger developer community as of mid-2025. |
| **Vapi** | **Bland.ai** | Bland is optimized for outbound campaigns (bulk calling). Inbound receptionist use case is not its primary target. Avoid for this project. |
| **Vapi** | **Raw Twilio + Deepgram + OpenAI** | Build from scratch if you need absolute control over every latency millisecond or have a use case Vapi can't express (e.g., custom DTMF, proprietary STT models). Adds ~4-6 weeks of infra work with no business value for v1. |
| **Supabase** | **PlanetScale / Neon** | Neon is a strong alternative serverless Postgres. Use if Supabase's opinionated auth or real-time features are not needed and pure Postgres flexibility matters more. For this project, Supabase's RLS multi-tenancy and real-time dashboard updates justify the choice. |
| **Supabase** | **Firebase Firestore** | Firebase lacks SQL joins, making the relational lead-job-calendar schema awkward. Avoid for this domain. |
| **Next.js App Router** | **Remix** | Remix has excellent form mutation patterns. Use if the team is Remix-experienced. Next.js is preferred here because shadcn/ui, Supabase SSR helpers, and Vercel deployment are all Next.js-first. |
| **OpenAI GPT-4o** | **Anthropic Claude (via Vapi)** | Vapi supports Claude as an LLM backend. Use Claude if GPT-4o function-calling reliability causes triage misclassifications in testing. Claude 3.5 Sonnet has comparable tool-calling accuracy. |
| **ElevenLabs TTS** | **Deepgram Aura (Vapi native)** | Deepgram Aura is Vapi's built-in TTS — lower latency and lower cost. Use Aura if ElevenLabs voice quality is not worth the added latency (~100-200ms) and cost. |
| **Resend** | **SendGrid / Postmark** | Sendgrid and Postmark are mature alternatives. Resend is preferred for its React Email template DX and simpler API. Use Postmark if deliverability is the primary concern. |
| **date-fns** | **Luxon** | Luxon has a richer timezone API. Use if complex recurring schedule logic (e.g., DST-aware weekly patterns) becomes a pain point with date-fns. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Twilio Voice (for the AI call handling)** | Twilio Programmable Voice requires you to build the entire STT/LLM/TTS pipeline manually. Adds months of infra work and latency tuning. Vapi/Retell exist specifically to solve this. | Vapi or Retell AI |
| **Moment.js** | Officially deprecated since 2020. 67KB bundle size. Mutable API causes subtle bugs in scheduling logic. | date-fns (tree-shakeable, immutable) or Luxon |
| **Redux** | Heavyweight state management for a single-tenant dashboard with ~5 data models. Boilerplate cost exceeds value. | Zustand (minimal API, TypeScript-friendly) |
| **Express.js standalone server** | Next.js API routes and Server Actions already provide a backend runtime. A separate Express server doubles deployment complexity for no gain. | Next.js App Router API routes |
| **Firebase Firestore** | No SQL joins. Querying "all leads for a business within a date range sorted by urgency" requires denormalized data or multiple reads. Scheduling logic is inherently relational. | Supabase (Postgres) |
| **Heroku** | Heroku's free tier was discontinued; its paid tiers are expensive for a startup. No native Next.js or edge function support. | Vercel (Next.js native) or Railway |
| **Socket.io** | Supabase real-time already provides WebSocket subscriptions backed by Postgres NOTIFY. Adding Socket.io duplicates this layer and adds server maintenance. | Supabase Realtime channels |
| **React Hook Form alone (without Zod)** | Form validation alone is not enough — Vapi webhook payloads, tool call arguments, and API inputs all need server-side validation. Zod provides both client and server validation with shared schemas. | React Hook Form + Zod resolver (for forms), Zod alone (for API validation) |

---

## Stack Patterns by Variant

**If self-hosting is required (no Vercel):**
- Deploy Next.js on Railway or Fly.io with Docker
- Use Supabase self-hosted (Docker Compose) or Neon for Postgres
- Add a Redis instance (Upstash) for distributed slot-locking instead of Postgres advisory locks

**If budget is extremely constrained (solo developer, no paid tier):**
- Replace ElevenLabs with Deepgram Aura (Vapi's built-in, cheaper TTS)
- Replace Resend with Resend free tier (3,000 emails/month)
- Start with Vapi's free trial minutes before committing to a plan
- Supabase free tier supports up to 500MB DB and 50,000 monthly active users

**If multi-tenant SaaS scale is needed early (50+ businesses):**
- Add a Redis/Upstash layer for webhook idempotency keys (prevents duplicate Vapi event processing)
- Postgres row-level locking with `SELECT ... FOR UPDATE SKIP LOCKED` for slot reservation under concurrent load
- Consider BullMQ (with Upstash Redis) for async notification delivery instead of inline Twilio/Resend calls

**If Outlook Calendar is primary (not Google):**
- Prioritize `@microsoft/microsoft-graph-client` OAuth flow before Google Calendar
- Both use OAuth 2.0 but Microsoft's tenant consent flow is more complex — build it first

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `next@14.x` | `react@18.x`, `react-dom@18.x` | Next.js 14 requires React 18. Next.js 15 (released late 2024) uses React 19 RC — avoid until React 19 is stable in the ecosystem. |
| `@supabase/supabase-js@2.x` | `@supabase/ssr@latest` | The `ssr` package replaces `@supabase/auth-helpers-nextjs`. Do not use both. The auth-helpers package is deprecated for App Router. |
| `@tanstack/react-query@5.x` | `next@14.x` | TanStack Query v5 has a different API than v4 (no `onSuccess`/`onError` in `useQuery`). Check for v5 patterns specifically in tutorials — most 2023 content is v4. |
| `tailwindcss@3.x` | `shadcn/ui` (any) | shadcn/ui requires Tailwind v3. Tailwind v4 (released 2025) has breaking CSS variable changes — confirm shadcn/ui compatibility before upgrading. |
| `zod@3.x` | `@hookform/resolvers@3.x` | Both must be on matching major versions for the resolver to work. |

---

## Confidence Notes

| Area | Confidence | Reason |
|------|------------|--------|
| Vapi as primary voice platform | MEDIUM | Vapi is well-documented in training data through Aug 2025. WebFetch unavailable to verify current SDK version or breaking changes. Verify `@vapi-ai/server-sdk` version on npm before pinning. |
| Retell as viable alternative | MEDIUM | Retell is an active competitor with comparable capabilities. Same caveat — verify current docs. |
| Next.js 14 App Router | HIGH | Stable, widely adopted, no evidence of deprecation. Next.js 15 exists but React 19 ecosystem is still stabilizing. |
| Supabase JS client v2 | HIGH | v2 has been stable since 2022. RLS + real-time for multi-tenant SaaS is a well-documented pattern. |
| GPT-4o for triage | MEDIUM | GPT-4o was the best function-calling model through training cutoff. Verify Vapi's current recommended model in their docs — they may default to a newer model by now. |
| ElevenLabs via Vapi | MEDIUM | ElevenLabs was Vapi's primary premium TTS option through mid-2025. Verify current Vapi TTS provider list. |
| shadcn/ui + Tailwind v3 | HIGH | This combination is the dominant React dashboard pattern. Tailwind v4 compatibility with shadcn is a known open question — verify before upgrading. |

---

## Sources

- Training data (Vapi docs, Retell docs, Next.js docs, Supabase docs) — through August 2025 — MEDIUM confidence
- PROJECT.md (F:/homeservice-agent/.planning/PROJECT.md) — project requirements and technology direction — HIGH confidence (authoritative)
- Note: WebSearch, WebFetch, and Context7 were unavailable this session. Version numbers marked MEDIUM confidence should be verified against official npm registries and vendor docs before use.

---

*Stack research for: AI voice receptionist + CRM for home service SMEs*
*Researched: 2026-03-18*
