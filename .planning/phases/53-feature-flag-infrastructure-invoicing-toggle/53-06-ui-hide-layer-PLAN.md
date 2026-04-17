---
phase: 53
plan: 06
type: execute
wave: 3
depends_on: [1, 2]
files_modified:
  - src/components/dashboard/DashboardSidebar.jsx
  - src/components/dashboard/LeadFlyout.jsx
  - src/app/dashboard/more/page.js
autonomous: true
requirements:
  - TOGGLE-03
must_haves:
  truths:
    - "DashboardSidebar's Invoices nav entry is absent from the DOM when features.invoicing = false"
    - "LeadFlyout's Create Invoice and Create Estimate CTAs are absent from the DOM when features.invoicing = false"
    - "/dashboard/more page hides the Invoice Settings and Integrations entries when features.invoicing = false"
    - "/dashboard/more mobile QUICK_ACCESS card is not rendered at all (not just empty) when features.invoicing = false"
    - "When features.invoicing = true, every UI surface renders exactly as it did before Phase 53"
    - "BottomTabBar is unchanged — confirmed via inspection that there is NO Invoices tab there to hide (RESEARCH Q9 / TABS array)"
  artifacts:
    - path: "src/components/dashboard/DashboardSidebar.jsx"
      provides: "Sidebar with conditionally-filtered NAV_ITEMS"
      contains: "useFeatureFlags"
    - path: "src/components/dashboard/LeadFlyout.jsx"
      provides: "LeadFlyout with conditionally-rendered invoice/estimate CTAs"
      contains: "useFeatureFlags"
    - path: "src/app/dashboard/more/page.js"
      provides: "More page with conditionally-rendered QUICK_ACCESS and conditionally-filtered MORE_ITEMS"
      contains: "useFeatureFlags"
  key_links:
    - from: "DashboardSidebar"
      to: "FeatureFlagsContext"
      via: "useFeatureFlags() hook"
      pattern: "useFeatureFlags"
    - from: "LeadFlyout"
      to: "FeatureFlagsContext"
      via: "useFeatureFlags() hook"
      pattern: "useFeatureFlags"
    - from: "More page"
      to: "FeatureFlagsContext"
      via: "useFeatureFlags() hook"
      pattern: "useFeatureFlags"
---

<objective>
Hide every invoicing-related UI element when `features.invoicing = false`. The proxy gate (Plan 03) and API gates (Plan 04) prevent access; this plan ensures users never SEE links/buttons that would lead to redirects or 404s.

Purpose: Closes TOGGLE-03. Without this, users with invoicing off would see "Invoices" in their sidebar, click it, and get redirected — confusing UX. The visual hide makes the disabled state feel deliberate, not broken.

OPEN QUESTION Q1 RESOLVED: Per UI-SPEC Surface 2 ("MORE_ITEMS mutation"), the More page hides BOTH `invoice-settings` AND `integrations` when invoicing is off. The current `/dashboard/more/integrations` page hosts only accounting-software connections (per the `description: 'Connect accounting software for invoice sync'` in the MORE_ITEMS array). Calendar connections live at the separate `/dashboard/more/calendar-connections` route (confirmed via directory listing). So hiding `integrations` does NOT remove calendar access. Phase 54+ will revisit when adding Jobber/Xero — at that point, `integrations` becomes a multi-purpose page and the gating logic may need to change. For Phase 53, hide `integrations` whenever `invoicing = false`.

Output: 3 files modified. Each consumes `useFeatureFlags()` and conditionally renders/filters arrays. No new components introduced. No styling changes.
</objective>

<execution_context>
@C:/Users/leheh/.Projects/homeservice_agent/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/leheh/.Projects/homeservice_agent/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-CONTEXT.md
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-UI-SPEC.md
@src/components/FeatureFlagsProvider.jsx
@src/components/dashboard/DashboardSidebar.jsx
@src/components/dashboard/BottomTabBar.jsx
@src/components/dashboard/LeadFlyout.jsx
@src/app/dashboard/more/page.js
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-03-SUMMARY.md

<interfaces>
From src/components/FeatureFlagsProvider.jsx (Plan 02):
```jsx
export function useFeatureFlags(): { invoicing: boolean }
```
Returns `{ invoicing: false }` when no Provider mounted (fail-closed default).

From src/components/dashboard/DashboardSidebar.jsx (current — line 16-23):
```js
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/jobs', label: 'Jobs', icon: Users },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar },
  { href: '/dashboard/calls', label: 'Calls', icon: Phone },
  { href: '/dashboard/invoices', label: 'Invoices', icon: FileText },  // ← hide when invoicing=false
  { href: '/dashboard/more', label: 'More', icon: MoreHorizontal },
];
```
NAV_ITEMS is consumed at line 114 via `NAV_ITEMS.map(...)`.

From src/components/dashboard/BottomTabBar.jsx (current — line 7-13):
```js
const TABS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/calls', label: 'Calls', icon: Phone },
  { href: '/dashboard/jobs', label: 'Jobs', icon: Users },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar },
  { href: '/dashboard/more', label: 'More', icon: MoreHorizontal },
];
```
NO Invoices tab present — confirmed by RESEARCH Q9 + Pitfall 5 / Pattern 6. NO change needed to this file.

From src/components/dashboard/LeadFlyout.jsx (current — lines 731-748):
```jsx
{/* existing per-lead invoice block */}
... (linked invoice button or "Create Invoice" button at line 737)
... ("Create Estimate" button at line 746)
```
The CTAs are inside a wider conditional block. Per D-08 + UI-SPEC Surface 4, when invoicing is off the entire CTA wrapper div must be removed from the DOM.

From src/app/dashboard/more/page.js (current — lines 22-25, 27-38):
```js
const QUICK_ACCESS = [
  { href: '/dashboard/invoices', label: 'Invoices', ..., icon: FileText },
  { href: '/dashboard/estimates', label: 'Estimates', ..., icon: ClipboardList },
];
const MORE_ITEMS = [
  ...
  { href: '/dashboard/more/invoice-settings', label: 'Invoice Settings', ..., icon: FileText },
  { href: '/dashboard/more/integrations', label: 'Integrations', ..., icon: Plug },
  ...
];
```
Per UI-SPEC Surface 2: when invoicing=false, hide BOTH invoice-settings AND integrations from MORE_ITEMS, and DO NOT render the QUICK_ACCESS card AT ALL (not just an empty card).

Per UI-SPEC Surface 6: The new "Features" entry is added to MORE_ITEMS in PLAN 07 (the toggle panel's home is part of building that panel). This plan does NOT add the Features entry — it only filters out the existing invoice-related entries.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Filter DashboardSidebar NAV_ITEMS to hide Invoices when invoicing=false</name>
  <files>src/components/dashboard/DashboardSidebar.jsx</files>
  <read_first>
    - src/components/dashboard/DashboardSidebar.jsx (full file — lines 1-189; NAV_ITEMS at 16-23, render at line 114, AlertDialog at 171-186)
    - src/components/FeatureFlagsProvider.jsx (Plan 02 — `useFeatureFlags` hook)
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md Pattern 6
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-UI-SPEC.md Surface 3 (sidebar spacing collapse, no compensation)
  </read_first>
  <action>
Make these THREE precise edits to `src/components/dashboard/DashboardSidebar.jsx`:

EDIT 1 — Add the import (alongside existing imports near line 13):
```js
import { useFeatureFlags } from '@/components/FeatureFlagsProvider';
```

EDIT 2 — Inside the `DashboardSidebar` function (line 87, before `const pathname = usePathname();`), call the hook:
```js
export default function DashboardSidebar() {
  const { invoicing } = useFeatureFlags();
  const pathname = usePathname();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  // ... rest unchanged
```

EDIT 3 — Replace the existing `NAV_ITEMS.map(...)` invocation (around line 114) with a filtered version:

Find:
```jsx
        <div className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
            />
          ))}
        </div>
```

Replace with:
```jsx
        <div className="flex-1 space-y-1">
          {NAV_ITEMS.filter((item) => item.href !== '/dashboard/invoices' || invoicing).map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
            />
          ))}
        </div>
```

DO NOT modify:
- The NAV_ITEMS array constant itself (line 16-23). Keep all 6 items defined; the filter at render time discriminates.
- The logout AlertDialog or its handler.
- The ThemeToggleButton, Ask Voco AI button, or any other sidebar element.
- BottomTabBar (different file, no change needed — no Invoices tab in TABS).

CRITICAL details:
- The filter expression `item.href !== '/dashboard/invoices' || invoicing` reads as: "keep this item if it's NOT the invoices entry, OR if invoicing is enabled". This shows Invoices when invoicing=true, hides it when invoicing=false.
- Per UI-SPEC Surface 3: NO `mt-*` compensation. The `space-y-1` gap collapses naturally when one item is removed.
- The sidebar reads flags from Context — flags update on next page load (Server Component re-renders), not reactively during a single page session. This is the documented behavior in UI-SPEC Surface 3.
  </action>
  <verify>
    <automated>grep -q "import { useFeatureFlags } from '@/components/FeatureFlagsProvider'" src/components/dashboard/DashboardSidebar.jsx && grep -q "const { invoicing } = useFeatureFlags()" src/components/dashboard/DashboardSidebar.jsx && grep -q "NAV_ITEMS.filter((item) => item.href !== '/dashboard/invoices' || invoicing)" src/components/dashboard/DashboardSidebar.jsx && grep -q "/dashboard/invoices" src/components/dashboard/DashboardSidebar.jsx && grep -q "label: 'Invoices'" src/components/dashboard/DashboardSidebar.jsx && npm run build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - File contains `import { useFeatureFlags } from '@/components/FeatureFlagsProvider';`
    - File contains `const { invoicing } = useFeatureFlags();` inside the `DashboardSidebar` function body (top of function, before `const pathname`)
    - File contains the literal string `NAV_ITEMS.filter((item) => item.href !== '/dashboard/invoices' || invoicing)`
    - The original NAV_ITEMS array is preserved (still contains the Invoices entry — we filter at render, not at definition)
    - File still contains `label: 'Invoices'` (in the NAV_ITEMS array)
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>Sidebar Invoices link hides when invoicing=false. Verified visually by toggling features_enabled in DB and reloading.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Wrap LeadFlyout invoice/estimate CTAs in conditional render</name>
  <files>src/components/dashboard/LeadFlyout.jsx</files>
  <read_first>
    - src/components/dashboard/LeadFlyout.jsx (read lines 1-50 for imports, lines 720-750 for the CTA block context, plus surrounding 30 lines on each side to understand the parent conditional structure)
    - src/components/FeatureFlagsProvider.jsx (Plan 02 — `useFeatureFlags` hook)
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md Pattern 8
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-UI-SPEC.md Surface 4 (no placeholder, no message, action area collapses naturally)
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-CONTEXT.md D-08 (DOM removal, NOT disabled state)
  </read_first>
  <action>
Make these TWO edits to `src/components/dashboard/LeadFlyout.jsx`:

EDIT 1 — Add the import (place alongside the existing FeatureFlagsProvider sibling imports near the top of the imports block, e.g., after the React imports and before the local component imports):
```js
import { useFeatureFlags } from '@/components/FeatureFlagsProvider';
```

EDIT 2 — Inside the LeadFlyout function (find the function declaration, then the first hook call — typically `useState` or similar), call the hook near the top of the function body:
```js
const { invoicing } = useFeatureFlags();
```

EDIT 3 — Wrap the invoice/estimate CTA block in a conditional render. Per the file inspection (lines 731-748), the CTAs include:
- The "Create Invoice" / "Create Draft Invoice" button OR linked invoice display (around line 731-739)
- The "Create Estimate" button (around line 741-747)
- Both wrapped in a containing div

READ lines 700-755 first to understand the EXACT outer structure (it likely starts with a fragment or div around line 700-730 that contains both CTAs + any per-lead invoice badge / linked invoice count). The conditional wrap must be applied to that OUTERMOST wrapper of the invoice-related content.

Apply the wrap:
```jsx
{invoicing && (
  <>
    {/* The existing invoice/estimate block — Linked invoice button OR Create Invoice button, plus Create Estimate button */}
    {/* (existing JSX preserved verbatim — only the wrapper changes) */}
  </>
)}
```

If the existing block is already inside a parent conditional (e.g., `lead.status !== 'archived' && (...)`), nest the new `invoicing &&` check INSIDE that — i.e., the most surrounding conditional becomes `lead.status !== 'archived' && invoicing && (...)`. The goal: when invoicing=false, the entire invoice-related section is removed from the DOM. When invoicing=true, behaviour is identical to today.

CRITICAL details (per UI-SPEC Surface 4 + D-08):
- The CTAs must be REMOVED from the DOM (not disabled, not hidden via CSS). DOM removal is what `{invoicing && (...)}` produces.
- DO NOT add a placeholder, message, or "invoicing disabled" notice anywhere in the flyout. The Features panel is the canonical place to learn about the flag.
- DO NOT change the styling of any other lead-flyout content.
- Per D-08, also hide any per-lead invoice badge or linked-invoice count indicator if present. If the linked invoice display (e.g., `linkedInvoice` button at line 720+) is OUTSIDE the wrap, it must be brought INSIDE the wrap (read carefully — the `linkedInvoice ? ... : ...` ternary at lines 720-730 is the linked invoice display; it must be hidden when invoicing=false).
- If the executor finds that the invoice-CTA block and the linked-invoice display are siblings (not nested), wrap BOTH in the same `{invoicing && (...)}` block — they are conceptually one "invoicing surface" that must vanish together.

Verify the change by:
1. With invoicing=false, opening any lead in the flyout: invoice/estimate buttons and linked invoice indicators must be absent from the DOM.
2. With invoicing=true, the flyout is unchanged from today.
  </action>
  <verify>
    <automated>grep -q "import { useFeatureFlags } from '@/components/FeatureFlagsProvider'" src/components/dashboard/LeadFlyout.jsx && grep -q "const { invoicing } = useFeatureFlags()" src/components/dashboard/LeadFlyout.jsx && grep -q "{invoicing && (" src/components/dashboard/LeadFlyout.jsx && grep -q "Create Estimate" src/components/dashboard/LeadFlyout.jsx && npm run build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - File contains `import { useFeatureFlags } from '@/components/FeatureFlagsProvider';`
    - File contains `const { invoicing } = useFeatureFlags();` inside the LeadFlyout function body
    - File contains at least one `{invoicing && (` conditional render expression
    - File still contains `Create Estimate` (the button label is preserved — only its conditional wrapper is added)
    - File still contains a reference to the `Create Invoice` or `Create Draft Invoice` label (preserved — only conditional wrapped)
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>LeadFlyout's invoice/estimate CTAs and linked invoice indicators are hidden when invoicing=false. Lead records themselves remain visible (only the cross-link to invoicing disappears).</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Filter More page MORE_ITEMS and conditionally render QUICK_ACCESS card</name>
  <files>src/app/dashboard/more/page.js</files>
  <read_first>
    - src/app/dashboard/more/page.js (full 128-line file — QUICK_ACCESS at line 22-25, MORE_ITEMS at line 27-38, QUICK_ACCESS render at line 69-95, MORE_ITEMS render at line 99-125)
    - src/components/FeatureFlagsProvider.jsx (Plan 02 — `useFeatureFlags` hook)
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md Pattern 7 + Pitfall 4
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-UI-SPEC.md Surface 2 (QUICK_ACCESS removal entirely, MORE_ITEMS hide both invoice-settings + integrations)
  </read_first>
  <action>
Make these THREE edits to `src/app/dashboard/more/page.js`:

EDIT 1 — Add the import (alongside existing imports at the top):
```js
import { useFeatureFlags } from '@/components/FeatureFlagsProvider';
```

EDIT 2 — Inside the `MorePage` function (line 40), call the hook at the top of the function body:
```js
export default function MorePage() {
  const { invoicing } = useFeatureFlags();

  // Compute filtered lists once per render
  const visibleQuickAccess = invoicing ? QUICK_ACCESS : [];
  const visibleMoreItems = MORE_ITEMS.filter((item) => {
    if (!invoicing && (
      item.href === '/dashboard/more/invoice-settings' ||
      item.href === '/dashboard/more/integrations'
    )) return false;
    return true;
  });

  return (
    // ... existing return JSX modified per EDIT 3
  );
}
```

EDIT 3 — Update the JSX to use the filtered lists.

(a) Replace the QUICK_ACCESS render block (around line 69-95). The current code unconditionally renders the `<div className={... lg:hidden}>...{QUICK_ACCESS.map(...)}...</div>`. Wrap the ENTIRE outer card div in a conditional render so when `visibleQuickAccess.length === 0` the card is not rendered AT ALL (not just empty — per UI-SPEC Surface 2: "do NOT render the quick-access card block at all").

Find:
```jsx
      {/* Quick access — Invoices & Estimates (visible on mobile where they're not in bottom bar) */}
      <div className={`${card.base} divide-y divide-border overflow-hidden mb-4 lg:hidden`}>
        {QUICK_ACCESS.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03, ease: 'easeOut' }}
            >
              <Link
                href={item.href}
                className="flex items-center gap-4 px-5 py-4 hover:bg-muted transition-colors min-h-[48px]"
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-[var(--brand-accent)]/[0.08] shrink-0">
                  <Icon className="h-5 w-5 text-[var(--brand-accent)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            </motion.div>
          );
        })}
      </div>
```

Replace with:
```jsx
      {/* Quick access — Invoices & Estimates (visible on mobile where they're not in bottom bar)
          Per Phase 53 UI-SPEC Surface 2: not rendered AT ALL when invoicing=false (no empty card). */}
      {visibleQuickAccess.length > 0 && (
        <div className={`${card.base} divide-y divide-border overflow-hidden mb-4 lg:hidden`}>
          {visibleQuickAccess.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.03, ease: 'easeOut' }}
              >
                <Link
                  href={item.href}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-muted transition-colors min-h-[48px]"
                >
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-[var(--brand-accent)]/[0.08] shrink-0">
                    <Icon className="h-5 w-5 text-[var(--brand-accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
```

(b) Replace the MORE_ITEMS render (around line 99-125) — change `{MORE_ITEMS.map(...)}` to `{visibleMoreItems.map(...)}`. The rest of the JSX inside the map stays identical.

DO NOT change:
- The QUICK_ACCESS or MORE_ITEMS const arrays themselves (filtering happens at render).
- The "Ask Voco AI" mobile-only card at the top (lines 45-67) — visible regardless of flag per UI-SPEC.
- The Settings header `<h2>` text or position.
- Any animation timings, classnames, or motion props.

CRITICAL details (per UI-SPEC Surface 2 + Pitfall 4):
- BOTH `QUICK_ACCESS` AND `MORE_ITEMS` must be filtered. Pitfall 4 explicitly calls out the mobile QUICK_ACCESS as an easy miss.
- The MORE_ITEMS filter hides BOTH `invoice-settings` AND `integrations` (per Open Question Q1 resolution at the top of this plan + UI-SPEC Surface 2).
- When QUICK_ACCESS is empty, do NOT render the empty card container — the conditional wrapper `{visibleQuickAccess.length > 0 && (...)}` ensures the entire `<div className={...}>...</div>` block is absent.
- Plan 07 will ADD a new "Features" entry to MORE_ITEMS (positioned between Billing and AI & Voice Settings per UI-SPEC Surface 6). Plan 06 only filters out — Plan 07 adds.
  </action>
  <verify>
    <automated>grep -q "import { useFeatureFlags } from '@/components/FeatureFlagsProvider'" src/app/dashboard/more/page.js && grep -q "const { invoicing } = useFeatureFlags()" src/app/dashboard/more/page.js && grep -q "visibleQuickAccess = invoicing ? QUICK_ACCESS : \[\]" src/app/dashboard/more/page.js && grep -q "visibleMoreItems = MORE_ITEMS.filter" src/app/dashboard/more/page.js && grep -q "/dashboard/more/invoice-settings" src/app/dashboard/more/page.js && grep -q "/dashboard/more/integrations" src/app/dashboard/more/page.js && grep -q "{visibleQuickAccess.length > 0 && (" src/app/dashboard/more/page.js && grep -q "{visibleMoreItems.map" src/app/dashboard/more/page.js && npm run build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - File contains `import { useFeatureFlags } from '@/components/FeatureFlagsProvider';`
    - File contains `const { invoicing } = useFeatureFlags();` inside the MorePage function
    - File contains the literal string `visibleQuickAccess = invoicing ? QUICK_ACCESS : []`
    - File contains `visibleMoreItems = MORE_ITEMS.filter` (filter expression)
    - The filter expression references both `/dashboard/more/invoice-settings` and `/dashboard/more/integrations`
    - File contains `{visibleQuickAccess.length > 0 && (` (conditional wrapper around the QUICK_ACCESS card)
    - File contains `{visibleMoreItems.map` (the render uses the filtered list)
    - File still contains the original `QUICK_ACCESS = [` const declaration (unchanged)
    - File still contains the original `MORE_ITEMS = [` const declaration (unchanged)
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>More page hides invoice-settings and integrations links + the entire QUICK_ACCESS card when invoicing=false. Page is otherwise unchanged.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Server (layout.js) → Client (these components) | Flags arrive as a serialized prop into FeatureFlagsProvider via Plan 03. These components consume via Context. |
| Client UI hide vs server gate | UI hide is convenience — the proxy (Plan 03) and API gates (Plan 04) are the actual security boundary. A user with browser devtools could remove the UI hide, but they would still hit a redirect/404. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-53-ui-bypass | Tampering | Client-side hide bypassed via devtools | accept | UI hide is UX, not security. The defense-in-depth comes from Plan 03 (proxy redirect) and Plan 04 (API 404). A user removing the hide would simply hit a redirect. Documented behavior. |
| T-53-quick-access-miss | Information Disclosure | QUICK_ACCESS Invoices link visible on mobile More page when invoicing=false | mitigate | Pitfall 4 explicitly addresses this — the conditional wrapper around the entire QUICK_ACCESS card prevents the link from being rendered. Acceptance criterion grep enforces. |
</threat_model>

<verification>
After all 3 tasks:
1. `npm run build` exits 0.
2. With features_enabled = `{"invoicing": false}`:
   - Open dashboard at desktop viewport (>1024px): sidebar shows Home, Jobs, Calendar, Calls, More — NO Invoices.
   - Open any lead in the flyout: NO "Create Invoice" / "Create Estimate" buttons visible. NO linked-invoice display.
   - Visit `/dashboard/more`: Settings list shows Services & Pricing, Working Hours, Service Zones, Notifications, Call Routing, Billing, AI & Voice Settings, Account — NO Invoice Settings, NO Integrations.
   - Mobile viewport (<1024px) at `/dashboard/more`: NO QUICK_ACCESS Invoices/Estimates card. Ask Voco AI card still visible.
3. With features_enabled = `{"invoicing": true}`:
   - Sidebar shows Invoices link.
   - LeadFlyout shows Create Invoice + Create Estimate buttons.
   - More page shows all 10 items including Invoice Settings + Integrations + QUICK_ACCESS card.
4. BottomTabBar (mobile) is unchanged in both states (no Invoices tab existed before; nothing to change).
</verification>

<success_criteria>
- 3 files modified, all consume `useFeatureFlags()` and conditionally render
- BottomTabBar untouched (no change required)
- DOM removal (not CSS hide) — confirmed by visual devtools inspection
- Open Question Q1 resolved: integrations link hidden alongside invoice-settings (calendar connections live elsewhere)
- Build passes
</success_criteria>

<output>
After completion, create `.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-06-SUMMARY.md` documenting:
- 3 files modified with grep evidence
- Visual QA results: which surfaces hide vs show under flag=true and flag=false
- Confirmation that BottomTabBar was inspected and required no change
- Note about how Phase 54+ may revisit `/dashboard/more/integrations` gating once Jobber/Xero connection cards land there
- Build status
</output>
