---
phase: 53
plan: 08
type: execute
wave: 4
depends_on: [1, 2, 3, 6, 7]
files_modified:
  - .claude/skills/auth-database-multitenancy/SKILL.md
  - .claude/skills/dashboard-crm-system/SKILL.md
autonomous: true
requirements:
  - TOGGLE-01
  - TOGGLE-02
  - TOGGLE-03
  - TOGGLE-04
must_haves:
  truths:
    - "auth-database-multitenancy SKILL.md documents the new tenants.features_enabled JSONB column with shape, default, and reference to migration 051"
    - "auth-database-multitenancy SKILL.md mentions src/lib/features.js getTenantFeatures() helper alongside getTenantId()"
    - "dashboard-crm-system SKILL.md documents the FeatureFlagsProvider Context, useFeatureFlags() hook, and the dashboard layout Server/Client split"
    - "dashboard-crm-system SKILL.md documents the /dashboard/more/features panel and its placement in MORE_ITEMS"
    - "dashboard-crm-system SKILL.md documents the conditional rendering pattern in DashboardSidebar / LeadFlyout / More page"
    - "Both skills reference the proxy gate pattern for invoicing pages and the API gate pattern for invoicing routes"
  artifacts:
    - path: ".claude/skills/auth-database-multitenancy/SKILL.md"
      provides: "Updated DB skill — features_enabled column + getTenantFeatures helper documentation"
      contains: "features_enabled"
    - path: ".claude/skills/dashboard-crm-system/SKILL.md"
      provides: "Updated dashboard skill — FeatureFlagsProvider + features panel + conditional render patterns"
      contains: "FeatureFlagsProvider"
  key_links:
    - from: ".claude/skills/auth-database-multitenancy/SKILL.md"
      to: "supabase/migrations/051_features_enabled.sql"
      via: "documented migration entry in the migrations section"
      pattern: "051_features_enabled"
    - from: ".claude/skills/dashboard-crm-system/SKILL.md"
      to: "src/components/FeatureFlagsProvider.jsx, src/app/dashboard/more/features/page.js"
      via: "documented architectural patterns in the layout + settings sections"
      pattern: "FeatureFlagsProvider"
---

<objective>
Update the two architectural skill files that govern Phase 53's territory: `auth-database-multitenancy` (DB schema + helpers) and `dashboard-crm-system` (layout + settings panels). Both files MUST reflect the post-Phase-53 state so future phases (54+ and beyond) operate from accurate documentation.

Per CLAUDE.md: "Keep skills in sync: When making changes to any system covered by a skill, read the skill first, make the code changes, then update the skill to reflect the new state."

Output: 2 skill files with surgical additions documenting the new column, helper, Context provider, panel, and conditional render patterns. NO sweeping rewrites — additive edits at the appropriate sections.
</objective>

<execution_context>
@C:/Users/leheh/.Projects/homeservice_agent/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/leheh/.Projects/homeservice_agent/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.claude/skills/auth-database-multitenancy/SKILL.md
@.claude/skills/dashboard-crm-system/SKILL.md
@supabase/migrations/051_features_enabled.sql
@src/lib/features.js
@src/components/FeatureFlagsProvider.jsx
@src/app/dashboard/more/features/page.js
@src/proxy.js
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-CONTEXT.md
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md

<interfaces>
The auth-database-multitenancy skill is the canonical home for ALL tenant table column documentation, RLS patterns, and Supabase client / helper conventions. Phase 53 added:
- New column: `tenants.features_enabled JSONB NOT NULL DEFAULT '{"invoicing": false}'::jsonb`
- New migration: `051_features_enabled.sql`
- New helper: `src/lib/features.js` exports `getTenantFeatures(tenantId): Promise<{invoicing: boolean}>` — lives alongside `getTenantId()` in src/lib/
- Proxy gate pattern (now extends the existing tenant fetch SELECT to include features_enabled — relevant to the proxy section if it documents the tenant fetch shape)

The dashboard-crm-system skill is the canonical home for dashboard layout, sidebar/BottomTabBar, More menu, LeadFlyout, and settings panel patterns. Phase 53 added:
- New layout pattern: Server-Component wrapper (`layout.js`) + Client-Component layout (`DashboardLayoutClient.jsx`) — first dashboard layout to use this pattern
- New Context provider: `<FeatureFlagsProvider>` mounted at the dashboard layout level; flags distributed via `useFeatureFlags()` hook
- New settings panel: `/dashboard/more/features` — list-of-toggles design, scaling to N feature flags
- New MORE_ITEMS entry: "Features" with Zap icon, between Billing and Invoice Settings, ALWAYS visible (never gated)
- New conditional render pattern: array filtering at render time (`NAV_ITEMS.filter(...).map(...)`) for sidebar / More page; conditional wrap (`{invoicing && (...)}`) for LeadFlyout
- Proxy gate adds page-level redirect for `/dashboard/invoices`, `/dashboard/estimates`, `/dashboard/more/invoice-settings`
- API gates: every gated route returns 404 (no body) when flag is off — pattern: `getTenantFeatures(tenantId)` after `getTenantId()`
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Update auth-database-multitenancy SKILL.md with features_enabled column + getTenantFeatures helper</name>
  <files>.claude/skills/auth-database-multitenancy/SKILL.md</files>
  <read_first>
    - .claude/skills/auth-database-multitenancy/SKILL.md (full file — find the section that lists `tenants` columns, the migrations section, the helpers section, and the proxy/middleware section)
    - supabase/migrations/051_features_enabled.sql (Plan 01 output)
    - src/lib/features.js (Plan 02 output)
    - src/proxy.js (Plan 03 modified state — extended tenant SELECT)
  </read_first>
  <action>
Make these THREE additions to `.claude/skills/auth-database-multitenancy/SKILL.md`. READ THE FILE FIRST and place each addition in the appropriate existing section — these are additive surgical edits, not section rewrites.

ADDITION 1 — Document the new tenants column.

Find the section that documents the `tenants` table columns (search for "tenants" table definition, likely in a "Tables" or "Schema" section). After the documentation for the existing JSONB columns (`notification_preferences`, `checklist_overrides`, `vip_numbers`, `call_forwarding_schedule`, etc. — there are several), ADD a new column entry:

```markdown
**`features_enabled JSONB NOT NULL DEFAULT '{"invoicing": false}'::jsonb`** (added Phase 53)
- Per-tenant feature flags. Shape: `{ invoicing: boolean, ... }`
- Default `{"invoicing": false}` for ALL tenants — Voco v6.0 ships invoicing OFF; owners opt in via `/dashboard/more/features`
- Future flags (xero, jobber) extend this same column — no per-flag column proliferation
- Read via `getTenantFeatures(tenantId)` helper at `src/lib/features.js`
- RLS: existing `tenants_update_own` policy covers SELECT/UPDATE on every column including this one; no new policy needed
- JSONB filter syntax for crons: `.eq('features_enabled->>invoicing', 'true')` — note string `'true'`, not boolean (PostgREST `->>` returns text)
```

ADDITION 2 — Document the new migration.

Find the section listing migrations (search for "Migrations" or "050_" — there should be a chronological list of migration descriptions). After the `050_checklist_overrides.sql` entry, ADD:

```markdown
- **051_features_enabled.sql** (Phase 53) — Adds `tenants.features_enabled JSONB NOT NULL DEFAULT '{"invoicing": false}'::jsonb`. No backfill needed (DEFAULT applies to existing rows on column add). No RLS policy change (existing tenants policies cover the new column). Foundation for the v6.0 invoicing toggle and future feature flags.
```

ADDITION 3 — Document the helper alongside getTenantId.

Find the section documenting `src/lib/get-tenant-id.js` and the `getTenantId()` helper (the file's "Helpers" or "Tenant Resolution" section). After the getTenantId documentation, ADD:

```markdown
### `src/lib/features.js` — getTenantFeatures(tenantId) (added Phase 53)

Returns the per-tenant feature flags from `tenants.features_enabled`. Companion to `getTenantId()`.

```js
import { getTenantFeatures } from '@/lib/features';

const features = await getTenantFeatures(tenantId);
if (!features.invoicing) {
  return new Response(null, { status: 404 }); // gate API route
}
```

- Uses the **service-role client** (`@/lib/supabase`) so it works in cron contexts (no session) AND in API routes (caller already validated session via `getTenantId()`)
- Takes `tenantId` as an explicit param — not derived from session — making it safe across all execution contexts
- Fail-CLOSED: any error / missing row / null column returns `{ invoicing: false }`. A DB outage cannot accidentally enable a flag.
- Return shape is an object so future flags compose without breaking call sites
```

ADDITION 4 (optional) — If the skill documents the proxy.js tenant fetch shape, update it to reflect the extended SELECT.

Search for `'onboarding_complete, id'` in the skill file. If found, update to `'onboarding_complete, id, features_enabled'` and add a note: "Phase 53 extended this SELECT to include features_enabled — used by the invoicing page gate. Pitfall: do NOT add a second supabase.from('tenants') call for feature reads; extend this existing SELECT."

DO NOT rewrite the file structure. Each addition above goes into an EXISTING section. If a section is hard to locate, place the addition near other Phase-related references (search for "Phase 48" or "Phase 49" — those should already be documented).
  </action>
  <verify>
    <automated>grep -q "features_enabled" .claude/skills/auth-database-multitenancy/SKILL.md && grep -q "051_features_enabled" .claude/skills/auth-database-multitenancy/SKILL.md && grep -q "getTenantFeatures" .claude/skills/auth-database-multitenancy/SKILL.md && grep -q "src/lib/features.js" .claude/skills/auth-database-multitenancy/SKILL.md</automated>
  </verify>
  <acceptance_criteria>
    - .claude/skills/auth-database-multitenancy/SKILL.md contains the literal string `features_enabled JSONB NOT NULL DEFAULT '{"invoicing": false}'::jsonb` OR an equivalent inline doc that names the column, type, and default
    - File contains `051_features_enabled` (migration entry)
    - File contains `getTenantFeatures` (helper documented)
    - File contains `src/lib/features.js` (file path documented)
    - File contains a mention of the JSONB filter syntax `'features_enabled->>invoicing'` OR `features_enabled->>'invoicing'` OR equivalent — with a note that the value is the string `'true'` not the boolean
    - File length increased by at least 200 characters (additions are not trivial)
  </acceptance_criteria>
  <done>auth-database-multitenancy skill reflects Phase 53 schema additions. Future phases reading this skill will know about features_enabled, the helper, and the migration.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Update dashboard-crm-system SKILL.md with FeatureFlagsProvider + Features panel + conditional render patterns</name>
  <files>.claude/skills/dashboard-crm-system/SKILL.md</files>
  <read_first>
    - .claude/skills/dashboard-crm-system/SKILL.md (full file — find sections covering layout.js, sidebar, BottomTabBar, LeadFlyout, More menu, settings panels)
    - src/app/dashboard/layout.js (Plan 03 — Server Component wrapper)
    - src/app/dashboard/DashboardLayoutClient.jsx (Plan 03 — Client Component)
    - src/components/FeatureFlagsProvider.jsx (Plan 02)
    - src/app/dashboard/more/features/page.js (Plan 07)
    - src/components/dashboard/DashboardSidebar.jsx (Plan 06 modified state)
  </read_first>
  <action>
Make these FOUR additions to `.claude/skills/dashboard-crm-system/SKILL.md`. READ THE FILE FIRST and place each addition in the appropriate existing section.

ADDITION 1 — Document the new layout Server/Client split pattern.

Find the section documenting the dashboard layout (search for "layout.js" or "DashboardLayout"). After the existing layout documentation, ADD:

```markdown
### Server/Client Layout Split (added Phase 53)

The dashboard layout is split into TWO files (`layout.js` Server Component + `DashboardLayoutClient.jsx` Client Component) to allow server-side feature-flag fetching without losing the client interactivity (usePathname, useSearchParams, framer-motion AnimatePresence).

- `src/app/dashboard/layout.js` (Server Component, NO `'use client'`):
  - Calls `getTenantId()` and `getTenantFeatures(tenantId)` once per request.
  - Passes the resolved `features` object as a prop to `DashboardLayoutClient`.
  - Fails closed: if no tenantId, features default to `{ invoicing: false }`.

- `src/app/dashboard/DashboardLayoutClient.jsx` (Client Component, has `'use client'`):
  - Contains all the existing client-side layout: ChatProvider, TooltipProvider, sidebar, BottomTabBar, AnimatePresence, etc.
  - Wraps everything in `<FeatureFlagsProvider value={features}>` — first wrapper inside the inner function, outside ChatProvider.
  - Receives `features` prop and passes it to the Provider.

Pattern source: Phase 53 RESEARCH.md Pattern 4 Option A. This is the dashboard's first Server/Client split — future phases that need server-fetched data for client UI should follow the same shape.
```

ADDITION 2 — Document the FeatureFlagsProvider Context pattern.

Find a section that lists shared providers / contexts in the dashboard (search for "ChatProvider" or "TooltipProvider"). After existing provider documentation, ADD:

```markdown
### FeatureFlagsProvider (added Phase 53)

`src/components/FeatureFlagsProvider.jsx` exports a thin React Context wrapper + a `useFeatureFlags()` hook for distributing per-tenant feature flags to client components.

```jsx
import { useFeatureFlags } from '@/components/FeatureFlagsProvider';

const { invoicing } = useFeatureFlags();
return invoicing ? <InvoiceCTA /> : null;
```

- Mounted by `DashboardLayoutClient.jsx` with `value={features}` (features fetched server-side by `layout.js`).
- Hook returns the default `{ invoicing: false }` when no Provider is mounted (e.g., outside the dashboard tree) — fail-closed behaviour.
- Future flags extend the value object: `{ invoicing: boolean, xero: boolean, jobber: boolean, ... }`.
- Phase 53 consumers: `DashboardSidebar`, `LeadFlyout`, `MorePage`, `FeaturesPage`.
```

ADDITION 3 — Document the new /dashboard/more/features panel.

Find the section listing More menu pages or settings panels (search for "MORE_ITEMS" or `/dashboard/more/billing`). After the existing settings panel documentation, ADD:

```markdown
### `/dashboard/more/features` — Features Panel (added Phase 53)

Dedicated settings panel hosting per-tenant feature flag toggles. Designed as a list-of-toggles to scale with future flags.

- Always accessible — explicitly EXCLUDED from the proxy gate matcher (`INVOICING_GATED_PATHS` in `src/proxy.js`). Owners must always be able to re-enable a flag.
- Layout matches `invoice-settings/page.js` exactly: `<h1>Features</h1>` + `<Separator>` + `card.base` container with `divide-y` rows.
- Each feature row: icon (lucide `Zap` for invoicing) in `bg-muted` container, label + description (text-sm semibold + text-xs muted), shadcn `<Switch>` on the right.
- Flip-on: silent (no toast).
- Flip-off: conditional flow — if invoices.count + estimates.count > 0, show shadcn `<AlertDialog>` with locked copy ("Disable invoicing?", brand-accent confirm button NOT destructive); else silent flip.
- Toggle persistence: PATCH `/api/tenant/features` with body `{features: {invoicing: boolean}}`. Optimistic UI with rollback on error.
- Counts source: GET `/api/tenant/invoicing-counts` — returns `{invoices, estimates}` for the authenticated tenant. NOT gated by the invoicing flag (must work at flip-off time).

Position in MORE_ITEMS: between Billing (`/dashboard/more/billing`) and Invoice Settings (`/dashboard/more/invoice-settings`). Permanent — never filtered out.
```

ADDITION 4 — Document the conditional render patterns in DashboardSidebar / LeadFlyout / MorePage.

Find the section covering navigation (search for "DashboardSidebar" or "NAV_ITEMS"). ADD:

```markdown
### Feature-Flag-Gated UI (added Phase 53)

Three components hide invoicing UI when `features.invoicing = false`:

1. **DashboardSidebar** — filters `NAV_ITEMS` at render: `NAV_ITEMS.filter((item) => item.href !== '/dashboard/invoices' || invoicing).map(...)`. The `space-y-1` gap collapses naturally when one item is removed; no compensation classes needed.
2. **LeadFlyout** — wraps the entire invoice-related CTA block (Create Invoice / Create Estimate buttons + linked-invoice display) in `{invoicing && (...)}`. DOM removal, NOT disabled state. No "invoicing disabled" message inside the flyout — Features panel is the canonical learning surface.
3. **MorePage** — derives two filtered lists at render: `visibleQuickAccess = invoicing ? QUICK_ACCESS : []` and `visibleMoreItems = MORE_ITEMS.filter(...)` that hides BOTH `invoice-settings` AND `integrations` entries. The QUICK_ACCESS card is wrapped in `{visibleQuickAccess.length > 0 && (...)}` — when empty, the card container is NOT rendered (no empty card).

**BottomTabBar** has NO Invoices tab in `TABS` (confirmed Phase 53). No change needed there.

**Proxy + API gates** complement the UI hide: even if a user removes the hide via devtools, hitting `/dashboard/invoices` returns a 302 redirect (Plan 03), and hitting `/api/invoices/**` returns a 404 with empty body (Plan 04). Defense-in-depth across three enforcement layers.
```

DO NOT rewrite or restructure the skill file. Each addition above slots into an EXISTING section. If a section is hard to locate, search for keywords near the addition's topic.
  </action>
  <verify>
    <automated>grep -q "FeatureFlagsProvider" .claude/skills/dashboard-crm-system/SKILL.md && grep -q "useFeatureFlags" .claude/skills/dashboard-crm-system/SKILL.md && grep -q "/dashboard/more/features" .claude/skills/dashboard-crm-system/SKILL.md && grep -q "DashboardLayoutClient" .claude/skills/dashboard-crm-system/SKILL.md && grep -q "Server/Client" .claude/skills/dashboard-crm-system/SKILL.md && grep -q "invoicing" .claude/skills/dashboard-crm-system/SKILL.md</automated>
  </verify>
  <acceptance_criteria>
    - .claude/skills/dashboard-crm-system/SKILL.md contains `FeatureFlagsProvider` (mentioned at least twice — once in providers section, once in usage example or layout section)
    - File contains `useFeatureFlags`
    - File contains `/dashboard/more/features` (the panel route)
    - File contains `DashboardLayoutClient` (the new client wrapper file name)
    - File contains a description of the Server/Client layout split (search for "Server" + "Client" near layout content)
    - File contains documentation of at least one of the three conditional render patterns (sidebar filter / LeadFlyout wrap / More page filter)
    - File length increased by at least 500 characters (significant additions)
  </acceptance_criteria>
  <done>dashboard-crm-system skill reflects Phase 53 layout split, Provider, Features panel, and conditional render patterns. Future phases (54-58) reading this skill will know how to gate new features behind flags using the same patterns.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Documentation → Future contributors | Skill files are read by future Claude instances and human developers. Inaccurate docs lead to incorrect implementations. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-53-doc-drift | Information Disclosure / Tampering (knowledge) | Stale skill docs cause future bugs | mitigate | This plan IS the mitigation. Updating both skill files immediately after Phase 53 lands prevents drift. CLAUDE.md mandates the sync rule — this plan executes it. |
</threat_model>

<verification>
After both tasks:
1. Read each updated skill file and confirm the additions are coherent with the surrounding sections (no orphan paragraphs).
2. `grep` verifications from acceptance criteria all pass.
3. The CLAUDE.md "Skill Reference" table still correctly maps these skills to the systems Phase 53 modified — no entry needs to change there (the table is at a higher abstraction level).
</verification>

<success_criteria>
- 2 skill files updated with the Phase 53 additions
- Documentation accurately reflects the Phase 53 code state
- Both skills remain navigable (additive edits, not rewrites)
- Future phases reading these skills can find the new patterns without re-discovering them in code
</success_criteria>

<output>
After completion, create `.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-08-SUMMARY.md` documenting:
- 2 skill files updated with line-count delta (before/after)
- List of additions made to each skill (sections updated, key new content)
- Confirmation that grep checks pass
- Note: this is the final plan in Phase 53; phase is ready for /gsd-verify-work
</output>
