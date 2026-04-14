/**
 * Phase 48 Plan 05 REVISION — SetupChecklistLauncher component tests.
 *
 * Target: `src/components/dashboard/SetupChecklistLauncher.jsx`
 *  - Wraps the existing SetupChecklist inside a responsive Sheet (side='right'
 *    on lg+, side='bottom' on mobile)
 *  - Auto-opens once per session via sessionStorage('voco_setup_opened') gate
 *    (desktop only, when incomplete)
 *  - Hides the FAB entirely when percent === 100
 *  - Passes data through onDataLoaded to capture progress server-side
 *
 * Matches project test convention (static source-text inspection, no
 * @testing-library). Same pattern as setup-checklist.test.js and
 * chat-panel.test.js.
 */

import { readFileSync, existsSync } from 'fs';

const SRC = 'src/components/dashboard/SetupChecklistLauncher.jsx';
const PAGE = 'src/app/dashboard/page.js';
const LAYOUT = 'src/app/dashboard/layout.js';

const read = (path) => readFileSync(path, 'utf8');

describe('SetupChecklistLauncher', () => {
  it('file exists at the expected path', () => {
    expect(existsSync(SRC)).toBe(true);
  });

  it('wraps the existing SetupChecklist component', () => {
    const src = read(SRC);
    expect(src).toMatch(
      /import\s+SetupChecklist\s+from\s+['"]@\/components\/dashboard\/SetupChecklist['"]/
    );
    // Progress is fetched directly in the launcher (Radix Sheet does not mount
    // children until open=true, so an onDataLoaded callback on the child can
    // never fire before the Sheet opens — which defeats the FAB + auto-open).
    expect(src).toMatch(/<SetupChecklist\s*\/>/);
  });

  it('uses shadcn Sheet with responsive side prop (right on lg+, bottom on mobile)', () => {
    const src = read(SRC);
    expect(src).toMatch(/from\s+['"]@\/components\/ui\/sheet['"]/);
    expect(src).toMatch(/<Sheet\b/);
    expect(src).toMatch(/side=\{[^}]*isMobile[^}]*['"]bottom['"][^}]*['"]right['"]/);
  });

  it('reads the useIsMobile hook with the lg (1024px) breakpoint', () => {
    const src = read(SRC);
    expect(src).toMatch(
      /import\s*\{\s*useIsMobile\s*\}\s*from\s*['"]@\/hooks\/useIsMobile['"]/
    );
    expect(src).toMatch(/useIsMobile\s*\(\s*1024\s*\)/);
  });

  it('uses sessionStorage voco_setup_opened as the auto-open gate', () => {
    const src = read(SRC);
    // Gate key
    expect(src).toMatch(/voco_setup_opened/);
    // Both read and write sides exist
    expect(src).toMatch(/sessionStorage\.getItem/);
    expect(src).toMatch(/sessionStorage\.setItem/);
  });

  it('skips auto-open on mobile (bottom-sheet blocks content)', () => {
    const src = read(SRC);
    // The effect must short-circuit when isMobile is truthy.
    expect(src).toMatch(/if\s*\(\s*isMobile\s*\)\s*return/);
  });

  it('skips auto-open and hides the FAB when percent >= 100', () => {
    const src = read(SRC);
    // Either as an effect short-circuit or in the FAB render guard.
    expect(src).toMatch(/percent\s*>=\s*100/);
  });

  it('FAB is rendered with a copper accent and a 44px minimum tap target', () => {
    const src = read(SRC);
    expect(src).toMatch(/#C2410C/);
    // FAB guards min tap size (WCAG) regardless of the visual diameter
    expect(src).toMatch(/minWidth:\s*44/);
    expect(src).toMatch(/minHeight:\s*44/);
  });

  it('mobile FAB is offset above the BottomTabBar (72px)', () => {
    const src = read(SRC);
    expect(src).toMatch(/bottom-\[72px\]/);
  });

  it('FAB carries a data-tour hook for the guided tour step', () => {
    const src = read(SRC);
    expect(src).toMatch(/data-tour=["']setup-checklist-fab["']/);
  });

  it('FAB button has an aria-label describing the pending count', () => {
    const src = read(SRC);
    expect(src).toMatch(/aria-label=/);
    // Label text references steps / finish setup — not a raw count
    expect(src).toMatch(/finish setup/i);
  });

  it('fetches /api/setup-checklist directly to derive progress', () => {
    const src = read(SRC);
    // Launcher owns the fetch — not the inner SetupChecklist — because Radix
    // Sheet doesn't mount children until open=true. See file-level comment.
    expect(src).toMatch(/useSWRFetch\s*\(\s*['"]\/api\/setup-checklist['"]/);
    // Tracks percent derived from items array
    expect(src).toMatch(/checklistData\.items/);
  });

  it('respects prefers-reduced-motion via framer-motion useReducedMotion', () => {
    const src = read(SRC);
    expect(src).toMatch(/useReducedMotion/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Integration checks — confirm the launcher replaced the inline mount pattern.
// ───────────────────────────────────────────────────────────────────────────

describe('Dashboard layout + page integration (launcher revision)', () => {
  it('layout.js mounts SetupChecklistLauncher alongside ChatbotSheet', () => {
    const src = read(LAYOUT);
    expect(src).toMatch(
      /import\s+SetupChecklistLauncher\s+from\s+['"]@\/components\/dashboard\/SetupChecklistLauncher['"]/
    );
    expect(src).toMatch(/<SetupChecklistLauncher\s*\/>/);
  });

  it('dashboard/page.js no longer renders SetupChecklist or ChatPanel inline', () => {
    const src = read(PAGE);
    expect(src).not.toMatch(/<SetupChecklist\s*\/?>/);
    expect(src).not.toMatch(/<ChatPanel\s*\/?>/);
    // Still composes the daily ops surfaces
    expect(src).toMatch(/<DailyOpsHub/);
    expect(src).toMatch(/<HelpDiscoverabilityCard/);
    expect(src).toMatch(/<RecentActivityFeed/);
  });

  it('page.js dropped the 12-col sidebar grid (single-column layout)', () => {
    const src = read(PAGE);
    expect(src).not.toMatch(/lg:grid-cols-12/);
    expect(src).not.toMatch(/lg:col-span-8/);
    expect(src).not.toMatch(/lg:col-span-4/);
    expect(src).not.toMatch(/lg:sticky\s+lg:top-6/);
  });
});
