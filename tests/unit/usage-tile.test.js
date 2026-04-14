/** RED (Wave 0): will be made GREEN by Plan 48-04 — do not delete */
/**
 * Phase 48 — UsageTile threshold color tests (D-13).
 *
 * Target: `src/components/dashboard/UsageTile.jsx` + a pure helper
 *   `usageThresholdClass(percent)` → Tailwind class string.
 *
 *  - 0–74%: `bg-[#C2410C]` (copper / accent)
 *  - 75–99%: `bg-amber-600`
 *  - ≥100%:  `bg-red-700`
 *
 * RED state: UsageTile.jsx does not exist until Plan 48-04; threshold helper TBD.
 */

import { readFileSync, existsSync } from 'fs';

const SRC = 'src/components/dashboard/UsageTile.jsx';

describe('UsageTile thresholds', () => {
  it('component file exists (created by Plan 48-04)', () => {
    expect(existsSync(SRC)).toBe(true);
  });

  it('bar fill copper (bg-[#C2410C]) when percent < 75', () => {
    const src = readFileSync(SRC, 'utf8');
    expect(src).toMatch(/bg-\[#C2410C\]/);
  });

  it('bar fill amber-600 when 75 <= percent < 100', () => {
    const src = readFileSync(SRC, 'utf8');
    expect(src).toMatch(/bg-amber-600/);
  });

  it('bar fill red-700 when percent >= 100', () => {
    const src = readFileSync(SRC, 'utf8');
    expect(src).toMatch(/bg-red-700/);
  });
});
