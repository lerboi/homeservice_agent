---
phase: 53
plan: 07
type: execute
wave: 4
depends_on: [1, 2, 6]
files_modified:
  - src/app/api/tenant/features/route.js
  - src/app/dashboard/more/features/page.js
  - src/app/dashboard/more/page.js
autonomous: true
requirements:
  - TOGGLE-04
must_haves:
  truths:
    - "PATCH /api/tenant/features with body {features: {invoicing: true|false}} updates tenants.features_enabled for the authenticated tenant only"
    - "PATCH /api/tenant/features rejects non-boolean invoicing values with 400"
    - "PATCH /api/tenant/features only writes the controlled shape {invoicing: features.invoicing} — no spread of arbitrary body fields"
    - "PATCH /api/tenant/features uses getTenantId() to scope writes to the authenticated owner's tenant — cross-tenant writes impossible"
    - "/dashboard/more/features page is reachable when invoicing=false (NOT in proxy gate matcher)"
    - "Toggling invoicing OFF when at least 1 invoice OR 1 estimate exists shows a flip-off AlertDialog with the actual counts"
    - "Toggling invoicing OFF when 0 invoices AND 0 estimates exist completes silently without dialog"
    - "Toggling invoicing ON is always silent (no dialog, no toast)"
    - "After PATCH success, the Switch reflects the new state; on error the optimistic update rolls back and a sonner error toast appears"
    - "/dashboard/more page lists 'Features' as a permanent entry between Billing and AI & Voice Settings"
  artifacts:
    - path: "src/app/api/tenant/features/route.js"
      provides: "PATCH endpoint that updates tenants.features_enabled with input validation"
      exports: ["PATCH"]
    - path: "src/app/dashboard/more/features/page.js"
      provides: "Features panel page — list of toggles, AlertDialog for flip-off confirmation, sonner toasts"
      contains: "useFeatureFlags"
    - path: "src/app/dashboard/more/page.js"
      provides: "More page MORE_ITEMS array now includes the permanent Features entry"
      contains: "/dashboard/more/features"
  key_links:
    - from: "Features panel Switch onCheckedChange"
      to: "/api/tenant/features PATCH"
      via: "fetch('/api/tenant/features', { method: 'PATCH', body: JSON.stringify({features: {invoicing: nextValue}}) })"
      pattern: "/api/tenant/features"
    - from: "Features panel flip-off branch"
      to: "/api/invoices?count_only=true and /api/estimates?count_only=true (or local counts query)"
      via: "conditional fetch before showing AlertDialog"
      pattern: "AlertDialog open"
    - from: "Features panel"
      to: "FeatureFlagsContext"
      via: "useFeatureFlags() hook for initial Switch state"
      pattern: "useFeatureFlags"
---

<objective>
Build the user-facing toggle: a PATCH endpoint, a dedicated /dashboard/more/features page with a Switch, and a conditional flip-off confirmation AlertDialog. Also add a permanent "Features" entry to the More menu so users can find the panel.

Purpose: Closes TOGGLE-04. This plan is what makes the entire phase USER-CONTROLLABLE — without it, the only way to toggle the flag is direct DB SQL.

Critical security points: The PATCH route must validate input strictly (T-53-06: JSONB injection via PATCH body) and write only the controlled shape (no body spread). Cross-tenant writes are impossible because `getTenantId()` resolves the AUTHENTICATED user's tenant, and the UPDATE WHERE clause uses that resolved ID (T-53-01).

Output: 1 new API route, 1 new page, 1 modification to More page (add the entry). Per UI-SPEC Surfaces 1, 5, 6.
</objective>

<execution_context>
@C:/Users/leheh/.Projects/homeservice_agent/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/leheh/.Projects/homeservice_agent/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-CONTEXT.md
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-UI-SPEC.md
@src/lib/features.js
@src/lib/get-tenant-id.js
@src/lib/supabase.js
@src/components/FeatureFlagsProvider.jsx
@src/app/api/notification-settings/route.js
@src/app/dashboard/more/page.js
@src/components/dashboard/DashboardSidebar.jsx
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-06-SUMMARY.md

<interfaces>
From src/app/api/notification-settings/route.js (canonical PATCH JSONB pattern):
```js
import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

export async function PATCH(request) {
  const tenantId = await getTenantId();
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { /* body field */ } = await request.json();
  // validate
  // update with controlled shape
  const { data, error } = await supabase
    .from('tenants')
    .update({ /* column: cleaned */ })
    .eq('id', tenantId)
    .select(/* column */)
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ /* result */ });
}
```

From src/components/dashboard/DashboardSidebar.jsx (lines 171-186) — AlertDialog usage pattern with brand-accent confirm button:
```jsx
<AlertDialog open={state} onOpenChange={setter}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>...</AlertDialogTitle>
      <AlertDialogDescription>...</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handler} className="bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)]">
        Confirm
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

UI-SPEC Surface 1 — Features page layout:
- Outer: `<div className="space-y-6 pb-10">`
- Header: `<div><h1 className={text-xl font-semibold ${heading}}>Features</h1><Separator className="mt-3" /></div>`
- Card: `<div className={`${card.base} p-6 space-y-0 divide-y divide-border`}>{ feature rows }</div>`
- Each row: flex layout with `min-h-[64px]`, icon container `h-10 w-10 rounded-lg bg-muted`, `Zap` icon `h-5 w-5 text-muted-foreground`, label `text-sm font-semibold ${heading}`, description `text-xs ${body} mt-1`, Switch on the right with aria-label `Invoicing — on|off`.

UI-SPEC Surface 5 — Flip-off dialog copy (LOCKED, exact strings):
- Title: `Disable invoicing?`
- Description (both N>0 and M>0): `You have {N} invoice(s) and {M} estimate(s) on file. Disabling invoicing hides the invoicing tools from your dashboard — your data is preserved and you can re-enable anytime from this page.`
- Description (invoices only, N>0, M=0): `You have {N} invoice(s) on file. Disabling invoicing hides the invoicing tools from your dashboard — your data is preserved and you can re-enable anytime from this page.`
- Description (estimates only, N=0, M>0): `You have {M} estimate(s) on file. Disabling invoicing hides the invoicing tools from your dashboard — your data is preserved and you can re-enable anytime from this page.`
- Cancel label: `Keep Invoicing`
- Confirm label: `Disable`
- Confirm button class: `bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)]` (NOT bg-destructive)
- Loading state on confirm: `{isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Disable`
- Success toast: `Invoicing disabled. Re-enable here anytime.`
- Error toast (disable failed): `Failed to disable invoicing. Try again.`
- Error toast (enable failed): `Failed to enable invoicing. Try again.`
- Toast on enable success: NONE (silent — per UI-SPEC)

UI-SPEC Surface 6 — More menu position for the Features entry:
- Insert in MORE_ITEMS between Billing (`/dashboard/more/billing`) and AI & Voice Settings (`/dashboard/more/ai-voice-settings`)
- Entry: `{ href: '/dashboard/more/features', label: 'Features', description: 'Turn optional capabilities on or off', icon: Zap }`
- Icon: `Zap` from lucide-react (NOT FileText — that's already used by Invoices nav)
- Always visible (never gated)

Counts pre-fetch: The flip-off path needs invoice + estimate counts. Two options:
- Option A: Add a small GET endpoint like `/api/tenant/invoicing-counts` that returns `{invoices, estimates}`. But this contradicts D-06 (gated APIs return 404 when invoicing=false — and we need this to WORK when invoicing=true).
- Option B (recommended): Use the EXISTING `/api/invoices` and `/api/estimates` endpoints to get counts when invoicing=true. The gates only fire when invoicing=false, but at the moment we're about to flip OFF, invoicing is currently TRUE (we're attempting to disable it). So the existing endpoints WILL return data and we can count locally OR add a `?count_only=true` param.
- Option C (simplest): Add a NEW small endpoint `/api/tenant/invoicing-counts` that BYPASSES the invoicing gate (because the Features panel needs to know counts to render the dialog). The route uses the service-role client + getTenantId() but does NOT call getTenantFeatures() — it always returns counts.

Use OPTION C — it's the cleanest. Document that this route is intentionally NOT in Plan 04's gated set.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create PATCH /api/tenant/features endpoint and GET /api/tenant/invoicing-counts endpoint</name>
  <files>src/app/api/tenant/features/route.js, src/app/api/tenant/invoicing-counts/route.js</files>
  <read_first>
    - src/app/api/notification-settings/route.js (canonical PATCH JSONB pattern — 87 lines, lines 47-87 are the PATCH body)
    - src/lib/features.js (Plan 02 — read pattern; the PATCH writes the same column)
    - src/lib/get-tenant-id.js (canonical session resolution)
    - src/lib/supabase.js (service-role client)
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md Pattern 10 (Toggle API Route) + Security Domain section
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-CONTEXT.md D-05 + D-06
  </read_first>
  <action>
Create TWO new API route files.

FILE 1 — `src/app/api/tenant/features/route.js`:

```js
import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

/**
 * PATCH /api/tenant/features
 *
 * Updates tenants.features_enabled for the authenticated owner's tenant.
 * Body shape: { features: { invoicing: boolean } }
 *
 * Validation (T-53-06): invoicing MUST be a boolean. Any other type returns 400.
 * Write shape (T-53-06): only the controlled `{ invoicing: features.invoicing }`
 * is written — the route does NOT spread the body into the column, so an attacker
 * cannot inject arbitrary keys.
 *
 * Cross-tenant guard (T-53-01): getTenantId() resolves the authenticated user's
 * tenant ONLY. The UPDATE clause uses that resolved tenantId, so writes cannot
 * affect another tenant.
 *
 * NOT gated by invoicing flag — this endpoint is the ONLY way to flip the flag
 * back on after disabling, so it must remain accessible regardless of state.
 */
export async function PATCH(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const features = body?.features;
  if (!features || typeof features !== 'object') {
    return Response.json(
      { error: 'Invalid: body.features must be an object' },
      { status: 400 }
    );
  }
  if (typeof features.invoicing !== 'boolean') {
    return Response.json(
      { error: 'Invalid: features.invoicing must be a boolean' },
      { status: 400 }
    );
  }

  // Controlled write — only the invoicing key is persisted. Future flags
  // are added in future phases by extending this object literal.
  const { data, error } = await supabase
    .from('tenants')
    .update({ features_enabled: { invoicing: features.invoicing } })
    .eq('id', tenantId)
    .select('features_enabled')
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ features_enabled: data.features_enabled });
}
```

FILE 2 — `src/app/api/tenant/invoicing-counts/route.js`:

```js
import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/tenant/invoicing-counts
 *
 * Returns the count of invoices + estimates for the authenticated tenant.
 * Used by the Features panel flip-off dialog to decide whether to prompt
 * the user before disabling invoicing.
 *
 * Intentionally NOT gated by the invoicing flag — the Features panel needs
 * counts to render the dialog at the moment of flip-off (when invoicing is
 * still currently true, but about to be flipped). Counts of 0 are valid
 * answers; the panel uses 0 to skip the dialog and flip silently.
 *
 * Cross-tenant guard: getTenantId() scopes the query to the authenticated
 * tenant. The .eq('tenant_id', tenantId) filters rows server-side.
 */
export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch both counts in parallel — head:true returns count without rows.
  const [invoicesResult, estimatesResult] = await Promise.all([
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    supabase
      .from('estimates')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
  ]);

  if (invoicesResult.error || estimatesResult.error) {
    const err = invoicesResult.error || estimatesResult.error;
    return Response.json({ error: err.message }, { status: 500 });
  }

  return Response.json({
    invoices: invoicesResult.count ?? 0,
    estimates: estimatesResult.count ?? 0,
  });
}
```

CRITICAL details:
- The PATCH route does NOT call `getTenantFeatures()`. There is NO gate on this route — it must always be accessible (else the user can't re-enable invoicing once disabled).
- The GET counts route ALSO does NOT call `getTenantFeatures()` — same reasoning, but for the read side at flip-off time.
- The PATCH validates BOTH that body.features is an object AND that body.features.invoicing is a boolean. Defensive: avoids `Cannot read property 'invoicing' of undefined` runtime errors AND avoids accepting strings/numbers.
- The UPDATE writes ONLY `{ invoicing: features.invoicing }` — the literal object, not spread of body. This is the T-53-06 mitigation. If a future flag is added, the route is updated to include the new key explicitly.
- The counts query uses `select('id', { count: 'exact', head: true })` — Supabase returns `count` without fetching rows. Efficient.
- Both routes use the service-role client (`@/lib/supabase`) — getTenantId() already established the auth context.
- Plan 04's API gates do NOT include `/api/tenant/**` — verify the gate file lists in Plan 04 explicitly excluded these (they are not in the gated set).
  </action>
  <verify>
    <automated>test -f src/app/api/tenant/features/route.js && test -f src/app/api/tenant/invoicing-counts/route.js && grep -q "export async function PATCH" src/app/api/tenant/features/route.js && grep -q "typeof features.invoicing !== 'boolean'" src/app/api/tenant/features/route.js && grep -q "{ features_enabled: { invoicing: features.invoicing } }" src/app/api/tenant/features/route.js && grep -q ".eq('id', tenantId)" src/app/api/tenant/features/route.js && grep -q "export async function GET" src/app/api/tenant/invoicing-counts/route.js && grep -q "count: 'exact', head: true" src/app/api/tenant/invoicing-counts/route.js && grep -q "Promise.all" src/app/api/tenant/invoicing-counts/route.js && ! grep -q "getTenantFeatures" src/app/api/tenant/features/route.js && ! grep -q "getTenantFeatures" src/app/api/tenant/invoicing-counts/route.js && npm run build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - File `src/app/api/tenant/features/route.js` exists
    - PATCH route exports async function PATCH(request)
    - PATCH route uses `await getTenantId()` and returns 401 when null
    - PATCH route validates `typeof features.invoicing !== 'boolean'` and returns 400 on failure
    - PATCH route writes `{ features_enabled: { invoicing: features.invoicing } }` (literal controlled shape, no body spread)
    - PATCH route uses `.eq('id', tenantId)` (cross-tenant guard)
    - PATCH route does NOT import or call `getTenantFeatures` (must remain accessible when flag is off)
    - File `src/app/api/tenant/invoicing-counts/route.js` exists
    - GET route uses `Promise.all` to fetch both counts in parallel
    - GET route uses `count: 'exact', head: true` for efficient counting
    - GET route does NOT import or call `getTenantFeatures`
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>Both endpoints functional. PATCH safely updates the column with strict validation; counts endpoint returns invoice + estimate totals for the authenticated tenant. Curl-testable.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Build /dashboard/more/features page with Switch + flip-off AlertDialog</name>
  <files>src/app/dashboard/more/features/page.js</files>
  <read_first>
    - src/app/dashboard/more/invoice-settings/page.js (visual sibling — match h1 + Separator + card.base layout)
    - src/components/dashboard/DashboardSidebar.jsx lines 171-186 (AlertDialog logout pattern with brand-accent confirm button)
    - src/components/FeatureFlagsProvider.jsx (Plan 02 — `useFeatureFlags`)
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-UI-SPEC.md Surface 1 + Surface 5 (full layout + dialog copy locked)
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-CONTEXT.md D-04 + D-05
  </read_first>
  <action>
Create `src/app/dashboard/more/features/page.js` with the full implementation. The file is a Client Component (`'use client'`) because it uses Switch state, AlertDialog state, fetch on click, and sonner toasts.

Use the EXACT structure below (copy verbatim — UI-SPEC has locked the visual contract):

```jsx
'use client';

import { useState } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { card, heading, body } from '@/lib/design-tokens';
import { useFeatureFlags } from '@/components/FeatureFlagsProvider';

const FEATURES = [
  {
    key: 'invoicing',
    label: 'Invoicing',
    description: "Create invoices and estimates, send payment reminders, and track what you're owed.",
    icon: Zap,
  },
  // Future flags appended here; matching shape.
];

export default function FeaturesPage() {
  const initial = useFeatureFlags();

  // Local optimistic state — we update immediately on Switch toggle, then
  // reconcile with the server response. On error we roll back to `initial`.
  const [enabled, setEnabled] = useState({ invoicing: initial.invoicing });
  const [pendingKey, setPendingKey] = useState(null);

  // Flip-off dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingCounts, setPendingCounts] = useState({ invoices: 0, estimates: 0 });
  const [confirmPending, setConfirmPending] = useState(false);

  async function patchFeatures(nextValue) {
    const prevValue = enabled.invoicing;
    setEnabled({ invoicing: nextValue }); // optimistic
    setPendingKey('invoicing');

    try {
      const res = await fetch('/api/tenant/features', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: { invoicing: nextValue } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Success toast only on disable confirmation flow (silent on enable per UI-SPEC).
      if (!nextValue) {
        toast.success('Invoicing disabled. Re-enable here anytime.');
      }
    } catch {
      // Rollback
      setEnabled({ invoicing: prevValue });
      toast.error(
        nextValue
          ? 'Failed to enable invoicing. Try again.'
          : 'Failed to disable invoicing. Try again.'
      );
    } finally {
      setPendingKey(null);
    }
  }

  async function handleToggleInvoicing(nextValue) {
    if (nextValue) {
      // Flip ON — always silent.
      await patchFeatures(true);
      return;
    }

    // Flip OFF — fetch counts. If 0/0, silent flip. Otherwise, dialog.
    setPendingKey('invoicing');
    let counts = { invoices: 0, estimates: 0 };
    try {
      const res = await fetch('/api/tenant/invoicing-counts');
      if (res.ok) counts = await res.json();
    } catch {
      // If counts fetch fails, fall through to silent flip — the cron filter
      // and proxy gate still protect the data; the dialog is informational only.
    }
    setPendingKey(null);

    if ((counts.invoices ?? 0) === 0 && (counts.estimates ?? 0) === 0) {
      await patchFeatures(false);
      return;
    }

    setPendingCounts(counts);
    setConfirmOpen(true);
  }

  async function handleConfirmDisable() {
    setConfirmPending(true);
    await patchFeatures(false);
    setConfirmPending(false);
    setConfirmOpen(false);
  }

  function handleCancelDisable() {
    setConfirmOpen(false);
    // Switch is bound to `enabled.invoicing`, which is still `true` because
    // patchFeatures was never called. No state to revert.
  }

  function buildDescription({ invoices, estimates }) {
    if (invoices > 0 && estimates > 0) {
      return `You have ${invoices} invoice(s) and ${estimates} estimate(s) on file. Disabling invoicing hides the invoicing tools from your dashboard — your data is preserved and you can re-enable anytime from this page.`;
    }
    if (invoices > 0) {
      return `You have ${invoices} invoice(s) on file. Disabling invoicing hides the invoicing tools from your dashboard — your data is preserved and you can re-enable anytime from this page.`;
    }
    return `You have ${estimates} estimate(s) on file. Disabling invoicing hides the invoicing tools from your dashboard — your data is preserved and you can re-enable anytime from this page.`;
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className={`text-xl font-semibold ${heading}`}>Features</h1>
        <Separator className="mt-3" />
      </div>

      <div className={`${card.base} p-6 space-y-0 divide-y divide-border`}>
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          const isEnabled = enabled[feature.key] === true;
          const isPending = pendingKey === feature.key;

          return (
            <div
              key={feature.key}
              className="flex items-center justify-between gap-4 py-5 first:pt-0 last:pb-0 min-h-[64px]"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted shrink-0">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${heading}`}>{feature.label}</p>
                  <p className={`text-xs ${body} mt-1`}>{feature.description}</p>
                </div>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={(next) => {
                  if (feature.key === 'invoicing') handleToggleInvoicing(next);
                }}
                disabled={isPending}
                aria-label={`${feature.label} — ${isEnabled ? 'on' : 'off'}`}
              />
            </div>
          );
        })}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable invoicing?</AlertDialogTitle>
            <AlertDialogDescription>
              {buildDescription(pendingCounts)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDisable}>
              Keep Invoicing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDisable}
              disabled={confirmPending}
              className="bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)]"
            >
              {confirmPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

CRITICAL details (per UI-SPEC, locked):
- Page title: literal `Features` (not "Feature Flags", not "Capabilities").
- Invoicing description: literal `Create invoices and estimates, send payment reminders, and track what you're owed.` — note the apostrophe escape via `&apos;` is NOT used; we use straight `"` quotes around the string and a plain `'` inside (JavaScript string handles it).
- Icon: `Zap` from lucide-react. Container: `bg-muted` (NOT brand-accent — UI-SPEC distinguishes settings items from QUICK_ACCESS items).
- Switch aria-label format: `Invoicing — on` or `Invoicing — off` (the em-dash `—`, NOT a hyphen `-`).
- AlertDialog action button: `bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)]` — orange, NOT red. The action is reversible.
- Dialog confirm button: when pending, prepend a `<Loader2 className="h-4 w-4 animate-spin mr-2" />` BEFORE the `Disable` text.
- Toasts: ONLY on disable success (`Invoicing disabled. Re-enable here anytime.`) and on either error. Enable success is SILENT.
- The Switch is bound to local state (`enabled.invoicing`), which is initialized from `useFeatureFlags()` once on mount. After PATCH, the local state is the source of truth for that session — the user sees the new state immediately. On next page navigation, the Server layout re-fetches and the Provider value updates.
- DO NOT add a back button or any navigation chrome — the parent `more/layout.js` already provides MoreBackButton.
- The page is intentionally NOT in the proxy gate matcher (Plan 03 has `/dashboard/more/invoice-settings` but NOT `/dashboard/more/features`). Verify by reading Plan 03 Task 1 acceptance criteria.
  </action>
  <verify>
    <automated>test -f src/app/dashboard/more/features/page.js && head -1 src/app/dashboard/more/features/page.js | grep -q "'use client';" && grep -q "import { useFeatureFlags }" src/app/dashboard/more/features/page.js && grep -q "FEATURES = \[" src/app/dashboard/more/features/page.js && grep -q "'/api/tenant/features'" src/app/dashboard/more/features/page.js && grep -q "'/api/tenant/invoicing-counts'" src/app/dashboard/more/features/page.js && grep -q "AlertDialogTitle>Disable invoicing?" src/app/dashboard/more/features/page.js && grep -q "Keep Invoicing" src/app/dashboard/more/features/page.js && grep -q ">Disable" src/app/dashboard/more/features/page.js && grep -q "Invoicing disabled. Re-enable here anytime." src/app/dashboard/more/features/page.js && grep -q "Failed to disable invoicing. Try again." src/app/dashboard/more/features/page.js && grep -q "Failed to enable invoicing. Try again." src/app/dashboard/more/features/page.js && grep -q "bg-\[var(--brand-accent)\]" src/app/dashboard/more/features/page.js && grep -q "Zap" src/app/dashboard/more/features/page.js && npm run build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - File `src/app/dashboard/more/features/page.js` exists
    - First line is `'use client';`
    - Imports `useFeatureFlags`, `Switch`, `AlertDialog` (and sub-parts), `Separator`, `toast`, `Zap`, `Loader2`, `card/heading/body` design tokens
    - Defines `const FEATURES = [...]` with at least the invoicing entry having `key: 'invoicing'`, `label: 'Invoicing'`, the locked description string, and `icon: Zap`
    - Calls PATCH `/api/tenant/features` with body `{ features: { invoicing: nextValue } }`
    - Calls GET `/api/tenant/invoicing-counts` in the disable flow
    - Renders an AlertDialog with title `Disable invoicing?`
    - Cancel button label: `Keep Invoicing`
    - Confirm button label: `Disable`
    - Confirm button class includes `bg-[var(--brand-accent)]`
    - Shows toast `Invoicing disabled. Re-enable here anytime.` on disable success
    - Shows toast `Failed to disable invoicing. Try again.` on disable error
    - Shows toast `Failed to enable invoicing. Try again.` on enable error
    - Skips the dialog when invoices.count == 0 AND estimates.count == 0
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>Features panel renders, Switch toggles invoicing, dialog appears conditionally on flip-off with locked copy, optimistic UI with rollback on error.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Add permanent "Features" entry to MORE_ITEMS in /dashboard/more/page.js</name>
  <files>src/app/dashboard/more/page.js</files>
  <read_first>
    - src/app/dashboard/more/page.js (now in its Plan 06 modified state — Plan 06 added useFeatureFlags + filter logic but did NOT add the Features entry; this task adds it)
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-UI-SPEC.md Surface 6 (placement between Billing and AI & Voice Settings)
  </read_first>
  <action>
Make these TWO edits to `src/app/dashboard/more/page.js`:

EDIT 1 — Add `Zap` to the existing lucide-react import block (the file already imports many icons from lucide-react; add Zap to that list). Find:
```js
import {
  Wrench,
  Clock,
  MapPin,
  Bot,
  Bell,
  PhoneForwarded,
  CreditCard,
  UserCircle,
  ChevronRight,
  FileText,
  Plug,
  ClipboardList,
  MessageSquare,
} from 'lucide-react';
```

Replace with (alphabetically inserted):
```js
import {
  Wrench,
  Clock,
  MapPin,
  Bot,
  Bell,
  PhoneForwarded,
  CreditCard,
  UserCircle,
  ChevronRight,
  FileText,
  Plug,
  ClipboardList,
  MessageSquare,
  Zap,
} from 'lucide-react';
```

EDIT 2 — Insert the Features entry into the `MORE_ITEMS` array between Billing and AI & Voice Settings.

Find:
```js
  { href: '/dashboard/more/billing', label: 'Billing', description: 'Plan, usage, and invoices', icon: CreditCard },
  { href: '/dashboard/more/invoice-settings', label: 'Invoice Settings', description: 'Business info, tax rate, and invoice numbering', icon: FileText },
  { href: '/dashboard/more/integrations', label: 'Integrations', description: 'Connect accounting software for invoice sync', icon: Plug },
  { href: '/dashboard/more/ai-voice-settings', label: 'AI & Voice Settings', description: 'Phone number, AI tone, and test call', icon: Bot },
```

Replace with:
```js
  { href: '/dashboard/more/billing', label: 'Billing', description: 'Plan, usage, and invoices', icon: CreditCard },
  { href: '/dashboard/more/features', label: 'Features', description: 'Turn optional capabilities on or off', icon: Zap },
  { href: '/dashboard/more/invoice-settings', label: 'Invoice Settings', description: 'Business info, tax rate, and invoice numbering', icon: FileText },
  { href: '/dashboard/more/integrations', label: 'Integrations', description: 'Connect accounting software for invoice sync', icon: Plug },
  { href: '/dashboard/more/ai-voice-settings', label: 'AI & Voice Settings', description: 'Phone number, AI tone, and test call', icon: Bot },
```

DO NOT change:
- The Plan 06 filter logic (`visibleMoreItems = MORE_ITEMS.filter(...)`). The Features entry is NOT in the gated set, so the filter never removes it.
- The QUICK_ACCESS array or its conditional render block.
- The order of any other entries.

CRITICAL details (per UI-SPEC Surface 6):
- Position: BETWEEN Billing and Invoice Settings. Per UI-SPEC, the rationale is: "Billing is a natural anchor before capability controls. Placing Features above Invoice Settings also creates a logical sequence: 'turn on features here, then configure them below.'"
- Description copy: literal `Turn optional capabilities on or off`.
- Icon: `Zap` (NOT FileText, NOT Settings).
- The entry is ALWAYS visible — it is NOT in the Plan 06 filter's hide list (`/dashboard/more/invoice-settings` and `/dashboard/more/integrations` are; `/dashboard/more/features` is not).
- When invoicing is OFF, the user sees: ... Billing, Features, AI & Voice Settings, Account (Invoice Settings + Integrations are filtered out).
- When invoicing is ON, the user sees: ... Billing, Features, Invoice Settings, Integrations, AI & Voice Settings, Account.
  </action>
  <verify>
    <automated>grep -q "Zap" src/app/dashboard/more/page.js && grep -q "{ href: '/dashboard/more/features', label: 'Features'" src/app/dashboard/more/page.js && grep -q "description: 'Turn optional capabilities on or off'" src/app/dashboard/more/page.js && grep -q "icon: Zap" src/app/dashboard/more/page.js && grep -q "visibleMoreItems = MORE_ITEMS.filter" src/app/dashboard/more/page.js && npm run build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - File imports `Zap` from `lucide-react`
    - MORE_ITEMS array contains the literal entry `{ href: '/dashboard/more/features', label: 'Features', description: 'Turn optional capabilities on or off', icon: Zap }`
    - The Features entry is positioned IMMEDIATELY AFTER the Billing entry (and IMMEDIATELY BEFORE Invoice Settings)
    - Plan 06's filter logic (`visibleMoreItems = MORE_ITEMS.filter(...)`) is preserved — the Features entry is not in the filter's hide list
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>"Features" entry appears in the More menu permanently. Users can find the toggle panel from the dashboard.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → PATCH /api/tenant/features | Authenticated owner-only write. getTenantId() validates the session and resolves the tenant. The UPDATE WHERE clause is bound to that tenant — cross-tenant writes impossible. |
| PATCH body → JSONB column | The route writes only the controlled `{ invoicing: features.invoicing }` literal. Body is parsed but never spread into the column — JSONB injection blocked. |
| Browser → GET /api/tenant/invoicing-counts | Authenticated read. getTenantId() scopes to the authenticated tenant. Counts are non-sensitive (just integers). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-53-01 | Elevation of Privilege | Tenant A flipping invoicing for Tenant B | mitigate | PATCH route uses `getTenantId()` to resolve the AUTHENTICATED user's tenant, then `.eq('id', tenantId)` constrains UPDATE to that tenant. Cross-tenant writes are prevented at the WHERE clause level. |
| T-53-06 | Tampering | JSONB injection via PATCH body | mitigate | Two-layer validation: (1) typeof features.invoicing !== 'boolean' returns 400; (2) UPDATE writes the LITERAL `{ invoicing: features.invoicing }` — no body spread. An attacker cannot inject `{ "invoicing": true, "admin": true }` into the column. |
| T-53-07 | Information Disclosure | Counts endpoint reveals total invoice count to attacker | accept | The counts are scoped to the authenticated tenant. An attacker who can read their own tenant's counts already has dashboard access — counts are not sensitive beyond what the dashboard already shows. |
| T-53-08 | Denial of Service | Repeated PATCH spam | accept | Rate limiting is a Next.js / Vercel platform concern, not Phase 53. The endpoint is idempotent (writing the same value twice has no side effect). |
</threat_model>

<verification>
After all 3 tasks:
1. `npm run build` exits 0.
2. With features_enabled = `{"invoicing": false}`:
   - Visit `/dashboard/more/features` — page loads (NOT redirected by proxy).
   - Switch shows OFF.
   - Click Switch ON → silent flip; Switch shows ON; sidebar Invoices link appears on next navigation.
3. With features_enabled = `{"invoicing": true}` AND at least 1 invoice in DB:
   - Visit `/dashboard/more/features` — Switch shows ON.
   - Click Switch OFF → AlertDialog appears with the locked copy and the actual invoice count.
   - Click "Keep Invoicing" → dialog closes, Switch remains ON.
   - Click Switch OFF again → dialog reappears.
   - Click "Disable" → loader spinner appears, then dialog closes, toast "Invoicing disabled..." appears, Switch shows OFF.
4. With features_enabled = `{"invoicing": true}` AND zero invoices/estimates:
   - Click Switch OFF → silent flip (no dialog), toast "Invoicing disabled..." appears.
5. Curl tests for the API:
   - `curl -X PATCH /api/tenant/features -H "Content-Type: application/json" -d '{"features":{"invoicing":true}}'` (with auth cookie) → 200 + `{features_enabled: {invoicing: true}}`.
   - `curl -X PATCH /api/tenant/features -H "Content-Type: application/json" -d '{"features":{"invoicing":"yes"}}'` → 400 + error about boolean type.
   - `curl -X PATCH /api/tenant/features -H "Content-Type: application/json" -d '{}'` → 400 + error about features object.
   - `curl /api/tenant/invoicing-counts` (with auth cookie) → 200 + `{invoices: N, estimates: M}`.
   - All routes WITHOUT auth cookie → 401.
6. /dashboard/more page shows "Features" entry between Billing and the invoice-related entries (when invoicing=true) or between Billing and AI & Voice Settings (when invoicing=false).
</verification>

<success_criteria>
- 1 new PATCH endpoint with strict input validation
- 1 new GET counts endpoint
- 1 new Features panel page implementing UI-SPEC Surfaces 1 + 5 verbatim
- More page MORE_ITEMS includes permanent Features entry per UI-SPEC Surface 6
- All 7 sub-behaviors from VALIDATION map (53-07-01 through 53-07-07) verified manually
- Build passes
</success_criteria>

<output>
After completion, create `.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-07-SUMMARY.md` documenting:
- 3 file changes (1 new + 1 new + 1 modified)
- Curl test results for PATCH (success, 400 type error, 400 missing object, 401 no auth)
- Curl test results for GET counts
- Visual QA results: features panel toggle behavior under all 4 states (off→on, on→off-with-records, on→off-without-records, error path)
- Confirmation that more page entry order matches UI-SPEC Surface 6
- Build status
</output>
