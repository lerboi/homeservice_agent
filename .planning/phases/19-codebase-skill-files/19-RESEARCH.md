# Phase 19: Codebase Skill Files for Full Architectural Reference — Research

**Researched:** 2026-03-25
**Domain:** Documentation / internal tooling — writing architectural skill files for the `.claude/skills/` directory
**Confidence:** HIGH

---

## Summary

Phase 19 is a documentation phase with zero runtime code changes. The goal is to create 5 new skill files in `.claude/skills/` that parallel the existing `voice-call-architecture` skill. Each skill file is a self-contained architectural reference that enables an AI (or developer) to understand and modify a major subsystem without reading every source file first.

The format is already established by the `voice-call-architecture` skill (`SKILL.md` ~527 lines). That skill contains: YAML frontmatter (name + description), an overview, a file map, per-component deep dives, database tables, environment variables, key design decisions, and a maintenance reminder. The 5 new skills should follow this exact pattern — adapted to their domain.

The codebase has been fully explored. All 5 skill domains map cleanly to real files. The biggest authoring risk is **incompleteness**: each skill spans 3-15 source files and multiple migrations, so the writer must read and distill each file rather than summarize from memory. The secondary risk is **divergence**: once written, skill files must stay in sync with code — CLAUDE.md already enforces this for voice-call-architecture, but the directive must be broadened to cover all 6 skills.

**Primary recommendation:** Write each skill as a direct code-read exercise — open every source file in the domain, extract the signatures/data flows/design decisions, then author the SKILL.md. Do not write from memory or from this research document alone.

---

## Standard Stack

### Core
| Item | Version/Location | Purpose |
|------|-----------------|---------|
| Skill directory | `.claude/skills/` | Where all project skills live (NOT `.agents/skills/`) |
| Skill format | SKILL.md only (no sub-files needed) | Single markdown file per skill |
| YAML frontmatter | `name` + `description` fields required | Triggering mechanism for Claude |
| Target length | ~500 lines per skill | Progressive disclosure limit per skill-creator guidance |

### Existing Reference
| Skill | Location | Lines |
|-------|----------|-------|
| `voice-call-architecture` | `.claude/skills/voice-call-architecture/SKILL.md` | 527 |

**Note:** The `.agents/skills/` directory exists in parallel but does NOT contain voice-call-architecture. The project uses `.claude/skills/` as the active skill directory.

---

## Architecture Patterns

### Existing Skill Structure (voice-call-architecture as template)

```
.claude/skills/{skill-name}/
└── SKILL.md
```

No sub-files, no scripts, no references directories — single flat SKILL.md. This is appropriate for architectural reference skills (no scripts to execute, no assets needed).

### SKILL.md Internal Structure (from voice-call-architecture)

```markdown
---
name: {skill-name}
description: "{complete description of what + when to use}"
---

# {Title} — Complete Reference

**Last updated**: {date} ({phase context})

---

## Architecture Overview
[Table: processes/layers and their purpose]
[ASCII diagram of data flow]

---

## File Map
[Table: file path → role]

---

## {N}. {Component Name}
[File path, function signatures, how it works, edge cases, key patterns]
...

---

## {N+1}. Database Tables
[Table: name → purpose, key columns]

---

## {N+2}. Environment Variables
[Table: var → service → purpose]

---

## {N+3}. Key Design Decisions
- Bulleted list of WHY decisions, not just WHAT

---

## Important: Keeping This Document Updated
[Maintenance reminder referencing the file map]
```

### Description Field (CRITICAL for triggering)

The description must encode both WHAT the skill does AND WHEN to use it. From voice-call-architecture:

```
"Complete architectural reference for the voice call system — ... Use this skill whenever making changes to the call system, voice agent prompts, triage logic, booking flow, ... Also use when the user asks about how calls work, wants to modify agent behavior, or needs to debug call-related issues."
```

Pattern: `"{domain} reference — {scope}. Use this skill whenever {trigger conditions}. Also use when {secondary triggers}."`

### Anti-Patterns to Avoid

- **Summary-only coverage**: The skill must contain actual function signatures, parameter names, DB column names — not just "there is a booking function". Vague summaries provide no value over asking Claude to read the files.
- **Outdated at birth**: Do NOT write from research notes or memory. Read each source file immediately before writing the corresponding section.
- **Monolithic "everything" skills**: Each skill covers one domain. Cross-domain dependencies should be noted as pointers ("see auth-database-multitenancy skill"), not duplicated.
- **Missing design decisions**: The "Key Design Decisions" section is where non-obvious choices are explained (why advisory locks, why `after()`, why service role client for webhooks). These are the highest-value content for future contributors.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Skill format | Custom template | Existing voice-call-architecture structure | Already proven, Claude knows it, CLAUDE.md references it |
| Skill directory | New `.agents/skills/` entries | `.claude/skills/` only | voice-call-architecture lives in `.claude/skills/` — keep consistent |
| Separate reference files | `references/` subdirectory | Inline in SKILL.md | Project skills are single-file; adding hierarchy adds load complexity |

---

## Skill File Scope Map

This is the primary output of research — the exact source file inventory for each planned skill.

### Skill 2: `scheduling-calendar-system`

**Source files to read and distill:**

| File | What to capture |
|------|----------------|
| `src/lib/scheduling/slot-calculator.js` | `calculateAvailableSlots()` signature, algorithm (walk forward, skip overlaps, travel buffers), inputs/outputs |
| `src/lib/scheduling/booking.js` | `atomicBookSlot()`, RPC call to `book_appointment_atomic`, advisory lock pattern |
| `src/lib/scheduling/google-calendar.js` | `pushBookingToCalendar()`, `syncCalendarEvents()`, `registerWatch()`, `revokeAndDisconnect()`, incremental sync / 410 handling |
| `src/lib/scheduling/outlook-calendar.js` | MSAL lazy singleton, `graphFetch()` wrapper, token refresh, deltaLink handling, `pushBookingToCalendar`, `syncCalendarEvents`, `renewOutlookSubscription` |
| `src/lib/webhooks/google-calendar-push.js` | Push notification webhook handler |
| `src/lib/webhooks/outlook-calendar-push.js` | Outlook change notification webhook handler |
| `src/app/api/google-calendar/auth/route.js` | OAuth initiation |
| `src/app/api/google-calendar/callback/route.js` | OAuth callback, credential storage |
| `src/app/api/outlook-calendar/auth/route.js` | Microsoft OAuth initiation |
| `src/app/api/outlook-calendar/callback/route.js` | Microsoft OAuth callback |
| `src/app/api/appointments/route.js` | GET/POST appointments API |
| `src/app/api/appointments/[id]/route.js` | PATCH/DELETE single appointment |
| `src/app/api/cron/renew-calendar-channels/route.js` | Dual-provider channel renewal cron job |
| `src/app/api/working-hours/route.js` | GET/PATCH working hours |
| `src/app/api/zones/route.js` | Zone management API |
| `supabase/migrations/003_scheduling.sql` | appointments, service_zones, zone_travel_buffers, calendar_credentials, calendar_events tables |
| `supabase/migrations/007_outlook_calendar.sql` | is_primary, external_event_id, external_event_provider additions |

**Key design decisions to document:**
- Local DB mirror (calendar_events) is source of truth for slots — never live-query during call hot path
- `pg_try_advisory_xact_lock` (non-blocking) for atomic slot booking — prevents queue buildup
- UNIQUE (tenant_id, start_time) as secondary defense
- Travel buffer logic: no zones = 30 min flat, same zone = 0, cross-zone = lookup table
- `after()` for calendar push — never in synchronous call path
- Store full deltaLink URL as `last_sync_token` (Graph API anti-pattern avoidance)
- Direct fetch for Outlook token refresh (not MSAL cache — serverless-safe)
- `is_primary` flag for multi-provider: `pushBookingToCalendar` queries `is_primary=true`
- `external_event_id` / `external_event_provider` replaces old `google_event_id` (migration D-09)
- `PROVIDER_CONFIG` map centralizes auth endpoints, icon colors, popup names per provider

---

### Skill 3: `dashboard-crm-system`

**Source files to read and distill:**

| File | What to capture |
|------|----------------|
| `src/lib/leads.js` | `createOrMergeLead()` flow, 15s short-call filter, repeat caller merge logic, status transitions |
| `src/app/api/leads/route.js` | Lead query API — filters (status, date_from), excludes transcript_text from list |
| `src/app/api/leads/[id]/route.js` | Lead detail (includes transcript), PATCH status, revenue_amount |
| `src/app/dashboard/page.js` | Stats loading (parallel fetch), Supabase Realtime subscription for live feed |
| `src/app/dashboard/leads/page.js` | Lead list, filter bar, Kanban board, flyout, Realtime |
| `src/app/dashboard/analytics/page.js` | Analytics charts, revenue, conversion funnel |
| `src/app/dashboard/services/page.js` | Service list with drag-to-reorder, bulk urgency tag |
| `src/app/dashboard/settings/page.js` | Settings panels — AI, hours, calendar |
| `src/app/dashboard/calendar/page.js` | Calendar view, conflict alerts |
| `src/app/dashboard/layout.js` | Sidebar, breadcrumb, sticky top bar |
| `src/components/dashboard/DashboardSidebar.jsx` | Nav structure, mobile menu |
| `src/components/dashboard/LeadFlyout.jsx` | Lead detail flyout — rendered outside card stack |
| `src/components/dashboard/KanbanBoard.jsx` | Kanban column structure |
| `src/components/dashboard/AnalyticsCharts.jsx` | Chart types, data shape |
| `src/components/dashboard/EscalationChainSection.js` | Escalation contacts CRUD + drag-to-reorder |
| `src/components/dashboard/SetupChecklist.jsx` | Checklist derivation logic (from tenants columns) |
| `src/components/dashboard/WorkingHoursEditor.js` | Hours per day config |
| `src/components/dashboard/CalendarView.js` | Calendar display |
| `src/components/dashboard/DashboardHomeStats.jsx` | Stat cards: calls today, conversion, upcoming appointments |
| `src/lib/design-tokens.js` | Color palette, btn, card, glass, gridTexture, focus, selected tokens |
| `src/app/api/escalation-contacts/route.js` | CRUD + PATCH reorder |
| `src/app/api/setup-checklist/route.js` | Checklist state API |
| `supabase/migrations/004_leads_crm.sql` | leads, lead_calls, activity_log, Realtime setup |
| `supabase/migrations/005_setup_checklist.sql` | setup_checklist_dismissed column |
| `supabase/migrations/006_escalation_contacts.sql` | escalation_contacts table, services sort_order |

**Key design decisions to document:**
- REPLICA IDENTITY FULL on leads + `supabase_realtime` publication for live dashboard
- `getLeads()` excludes `transcript_text` — fetched separately on lead detail (CRM-02 decision)
- Repeat caller merge: checks `status IN ('new','booked')` only — completed/paid/lost create new leads
- Soft-delete services via `is_active=false` — preserves call history
- `LeadFlyout` rendered outside card stack to avoid Sheet overlay stacking context issues
- Design tokens in `src/lib/design-tokens.js` — shared by onboarding + dashboard
- Supabase Realtime keyframe injected via `ensureSlideInKeyframe()` — avoids CSS module complexity
- Counter animation: requestAnimationFrame + ease-out cubic, prefers-reduced-motion guard

---

### Skill 4: `onboarding-flow`

**Source files to read and distill:**

| File | What to capture |
|------|----------------|
| `src/app/onboarding/page.js` | Step 1 (auth): signup/OTP flow, useState toggle (not router.push) |
| `src/app/onboarding/profile/page.js` | Step 2: trade selection + business_name, dual POST to /api/onboarding/start |
| `src/app/onboarding/services/page.js` | Step 3: service list from TRADE_TEMPLATES, editable |
| `src/app/onboarding/verify/page.js` | Step 4: phone number, OTP verify |
| `src/app/onboarding/test-call/page.js` | Step 5: TestCallPanel, clearWizardSession |
| `src/app/onboarding/contact/page.js` | Step (contact info) |
| `src/app/onboarding/complete/page.js` | Redirects to /dashboard |
| `src/components/onboarding/TestCallPanel.js` | Polling from 'calling' + 'in_progress' states |
| `src/components/onboarding/CelebrationOverlay.js` | prefers-reduced-motion skips radial pulse divs entirely |
| `src/components/onboarding/TradeSelector.js` | Trade picker UI |
| `src/components/onboarding/OtpInput.js` | OTP digit boxes, focus ring |
| `src/hooks/useWizardSession.js` | `gsd_onboarding_` prefix, `clearWizardSession()` |
| `src/app/api/onboarding/start/route.js` | Create/upsert tenant, tone_preset |
| `src/app/api/onboarding/provision-number/route.js` | Retell phone number provisioning |
| `src/app/api/onboarding/sms-confirm/route.js` | Save owner_phone + owner_email in one round-trip |
| `src/app/api/onboarding/sms-verify/route.js` | OTP verification |
| `src/app/api/onboarding/test-call/route.js` | Trigger Retell test call |
| `src/app/api/onboarding/test-call-status/route.js` | Poll for provisioned phone number |
| `src/app/api/onboarding/complete/route.js` | Set onboarding_complete flag |
| `src/lib/trade-templates.js` | `TRADE_TEMPLATES` map: trade → services[] with urgency_tag |
| `src/middleware.js` | AUTH_REQUIRED_PATHS, onboarding_complete redirect logic |

**Key design decisions to document:**
- `shouldCreateUser: false` on `signInWithOtp` — prevents duplicate user after `signUp` (Pitfall 2 from P07 research)
- Step 1 OTP uses useState toggle — avoids layout re-mount and progress bar flicker
- Two sequential POSTs to `/api/onboarding/start`: business_name+tone creates tenant first, then trade+services depend on tenant existing
- `onboarding_complete` set on webhook callback (call completion), NOT at test call trigger time
- `retell_llm_dynamic_variables` keeps `onboarding_complete: true` during test call (AI behavior), separate from DB wizard flag
- `useWizardSession` uses `gsd_onboarding_` prefix for sessionStorage key isolation
- `clearWizardSession` bulk-removes all `gsd_onboarding_*` keys at completion
- OAuth callback default is `/onboarding/profile` so Google OAuth users skip Step 1
- TestCallPanel polls from both 'calling' and 'in_progress' to catch fast-completing calls
- AUTH_REQUIRED_PATHS includes `/onboarding` sub-paths but not `/onboarding` root (sign-in is Step 1)
- Middleware checks `onboarding_complete` on `/onboarding` paths only — avoids DB latency on every dashboard load

---

### Skill 5: `auth-database-multitenancy`

**Source files to read and distill:**

| File | What to capture |
|------|----------------|
| `src/middleware.js` | Auth guard, onboarding redirect, matcher config |
| `src/lib/supabase.js` | Service role client (bypasses RLS) — for webhook handlers |
| `src/lib/supabase-server.js` | `createSupabaseServer()` — SSR client (cookie-based) |
| `src/lib/supabase-browser.js` | Browser client (anon key) — for client components |
| `src/lib/get-tenant-id.js` | `getTenantId()` — auth → owner_id → tenant_id lookup pattern |
| `supabase/migrations/001_initial_schema.sql` | tenants, calls tables, RLS policies, service_role_bypass |
| `supabase/migrations/002_onboarding_triage.sql` | services table, working_hours, calls triage columns |
| `supabase/migrations/003_scheduling.sql` | appointments, service_zones, zone_travel_buffers, calendar_credentials, calendar_events |
| `supabase/migrations/004_leads_crm.sql` | leads, lead_calls, activity_log, Realtime |
| `supabase/migrations/005_setup_checklist.sql` | setup_checklist_dismissed on tenants |
| `supabase/migrations/006_escalation_contacts.sql` | escalation_contacts, services.sort_order |
| `supabase/migrations/007_outlook_calendar.sql` | calendar_credentials.is_primary, appointments.external_event_id/provider |
| `supabase/migrations/008_call_outcomes.sql` | calls.booking_outcome, exception_reason, notification_priority |

**Key design decisions to document:**
- Three Supabase clients with distinct purposes: `supabase` (service_role, no RLS — webhooks), `createSupabaseServer()` (SSR cookie-based — server components, middleware), `supabase-browser.js` (anon key — client components)
- `getTenantId()` resolves: getUser() → owner_id → tenants.id. Does NOT use user_metadata (never stored there)
- All RLS policies follow one of two patterns: `owner_id = auth.uid()` (tenants) OR `tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())` (all child tables)
- Service role bypass policy exists on every table — enables webhook handlers to write cross-tenant without RLS
- `REPLICA IDENTITY FULL` on leads required for Supabase Realtime row-level change events
- Multi-tenant isolation: ALL data tables carry `tenant_id` FK to tenants — no cross-tenant access possible via RLS
- Middleware uses anon key (not service_role) for cookie-based auth check — correct for user-facing requests
- Migration ordering matters: child tables must be created after parents (FK dependencies)

---

### Skill 6: `public-site-i18n`

**Source files to read and distill:**

| File | What to capture |
|------|----------------|
| `src/app/(public)/layout.js` | LandingNav + LandingFooter wrapper, (public) route group |
| `src/app/(public)/page.js` | Landing page — sections composition |
| `src/app/(public)/pricing/page.js` | Pricing tiers, monthly/annual toggle |
| `src/app/(public)/pricing/pricingData.js` | Tier data structure |
| `src/app/(public)/pricing/PricingTiers.jsx` | Tier cards |
| `src/app/(public)/pricing/ComparisonTable.jsx` | Feature comparison |
| `src/app/(public)/pricing/FAQSection.jsx` | FAQ accordion |
| `src/app/(public)/about/page.js` | About page |
| `src/app/(public)/contact/page.js` | Contact form page |
| `src/app/(public)/contact/ContactForm.jsx` | Named export, honeypot, Resend |
| `src/app/api/contact/route.js` | Contact API, Resend per-request, honeypot 200 |
| `src/app/components/landing/LandingNav.jsx` | `isRoot` pattern for anchor links, backdrop-blur-[12px] |
| `src/app/components/landing/LandingFooter.jsx` | use client for back-to-top, newsletter display-only |
| `src/app/components/landing/HeroSection.jsx` | Spline TODO, design tokens |
| `src/app/components/landing/FeaturesGrid.jsx` | Bento grid |
| `src/app/components/landing/SocialProofSection.jsx` | Social proof |
| `src/app/components/landing/HowItWorksSection.jsx` | Server component + HowItWorksTabs dynamic import |
| `src/app/components/landing/HowItWorksTabs.jsx` | Roving tabindex, AnimatePresence mode=wait |
| `src/app/components/landing/HowItWorksSticky.jsx` | Sticky scroll variant |
| `src/app/components/landing/FinalCTASection.jsx` | CSS-only prefers-reduced-motion, Server Component |
| `src/app/components/landing/AnimatedSection.jsx` | direction prop, stagger/item variants, prefers-reduced-motion initial=false |
| `src/components/landing/AuthAwareCTA.js` | Authenticated → /dashboard, unauthenticated → /onboarding |
| `src/emails/NewLeadEmail.jsx` | React Email template for owner notifications |
| `src/i18n/routing.js` | `locales: ['en', 'es']`, `defaultLocale: 'en'` |
| `messages/en.json` | English translations (agent + UI strings) |
| `messages/es.json` | Spanish translations |

**Key design decisions to document:**
- `(public)` route group — LandingNav/LandingFooter injected via layout, NOT in page components
- `isRoot` pattern in LandingNav: sub-pages prefix `/` to navigate back-and-scroll to landing anchors
- Cookie-based locale without URL prefix routing — API-first multi-tenant app constraint (Phase 01 decision)
- `next-intl` used for client-side translation; agent prompt uses direct JSON import (runs outside Next.js context)
- Language barrier detection uses `locales` from `routing.js` as single source of truth
- Contact form: named export (not default), honeypot returns 200 silently (no bot fingerprinting), Resend instantiated per-request (serverless-safe)
- `AnimatedSection`: `initial={false}` when `prefers-reduced-motion` active — skips animation state entirely (Framer Motion v12)
- `HowItWorksSection`: Server Component with dynamic import of `HowItWorksTabs` for bundle splitting
- `FinalCTASection`: stays Server Component — CSS-only motion guard, no `useReducedMotion` hook
- Landing design tokens (in CSS/Tailwind, not `design-tokens.js`): hero/footer `#050505`, accent `#F97316`, light `#F5F5F4`, muted `#475569`
- Tailwind v4 uses `@import 'tailwindcss'` in CSS + `@tailwindcss/postcss` (no `tailwind.config.js`)

---

## CLAUDE.md Update Required

**Current state:** CLAUDE.md only mentions `voice-call-architecture` by example name:
> "This applies to all architecture skill files (e.g., `voice-call-architecture`)."

**Required change:** The directive must list all 6 skills explicitly so the maintenance obligation is unambiguous for each domain:

```markdown
## Skill-Driven Architecture Changes

When asked to read a skill file and make changes to a specific architecture or system:
1. Read the relevant skill file first to understand the full system
2. Make the requested code changes
3. **After changes are made, update the skill file** to reflect the new version of the code — keep it accurate and in sync with the actual codebase

**Architecture skill files (all must be kept in sync):**
- `voice-call-architecture` — WebSocket LLM server, Retell webhooks, call-processor, triage, whisper messages
- `scheduling-calendar-system` — Slot calculator, booking, Google + Outlook OAuth/sync/webhooks, cron jobs
- `dashboard-crm-system` — Dashboard pages, lead lifecycle, Kanban, analytics, escalation chain, settings, design tokens
- `onboarding-flow` — 7-step wizard, onboarding API routes, phone provisioning, SMS verify, test call
- `auth-database-multitenancy` — Supabase Auth, middleware, RLS, all migrations, getTenantId
- `public-site-i18n` — Landing, pricing, about, contact, Resend email, next-intl (en/es)
```

---

## Common Pitfalls

### Pitfall 1: Writing from Research Notes Instead of Source Files
**What goes wrong:** Skill content is a summary of summaries rather than concrete function signatures and column names. The skill becomes useless — too vague to act on.
**Why it happens:** It feels faster to write from the research notes already compiled here. But this research only identifies which files to read, not the full content of each file.
**How to avoid:** Read each source file immediately before writing its section in the skill. The skill author must be the one reading `booking.js` and extracting the exact RPC call structure.
**Warning signs:** Sections describe behavior without naming parameters, column names, or exact file paths.

### Pitfall 2: Missing the Key Design Decisions Section
**What goes wrong:** The skill explains WHAT exists but not WHY — future contributors make changes that violate constraints they didn't know about (e.g., removing `after()` and breaking Retell timeout, or adding middleware DB queries on every dashboard load).
**Why it happens:** Design decisions feel redundant when the code already exists.
**How to avoid:** Mine `STATE.md` decisions for each domain — that file has every non-obvious choice logged with phase context. Each decision entry in STATE.md that touches a skill's domain becomes a bullet in "Key Design Decisions."

### Pitfall 3: Stale "Last Updated" Date
**What goes wrong:** A skill says "Last updated: 2026-03-25" but code changes at 2026-04-10 don't update the skill. The date is now misleading.
**Why it happens:** The CLAUDE.md enforcement directive wasn't broad enough to clearly require updates.
**How to avoid:** The CLAUDE.md update (adding all 6 skill names) is the preventative fix for this. The date in each skill must be updated on every code change to covered files.

### Pitfall 4: Wrong Skills Directory
**What goes wrong:** New skills created in `.agents/skills/` instead of `.claude/skills/`.
**Why it happens:** Both directories exist. `.agents/skills/` has more skill examples.
**How to avoid:** `voice-call-architecture` lives in `.claude/skills/voice-call-architecture/SKILL.md`. All new skills must go in `.claude/skills/` to be in the same location.

### Pitfall 5: Skill Name Mismatch with CLAUDE.md
**What goes wrong:** Skill file is named `scheduling-calendar.md` but CLAUDE.md references `scheduling-calendar-system`.
**Why it happens:** Naming is chosen ad-hoc at write time.
**How to avoid:** Skill directory names are established in ROADMAP.md Phase 19 table: `scheduling-calendar-system`, `dashboard-crm-system`, `onboarding-flow`, `auth-database-multitenancy`, `public-site-i18n`. Use these exact names.

---

## Plan Structure Recommendation

This phase breaks down into 3 plans:

| Plan | Work | Complexity |
|------|------|-----------|
| 19-01 | Create `scheduling-calendar-system` skill | HIGH — most complex domain (dual-provider calendar sync) |
| 19-02 | Create `dashboard-crm-system` + `onboarding-flow` skills | MEDIUM — lots of files but patterns are straightforward |
| 19-03 | Create `auth-database-multitenancy` + `public-site-i18n` skills + update CLAUDE.md | MEDIUM — auth has clear migration trail; i18n is well-contained |

Each plan: read every source file in domain → write SKILL.md → verify file map is complete → verify design decisions are captured.

---

## Validation Architecture

nyquist_validation is enabled, but this phase produces only `.md` files and no executable code. There are no automated tests applicable.

**Manual validation gate (per skill):**
1. Open the skill and read it cold — does it contain enough information to modify the system without opening source files?
2. Verify the File Map covers every file that was read during authoring
3. Verify the "Last updated" date and phase context are correct
4. Spot-check 2 function signatures against the actual source file — do they match?

**Phase gate before `/gsd:verify-work`:** All 5 skill files exist, CLAUDE.md updated, voice-call-architecture SKILL.md is unchanged.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely documentation/file authoring with no external tool dependencies.

---

## Sources

### Primary (HIGH confidence)
- `.claude/skills/voice-call-architecture/SKILL.md` — complete template reference, format and depth baseline
- `.agents/skills/skill-creator/SKILL.md` — skill format spec (YAML frontmatter, progressive disclosure, 500-line guideline)
- All 8 `supabase/migrations/*.sql` files — ground truth for database schema
- `src/middleware.js` — auth guard patterns
- `src/lib/*.js` — core library implementations
- `.planning/STATE.md` — accumulated design decisions per phase
- `.planning/ROADMAP.md` Phase 19 section — exact scope and skill names

### Secondary (MEDIUM confidence)
- Source file headers (read partially) — function signatures partially verified; full content read required during authoring

---

## Metadata

**Confidence breakdown:**
- Skill format/structure: HIGH — directly observed from voice-call-architecture
- Source file inventory: HIGH — directory listings + file reads confirmed
- Design decisions to capture: HIGH — cross-referenced with STATE.md
- Exact function signatures for unread files: MEDIUM — files were listed but not fully read; authoring requires direct reading

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (30 days — documentation phase, stable)
