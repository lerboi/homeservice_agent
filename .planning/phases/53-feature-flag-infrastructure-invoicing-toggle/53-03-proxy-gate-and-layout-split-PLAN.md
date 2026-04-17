---
phase: 53
plan: 03
type: execute
wave: 3
depends_on: [1, 2]
files_modified:
  - src/proxy.js
  - src/app/dashboard/layout.js
  - src/app/dashboard/DashboardLayoutClient.jsx
autonomous: true
requirements:
  - TOGGLE-02
must_haves:
  truths:
    - "Visiting /dashboard/invoices, /dashboard/invoices/{id}, /dashboard/invoices/new, /dashboard/invoices/batch-review, /dashboard/estimates, /dashboard/estimates/{id}, /dashboard/estimates/new, or /dashboard/more/invoice-settings with features_enabled.invoicing = false redirects to /dashboard"
    - "Visiting any of those paths with features_enabled.invoicing = true serves the page normally"
    - "/dashboard/more/features is NEVER redirected by the gate, regardless of flag state"
    - "Dashboard layout fetches features once per request (Server Component) and passes them to FeatureFlagsProvider for client distribution"
    - "src/proxy.js still issues only a single SELECT against the tenants table per matched request (existing fetch extended, no second query added)"
  artifacts:
    - path: "src/proxy.js"
      provides: "Extended tenant fetch (now selects features_enabled) and new feature flag gate block"
      contains: "INVOICING_GATED_PATHS"
    - path: "src/app/dashboard/layout.js"
      provides: "Server Component wrapper that fetches features and passes them to the client layout"
      contains: "getTenantFeatures"
    - path: "src/app/dashboard/DashboardLayoutClient.jsx"
      provides: "Renamed Client Component (was layout.js) — now wraps children in FeatureFlagsProvider"
      contains: "FeatureFlagsProvider"
  key_links:
    - from: "src/app/dashboard/layout.js"
      to: "src/lib/features.js"
      via: "import + await getTenantFeatures(tenantId)"
      pattern: "getTenantFeatures"
    - from: "src/app/dashboard/DashboardLayoutClient.jsx"
      to: "src/components/FeatureFlagsProvider.jsx"
      via: "<FeatureFlagsProvider value={features}>...</FeatureFlagsProvider>"
      pattern: "FeatureFlagsProvider"
    - from: "src/proxy.js (gate block)"
      to: "tenants.features_enabled"
      via: "tenant.features_enabled?.invoicing === true (read from EXISTING fetch, not a new query)"
      pattern: "features_enabled"
---

<objective>
Add the dashboard-page gate (proxy redirect when invoicing flag is off) and wire feature flags into the dashboard layout so client components downstream (Plan 06, 07) can read flags via `useFeatureFlags()`.

Purpose: Closes TOGGLE-02 for page surfaces and unlocks Plan 06's UI hide layer. The layout Server/Client split is the trickiest change in Phase 53 — `src/app/dashboard/layout.js` is currently a Client Component and CANNOT call the async `getTenantFeatures()` directly. Pattern 4 from RESEARCH.md is followed exactly.

Output: 1 file modified (proxy), 1 file rewritten (layout.js becomes Server wrapper), 1 file created (DashboardLayoutClient.jsx — the renamed-and-modified original layout content).
</objective>

<execution_context>
@C:/Users/leheh/.Projects/homeservice_agent/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/leheh/.Projects/homeservice_agent/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-CONTEXT.md
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md
@src/proxy.js
@src/app/dashboard/layout.js
@src/lib/features.js
@src/components/FeatureFlagsProvider.jsx
@src/lib/get-tenant-id.js
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-02-SUMMARY.md

<interfaces>
From src/proxy.js (current tenant fetch — lines 78-82):
```js
const { data: tenant } = await supabase
  .from('tenants')
  .select('onboarding_complete, id')
  .eq('owner_id', user.id)
  .single();
```
Target: extend the SELECT to `.select('onboarding_complete, id, features_enabled')`.

From src/app/dashboard/layout.js (current — IS a Client Component, has 'use client' at line 1):
The full file (109 lines) is the existing client layout: imports, DashboardLayoutInner function with usePathname/useSearchParams/useState/useEffect/AnimatePresence, and the wrapping default export with Suspense. ALL of this content moves verbatim into DashboardLayoutClient.jsx. The new layout.js becomes a small Server Component that resolves features and passes them as a prop.

From src/lib/features.js (Plan 02 output): `export async function getTenantFeatures(tenantId): Promise<{invoicing: boolean}>`.

From src/components/FeatureFlagsProvider.jsx (Plan 02 output): `export function FeatureFlagsProvider({ value, children })`. Receives `value` prop (NOT `flags`).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Extend proxy.js tenant SELECT and add the feature-flag gate block</name>
  <files>src/proxy.js</files>
  <read_first>
    - src/proxy.js (full file — see existing tenant fetch lines 77-82, subscription gate lines 107-135, matcher line 142, admin gate lines 41-61)
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md Pattern 3 (Proxy Gate Block) + Pitfall 3 (single fetch)
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-CONTEXT.md D-01 + D-06
  </read_first>
  <action>
Make TWO edits to `src/proxy.js`:

EDIT 1 — Extend the existing tenant SELECT (lines 78-82, do NOT add a second fetch):

Find:
```js
    const { data: tenant } = await supabase
      .from('tenants')
      .select('onboarding_complete, id')
      .eq('owner_id', user.id)
      .single();
```

Replace with:
```js
    const { data: tenant } = await supabase
      .from('tenants')
      .select('onboarding_complete, id, features_enabled')
      .eq('owner_id', user.id)
      .single();
```

EDIT 2 — Insert the feature flag gate block immediately AFTER the subscription gate's closing `}` and BEFORE the closing `}` of the outer `if (user)` branch (currently around line 135). Use the exact comment style of the subscription gate header.

Insert this code:
```js
    // ── Feature flag gate (TOGGLE-02 pages, D-01) ────────────────────────────
    // Redirect to /dashboard when a tenant tries to visit an invoicing page with
    // features_enabled.invoicing = false. Reads from the EXISTING tenant fetch
    // above — DO NOT add a second supabase.from('tenants') call here (Pitfall 3).
    //
    // /dashboard/more/features is intentionally NOT in this list — it is the
    // panel where owners re-enable invoicing, and must remain accessible when
    // the flag is off (Pitfall 6).
    const INVOICING_GATED_PATHS = [
      '/dashboard/invoices',
      '/dashboard/estimates',
      '/dashboard/more/invoice-settings',
    ];

    const isInvoicingGatedPath = INVOICING_GATED_PATHS.some(
      (p) => pathname === p || pathname.startsWith(p + '/')
    );

    if (isInvoicingGatedPath && tenant) {
      const invoicingEnabled = tenant.features_enabled?.invoicing === true;
      if (!invoicingEnabled) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
```

DO NOT change:
- The matcher config (line 142) — `/dashboard/:path*` already covers all gated paths.
- The admin gate (lines 41-61).
- The subscription gate (lines 107-135).
- The auth-required redirect (lines 64-74).

CRITICAL details:
- The gate runs inside `if (user)` — unauthenticated users hit the earlier auth-required redirect (line 70). Don't add an outer `if (user)` check.
- `tenant?.features_enabled?.invoicing === true` uses strict equality — JSONB can return null/undefined for missing keys (Pitfall 2).
- The `pathname.startsWith(p + '/')` check is critical — without the `/` suffix, a hypothetical future page named `/dashboard/invoices-overview` would also match `/dashboard/invoices`.
  </action>
  <verify>
    <automated>grep -q "select('onboarding_complete, id, features_enabled')" src/proxy.js && grep -q "INVOICING_GATED_PATHS" src/proxy.js && grep -q "/dashboard/invoices" src/proxy.js && grep -q "/dashboard/estimates" src/proxy.js && grep -q "/dashboard/more/invoice-settings" src/proxy.js && grep -q "tenant.features_enabled?.invoicing === true" src/proxy.js && [ "$(grep -c "supabase\.from('tenants')" src/proxy.js)" = "1" ] && npm run build 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - src/proxy.js contains the literal string `select('onboarding_complete, id, features_enabled')`
    - src/proxy.js contains `INVOICING_GATED_PATHS` as a `const` declaration
    - The INVOICING_GATED_PATHS array contains all three literal strings: `/dashboard/invoices`, `/dashboard/estimates`, `/dashboard/more/invoice-settings`
    - src/proxy.js does NOT contain the string `/dashboard/more/features` in the gated-paths array (the features panel is intentionally always reachable)
    - src/proxy.js contains `tenant.features_enabled?.invoicing === true` (strict equality, optional chaining)
    - src/proxy.js contains `NextResponse.redirect(new URL('/dashboard', request.url))` inside the gate block
    - `grep -c "supabase\.from('tenants')" src/proxy.js` returns exactly `1` (Pitfall 3 — only one tenant fetch)
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>Proxy gate active. Visiting any INVOICING_GATED_PATHS path with flag=false redirects to /dashboard. Feature panel and other dashboard pages unaffected.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Move existing layout.js content into DashboardLayoutClient.jsx and wrap children in FeatureFlagsProvider</name>
  <files>src/app/dashboard/DashboardLayoutClient.jsx</files>
  <read_first>
    - src/app/dashboard/layout.js (current 109-line Client Component — its full body moves here verbatim, with the addition of the FeatureFlagsProvider wrapper and a `features` prop)
    - src/components/FeatureFlagsProvider.jsx (Plan 02 — exports `FeatureFlagsProvider`)
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md Pattern 4 Option A (Server wrapper)
  </read_first>
  <action>
Create `src/app/dashboard/DashboardLayoutClient.jsx` containing the EXACT current contents of `src/app/dashboard/layout.js` with these THREE modifications applied:

1. Add the FeatureFlagsProvider import to the imports block: `import { FeatureFlagsProvider } from '@/components/FeatureFlagsProvider';`
2. Update the inner function signature: `function DashboardLayoutInner({ children, features }) {`
3. Wrap the entire returned tree in `<FeatureFlagsProvider value={features}>` as the OUTERMOST wrapper of the inner function's return. The new wrapping order MUST be: `FeatureFlagsProvider` outermost, then `ChatProvider` inside.
4. Update the default export — rename `DashboardLayout` to `DashboardLayoutClient`, accept `features` prop, pass it through.

The full target structure of `DashboardLayoutClient.jsx` (write exactly this):

```jsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import BottomTabBar from '@/components/dashboard/BottomTabBar';
import dynamic from 'next/dynamic';
const DashboardTour = dynamic(() => import('@/components/dashboard/DashboardTour'), { ssr: false });
import { GridTexture } from '@/components/ui/grid-texture';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import CommandPalette from '@/components/dashboard/CommandPalette';
import ChatbotSheet from '@/components/dashboard/ChatbotSheet';
import SetupChecklistLauncher from '@/components/dashboard/SetupChecklistLauncher';
import { ChatProvider } from '@/components/dashboard/ChatProvider';
import OfflineBanner from '@/components/dashboard/OfflineBanner';
import ImpersonationBanner from './ImpersonationBanner';
import BillingWarningBanner from './BillingWarningBanner';
import TrialCountdownBanner from './TrialCountdownBanner';
import { FeatureFlagsProvider } from '@/components/FeatureFlagsProvider';

function DashboardLayoutInner({ children, features }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tourRunning, setTourRunning] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const impersonateTenantId = searchParams.get('impersonate');
  const impersonateName = searchParams.get('impersonate_name');

  useEffect(() => {
    function handleStartTour() {
      setTourRunning(true);
    }
    window.addEventListener('start-dashboard-tour', handleStartTour);
    return () => window.removeEventListener('start-dashboard-tour', handleStartTour);
  }, []);

  useEffect(() => {
    function handleOpenChat() { setChatOpen(true); }
    window.addEventListener('open-voco-chat', handleOpenChat);
    return () => window.removeEventListener('open-voco-chat', handleOpenChat);
  }, []);

  return (
    <FeatureFlagsProvider value={features}>
      <ChatProvider currentRoute={pathname}>
      <TooltipProvider delayDuration={300}>
        {impersonateTenantId && (
          <ImpersonationBanner tenantName={impersonateName || 'Unknown Tenant'} />
        )}
        <div className={impersonateTenantId ? 'pointer-events-none opacity-60' : ''}>
          <div className="min-h-screen bg-background relative">
            <GridTexture variant="light" />
            <DashboardSidebar />
            <div className="relative lg:pl-60">
              <OfflineBanner />
              {!impersonateTenantId && <BillingWarningBanner />}
              {!impersonateTenantId && <TrialCountdownBanner />}
              <AnimatePresence>
                <motion.div
                  key={pathname}
                  className="max-w-6xl mx-auto px-4 lg:px-8 py-6 pb-24 lg:pb-6"
                  data-tour="dashboard-layout"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  {children}
                </motion.div>
              </AnimatePresence>
              <BottomTabBar />
            </div>
            <DashboardTour
              run={tourRunning}
              onFinish={() => setTourRunning(false)}
            />
          </div>
        </div>
        <CommandPalette />
        <ChatbotSheet open={chatOpen} onOpenChange={setChatOpen} />
        {!impersonateTenantId && <SetupChecklistLauncher />}
        <Toaster richColors position="top-right" />
      </TooltipProvider>
      </ChatProvider>
    </FeatureFlagsProvider>
  );
}

export default function DashboardLayoutClient({ children, features }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <DashboardLayoutInner features={features}>{children}</DashboardLayoutInner>
    </Suspense>
  );
}
```

CRITICAL details:
- `'use client';` MUST be the first line.
- Provider wraps everything inside the inner function — including ChatProvider, TooltipProvider, CommandPalette, ChatbotSheet, SetupChecklistLauncher. The chat surface and command palette may want to read `useFeatureFlags()` in future work, so they MUST be inside the Provider.
- The default export is `DashboardLayoutClient` (renamed from `DashboardLayout`) — this matches the import that Task 3 will use in the new `layout.js`.
- The `features` prop flows: `DashboardLayoutClient(features) -> DashboardLayoutInner(features) -> FeatureFlagsProvider value={features}`.
- All comments inside the original layout (Impersonation banner, system banners, Main content fade, Bottom tab bar, Guided tour, Setup checklist overlay) MAY be preserved or omitted at the executor's discretion — the structure is what matters.
  </action>
  <verify>
    <automated>test -f src/app/dashboard/DashboardLayoutClient.jsx && head -1 src/app/dashboard/DashboardLayoutClient.jsx | grep -q "'use client';" && grep -q "import { FeatureFlagsProvider } from '@/components/FeatureFlagsProvider'" src/app/dashboard/DashboardLayoutClient.jsx && grep -q "<FeatureFlagsProvider value={features}>" src/app/dashboard/DashboardLayoutClient.jsx && grep -q "export default function DashboardLayoutClient" src/app/dashboard/DashboardLayoutClient.jsx && grep -q "function DashboardLayoutInner({ children, features })" src/app/dashboard/DashboardLayoutClient.jsx && grep -q "ChatProvider" src/app/dashboard/DashboardLayoutClient.jsx</automated>
  </verify>
  <acceptance_criteria>
    - File `src/app/dashboard/DashboardLayoutClient.jsx` exists
    - First line (after any leading whitespace) is `'use client';`
    - Imports `FeatureFlagsProvider` from `@/components/FeatureFlagsProvider`
    - The inner function signature is `function DashboardLayoutInner({ children, features })`
    - The default export is `export default function DashboardLayoutClient({ children, features })`
    - The returned JSX contains `<FeatureFlagsProvider value={features}>` as the outermost wrapper of the inner function's return
    - All existing imports/components from the current layout.js are preserved (DashboardSidebar, BottomTabBar, ChatProvider, TooltipProvider, CommandPalette, ChatbotSheet, SetupChecklistLauncher, etc.)
    - File still references `usePathname`, `useSearchParams`, `useState`, `useEffect`, `AnimatePresence` (preserved from original)
  </acceptance_criteria>
  <done>The new client file mirrors the current layout but adds the Provider wrapper and accepts a `features` prop. Old layout.js is NOT yet deleted — that's Task 3.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Replace src/app/dashboard/layout.js with a Server Component wrapper that fetches features</name>
  <files>src/app/dashboard/layout.js</files>
  <read_first>
    - src/app/dashboard/layout.js (current — full content already moved into DashboardLayoutClient.jsx in Task 2)
    - src/lib/get-tenant-id.js (canonical session-to-tenantId helper)
    - src/lib/features.js (Plan 02 output — `getTenantFeatures(tenantId)`)
    - src/app/dashboard/DashboardLayoutClient.jsx (Task 2 output — the named import target)
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md Pattern 4 Option A
  </read_first>
  <action>
REPLACE the entire current contents of `src/app/dashboard/layout.js` with the EXACT contents below. This file becomes a Server Component (no `'use client';` directive). The previous Client Component contents now live in `DashboardLayoutClient.jsx` (Task 2).

```jsx
import { getTenantId } from '@/lib/get-tenant-id';
import { getTenantFeatures } from '@/lib/features';
import DashboardLayoutClient from './DashboardLayoutClient';

/**
 * Server-side dashboard layout wrapper (Phase 53).
 *
 * Resolves the current tenant's feature flags ONCE per request and hands them
 * to the Client layout for distribution via FeatureFlagsProvider. This avoids
 * a client-side flash where invoicing UI renders briefly before the flag value
 * arrives (which would happen if features were fetched client-side via useEffect).
 *
 * Auth: getTenantId() returns null for unauthenticated users — the proxy gate
 * (src/proxy.js) redirects unauthenticated dashboard requests to /auth/signin
 * before this layout runs, so reaching here without a session means we're either
 * mid-redirect or in an unusual edge case. We fail-closed: features default to
 * { invoicing: false } so no flagged UI leaks.
 */
export default async function DashboardLayout({ children }) {
  const tenantId = await getTenantId();
  const features = tenantId
    ? await getTenantFeatures(tenantId)
    : { invoicing: false };

  return (
    <DashboardLayoutClient features={features}>
      {children}
    </DashboardLayoutClient>
  );
}
```

CRITICAL details:
- This file MUST NOT contain `'use client';`. It is a Server Component — async/await is required to call `getTenantFeatures`.
- The `features` prop matches what `DashboardLayoutClient` expects (Task 2).
- The fallback `{ invoicing: false }` is defensive — `getTenantId()` returning null shouldn't happen here (proxy already redirected), but the guard prevents a runtime crash if the proxy gate is ever changed.
- Do NOT add any other props or context here. The Server wrapper has ONE job: fetch features and pass them down.
- Do NOT inline the fetch into a Promise.all or a try/catch — `getTenantFeatures` already handles errors and returns the safe default. Adding catch here would obscure that.
  </action>
  <verify>
    <automated>! grep -q "'use client';" src/app/dashboard/layout.js && grep -q "import { getTenantId } from '@/lib/get-tenant-id'" src/app/dashboard/layout.js && grep -q "import { getTenantFeatures } from '@/lib/features'" src/app/dashboard/layout.js && grep -q "import DashboardLayoutClient from './DashboardLayoutClient'" src/app/dashboard/layout.js && grep -q "export default async function DashboardLayout" src/app/dashboard/layout.js && grep -q "<DashboardLayoutClient features={features}>" src/app/dashboard/layout.js && npm run build 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - src/app/dashboard/layout.js does NOT contain `'use client';` (it must be a Server Component)
    - Contains `import { getTenantId } from '@/lib/get-tenant-id';`
    - Contains `import { getTenantFeatures } from '@/lib/features';`
    - Contains `import DashboardLayoutClient from './DashboardLayoutClient';`
    - Contains `export default async function DashboardLayout({ children })`
    - Contains `await getTenantId()`
    - Contains `await getTenantFeatures(tenantId)`
    - Contains the JSX `<DashboardLayoutClient features={features}>`
    - Contains the fallback literal `{ invoicing: false }` for the missing-tenantId branch
    - `npm run build` exits 0 with no Server/Client component errors
  </acceptance_criteria>
  <done>Server wrapper in place. Visiting /dashboard now: server resolves features once, hands to client layout, client mounts FeatureFlagsProvider, all client descendants can call useFeatureFlags(). Build passes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → proxy (middleware) | Proxy intercepts every dashboard request, validates session via Supabase auth, and gates access. |
| Server layout → Client layout | Features object crosses Server-Client React boundary as a serialized prop. |
| Client components → useFeatureFlags() | Client components read flags via Context. They cannot mutate flags from the client (PATCH route in Plan 07 is server-side and validates session). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-53-03 | Tampering / Information Disclosure | Page redirect bypass | mitigate | Proxy gate runs before any dashboard page renders. The block uses `pathname.startsWith(p + '/')` for exact prefix matching so adjacent paths cannot accidentally bypass. The gate evaluates AFTER the existing tenant fetch resolved the tenant scoped to the authenticated user — cross-tenant flag bypass is impossible. |
| T-53-page-flash | Information Disclosure | Client-side flag fetch flash | mitigate | Server Component wrapper resolves features BEFORE first byte. No client-side useEffect fetch. No invoicing UI ever renders for tenants with the flag off. |
| T-53-double-fetch | Performance / availability | Proxy DB load | mitigate | Pitfall 3 — extending the existing SELECT instead of adding a second query keeps proxy DB load at one tenants read per matched request. Acceptance criterion `grep -c "supabase\.from('tenants')" src/proxy.js` enforces this. |
</threat_model>

<verification>
After all three tasks:
1. `npm run build` exits 0 (Server Component + Client Component split type-checks correctly).
2. With dev's tenant features_enabled = `{"invoicing": false}`:
   - Visit `/dashboard/invoices` → 302 redirect to `/dashboard` (proxy gate).
   - Visit `/dashboard/estimates` → 302 redirect to `/dashboard`.
   - Visit `/dashboard/more/invoice-settings` → 302 redirect to `/dashboard`.
   - Visit `/dashboard/more/features` → page loads (NOT redirected).
   - Visit `/dashboard` → page loads, no errors.
3. With dev's tenant features_enabled = `{"invoicing": true}`:
   - Visit `/dashboard/invoices` → page loads normally.
   - Visit `/dashboard/estimates` → page loads normally.
4. Open browser devtools, network tab: a single request to `tenants` per dashboard page navigation in proxy logs (`[proxy]` console.log).
5. React devtools: FeatureFlagsContext is mounted high in the tree, with value `{ invoicing: <correct boolean> }` matching the DB row.
</verification>

<success_criteria>
- src/proxy.js extended SELECT (no second fetch) and gate block in place
- src/app/dashboard/layout.js is a Server Component fetching features
- src/app/dashboard/DashboardLayoutClient.jsx contains all original layout content + FeatureFlagsProvider wrapper + features prop
- Build passes
- Dashboard pages redirect correctly based on flag state
- Features panel always reachable
</success_criteria>

<output>
After completion, create `.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-03-SUMMARY.md` documenting:
- Three file changes summary (proxy + layout + client layout)
- Manual QA results: redirect behavior with flag=true and flag=false for all gated paths
- Confirmation that /dashboard/more/features is still reachable when flag=false
- Build status
</output>
