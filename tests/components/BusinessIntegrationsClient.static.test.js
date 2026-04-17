/**
 * Static-grep tests for BusinessIntegrationsClient (Phase 55 Plan 05).
 * React Testing Library is not configured in this project; render behavior
 * is verified by the user in Task 4's visual UAT checkpoint. These tests
 * enforce the locked copy and the presence of the 3-state handling.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('BusinessIntegrationsClient — locked UI-SPEC copy', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/components/dashboard/BusinessIntegrationsClient.jsx'),
    'utf8',
  );

  it('renders the Reconnect-needed banner copy verbatim', () => {
    expect(source).toContain(
      'Reconnect needed — Xero token expired. Your AI receptionist can',
    );
    expect(source).toContain('until you reconnect.');
  });

  it('renders the Last-synced timestamp prefix', () => {
    expect(source).toContain('Last synced');
    expect(source).toMatch(/formatDistanceToNow\(/);
  });

  it('branches on error_state === token_refresh_failed', () => {
    expect(source).toMatch(/error_state\s*===\s*'token_refresh_failed'/);
  });

  it('renders Reconnect {providerName} button label', () => {
    expect(source).toMatch(/Reconnect \$\{meta\.name\}/);
  });

  it('preserves P54 locked PROVIDER_META copy (disconnect dialog title/body)', () => {
    expect(source).toContain('Disconnect Xero?');
    expect(source).toContain(
      'Your AI receptionist will stop sharing Xero customer history during calls.',
    );
  });

  it('imports AlertTriangle + Alert for the amber banner', () => {
    expect(source).toMatch(/import\s+\{[^}]*AlertTriangle[^}]*\}\s+from\s+'lucide-react'/);
    expect(source).toMatch(/from\s+'@\/components\/ui\/alert'/);
  });
});
