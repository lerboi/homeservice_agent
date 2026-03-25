---
phase: 19-codebase-skill-files
plan: 03
subsystem: skill-files
tags: [documentation, skills, auth, database, multitenancy, public-site, i18n, landing, rls]
dependency_graph:
  requires: ["19-01", "19-02"]
  provides: ["auth-database-multitenancy skill", "public-site-i18n skill", "complete skill coverage"]
  affects: ["all future development sessions", "CLAUDE.md maintenance directive"]
tech_stack:
  added: []
  patterns:
    - auth-database-multitenancy skill file following voice-call-architecture template
    - public-site-i18n skill file following voice-call-architecture template
    - CLAUDE.md updated with explicit 6-skill maintenance list
key_files:
  created:
    - .claude/skills/auth-database-multitenancy/SKILL.md
    - .claude/skills/public-site-i18n/SKILL.md
  modified:
    - CLAUDE.md
decisions:
  - auth-database-multitenancy skill covers all 3 Supabase clients, getTenantId, middleware, RLS two-pattern design, and all 8 migrations with actual SQL
  - public-site-i18n skill covers all 25+ source files: landing sections, pricing, about, contact, i18n, email templates
  - CLAUDE.md maintenance directive updated from vague "e.g., voice-call-architecture" to explicit list of all 6 skills
metrics:
  duration_minutes: 35
  completed_date: "2026-03-25"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 1
---

# Phase 19 Plan 03: Auth-Database-Multitenancy + Public-Site-i18n Skills Summary

Completes full codebase skill file coverage by creating two final skill files and updating CLAUDE.md with an explicit 6-skill maintenance list.

---

## What Was Built

### Task 1: auth-database-multitenancy SKILL.md

**517-line complete reference** for authentication, database schema, and multi-tenant isolation. Covers:

- **Three Supabase clients** with exact `createClient()` calls — service role (supabase.js), SSR cookie-based (supabase-server.js), browser (supabase-browser.js)
- **`getTenantId()` pattern** — `getUser()` → `owner_id` → `tenants` query via service role client. Does NOT use `user_metadata`.
- **Middleware auth guard** — `AUTH_REQUIRED_PATHS`, cookie-based auth check using anon key (not service_role), onboarding_complete redirect logic
- **RLS two-pattern design** — direct owner (`owner_id = auth.uid()`) for tenants table; tenant child (`tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())`) for all data tables; service_role bypass on every table
- **Full migration trail** for all 8 migrations (001–008) — tables created/altered, key columns with types, constraints, RLS policies
- **Complete table reference** — all 12 tables across migrations with their migration number, purpose, and RLS pattern

### Task 2: public-site-i18n SKILL.md

**500-line complete reference** for the public marketing site and internationalization. Covers:

- **(public) route group and layout** — `LandingNav` + `LandingFooter` injected once via layout.js, not in page components
- **Landing sections deep dive** — HeroSection (Spline + RotatingText + mobile fallback), FeaturesGrid (bento grid), SocialProofSection, HowItWorksSection (Server Component + dynamic import), HowItWorksTabs (WAI-ARIA Tabs), FinalCTASection (CSS-only reduced-motion guard)
- **Animation system** — `AnimatedSection` (direction prop, `initial={false}` for prefers-reduced-motion), `AnimatedStagger`, `AnimatedItem`
- **LandingNav + LandingFooter** — scroll state, mobile drawer, back-to-top, newsletter stub
- **AuthAwareCTA** — authenticated → /dashboard, unauthenticated → /onboarding
- **Pricing page** — 4 tiers, `pricingData.js` structure, `FAQSection` Radix accordion with `--radix-accordion-content-height`
- **ContactForm** — named export, honeypot silent 200, Resend per-request, Sonner toasts
- **i18n** — cookie-based locale, `routing.js` as single source of truth for language barrier detection, direct JSON import for agent vs next-intl for UI
- **Design tokens (landing)** — separate from dashboard tokens, Tailwind v4 `@import` pattern

### CLAUDE.md Update

Replaced vague `"This applies to all architecture skill files (e.g., \`voice-call-architecture\`)"` with explicit 6-skill maintenance list:

```
- voice-call-architecture
- scheduling-calendar-system
- dashboard-crm-system
- onboarding-flow
- auth-database-multitenancy
- public-site-i18n
```

---

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1 | `1baf7b9` | `.claude/skills/auth-database-multitenancy/SKILL.md` (517 lines) |
| Task 2 | `6dc2db2` | `.claude/skills/public-site-i18n/SKILL.md` (500 lines), `CLAUDE.md` |

---

## Deviations from Plan

None - plan executed exactly as written.

---

## Known Stubs

None — this plan is documentation-only. No source code was modified.

The `LandingFooter` newsletter form mentioned in the public-site-i18n skill has a known display-only stub (no API wired) — this is intentional and documented in the skill file. It does not affect the plan's goal.

---

## Self-Check: PASSED

- `.claude/skills/auth-database-multitenancy/SKILL.md` exists (517 lines) ✓
- `.claude/skills/public-site-i18n/SKILL.md` exists (500 lines) ✓
- `CLAUDE.md` contains all 6 skill names ✓
- `voice-call-architecture/SKILL.md` unchanged ✓
- Commits `1baf7b9` and `6dc2db2` exist ✓
- No source code files modified (documentation-only phase) ✓
