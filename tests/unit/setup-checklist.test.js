/**
 * Phase 48 — SetupChecklist component source-level tests (GREEN after Plan 48-03).
 *
 * Target: `src/components/dashboard/SetupChecklist.jsx` refactored in-place per D-01:
 *  - 4 theme accordions in order profile/voice/calendar/billing
 *  - Dismiss button fires PATCH /api/setup-checklist { item_id, dismiss: true }
 *  - Mark done button fires PATCH /api/setup-checklist { item_id, mark_done: <boolean> }
 *  - Window-focus refetch via useSWRFetch({ revalidateOnFocus: true })
 *  - Preserved: conic-gradient progress ring + SetupCompleteBar celebration
 *
 * Matches project test convention (source-text inspection, no @testing-library).
 */

import { readFileSync, existsSync } from 'fs';

const SRC = 'src/components/dashboard/SetupChecklist.jsx';
const ITEM_SRC = 'src/components/dashboard/ChecklistItem.jsx';
const read = () => readFileSync(SRC, 'utf8');
const readItem = () => readFileSync(ITEM_SRC, 'utf8');

describe('SetupChecklist', () => {
  it('component file exists', () => {
    expect(existsSync(SRC)).toBe(true);
  });

  it('renders 4 theme accordions in order profile/voice/calendar/billing', () => {
    const src = read();
    // Uses shadcn Accordion primitives
    expect(src).toMatch(/from '@\/components\/ui\/accordion'/);
    expect(src).toMatch(/<Accordion\b/);
    // Themes appear in canonical order somewhere in the source (THEME_ORDER array)
    const themeOrderMatch = src.match(
      /\[\s*['"]profile['"]\s*,\s*['"]voice['"]\s*,\s*['"]calendar['"]\s*,\s*['"]billing['"]\s*\]/
    );
    expect(themeOrderMatch).not.toBeNull();
    // THEME_LABELS covers all four
    expect(src).toMatch(/profile:\s*['"]Profile['"]/);
    expect(src).toMatch(/voice:\s*['"]Voice['"]/);
    expect(src).toMatch(/calendar:\s*['"]Calendar['"]/);
    expect(src).toMatch(/billing:\s*['"]Billing['"]/);
  });

  it('Dismiss handler fires PATCH /api/setup-checklist with {item_id, dismiss:true}', () => {
    const src = read();
    // PATCH method + body includes item_id and dismiss: true literal
    expect(src).toMatch(/method:\s*['"]PATCH['"]/);
    expect(src).toMatch(/item_id:\s*itemId/);
    expect(src).toMatch(/dismiss:\s*true/);
    // Undo reverse-PATCH shape present
    expect(src).toMatch(/dismiss:\s*false/);
  });

  it('Mark done handler fires PATCH with {item_id, mark_done}', () => {
    const src = read();
    expect(src).toMatch(/mark_done:\s*\w+/);
    // Wired to item action
    expect(src).toMatch(/handleMarkDone/);
    expect(src).toMatch(/onMarkDone=\{handleMarkDone\}/);
  });

  it('uses useSWRFetch with revalidateOnFocus for window-focus auto-refetch', () => {
    const src = read();
    expect(src).toMatch(/useSWRFetch\s*\(\s*['"]\/api\/setup-checklist['"]/);
    expect(src).toMatch(/revalidateOnFocus:\s*true/);
  });

  it('preserves conic-gradient progress ring and SetupCompleteBar', () => {
    const src = read();
    expect(src).toMatch(/conic-gradient/);
    expect(src).toMatch(/SetupCompleteBar/);
  });

  it('fires a sonner toast with Undo action on dismiss', () => {
    const src = read();
    expect(src).toMatch(/from\s+['"]sonner['"]/);
    expect(src).toMatch(/toast\(/);
    expect(src).toMatch(/label:\s*['"]Undo['"]/);
  });

  it('ChecklistItem exposes Mark done, Dismiss, and Jump actions with aria-labels and 44px targets', () => {
    const item = readItem();
    expect(item).toMatch(/aria-label/);
    expect(item).toMatch(/min-h-\[44px\]/);
    expect(item).toMatch(/onMarkDone/);
    expect(item).toMatch(/onDismiss/);
    expect(item).toMatch(/Mark done|Unmark done/);
  });
});
