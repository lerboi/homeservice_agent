---
phase: 54-integration-credentials-foundation-caching-prep-sandbox-provisioning
plan: 05
type: execute
wave: 5
depends_on:
  - 54-03
  - 54-04
files_modified:
  - src/app/dashboard/more/integrations/page.js
  - src/components/dashboard/BusinessIntegrationsClient.jsx
  - .claude/skills/dashboard-crm-system/SKILL.md
  - .claude/skills/auth-database-multitenancy/SKILL.md
autonomous: false
requirements:
  - INTFOUND-01

must_haves:
  truths:
    - "`/dashboard/more/integrations` renders with H1 'Business Integrations' and the verbatim UI-SPEC subheading"
    - "Under an H2 'Calendar Connections' section, the existing CalendarSyncCard still renders (preserved from pre-Phase-54 page)"
    - "Under an H2 'Accounting & Job Management' section, two cards render: Xero (FileSpreadsheet icon) and Jobber (Wrench icon) — side-by-side at md+, stacked at <768px"
    - "When a provider is disconnected, the card shows the verbatim disconnected status line and a filled-accent 'Connect Xero' / 'Connect Jobber' button"
    - "When a provider is connected, the card shows one of two verbatim status lines depending on whether the invoicing feature flag is ON or OFF, plus an outline red 'Disconnect' button"
    - "Clicking 'Connect Xero' fires a full-page redirect to the Xero consent URL returned by `GET /api/integrations/xero/auth`"
    - "OAuth callback landing with `?connected=xero` triggers `toast.success('Xero connected.')`; `?error=...` triggers `toast.error` per UI-SPEC copy"
    - "Clicking 'Disconnect' opens an AlertDialog with verbatim UI-SPEC copy per provider; confirm calls `POST /api/integrations/disconnect` and optimistically removes the card's connected state"
    - "The page is a Server Component that calls `getIntegrationStatus(tenantId)` directly and passes initial status to a Client child component (Pattern A per researcher finding #5 / UI-SPEC Open Question #4)"
    - "No QuickBooks or FreshBooks card renders anywhere (deleted, not hidden)"
  artifacts:
    - path: "src/app/dashboard/more/integrations/page.js"
      provides: "Server Component — reads tenantId + getIntegrationStatus, renders BusinessIntegrationsClient"
      contains: "getIntegrationStatus"
    - path: "src/components/dashboard/BusinessIntegrationsClient.jsx"
      provides: "Client component — interactions (connect, disconnect AlertDialog, toasts, skeletons for status refresh, invoicing-flag-aware status-line copy)"
      exports: ["default"]
    - path: ".claude/skills/dashboard-crm-system/SKILL.md"
      provides: "Skill documentation updated to reflect Business Integrations page shape + Phase 54 additions"
      contains: "Business Integrations"
    - path: ".claude/skills/auth-database-multitenancy/SKILL.md"
      provides: "Skill documentation updated to reflect migration 051 + accounting_credentials schema extensions"
      contains: "051_integrations_schema"
  key_links:
    - from: "src/app/dashboard/more/integrations/page.js"
      to: "getIntegrationStatus"
      via: "direct import + await call before rendering Client child"
      pattern: "await getIntegrationStatus"
    - from: "src/components/dashboard/BusinessIntegrationsClient.jsx"
      to: "/api/integrations/xero/auth"
      via: "fetch → { url } → window.location.href = url"
      pattern: "window.location.href"
    - from: "src/components/dashboard/BusinessIntegrationsClient.jsx"
      to: "/api/integrations/disconnect"
      via: "fetch POST with { provider } body"
      pattern: "/api/integrations/disconnect"
---

<objective>
Rewrite the `/dashboard/more/integrations` page per UI-SPEC and D-04 / D-07. The page heading becomes "Business Integrations." The existing Calendar Connections section stays (under its own H2). The Accounting Software section is replaced with a provider-first two-card layout (Xero + Jobber) using the EXACT UI-SPEC strings and following the shadcn neutral+new-york preset already configured.

This plan uses **Pattern A** per researcher finding #5 resolution: a Server Component `page.js` calls `getIntegrationStatus(tenantId)` directly (exercising the `'use cache'` loop at the render boundary — per D-10's "page renders from this cached read" requirement) and passes the resolved status as `initialStatus` props to a Client Component child. The Client child owns all interaction state (connect, disconnect dialog, toasts, skeleton, invoicing-flag-aware status line).

Purpose:
- D-04 locks the renamed heading + provider-first card layout.
- D-07 locks frontend rewrite as in-phase work.
- D-10 locks the `'use cache'` smoke test via the Business Integrations page.
- INTFOUND-01 includes the read path (status visible to owner).
- UI-SPEC has the exact copy contract.

**Researcher finding #5 resolution:** UI-SPEC §Data Flow specified "Page fetches `GET /api/integrations/status` on mount" (Pattern B). Researcher recommended Pattern A (Server Component calls `getIntegrationStatus` directly) as the more decisive cache-loop smoke test. UI-SPEC Open Question #4 explicitly flagged this as flexible. Plan 05 commits to Pattern A. The `/api/integrations/status` endpoint from Plan 03 remains as a fallback for any downstream client consumer (Phase 58 telemetry dashboards, third-party reuse).

**Phase 53 FeatureFlagsProvider dependency:** UI-SPEC assumes `FeatureFlagsProvider` (Phase 53) is available so the Client child can read `invoicing` flag from Context. Phase 53 is a prerequisite to Phase 54 per ROADMAP. If for any reason `FeatureFlagsProvider` is not yet reachable from `/dashboard/more/integrations` at execution time, the Client child falls back to a `fetch('/api/tenant/features')` call (per UI-SPEC Open Question #4 escape hatch). The plan encodes both paths; executor picks whichever compiles.

**Out of scope (do NOT do in this plan):**
- Do NOT implement scope-level toggles (CONTEXT.md Deferred Ideas).
- Do NOT show `last_context_fetch_at` timestamp to owners (UI-SPEC: "No timestamp … in Phase 54").
- Do NOT render a QuickBooks or FreshBooks card (D-15 — deleted).
- Do NOT display per-capability status breakdown ("Customer context: ON | Invoice push: OFF") — UI-SPEC explicitly rejects.
- Do NOT touch `voice-call-architecture` or `payment-architecture` skills (those are Phase 55/56 skill sync territory).
</objective>

<execution_context>
@.claude/get-shit-done/workflows/execute-plan.md
@.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-CONTEXT.md
@.planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-RESEARCH.md
@.planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-UI-SPEC.md
@src/app/dashboard/more/integrations/page.js
@src/lib/integrations/status.js
@src/lib/get-tenant-id.js
@src/components/dashboard/CalendarSyncCard.js

<interfaces>
<!-- Plan 02/03/04 outputs this plan consumes -->

From `src/lib/integrations/status.js` (Plan 02):
```javascript
export async function getIntegrationStatus(tenantId): Promise<{
  xero:   { provider, scopes: string[], last_context_fetch_at: string|null, connected_at: string, display_name: string|null } | null,
  jobber: { provider, scopes: string[], last_context_fetch_at: string|null, connected_at: string, display_name: string|null } | null
}>
```

From `src/lib/get-tenant-id.js` (existing):
```javascript
export async function getTenantId(): Promise<string | null>
```

From `src/components/dashboard/CalendarSyncCard.js` (existing — rendered inside this page, unchanged by Plan 05):
```javascript
export default function CalendarSyncCard(): JSX.Element
```

From `@/components/ui/*` (shadcn — all already installed per UI-SPEC Registry Safety):
- `Card`, `CardContent`, `CardFooter`
- `Button`
- `Skeleton`
- `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
- `Separator` (optional)
- `toast` from `sonner`
- Icons from `lucide-react`: `FileSpreadsheet`, `Wrench`, `Loader2`

From Phase 53 (prerequisite):
```javascript
// src/components/providers/FeatureFlagsProvider.jsx (or similar — planned but may not yet exist at Plan 05 execution)
export function useFeatureFlags(): { invoicing: boolean, ... }
```

If the Phase 53 hook is unavailable at Plan 05 execution time, fallback path:
```javascript
fetch('/api/tenant/features').then(r => r.json())   // returns { invoicing: boolean }
```

The page file path `src/app/dashboard/more/integrations/page.js` currently holds a Client Component (verified via `'use client'` on line 1). Plan 05 REPLACES this entirely — converts to a Server Component and extracts the interactive surface into `src/components/dashboard/BusinessIntegrationsClient.jsx`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create BusinessIntegrationsClient.jsx — interactive card grid + AlertDialog + invoicing-flag-aware status lines</name>
  <files>src/components/dashboard/BusinessIntegrationsClient.jsx</files>
  <read_first>
    - .planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-UI-SPEC.md (ENTIRE file — Copywriting Contract § has the verbatim strings; Component Inventory § has the prop contract; Interaction Contracts § has the state machine)
    - src/app/dashboard/more/integrations/page.js (current Client implementation — template for interaction patterns; note: you are NOT editing this file, you are creating a sibling and the Server page will replace it)
    - src/components/dashboard/CalendarSyncCard.js (follow same file conventions — `.jsx`/`.js` mix is OK; match neighboring code)
    - src/lib/design-tokens.js (use `card.base`, `btn.primary`, `focus.ring` tokens)
  </read_first>
  <action>
Create `src/components/dashboard/BusinessIntegrationsClient.jsx` using the UI-SPEC copy verbatim. The client is a single file; provider cards are inline (per UI-SPEC Open Question #1, extraction not mandated unless card body exceeds ~80 lines — with two variants of status-line copy per provider, the card body stays compact; inline is acceptable).

**Full file:**

```jsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { FileSpreadsheet, Wrench, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { card } from '@/lib/design-tokens';

// UI-SPEC Open Question #4 + CONTEXT.md D-10 architectural intent:
// FeatureFlagsProvider (Phase 53) is the CANONICAL invoicing-flag source.
// Import at module top so useFeatureFlags() runs at render time (primary path).
// Phase 53's useFeatureFlags() already returns DEFAULT_FLAGS ({ invoicing: false })
// when no Provider is mounted — so the hook itself is the fallback mechanism.
// The try/catch below guards ONLY the case where the Phase 53 module file is
// missing entirely (unlikely once Phase 53 merges; defensive for mid-merge window).
let useFeatureFlagsHook;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  useFeatureFlagsHook = require('@/components/FeatureFlagsProvider').useFeatureFlags;
} catch {
  useFeatureFlagsHook = null;
}

// UI-SPEC locks these exact strings. Do NOT paraphrase.
const PROVIDER_META = {
  xero: {
    id: 'xero',
    name: 'Xero',
    Icon: FileSpreadsheet,
    connectLabel: 'Connect Xero',
    connectSuccessToast: 'Xero connected.',
    connectErrorToast: "Couldn't connect to Xero. Please try again.",
    startErrorToast: "Couldn't start the Xero connection. Please try again.",
    disconnectErrorToast: "Couldn't disconnect Xero. Please try again.",
    disconnectedStatus:
      'Connect Xero to share customer history with your AI receptionist during calls.',
    connectedStatusInvoicingOff:
      'Connected. Sharing customer context with your AI receptionist.',
    connectedStatusInvoicingOn:
      'Connected. Sharing customer context and sending invoices.',
    dialogTitle: 'Disconnect Xero?',
    dialogBody:
      'Your AI receptionist will stop sharing Xero customer history during calls. If invoicing is on, invoices will also stop syncing to Xero. Previously synced invoices are not affected. You can reconnect anytime.',
  },
  jobber: {
    id: 'jobber',
    name: 'Jobber',
    Icon: Wrench,
    connectLabel: 'Connect Jobber',
    connectSuccessToast: 'Jobber connected.',
    connectErrorToast: "Couldn't connect to Jobber. Please try again.",
    startErrorToast: "Couldn't start the Jobber connection. Please try again.",
    disconnectErrorToast: "Couldn't disconnect Jobber. Please try again.",
    disconnectedStatus:
      'Connect Jobber to share customer and job history with your AI receptionist during calls.',
    connectedStatusInvoicingOff:
      'Connected. Sharing customer and job history with your AI receptionist.',
    connectedStatusInvoicingOn:
      'Connected. Sharing customer history and sending invoices.',
    dialogTitle: 'Disconnect Jobber?',
    dialogBody:
      'Your AI receptionist will stop sharing Jobber customer and job history during calls. If invoicing is on, invoices will also stop syncing to Jobber. Previously synced data is not affected. You can reconnect anytime.',
  },
};

const PROVIDER_ORDER = ['xero', 'jobber'];

/**
 * Resolves the invoicing feature flag per UI-SPEC Open Question #4 (RESOLVED).
 *
 * PRIMARY path: call useFeatureFlags() at render time. Phase 53 guarantees that
 * the hook returns DEFAULT_FLAGS ({ invoicing: false }) if no Provider is
 * mounted, so no extra fallback logic is needed for the "Provider not wrapping
 * this page" case.
 *
 * FALLBACK path: fetch /api/tenant/features — exercised ONLY if the Phase 53
 * module file itself is missing (useFeatureFlagsHook resolved to null at the
 * module-load try/catch above). This is a defensive guard for the brief window
 * between Phase 54 merging and Phase 53 wiring stabilising across all branches.
 *
 * Net effect after Phase 53 is merged: useFeatureFlags() is the primary (and
 * only) path. Fetch fallback is dead code kept for merge-order resilience.
 */
function useInvoicingFlag() {
  // Primary path — always call the hook if the module resolved.
  // NOTE: Hooks must be called unconditionally. The decision of which path
  // to take is made at module-load time (useFeatureFlagsHook === null?), not
  // per-render — so calling the hook here is safe React-hooks-rules-wise.
  if (useFeatureFlagsHook) {
    const flags = useFeatureFlagsHook();
    return Boolean(flags?.invoicing);
  }

  // Fallback path — Phase 53 module not found. Fetch the API route instead.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [invoicing, setInvoicing] = useState(null);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    let mounted = true;
    fetch('/api/tenant/features')
      .then((r) => r.json())
      .then((data) => {
        if (mounted) setInvoicing(Boolean(data?.invoicing));
      })
      .catch(() => {
        if (mounted) setInvoicing(false);
      });
    return () => {
      mounted = false;
    };
  }, []);
  return invoicing;
}

function statusLineFor(providerMeta, connected, invoicing) {
  if (!connected) return providerMeta.disconnectedStatus;
  if (invoicing) return providerMeta.connectedStatusInvoicingOn;
  return providerMeta.connectedStatusInvoicingOff;
}

export default function BusinessIntegrationsClient({ initialStatus }) {
  const searchParams = useSearchParams();
  const invoicing = useInvoicingFlag(); // null | boolean

  // Convert server-provided { xero, jobber } shape into {provider: row} map
  const [status, setStatus] = useState(() => ({
    xero: initialStatus?.xero || null,
    jobber: initialStatus?.jobber || null,
  }));
  const [connecting, setConnecting] = useState(null);
  const [disconnecting, setDisconnecting] = useState(null);
  const [disconnectTarget, setDisconnectTarget] = useState(null);

  // OAuth callback landing toast (UI-SPEC copy verbatim)
  useEffect(() => {
    const connected = searchParams.get('connected');
    const errParam = searchParams.get('error');
    const errProvider = searchParams.get('provider');

    if (connected && PROVIDER_META[connected]) {
      toast.success(PROVIDER_META[connected].connectSuccessToast);
    }
    if (errParam) {
      const providerKey = PROVIDER_META[errProvider] ? errProvider : null;
      const meta = providerKey ? PROVIDER_META[providerKey] : null;
      toast.error(
        meta
          ? meta.connectErrorToast
          : "Couldn't complete the integration. Please try again.",
      );
    }
  }, [searchParams]);

  async function handleConnect(providerKey) {
    const meta = PROVIDER_META[providerKey];
    setConnecting(providerKey);
    try {
      const res = await fetch(`/api/integrations/${providerKey}/auth`);
      const { url, error } = await res.json();
      if (error || !url) {
        toast.error(meta.startErrorToast);
        setConnecting(null);
        return;
      }
      window.location.href = url; // full-page redirect per UI-SPEC
    } catch {
      toast.error(meta.startErrorToast);
      setConnecting(null);
    }
  }

  async function handleDisconnect(providerKey) {
    const meta = PROVIDER_META[providerKey];
    setDisconnecting(providerKey);
    try {
      const res = await fetch('/api/integrations/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerKey }),
      });
      if (!res.ok) throw new Error('disconnect failed');
      setStatus((prev) => ({ ...prev, [providerKey]: null }));
    } catch {
      toast.error(meta.disconnectErrorToast);
    } finally {
      setDisconnecting(null);
      setDisconnectTarget(null);
    }
  }

  // Still resolving invoicing flag? Show skeleton cards.
  const showSkeletons = invoicing === null;

  return (
    <>
      {showSkeletons ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" aria-busy="true">
          {PROVIDER_ORDER.map((key) => (
            <div key={key} className={`${card.base} p-5`}>
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4 mb-4" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PROVIDER_ORDER.map((providerKey) => {
            const meta = PROVIDER_META[providerKey];
            const Icon = meta.Icon;
            const connected = Boolean(status[providerKey]);
            const isConnecting = connecting === providerKey;
            const isDisconnecting = disconnecting === providerKey;

            return (
              <div key={providerKey} className={`${card.base} p-5 flex flex-col`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center h-8 w-8 bg-muted rounded-lg">
                    <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{meta.name}</span>
                </div>

                <p
                  className={
                    connected
                      ? 'flex-1 text-sm text-emerald-600 dark:text-emerald-400 mb-4'
                      : 'flex-1 text-sm text-muted-foreground mb-4'
                  }
                >
                  {statusLineFor(meta, connected, invoicing)}
                </p>

                {connected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                    onClick={() => setDisconnectTarget(providerKey)}
                    disabled={isDisconnecting}
                  >
                    {isDisconnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                        Disconnecting…
                      </>
                    ) : (
                      'Disconnect'
                    )}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full bg-[var(--brand-accent)] text-white hover:bg-[var(--brand-accent)]/90"
                    onClick={() => handleConnect(providerKey)}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                        Connecting…
                      </>
                    ) : (
                      meta.connectLabel
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={!!disconnectTarget}
        onOpenChange={(open) => {
          if (!open) setDisconnectTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {disconnectTarget ? PROVIDER_META[disconnectTarget].dialogTitle : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {disconnectTarget ? PROVIDER_META[disconnectTarget].dialogBody : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => disconnectTarget && handleDisconnect(disconnectTarget)}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

Copy the UI-SPEC strings verbatim — they are the checker sign-off gate. No paraphrasing, no shortening, no added punctuation.
  </action>
  <verify>
    <automated>test -f src/components/dashboard/BusinessIntegrationsClient.jsx && grep -c "Connect Xero to share customer history with your AI receptionist during calls." src/components/dashboard/BusinessIntegrationsClient.jsx && grep -c "Connect Jobber to share customer and job history with your AI receptionist during calls." src/components/dashboard/BusinessIntegrationsClient.jsx && grep -c "Disconnect Xero?" src/components/dashboard/BusinessIntegrationsClient.jsx && grep -c "Disconnect Jobber?" src/components/dashboard/BusinessIntegrationsClient.jsx && grep -c "FileSpreadsheet" src/components/dashboard/BusinessIntegrationsClient.jsx && grep -c "Wrench" src/components/dashboard/BusinessIntegrationsClient.jsx && ! grep -q "QuickBooks" src/components/dashboard/BusinessIntegrationsClient.jsx && ! grep -q "FreshBooks" src/components/dashboard/BusinessIntegrationsClient.jsx && grep -c "/api/integrations/" src/components/dashboard/BusinessIntegrationsClient.jsx && ! grep -q "/api/accounting/" src/components/dashboard/BusinessIntegrationsClient.jsx</automated>
  </verify>
  <acceptance_criteria>
    - File exists at `src/components/dashboard/BusinessIntegrationsClient.jsx`
    - File starts with `'use client';`
    - File contains the verbatim Xero disconnected status line: `Connect Xero to share customer history with your AI receptionist during calls.`
    - File contains verbatim Xero connected-invoicing-off status: `Connected. Sharing customer context with your AI receptionist.`
    - File contains verbatim Xero connected-invoicing-on status: `Connected. Sharing customer context and sending invoices.`
    - File contains verbatim Jobber disconnected status: `Connect Jobber to share customer and job history with your AI receptionist during calls.`
    - File contains verbatim Jobber connected-invoicing-off status: `Connected. Sharing customer and job history with your AI receptionist.`
    - File contains verbatim Jobber connected-invoicing-on status: `Connected. Sharing customer history and sending invoices.`
    - File contains exactly these dialog titles: `Disconnect Xero?` and `Disconnect Jobber?`
    - File uses `FileSpreadsheet` icon for Xero and `Wrench` icon for Jobber (per UI-SPEC Component Inventory)
    - File does NOT mention `QuickBooks` or `FreshBooks` (grep returns 0)
    - File hits `/api/integrations/...` endpoints (NOT `/api/accounting/...`)
    - Toast success copy matches UI-SPEC: `Xero connected.` / `Jobber connected.`
    - Toast error copy matches UI-SPEC: `Couldn't connect to Xero. Please try again.` / `Couldn't start the Xero connection. Please try again.` / `Couldn't disconnect Xero. Please try again.`
    - Responsive grid: `grid grid-cols-1 md:grid-cols-2 gap-6` (UI-SPEC §Spacing)
  </acceptance_criteria>
  <done>
Client child component exists with every UI-SPEC string verbatim, shadcn components wired, invoicing-flag-aware status line, AlertDialog destructive confirm, full-page OAuth redirect, optimistic disconnect state update. No QB/FB residue.
  </done>
</task>

<task type="auto">
  <name>Task 2: Convert page.js to Server Component (Pattern A) + preserve Calendar Connections section</name>
  <files>src/app/dashboard/more/integrations/page.js</files>
  <read_first>
    - src/app/dashboard/more/integrations/page.js (CURRENT Client Component — you are replacing it entirely; reference only for Calendar Connections section preservation)
    - src/lib/integrations/status.js (confirm getIntegrationStatus export + return shape)
    - src/lib/get-tenant-id.js (confirm getTenantId signature for Server Component use)
    - src/components/dashboard/CalendarSyncCard.js (confirm it renders standalone — no new props needed)
    - .planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-UI-SPEC.md §Page Heading + Subheading + §Section Heading
  </read_first>
  <action>
Completely REPLACE the contents of `src/app/dashboard/more/integrations/page.js` with a Server Component that resolves the cached integration status and delegates interactive UI to the new Client child.

**Full file:**

```jsx
// Server Component — Phase 54 D-04 + D-10 (Pattern A).
// Reads cached per-tenant integration status via getIntegrationStatus
// ('use cache' + cacheTag inside status.js). Renders the Calendar Connections
// section (preserved, unchanged) and delegates the Xero/Jobber provider cards
// to BusinessIntegrationsClient for interactive state.

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getTenantId } from '@/lib/get-tenant-id';
import { getIntegrationStatus } from '@/lib/integrations/status';
import CalendarSyncCard from '@/components/dashboard/CalendarSyncCard';
import BusinessIntegrationsClient from '@/components/dashboard/BusinessIntegrationsClient';
import { card } from '@/lib/design-tokens';

export default async function IntegrationsPage() {
  const tenantId = await getTenantId();
  if (!tenantId) {
    redirect('/auth/signin');
  }

  const initialStatus = await getIntegrationStatus(tenantId);

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-1">Business Integrations</h1>
      <p className="text-sm text-muted-foreground">
        Connect Xero and Jobber so your AI receptionist knows your customers&apos; history during calls.
      </p>

      {/* Calendar Connections — preserved from pre-Phase-54 page, unchanged copy */}
      <h2 className="text-base font-semibold text-foreground mt-8 mb-1">Calendar Connections</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Connect your calendar to automatically sync appointments.
      </p>
      <div className={`${card.base} p-5`}>
        <CalendarSyncCard />
      </div>

      {/* Accounting &amp; Job Management — provider-first cards per UI-SPEC */}
      <h2 className="text-base font-semibold text-foreground mt-10 mb-1">Accounting &amp; Job Management</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Connect Xero or Jobber to share customer history with your AI receptionist.
      </p>

      <Suspense fallback={null}>
        <BusinessIntegrationsClient initialStatus={initialStatus} />
      </Suspense>
    </div>
  );
}
```

Key decisions embedded:
- **No `'use client'` at top** — this is a Server Component, which is what lets us `await getIntegrationStatus(tenantId)` and hit the `'use cache'` boundary (D-10).
- **H1 "Business Integrations"** — D-04 verbatim.
- **Subheading verbatim from UI-SPEC §Page Heading + Subheading.**
- **Calendar Connections H2 preserved** — UI-SPEC §Section Heading notes the planner's-call variant; we chose UI-SPEC's "preferred single-H1 'Business Integrations'" shape with Calendar Connections retained beneath it (matches current page continuity).
- **Accounting & Job Management H2** — replaces prior "Accounting Software" H2 with the more accurate "job management" framing (Jobber is FSM, not accounting).
- **Suspense wrapper** — required by Next.js 16 cacheComponents rules when a Client Component sits inside a Server Component that has async data. Fallback is `null` because BusinessIntegrationsClient owns its own skeleton states.

Do NOT add `'use cache'` to this page (it reads `tenantId` from auth cookies via `getTenantId()` — request-time; can't be cached at the page level). The cache lives INSIDE `getIntegrationStatus`, keyed per tenant.
  </action>
  <verify>
    <automated>test -f src/app/dashboard/more/integrations/page.js && ! grep -q "^'use client'" src/app/dashboard/more/integrations/page.js && grep -c "export default async function" src/app/dashboard/more/integrations/page.js && grep -c "getIntegrationStatus" src/app/dashboard/more/integrations/page.js && grep -c "Business Integrations" src/app/dashboard/more/integrations/page.js && grep -c "BusinessIntegrationsClient" src/app/dashboard/more/integrations/page.js && grep -c "CalendarSyncCard" src/app/dashboard/more/integrations/page.js && ! grep -q "QuickBooks" src/app/dashboard/more/integrations/page.js && ! grep -q "FreshBooks" src/app/dashboard/more/integrations/page.js && ! grep -q "/api/accounting" src/app/dashboard/more/integrations/page.js</automated>
  </verify>
  <acceptance_criteria>
    - File `src/app/dashboard/more/integrations/page.js` exists
    - File does NOT start with `'use client'` (grep for `^'use client'` returns 0) — Server Component
    - File exports an `export default async function` (Server Component async)
    - File imports `getIntegrationStatus` from `@/lib/integrations/status`
    - File imports `getTenantId` from `@/lib/get-tenant-id`
    - File imports `BusinessIntegrationsClient` from `@/components/dashboard/BusinessIntegrationsClient`
    - File imports `CalendarSyncCard` from `@/components/dashboard/CalendarSyncCard` (preserved section)
    - File contains literal H1 `<h1 className="text-xl font-semibold text-foreground mb-1">Business Integrations</h1>`
    - File contains the verbatim UI-SPEC subheading: `Connect Xero and Jobber so your AI receptionist knows your customers' history during calls.` (note the `&apos;` for the apostrophe in JSX)
    - File contains H2 `Calendar Connections` (preserved) AND H2 `Accounting &amp; Job Management` (new)
    - File does NOT reference `/api/accounting/` anywhere (grep returns 0)
    - File does NOT reference `QuickBooks` or `FreshBooks` (grep returns 0)
    - File wraps `BusinessIntegrationsClient` in `<Suspense fallback={null}>`
  </acceptance_criteria>
  <done>
Page is a Server Component. Heading and subheading match UI-SPEC verbatim. Calendar Connections preserved. Provider cards delegated to Client child, which receives server-resolved `initialStatus`. `'use cache'` loop exercised at `getIntegrationStatus` call.
  </done>
</task>

<task type="auto">
  <name>Task 3: Update auth-database-multitenancy + dashboard-crm-system skills to document Phase 54 changes</name>
  <files>.claude/skills/dashboard-crm-system/SKILL.md, .claude/skills/auth-database-multitenancy/SKILL.md</files>
  <read_first>
    - .claude/skills/dashboard-crm-system/SKILL.md (full file — understand current structure before amending)
    - .claude/skills/auth-database-multitenancy/SKILL.md (full file — same)
    - supabase/migrations/051_integrations_schema.sql (document exact schema additions)
    - src/lib/integrations/ (list the 5 module files you're documenting)
  </read_first>
  <action>
**Step 1. Update `.claude/skills/dashboard-crm-system/SKILL.md`:**

Find the section that documents `/dashboard/more/integrations` (if none, add one under the "More menu pages" or equivalent). Add/update to include:

- **Heading:** "Business Integrations" (Phase 54 renamed from "Integrations")
- **Shape:** Server Component page → reads `getIntegrationStatus(tenantId)` (cached `'use cache'` + `cacheTag`) → renders `BusinessIntegrationsClient.jsx` (Client) for interaction
- **Sections on page:**
  1. Calendar Connections (unchanged, `CalendarSyncCard`)
  2. Accounting & Job Management — two provider cards (Xero + Jobber)
- **Interaction flow:** owner clicks "Connect Xero" → `GET /api/integrations/xero/auth` → window.location.href redirect → Xero consent → `GET /api/integrations/xero/callback` → upserts `accounting_credentials` (Phase 54 schema) → `revalidateTag(\`integration-status-${tenantId}\`)` → returns to page with `?connected=xero` → toast.success
- **Disconnect flow:** AlertDialog confirm → `POST /api/integrations/disconnect` → adapter.revoke best-effort + DB row delete + revalidateTag → optimistic UI update
- **Invoicing flag dependency:** status-line copy varies depending on `FeatureFlagsProvider.invoicing` state (Phase 53)
- **QuickBooks + FreshBooks:** removed in Phase 54 (D-15); NOT hidden — deleted

Keep edits surgical: add the above as a "Business Integrations (Phase 54)" subsection without rewriting unrelated pages.

**Step 2. Update `.claude/skills/auth-database-multitenancy/SKILL.md`:**

Find the migration catalog (the skill indexes all 50+ migrations with every table). Append migration 051 entry:

- **051_integrations_schema.sql** (Phase 54)
  - Extends `accounting_credentials.provider` CHECK constraint from `('quickbooks', 'xero', 'freshbooks')` to `('xero', 'jobber')`
  - Purges any existing rows with `provider IN ('quickbooks', 'freshbooks')` BEFORE swapping the CHECK (required by Postgres — can't ALTER CHECK in-place)
  - Adds `scopes TEXT[] NOT NULL DEFAULT '{}'::text[]` — populated by `/api/integrations/[provider]/callback` with granular OAuth scopes
  - Adds `last_context_fetch_at TIMESTAMPTZ NULL` — populated by Phase 55+ `fetchCustomerByPhone` for telemetry
  - No new indexes; existing `UNIQUE (tenant_id, provider)` covers tenant-scoped reads
  - **Python compatibility:** `TEXT[]` → `list[str]`, `TIMESTAMPTZ` → `datetime` (for livekit-agent service-role reads in Phase 55+)

Update the migration count if the skill tracks it (e.g., change "50 migrations" to "51 migrations" in the header).

Do NOT touch `voice-call-architecture`, `payment-architecture`, `onboarding-flow`, or any other skill — Phase 54's scope is dashboard + DB. Other skill syncs belong to Phase 58 per ROADMAP.
  </action>
  <verify>
    <automated>grep -c "Business Integrations" .claude/skills/dashboard-crm-system/SKILL.md && grep -c "051_integrations_schema" .claude/skills/auth-database-multitenancy/SKILL.md && grep -c "scopes TEXT\[\]" .claude/skills/auth-database-multitenancy/SKILL.md && grep -c "last_context_fetch_at" .claude/skills/auth-database-multitenancy/SKILL.md</automated>
  </verify>
  <acceptance_criteria>
    - `.claude/skills/dashboard-crm-system/SKILL.md` contains literal string `Business Integrations` (new section/subsection)
    - `.claude/skills/dashboard-crm-system/SKILL.md` references Server Component + Client child pattern AND `/api/integrations/` endpoints
    - `.claude/skills/auth-database-multitenancy/SKILL.md` contains literal `051_integrations_schema`
    - `.claude/skills/auth-database-multitenancy/SKILL.md` documents `scopes TEXT[]` column addition
    - `.claude/skills/auth-database-multitenancy/SKILL.md` documents `last_context_fetch_at` column addition
    - `.claude/skills/auth-database-multitenancy/SKILL.md` notes CHECK swap to `('xero', 'jobber')` and QB/FB row purge
    - No other skill files modified in this task (confirm via `git status` — only the two SKILL.md files changed in this task's commit)
  </acceptance_criteria>
  <done>
Two skills synced: dashboard-crm-system documents the new Business Integrations page shape; auth-database-multitenancy documents migration 051. Other skills untouched (they're Phase 58 territory).
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Human UI verification — Business Integrations page at /dashboard/more/integrations</name>
  <what-built>
- Server Component page at `src/app/dashboard/more/integrations/page.js` rendering "Business Integrations" H1 + Calendar Connections (preserved) + Accounting & Job Management provider cards (Xero + Jobber)
- Client child `src/components/dashboard/BusinessIntegrationsClient.jsx` with AlertDialog, sonner toasts, and verbatim UI-SPEC copy for all 6 status-line variants
- `getIntegrationStatus` exercised at page render (D-10 smoke test)
- Skills updated
  </what-built>
  <how-to-verify>
1. **Build + run:**
   ```bash
   npm run build && npm run start
   ```
   If `build` fails with cacheComponents-related errors (e.g., `Filling a cache during prerender timed out`), inspect the error — most likely the page is trying to cache despite reading `tenantId`. Fix: ensure `getIntegrationStatus` is AWAITED inside the Server Component (it is — confirm no race).

2. **Sign in** as a tenant owner. Navigate to `/dashboard/more/integrations`.

3. **Visual verification against UI-SPEC:**
   - [ ] H1 reads exactly "Business Integrations"
   - [ ] Subheading reads exactly "Connect Xero and Jobber so your AI receptionist knows your customers' history during calls." (note apostrophe)
   - [ ] H2 "Calendar Connections" still renders with CalendarSyncCard below (unchanged from pre-Phase-54)
   - [ ] H2 "Accounting & Job Management" renders below, followed by two provider cards
   - [ ] Xero card: FileSpreadsheet icon, name "Xero", disconnected status line "Connect Xero to share customer history with your AI receptionist during calls."
   - [ ] Jobber card: Wrench icon, name "Jobber", disconnected status line "Connect Jobber to share customer and job history with your AI receptionist during calls."
   - [ ] Cards side-by-side at md+ (≥768px), stacked at mobile (<768px)
   - [ ] No QuickBooks card, no FreshBooks card
   - [ ] "Connect Xero" button is the accent color (`#C2410C` light / `#FB923C` dark)
   - [ ] "Connect Jobber" button is same accent color

4. **Interaction test (OAuth roundtrip):**
   - Click "Connect Xero" → expect full-page redirect to `login.xero.com`
   - If Xero sandbox not yet registered, this step will return a 500 on the callback — that's expected; verify the `?error=connection_failed&provider=xero` URL triggers `toast.error("Couldn't connect to Xero. Please try again.")` when you return to the page.
   - Click "Connect Jobber" → redirect to Jobber's authorize page, then back with `?error=connection_failed&provider=jobber` (Jobber callback throws NotImplementedError) → expect toast.error "Couldn't connect to Jobber. Please try again."

5. **Disconnect test (requires a connected provider — only Xero if sandbox + `.env` configured):**
   - If Xero is actually connected: click "Disconnect" → AlertDialog opens with title "Disconnect Xero?" and exact body copy
   - Click "Disconnect" (red) in dialog → card transitions to disconnected state
   - Check Supabase: `accounting_credentials` row for `(tenantId, 'xero')` deleted
   - Navigate away and back → confirmed disconnected state persists (revalidateTag fired + `getIntegrationStatus` reruns)

6. **Cache smoke test (D-10 full loop):**
   ```bash
   NEXT_PRIVATE_DEBUG_CACHE=1 npm run dev
   ```
   - First page load: expect a cache miss log with `integration-status-<tenantId>` tag
   - Second page load without state change: expect a cache hit (no new DB query log)
   - After a disconnect action: expect the next page load to MISS again (revalidateTag worked)

7. **Dark mode (quick check):**
   - Toggle to dark mode (if Phase 49 dark toggle is wired)
   - All cards render legibly; emerald connected-state color shifts to `emerald-400`; red disconnect button hover shifts to `red-950/40`

8. **Accessibility:**
   - Tab order: Xero Connect/Disconnect → Jobber Connect/Disconnect → Calendar section controls
   - Escape closes AlertDialog
   - First focus in AlertDialog lands on Cancel (not Disconnect)

Record any discrepancies. Any UI-SPEC string mismatch or missing section is a blocker.
  </how-to-verify>
  <files>(dev runtime — verifying Plan 05 Tasks 1-3 output; no files modified by this task)</files>
  <action>Run `npm run build && npm run start`. Sign in as a tenant owner. Navigate to `/dashboard/more/integrations` and execute the 8-step verification walkthrough in <how-to-verify> (build check, visual audit against UI-SPEC strings, OAuth click-through, disconnect flow, cache smoke test under `NEXT_PRIVATE_DEBUG_CACHE=1`, dark mode, keyboard/focus). Record any delta between rendered copy and UI-SPEC expectations.</action>
  <verify>
    <automated>npm run build 2>&1 | tail -20 && grep -c "Business Integrations" src/app/dashboard/more/integrations/page.js</automated>
  </verify>
  <done>All 8 verification steps pass; UI-SPEC copy audit clean; cache loop observable; no blockers. Human types "approved" to close Phase 54 ready for `/gsd-verify-work`.</done>
  <resume-signal>Type "approved" if all 8 verification steps pass. If there's a blocker, paste the diff between what was rendered and the UI-SPEC expectation. If the cache smoke test didn't show a hit on second load, paste the last 30 lines of `NEXT_PRIVATE_DEBUG_CACHE=1` output — we may need to adjust `'use cache'` placement or check a 16.1.x Turbopack interaction.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Server Component page → service-role status read | `getTenantId()` proves authenticated ownership BEFORE the cache boundary; cache is keyed per-tenant. |
| Client child → `/api/integrations/*` | Same-origin fetches; session cookie authenticates; CSRF mitigated by Next.js Route Handler defaults (same-origin only). |
| OAuth return (provider → `?connected=...`) | `searchParams` drives toast; string match on known provider keys (xero/jobber) prevents injecting arbitrary toast text. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-54-24 | Information Disclosure | Cached page leaks one tenant's status to another | mitigate | Server Component reads `tenantId` via `getTenantId()` (request-time; pre-cache). `getIntegrationStatus(tenantId)` uses per-tenant `cacheTag` — Next.js 16 serialization contract keys cache by closure-captured `tenantId`. Verified in Plan 02 Task 1. |
| T-54-25 | Tampering | `searchParams.get('connected')` used in toast copy can inject arbitrary text | mitigate | Client child checks `PROVIDER_META[connected]` map BEFORE using — unknown providers fall through without toast. String constants for toast copy; no user-provided text substituted. |
| T-54-26 | Spoofing | Attacker crafts `?connected=xero` URL without actually completing OAuth | accept | Worst case: victim sees a false "Xero connected." toast but their actual status (from cached server render) still shows disconnected. No DB state mutated. Low impact; not worth additional HMAC on the `connected=` param. |
| T-54-27 | Elevation of Privilege | Client child can disconnect a provider by crafting POST body | mitigate | `POST /api/integrations/disconnect` (Plan 03) calls `getTenantId()` + deletes row scoped by `tenant_id` AND `provider`. A tenant cannot disconnect another tenant's integration. |
| T-54-28 | Denial-of-Service | Malicious rapid-click on Connect button floods OAuth initiation | accept | Rate limiting not in Phase 54 scope; existing Next.js middleware rate limits apply (if configured). Owner-facing dashboard — low-abuse surface. |
| T-54-29 | Repudiation | Owner disconnects but the upstream Xero token isn't revoked | mitigate | Plan 03 disconnect route calls `adapter.revoke` best-effort BEFORE DB delete (inherited mitigation; Plan 05 doesn't regress). |
</threat_model>

<verification>
- Build passes under `cacheComponents: true` (Plan 04 prerequisite)
- Page is Server Component; Client child has interaction state
- All UI-SPEC strings verbatim (grep-verified via Task 1 + Task 2 acceptance)
- No QB/FB residue
- CalendarSyncCard still renders
- Skills updated
- Human-verify checkpoint resolved
</verification>

<success_criteria>
- `/dashboard/more/integrations` renders correctly with H1 "Business Integrations" + Calendar Connections + Accounting & Job Management sections
- OAuth initiation works (redirect URL issued) for both Xero and Jobber
- Disconnect AlertDialog triggers correct revoke + delete + revalidate loop
- `'use cache'` hits are observable in `NEXT_PRIVATE_DEBUG_CACHE=1` logs
- UI-SPEC checker dimensions 1-6 pass (copy, visuals, color, typography, spacing, registry)
- Skill files reflect the new state
</success_criteria>

<output>
After completion, create `.planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-05-SUMMARY.md`

Required fields:
- Files created: `src/components/dashboard/BusinessIntegrationsClient.jsx`
- Files rewritten: `src/app/dashboard/more/integrations/page.js` (Client → Server)
- Files modified: `.claude/skills/{dashboard-crm-system,auth-database-multitenancy}/SKILL.md`
- UI-SPEC copy audit: all 6 status lines + 2 dialog titles + 2 dialog bodies + 4 toast messages verbatim-verified
- Human-verify result: approved / list of deltas
- Cache smoke test (D-10): loop observed (yes/no); if no, reason
- Phase 54 overall: READY FOR `/gsd-verify-work`
</output>
