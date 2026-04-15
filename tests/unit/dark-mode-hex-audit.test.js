// tests/unit/dark-mode-hex-audit.test.js
// Wave 0 grep assertion: zero disallowed hex in dashboard trees
// (excludes Phase 50 files + sidebar navy intentional exception)
// Node env — no React imports

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../');

// Files excluded from the hex audit (intentional or deferred-to-later-phase)
const EXCLUDED_BASENAMES = new Set(['AnalyticsCharts.jsx', 'CalendarView.js', 'DashboardSidebar.jsx']);

// Disallowed hex patterns (the 5 hardcoded tokens being migrated)
const DISALLOWED_HEX = /#(C2410C|9A3412|F5F5F4|0F172A|475569)\b/i;

/**
 * Recursively collect all .js and .jsx files under a directory.
 */
function collectFiles(dir, collected = []) {
  if (!fs.existsSync(dir)) return collected;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, collected);
    } else if (entry.isFile() && /\.(js|jsx)$/.test(entry.name)) {
      collected.push(fullPath);
    }
  }
  return collected;
}

describe('dashboard hex audit', () => {
  const dashboardAppFiles = collectFiles(path.join(ROOT, 'src/app/dashboard'));
  const dashboardComponentFiles = collectFiles(path.join(ROOT, 'src/components/dashboard'));

  const allFiles = [...dashboardAppFiles, ...dashboardComponentFiles].filter(
    (f) => !EXCLUDED_BASENAMES.has(path.basename(f))
  );

  it('has no disallowed hex literals in dashboard app or component files', () => {
    const collectedMatches = [];
    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (DISALLOWED_HEX.test(lines[i])) {
          collectedMatches.push({ file: path.relative(ROOT, file), line: i + 1, text: lines[i].trim() });
        }
      }
    }
    if (collectedMatches.length > 0) {
      const detail = collectedMatches.map((m) => `  ${m.file}:${m.line} — ${m.text}`).join('\n');
      throw new Error(`Found disallowed hex literals in ${collectedMatches.length} location(s):\n${detail}`);
    }
    expect(collectedMatches.length).toBe(0);
  });
});

describe('design-tokens.js hex audit', () => {
  it('design-tokens.js contains no text-[# or bg-[# literals', () => {
    const tokensContent = fs.readFileSync(path.join(ROOT, 'src/lib/design-tokens.js'), 'utf8');
    const hasTextHex = tokensContent.includes('text-[#');
    const hasBgHex = tokensContent.includes('bg-[#');
    if (hasTextHex || hasBgHex) {
      const violations = [];
      if (hasTextHex) violations.push('text-[#');
      if (hasBgHex) violations.push('bg-[#');
      throw new Error(`design-tokens.js still has hex literals: ${violations.join(', ')}`);
    }
    expect(hasTextHex).toBe(false);
    expect(hasBgHex).toBe(false);
  });
});
