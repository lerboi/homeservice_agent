// tests/unit/dark-mode-infra.test.js
// Wave 0 grep assertions for layout, globals.css selector, 150ms rule, token declarations
// Node env — no React imports

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../');

describe('layout.js infra assertions', () => {
  const layoutContent = fs.readFileSync(path.join(ROOT, 'src/app/layout.js'), 'utf8');

  it('contains suppressHydrationWarning', () => {
    expect(layoutContent).toMatch(/suppressHydrationWarning/);
  });

  it('contains ThemeProvider', () => {
    expect(layoutContent).toMatch(/ThemeProvider/);
  });

  it('does NOT contain disableTransitionOnChange', () => {
    expect(layoutContent).not.toMatch(/disableTransitionOnChange/);
  });
});

describe('globals.css infra assertions', () => {
  const cssContent = fs.readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf8');

  it('uses fixed @custom-variant dark selector (:where)', () => {
    expect(cssContent).toMatch(/@custom-variant dark \(&:where\(\.dark, \.dark \*\)\)/);
  });

  it('contains 150ms transition inside prefers-reduced-motion block', () => {
    // Multiline match: prefers-reduced-motion block that contains 150ms
    const pmBlock = cssContent.match(/@media\s*\(prefers-reduced-motion:\s*no-preference\)[^}]*\{[\s\S]*?(?=@media|\z)/g);
    // Check the string as a whole for 150ms after prefers-reduced-motion
    const hasReduced = /prefers-reduced-motion/.test(cssContent);
    const has150ms = /150ms/.test(cssContent);
    expect(hasReduced).toBe(true);
    expect(has150ms).toBe(true);
    // Verify 150ms appears near prefers-reduced-motion (within 500 chars)
    const reducedIdx = cssContent.indexOf('prefers-reduced-motion: no-preference');
    // Find the last occurrence (the body transition block)
    const lastReducedIdx = cssContent.lastIndexOf('prefers-reduced-motion: no-preference');
    const nearby = cssContent.slice(lastReducedIdx, lastReducedIdx + 300);
    expect(nearby).toMatch(/150ms/);
  });

  it('declares --brand-accent in :root and .dark (at least 2 occurrences)', () => {
    const matches = cssContent.match(/--brand-accent:/g);
    expect(matches).not.toBeNull();
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
