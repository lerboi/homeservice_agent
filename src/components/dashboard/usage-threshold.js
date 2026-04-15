/**
 * Pure helper shared by UsageTile.jsx and its unit tests.
 *
 * Extracted into its own .js module so tests/unit/usage-tile.test.js can
 * `import` the helper without pulling Jest through the JSX parser
 * (jest is not configured with @babel/preset-react in this project).
 *
 * Phase 48 Plan 04 — D-13 threshold colors.
 */

/**
 * Derive Tailwind bar-fill + caption-tone classes from a usage percent.
 *
 *   percent < 75        → copper (on-brand "healthy usage")
 *   75 <= percent < 100 → amber  (approaching cap)
 *   percent >= 100      → red    (over cap, show overage)
 *
 * @param {number} percent — 0..Infinity, NOT clamped
 * @returns {{ fill: string, tone: string }}
 */
export function usageThresholdClass(percent) {
  if (percent >= 100) return { fill: 'bg-red-700', tone: 'text-red-700' };
  if (percent >= 75) return { fill: 'bg-amber-600', tone: 'text-amber-700' };
  return { fill: 'bg-[var(--brand-accent)]', tone: 'text-stone-600' };
}
