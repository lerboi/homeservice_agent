/**
 * Phase 48 Plan 04 — UsageTile threshold color tests (D-13). GREEN.
 *
 * Covers:
 *   1. Component file exists at src/components/dashboard/UsageTile.jsx.
 *   2. Source-text contains all three threshold Tailwind classes.
 *   3. usageThresholdClass(percent) helper returns correct bar fill + caption tone:
 *        - percent < 75       → bg-[#C2410C] / text-stone-600  (copper / healthy)
 *        - 75 <= percent < 100 → bg-amber-600 / text-amber-700 (warning)
 *        - percent >= 100     → bg-red-700   / text-red-700    (overage)
 *
 * Matches project test convention (source-text + pure-helper assertions).
 */

import { readFileSync, existsSync } from 'fs';
// Helper imported from the .js mirror — UsageTile.jsx inlines the same function
// but cannot be imported into Jest without @babel/preset-react configured.
import { usageThresholdClass } from '../../src/components/dashboard/usage-threshold.js';

const SRC = 'src/components/dashboard/UsageTile.jsx';

describe('UsageTile — source-text surface', () => {
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

  it('exports the usageThresholdClass helper for testability', () => {
    const src = readFileSync(SRC, 'utf8');
    expect(src).toMatch(/export function usageThresholdClass/);
  });

  it('uses tabular-nums for the display fraction', () => {
    const src = readFileSync(SRC, 'utf8');
    expect(src).toMatch(/tabular-nums/);
  });

  it('bar has role="progressbar" with aria wiring', () => {
    const src = readFileSync(SRC, 'utf8');
    expect(src).toMatch(/role="progressbar"/);
    expect(src).toMatch(/aria-valuenow/);
    expect(src).toMatch(/aria-valuemax/);
    expect(src).toMatch(/aria-label="Calls used this cycle"/);
  });

  it('has Manage plan CTA pointing to /dashboard/more/billing', () => {
    const src = readFileSync(SRC, 'utf8');
    expect(src).toMatch(/Manage plan/);
    expect(src).toMatch(/\/dashboard\/more\/billing/);
  });

  it('composes from design-tokens card.base/card.hover (no raw bg-white rounded-2xl)', () => {
    const src = readFileSync(SRC, 'utf8');
    expect(src).toMatch(/design-tokens/);
    expect(src).not.toMatch(/\bbg-white rounded-2xl\b/);
  });

  it('has no dark: variants (Phase 49 owns dark mode)', () => {
    const src = readFileSync(SRC, 'utf8');
    expect(src).not.toMatch(/\bdark:/);
  });
});

describe('usageThresholdClass — pure helper', () => {
  it('returns copper fill + stone-600 tone below 75%', () => {
    const r = usageThresholdClass(0);
    expect(r.fill).toBe('bg-[#C2410C]');
    expect(r.tone).toBe('text-stone-600');

    const r2 = usageThresholdClass(50);
    expect(r2.fill).toBe('bg-[#C2410C]');
    expect(r2.tone).toBe('text-stone-600');

    const r3 = usageThresholdClass(74.9);
    expect(r3.fill).toBe('bg-[#C2410C]');
  });

  it('returns amber-600 fill + amber-700 tone at 75% up to (not including) 100%', () => {
    const r = usageThresholdClass(75);
    expect(r.fill).toBe('bg-amber-600');
    expect(r.tone).toBe('text-amber-700');

    const r2 = usageThresholdClass(80);
    expect(r2.fill).toBe('bg-amber-600');

    const r3 = usageThresholdClass(99.999);
    expect(r3.fill).toBe('bg-amber-600');
  });

  it('returns red-700 fill + red-700 tone at and above 100%', () => {
    const r = usageThresholdClass(100);
    expect(r.fill).toBe('bg-red-700');
    expect(r.tone).toBe('text-red-700');

    const r2 = usageThresholdClass(150);
    expect(r2.fill).toBe('bg-red-700');
    expect(r2.tone).toBe('text-red-700');
  });
});
