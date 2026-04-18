/**
 * Phase 56 Plan 04 — Static-grep tests for BusinessIntegrationsClient.
 *
 * Mirrors the Phase 55 test pattern (BusinessIntegrationsClient.static.test.js):
 * the project runs Jest in `node` environment without React Testing Library,
 * so behavior is asserted by source-text invariants. Visual UAT is deferred to
 * VALIDATION.md Manual-Only row 2.
 *
 * Covers:
 *  - U1: Xero error banner uses {meta.name} (no hardcoded "Xero")
 *  - U2: Jobber card renders through the same banner code path (shared {meta.name})
 *  - U3/U4/U5: Preferred badge render condition
 *  - U6: PROVIDER_META.jobber still locks "Connect Jobber"
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(process.cwd(), 'src/components/dashboard/BusinessIntegrationsClient.jsx'),
  'utf8',
);

describe('BusinessIntegrationsClient — Phase 56 bug fix + Preferred badge', () => {
  // U1 + U2: the reconnect-needed banner must use {meta.name}, not hardcoded "Xero".
  // Shared code path means the Jobber card will render "Jobber token expired" naturally.
  it('U1/U2: reconnect banner uses {meta.name} interpolation (no hardcoded "Xero")', () => {
    // Must NOT contain the hardcoded "Xero token expired" literal anywhere
    expect(source).not.toMatch(/Xero token expired/);
    expect(source).not.toMatch(/access Xero customer info/);
    // Must contain the provider-dynamic template string using meta.name
    expect(source).toMatch(/\{meta\.name\}\s+token expired/);
    expect(source).toMatch(/access \{meta\.name\} customer info/);
  });

  // U3 + U4 + U5: Preferred badge rendered only when Jobber connected AND Xero row exists
  it('U3: Preferred badge markup present with emerald palette', () => {
    expect(source).toContain('Preferred');
    expect(source).toMatch(/bg-emerald-50 text-emerald-700/);
    expect(source).toMatch(/dark:bg-emerald-950\/40 dark:text-emerald-300/);
    expect(source).toMatch(/text-\[11px\]/);
    expect(source).toMatch(/ml-auto/);
  });

  it('U4: Preferred badge gated on providerKey === "jobber" AND status.xero !== null', () => {
    // Condition must guard on jobber provider + xero row presence + connected + NOT hasError
    expect(source).toMatch(/providerKey === 'jobber'/);
    expect(source).toMatch(/status\.xero\s*!==\s*null/);
  });

  it('U5: Preferred badge hidden on error state (!hasError in condition)', () => {
    // Find the Preferred block and confirm !hasError appears in its render guard
    const preferredIdx = source.indexOf('Preferred');
    expect(preferredIdx).toBeGreaterThan(-1);
    // Look backward ~300 chars for the conditional guard
    const guardWindow = source.slice(Math.max(0, preferredIdx - 400), preferredIdx);
    expect(guardWindow).toMatch(/!hasError/);
    expect(guardWindow).toMatch(/connected/);
  });

  it('U6: PROVIDER_META.jobber.connectLabel locked to "Connect Jobber"', () => {
    expect(source).toContain("connectLabel: 'Connect Jobber'");
  });

  // Bug-fix sanity: the shared banner path still references AlertTriangle + Alert
  it('preserves AlertTriangle + Alert imports for the shared banner', () => {
    expect(source).toMatch(/import\s+\{[^}]*AlertTriangle[^}]*\}\s+from\s+'lucide-react'/);
    expect(source).toMatch(/from\s+'@\/components\/ui\/alert'/);
  });

  // Branching still triggers on error_state for either provider
  it('branches on error_state === "token_refresh_failed" (provider-agnostic)', () => {
    expect(source).toMatch(/error_state\s*===\s*'token_refresh_failed'/);
  });
});
