/**
 * SetupChecklistLauncher component tests (onboarding revamp).
 *
 * Target: `src/components/dashboard/SetupChecklistLauncher.jsx`
 *  - Wraps the existing SetupChecklist inside a responsive Sheet (side='right'
 *    on lg+, side='bottom' on mobile)
 *  - Opens on the `open-setup-checklist` window event (fired by the readiness
 *    card) — NO LONGER auto-opens per session
 *  - Hides the FAB entirely when percent === 100
 *  - FAB surfaces the count of essentials remaining (the call-readiness blocker)
 *
 * Matches project test convention (static source-text inspection, no
 * @testing-library).
 */

import { readFileSync, existsSync } from 'fs';

const SRC = 'src/components/dashboard/SetupChecklistLauncher.jsx';
const PAGE = 'src/app/dashboard/page.js';
// The launcher mounts in the client layout shell, not the server layout.js.
const LAYOUT = 'src/app/dashboard/DashboardLayoutClient.jsx';

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

  it('opens the Sheet on the open-setup-checklist window event', () => {
    const src = read(SRC);
    expect(src).toMatch(/addEventListener\(\s*['"]open-setup-checklist['"]/);
    expect(src).toMatch(/setOpen\(true\)/);
  });

  it('no longer auto-opens the Sheet (the readiness card is the surfaced guide)', () => {
    const src = read(SRC);
    expect(src).not.toMatch(/voco_setup_opened/);
    expect(src).not.toMatch(/shouldAutoOpen/);
  });

  it('hides the FAB when percent >= 100 (nothing left to launch)', () => {
    const src = read(SRC);
    expect(src).toMatch(/percent\s*>=\s*100/);
  });

  it('FAB surfaces the essentials-remaining count', () => {
    const src = read(SRC);
    expect(src).toMatch(/essentialsLeft/);
  });

  it('FAB uses the copper brand accent and a 44px minimum tap target', () => {
    const src = read(SRC);
    expect(src).toMatch(/var\(--brand-accent\)/);
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
    // Label text references finishing setup — not a raw count
    expect(src).toMatch(/finish setup/i);
  });

  it('fetches /api/setup-checklist directly to derive progress', () => {
    const src = read(SRC);
    expect(src).toMatch(/useSWRFetch\s*\(\s*['"]\/api\/setup-checklist['"]/);
    expect(src).toMatch(/checklistData\.items/);
  });

  it('respects prefers-reduced-motion via framer-motion useReducedMotion', () => {
    const src = read(SRC);
    expect(src).toMatch(/useReducedMotion/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Integration checks — confirm the home page + layout wiring.
// ───────────────────────────────────────────────────────────────────────────

describe('Dashboard layout + page integration (onboarding revamp)', () => {
  it('DashboardLayoutClient mounts SetupChecklistLauncher alongside ChatbotSheet', () => {
    const src = read(LAYOUT);
    expect(src).toMatch(
      /import\s+SetupChecklistLauncher\s+from\s+['"]@\/components\/dashboard\/SetupChecklistLauncher['"]/
    );
    expect(src).toMatch(/<SetupChecklistLauncher\s*\/>/);
  });

  it('dashboard/page.js renders the CallReadinessCard, not the inline checklist', () => {
    const src = read(PAGE);
    expect(src).not.toMatch(/<SetupChecklist\s*\/?>/);
    expect(src).toMatch(/<CallReadinessCard\s*\/>/);
    // Still composes the daily ops surfaces
    expect(src).toMatch(/<DailyOpsHub/);
    expect(src).toMatch(/<HelpDiscoverabilityCard/);
    expect(src).toMatch(/<RecentActivityFeed/);
  });

  it('page.js uses a single-column layout (no 12-col sidebar grid)', () => {
    const src = read(PAGE);
    expect(src).not.toMatch(/lg:grid-cols-12/);
    expect(src).not.toMatch(/lg:col-span-8/);
    expect(src).not.toMatch(/lg:col-span-4/);
  });
});
