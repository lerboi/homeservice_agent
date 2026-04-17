/**
 * Static-grep test asserting 'use cache' directive placement and two-tier
 * cacheTag strings in XeroAdapter.fetchCustomerByPhone.
 *
 * Why static grep: Next.js 'use cache' is a compile-time directive; at runtime
 * in a unit-test env it's a no-op string literal. The only way to enforce
 * placement (must be FIRST statement) and tag correctness is to parse source.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe("fetchXeroCustomerByPhone cache directive", () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/lib/integrations/xero.js'),
    'utf8',
  );

  it("'use cache' is the first statement inside fetchXeroCustomerByPhone (module-level function — Next.js 16 forbids the directive on class methods)", () => {
    const fnMatch = source.match(
      /export\s+async\s+function\s+fetchXeroCustomerByPhone\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*(?:cacheTag|const|let|var|return|await|if|try|throw)/,
    );
    expect(fnMatch).toBeTruthy();
    const head = fnMatch[1].trim();
    expect(
      head.startsWith("'use cache'") || head.startsWith('"use cache"'),
    ).toBe(true);
  });

  it('uses two-tier cacheTag (broad + specific)', () => {
    expect(source).toMatch(/cacheTag\(`xero-context-\$\{tenantId\}`\)/);
    expect(source).toMatch(
      /cacheTag\(`xero-context-\$\{tenantId\}-\$\{phoneE164\}`\)/,
    );
  });
});
