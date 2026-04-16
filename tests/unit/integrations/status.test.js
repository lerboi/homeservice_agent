import { readFileSync } from 'node:fs';
import { describe, it, expect } from '@jest/globals';

describe('integrations/status.js — cache directive placement', () => {
  it("has 'use cache' as the FIRST statement in getIntegrationStatus body", () => {
    const src = readFileSync('src/lib/integrations/status.js', 'utf8');
    // Match: export async function getIntegrationStatus(...) { <whitespace> 'use cache'
    const re = /export\s+async\s+function\s+getIntegrationStatus\s*\([^)]*\)\s*\{\s*['"]use cache['"]/m;
    expect(re.test(src)).toBe(true);
  });

  it("calls cacheTag with integration-status-<tenantId> pattern", () => {
    const src = readFileSync('src/lib/integrations/status.js', 'utf8');
    expect(src).toMatch(/cacheTag\(`integration-status-\$\{tenantId\}`\)/);
  });
});
