/** RED (Wave 0): will be made GREEN by Plan 48-03 — do not delete */
/**
 * Phase 48 — SetupChecklist component source-level tests.
 *
 * Target: `src/components/dashboard/SetupChecklist.jsx` refactored in-place per D-01:
 *  - 4 theme accordions in order profile/voice/calendar/billing
 *  - Dismiss button fires PATCH /api/setup-checklist { item_id, dismiss: true }
 *  - Mark done button fires PATCH /api/setup-checklist { item_id, mark_done: true }
 *
 * Matches project test convention (source-text inspection, no @testing-library).
 * RED state: the refactored JSX/handlers land in Plan 48-03.
 */

import { readFileSync, existsSync } from 'fs';

const SRC = 'src/components/dashboard/SetupChecklist.jsx';
const read = () => readFileSync(SRC, 'utf8');

describe('SetupChecklist', () => {
  it('component file exists (pre-existing from Phase 9)', () => {
    expect(existsSync(SRC)).toBe(true);
  });

  it('renders 4 theme accordions in order profile/voice/calendar/billing', () => {
    const src = read();
    // Expect theme labels + Accordion imports after Plan 48-03 refactor.
    expect(src).toMatch(/Accordion/);
    const profileIdx = src.indexOf('profile');
    const voiceIdx = src.indexOf('voice');
    const calendarIdx = src.indexOf('calendar');
    const billingIdx = src.indexOf('billing');
    expect(profileIdx).toBeGreaterThan(-1);
    expect(voiceIdx).toBeGreaterThan(profileIdx);
    expect(calendarIdx).toBeGreaterThan(voiceIdx);
    expect(billingIdx).toBeGreaterThan(calendarIdx);
  });

  it('Dismiss button fires PATCH /api/setup-checklist with {item_id, dismiss:true}', () => {
    const src = read();
    // After Plan 48-03, the dismiss handler sends item_id + dismiss: true.
    expect(src).toMatch(/dismiss\s*:\s*true/);
    expect(src).toMatch(/item_id/);
  });

  it('Mark done button fires PATCH with {item_id, mark_done:true}', () => {
    const src = read();
    // After Plan 48-03, the mark-done handler sends item_id + mark_done: true.
    expect(src).toMatch(/mark_done\s*:\s*true/);
  });
});
