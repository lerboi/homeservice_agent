/**
 * Static-grep test asserting 'use cache' directive placement, two-tier
 * cacheTag strings, and X-JOBBER-GRAPHQL-VERSION header presence in
 * fetchJobberCustomerByPhone (Phase 56 Plan 01).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('fetchJobberCustomerByPhone cache directive', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/lib/integrations/jobber.js'),
    'utf8',
  );

  it("C1: 'use cache' is the FIRST statement inside fetchJobberCustomerByPhone (module-level fn, not class method)", () => {
    const fnMatch = source.match(
      /export\s+async\s+function\s+fetchJobberCustomerByPhone\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*(?:cacheTag|const|let|var|return|await|if|try|throw)/,
    );
    expect(fnMatch).toBeTruthy();
    const head = fnMatch[1].trim();
    expect(
      head.startsWith("'use cache'") || head.startsWith('"use cache"'),
    ).toBe(true);
  });

  it('C2: two-tier cacheTag — broad + specific', () => {
    expect(source).toMatch(/cacheTag\(`jobber-context-\$\{tenantId\}`\)/);
    expect(source).toMatch(/cacheTag\(`jobber-context-\$\{tenantId\}-\$\{phoneE164\}`\)/);
  });

  it('C3: X-JOBBER-GRAPHQL-VERSION header is set (Pitfall 7)', () => {
    expect(source).toMatch(/X-JOBBER-GRAPHQL-VERSION/);
  });
});
