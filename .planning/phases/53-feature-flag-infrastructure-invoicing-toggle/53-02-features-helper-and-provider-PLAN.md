---
phase: 53
plan: 02
type: execute
wave: 2
depends_on: [1]
files_modified:
  - src/lib/features.js
  - src/components/FeatureFlagsProvider.jsx
autonomous: true
requirements:
  - TOGGLE-01
  - TOGGLE-02
  - TOGGLE-03
must_haves:
  truths:
    - "getTenantFeatures(tenantId) returns { invoicing: boolean } sourced from tenants.features_enabled column"
    - "getTenantFeatures(tenantId) returns { invoicing: false } as safe default when DB read errors or features_enabled is null"
    - "FeatureFlagsProvider exposes flag values to all client descendants via React Context"
    - "useFeatureFlags() hook returns the current flags object; defaults to { invoicing: false } when no Provider is mounted"
  artifacts:
    - path: "src/lib/features.js"
      provides: "getTenantFeatures(tenantId) — async helper that returns { invoicing: boolean }"
      exports: ["getTenantFeatures"]
    - path: "src/components/FeatureFlagsProvider.jsx"
      provides: "FeatureFlagsProvider Context wrapper + useFeatureFlags() hook"
      exports: ["FeatureFlagsProvider", "useFeatureFlags"]
  key_links:
    - from: "src/lib/features.js"
      to: "tenants.features_enabled column"
      via: "supabase.from('tenants').select('features_enabled').eq('id', tenantId).single()"
      pattern: "features_enabled"
    - from: "src/components/FeatureFlagsProvider.jsx"
      to: "consuming client components (Plans 03, 06, 07)"
      via: "useContext(FeatureFlagsContext)"
      pattern: "useFeatureFlags"
---

<objective>
Build the foundation that every other Phase 53 plan consumes: a server-side helper `getTenantFeatures(tenantId)` and a client-side `<FeatureFlagsProvider>` Context with a `useFeatureFlags()` hook.

Purpose: Plan 03 needs the helper to read flags in the Server layout wrapper and proxy. Plans 04 (API gates), 05 (cron filter), and 07 (toggle PATCH route) all call `getTenantFeatures()`. Plan 06 (sidebar/LeadFlyout/More) consumes flags via `useFeatureFlags()`.

Output: Two new files. Zero modifications to existing files. Zero behavior change visible to users — this plan only introduces unused exports that downstream plans will consume.
</objective>

<execution_context>
@C:/Users/leheh/.Projects/homeservice_agent/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/leheh/.Projects/homeservice_agent/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-CONTEXT.md
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md
@src/lib/get-tenant-id.js
@src/app/api/notification-settings/route.js
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-01-SUMMARY.md

<interfaces>
<!-- Reference patterns the executor mirrors. -->

From src/lib/get-tenant-id.js (canonical helper shape):
```js
import { createSupabaseServer } from '@/lib/supabase-server';

export async function getTenantId() {
  const serverSupabase = await createSupabaseServer();
  const { data: { user } } = await serverSupabase.auth.getUser();
  if (!user) return null;

  const { data: tenant } = await serverSupabase
    .from('tenants')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle();

  return tenant?.id || null;
}
```

From src/app/api/notification-settings/route.js (canonical JSONB read on tenants):
```js
import { supabase } from '@/lib/supabase'; // service-role client

const { data, error } = await supabase
  .from('tenants')
  .select('notification_preferences')
  .eq('id', tenantId)
  .single();

if (error) return Response.json({ error: error.message }, { status: 500 });
return Response.json({
  notification_preferences: data.notification_preferences || DEFAULT_PREFERENCES,
});
```

From RESEARCH.md Pattern 2 (the contract for getTenantFeatures):
```js
export async function getTenantFeatures(tenantId) {
  const { data, error } = await supabase
    .from('tenants')
    .select('features_enabled')
    .eq('id', tenantId)
    .single();
  if (error || !data) return { invoicing: false };
  return { invoicing: data.features_enabled?.invoicing === true };
}
```

The service-role client (`@/lib/supabase`) is the correct choice (per Q2/A2 in RESEARCH) — the helper takes an explicit `tenantId` param (not derived from session), making it safe for cron contexts too. Session validation is the caller's responsibility (e.g., API routes call `getTenantId()` first).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create getTenantFeatures() helper in src/lib/features.js</name>
  <files>src/lib/features.js</files>
  <read_first>
    - src/lib/get-tenant-id.js (canonical helper shape — JSDoc style, single export, brief comment)
    - src/lib/supabase.js (confirm the service-role client export is `supabase`, not a default export)
    - src/app/api/notification-settings/route.js (canonical JSONB read pattern on tenants table)
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md Pattern 2 + Pitfall 2 (`=== true` comparison)
  </read_first>
  <action>
Create `src/lib/features.js` with the EXACT contents below:

```js
import { supabase } from '@/lib/supabase';

/**
 * Returns the per-tenant feature flags from `tenants.features_enabled`.
 *
 * Uses the service-role client so this helper is safe in cron contexts (no session)
 * AND in API routes (caller already validated session via `getTenantId()`).
 *
 * Defaults to `{ invoicing: false }` if the row is missing, the read errors, or the
 * column is null — fail-closed so a DB outage cannot accidentally enable a flag.
 *
 * @param {string} tenantId
 * @returns {Promise<{invoicing: boolean}>}
 */
export async function getTenantFeatures(tenantId) {
  if (!tenantId) return { invoicing: false };

  const { data, error } = await supabase
    .from('tenants')
    .select('features_enabled')
    .eq('id', tenantId)
    .single();

  if (error || !data) return { invoicing: false };

  return {
    invoicing: data.features_enabled?.invoicing === true,
    // Future flags extend here, e.g.:
    //   xero: data.features_enabled?.xero === true,
    //   jobber: data.features_enabled?.jobber === true,
  };
}
```

CRITICAL details (do not deviate):
- Import is `import { supabase } from '@/lib/supabase';` — service-role client, NOT `supabase-server` (no cookie dependency).
- The boolean comparison MUST be `=== true` (not `?? true` or truthy check). Per Pitfall 2: JSONB returns can be `null` / `false` / missing keys, all of which must resolve to `false`.
- Early-return `{ invoicing: false }` for `!tenantId` — protects against accidental `getTenantFeatures(null)` calls.
- Return shape is an object (not a boolean). Per CONTEXT discretion: this scales to N flags without breaking call sites.
- No `console.log` calls. No telemetry. No retries. The helper is a single read.
  </action>
  <verify>
    <automated>test -f src/lib/features.js && grep -q "export async function getTenantFeatures" src/lib/features.js && grep -q "from '@/lib/supabase'" src/lib/features.js && grep -q "data.features_enabled?.invoicing === true" src/lib/features.js && grep -q "return { invoicing: false }" src/lib/features.js && npm run build 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - File `src/lib/features.js` exists
    - Contains `export async function getTenantFeatures(tenantId)` (signature exact)
    - Contains `import { supabase } from '@/lib/supabase';` (service-role client, NOT supabase-server)
    - Contains `data.features_enabled?.invoicing === true` (strict equality, optional chaining)
    - Contains at least one early-return `{ invoicing: false }` for the !tenantId path
    - Contains at least one early-return `{ invoicing: false }` for the (error || !data) path
    - Does NOT contain `import { createSupabaseServer }` (would couple to session)
    - Does NOT contain `getTenantId` import (helper takes tenantId as param)
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>Helper file exists, types check, build passes. Helper not yet consumed anywhere — that happens in Plans 03/04/05/07.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Create FeatureFlagsProvider Context + useFeatureFlags hook</name>
  <files>src/components/FeatureFlagsProvider.jsx</files>
  <read_first>
    - src/components/dashboard/ChatProvider.jsx (existing Context pattern in the codebase — match its export style)
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md Pattern 5 (FeatureFlagsProvider)
  </read_first>
  <action>
Create `src/components/FeatureFlagsProvider.jsx` with the EXACT contents below:

```jsx
'use client';

import { createContext, useContext } from 'react';

/**
 * Default flags — used when no Provider is mounted (e.g., during initial mount,
 * or in routes outside the dashboard tree). Fail-closed: invoicing OFF.
 */
const DEFAULT_FLAGS = { invoicing: false };

const FeatureFlagsContext = createContext(DEFAULT_FLAGS);

/**
 * Wraps the dashboard subtree and distributes per-tenant feature flags.
 *
 * Mounted by `src/app/dashboard/DashboardLayoutClient.jsx` (Plan 03) and given
 * the flags object that the Server layout wrapper resolved via getTenantFeatures().
 *
 * @param {{ value: { invoicing: boolean }, children: React.ReactNode }} props
 */
export function FeatureFlagsProvider({ value, children }) {
  return (
    <FeatureFlagsContext.Provider value={value || DEFAULT_FLAGS}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

/**
 * Reads the current feature flags from Context.
 *
 * Returns DEFAULT_FLAGS when called outside a <FeatureFlagsProvider> — this is
 * intentional fail-closed behaviour: components rendered outside the dashboard
 * tree (e.g., login page) see invoicing OFF and hide invoicing UI by default.
 *
 * @returns {{ invoicing: boolean }}
 */
export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
```

CRITICAL details (do not deviate):
- File starts with `'use client';` — React Context requires the client boundary.
- Two named exports: `FeatureFlagsProvider` (component) and `useFeatureFlags` (hook). NO default export.
- The Provider receives flags via the `value` prop (not as `flags`) — matches the React Context convention and matches how Plan 03 wires it.
- The Provider falls back to `DEFAULT_FLAGS` if `value` is null/undefined — defensive guard against the Server wrapper passing `null` on auth failure.
- The hook does NOT throw when used outside the Provider — it returns DEFAULT_FLAGS. Rationale: a thrown error would break unrelated pages that happen to import a shared component (e.g., LeadFlyout used in chatbot suggestions).
  </action>
  <verify>
    <automated>test -f src/components/FeatureFlagsProvider.jsx && grep -q "'use client';" src/components/FeatureFlagsProvider.jsx && grep -q "export function FeatureFlagsProvider" src/components/FeatureFlagsProvider.jsx && grep -q "export function useFeatureFlags" src/components/FeatureFlagsProvider.jsx && grep -q "createContext" src/components/FeatureFlagsProvider.jsx && grep -q "DEFAULT_FLAGS = { invoicing: false }" src/components/FeatureFlagsProvider.jsx && npm run build 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - File `src/components/FeatureFlagsProvider.jsx` exists
    - First non-comment line is `'use client';`
    - Contains named export `export function FeatureFlagsProvider({ value, children })`
    - Contains named export `export function useFeatureFlags()`
    - Contains `import { createContext, useContext } from 'react';`
    - Contains `const DEFAULT_FLAGS = { invoicing: false };`
    - Provider's value prop fallback uses `value || DEFAULT_FLAGS`
    - Hook returns `useContext(FeatureFlagsContext)` (no thrown error path)
    - File has NO `export default` line
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>Provider and hook exist, build passes. Not yet consumed — Plan 03 mounts the Provider, Plans 06/07 consume the hook.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Caller → getTenantFeatures | Helper takes tenantId as a parameter. Caller is responsible for verifying the tenantId belongs to the authenticated session (via prior `getTenantId()` call). |
| Server → Client (Provider) | Flag values cross the React Server/Client boundary as a serialized JSON prop. The flags object is intentionally non-sensitive (just a boolean per feature). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-53-helper-fail-open | Tampering / Elevation | getTenantFeatures DB read errors | mitigate | Helper fail-CLOSED: errors return `{ invoicing: false }`, never `{ invoicing: true }`. A DB outage cannot accidentally enable a flag. |
| T-53-helper-default | Information Disclosure | useFeatureFlags() outside Provider | accept | Hook returns DEFAULT_FLAGS (`invoicing: false`) when no Provider mounted — fail-closed; cannot reveal a tenant's true flag state to a context-less component. |
</threat_model>

<verification>
After both tasks:
1. `npm run build` exits 0 (helper + provider type-check)
2. `node -e "import('./src/lib/features.js').then(m => console.log(typeof m.getTenantFeatures))"` prints `function` (helper is exported)
3. Visual inspection: opening any page in the running dev server has unchanged behaviour — neither file is consumed yet.
</verification>

<success_criteria>
- src/lib/features.js exports `getTenantFeatures(tenantId)` matching Pattern 2 exactly
- src/components/FeatureFlagsProvider.jsx exports both `FeatureFlagsProvider` and `useFeatureFlags`
- Both files are 'use client'-correct (helper has no directive, provider has 'use client')
- Build passes
- No existing file modified, no user-visible behavior change
</success_criteria>

<output>
After completion, create `.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-02-SUMMARY.md` documenting:
- Two new files created with exact paths
- Helper signature and return shape
- Provider/hook export shape and fail-closed defaults
- Build status
</output>
