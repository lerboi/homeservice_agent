/**
 * Phase 56 Plan 04 — Static-grep tests for /dashboard/more/integrations/page.js.
 *
 * The page delegates to `getIntegrationStatus(tenantId)` (from
 * src/lib/integrations/status.js) which returns `{ xero, jobber }` — both rows
 * with `error_state` included. This test asserts the page passes that shape
 * through to BusinessIntegrationsClient's `initialStatus` prop.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(process.cwd(), 'src/app/dashboard/more/integrations/page.js'),
  'utf8',
);

const statusLibSource = readFileSync(
  resolve(process.cwd(), 'src/lib/integrations/status.js'),
  'utf8',
);

describe('IntegrationsPage — initialStatus contract', () => {
  // PG1: server component fetches both Xero AND Jobber rows
  it('PG1a: delegates to getIntegrationStatus which returns both providers', () => {
    expect(source).toMatch(/getIntegrationStatus/);
    // The status lib must select error_state + last_context_fetch_at + dispatch both providers
    expect(statusLibSource).toMatch(/error_state/);
    expect(statusLibSource).toMatch(/last_context_fetch_at/);
    expect(statusLibSource).toMatch(/xero:/);
    expect(statusLibSource).toMatch(/jobber:/);
    expect(statusLibSource).toMatch(/provider === 'xero'/);
    expect(statusLibSource).toMatch(/provider === 'jobber'/);
  });

  it('PG1b: passes initialStatus prop to BusinessIntegrationsClient', () => {
    expect(source).toMatch(/BusinessIntegrationsClient/);
    expect(source).toMatch(/initialStatus=\{initialStatus\}/);
  });
});
