/** RED (Wave 0): will be made GREEN by Plan 48-05 — do not delete */
/**
 * Phase 48 — HelpDiscoverabilityCard component tests (HOME-06 / D-14 / D-15).
 *
 * Target: `src/components/dashboard/HelpDiscoverabilityCard.jsx`
 *  - Renders 3 to 4 tiles, each with a Link whose href is a `/dashboard` route
 *  - Tile labels follow verb+noun sentence-case pattern per UI-SPEC Copywriting Contract
 *
 * RED state: HelpDiscoverabilityCard.jsx does not exist until Plan 48-05.
 */

import { readFileSync, existsSync } from 'fs';

const SRC = 'src/components/dashboard/HelpDiscoverabilityCard.jsx';
const read = () => readFileSync(SRC, 'utf8');

describe('HelpDiscoverabilityCard', () => {
  it('file exists (created by Plan 48-05)', () => {
    expect(existsSync(SRC)).toBe(true);
  });

  it('renders 3 to 4 tiles each with a Link whose href is a /dashboard route', () => {
    const src = read();
    // Count href values pointing at /dashboard* routes — tile count target is 3-4.
    const hrefs = src.match(/href\s*=\s*["']\/dashboard[^"']*["']/g) || [];
    expect(hrefs.length).toBeGreaterThanOrEqual(3);
    expect(hrefs.length).toBeLessThanOrEqual(4);
  });

  it('tile labels match verb+noun sentence-case pattern', () => {
    const src = read();
    // Strong candidates per UI-SPEC Copywriting Contract (D-15):
    //   Add a service | Change AI voice | Invite teammate | View invoices |
    //   Set escalation contacts | Connect calendar
    const LABEL_PATTERNS = [
      /Add a service/i,
      /Change (AI )?voice/i,
      /Invite teammate/i,
      /View invoices/i,
      /Set escalation/i,
      /Connect calendar/i,
    ];
    const matchCount = LABEL_PATTERNS.filter((re) => re.test(src)).length;
    // Between 3 and 4 of the canonical labels must appear (planner picks 3–4 per D-15).
    expect(matchCount).toBeGreaterThanOrEqual(3);
    expect(matchCount).toBeLessThanOrEqual(4);
  });
});
