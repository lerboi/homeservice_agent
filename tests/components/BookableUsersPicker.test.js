/**
 * Phase 57 Plan 04 — BookableUsersPicker tests.
 *
 * Two layers (project does NOT configure React Testing Library — see
 * BusinessIntegrationsClient.static.test.js precedent):
 *   1. Pure-function tests for the pre-select heuristic (computeDefaultSelected)
 *      — exhaustive coverage of D-03 behavior without a DOM.
 *   2. Static-grep tests assert the UI-SPEC §5 locked copy and accessibility
 *      structure are present in the source file.
 */

import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeDefaultSelected } from '@/components/dashboard/BookableUsersPicker.helpers';

const SOURCE = readFileSync(
  resolve(process.cwd(), 'src/components/dashboard/BookableUsersPicker.jsx'),
  'utf8',
);

describe('computeDefaultSelected — pre-select heuristic (D-03)', () => {
  test('1. with hasRecentActivity flags: only active users pre-selected', () => {
    const set = computeDefaultSelected(
      [
        { id: 'u1', name: 'Alice', hasRecentActivity: true },
        { id: 'u2', name: 'Bob', hasRecentActivity: true },
        { id: 'u3', name: 'Carol', hasRecentActivity: false },
      ],
      null,
    );
    expect(Array.from(set).sort()).toEqual(['u1', 'u2']);
  });

  test('2. zero recent activity → ALL users pre-selected (D-03 fallback)', () => {
    const set = computeDefaultSelected(
      [
        { id: 'u1', name: 'A', hasRecentActivity: false },
        { id: 'u2', name: 'B', hasRecentActivity: false },
        { id: 'u3', name: 'C', hasRecentActivity: false },
      ],
      null,
    );
    expect(Array.from(set).sort()).toEqual(['u1', 'u2', 'u3']);
  });

  test('3. initialSelected array overrides heuristic (already-saved set)', () => {
    const set = computeDefaultSelected(
      [
        { id: 'u1', name: 'A', hasRecentActivity: true },
        { id: 'u2', name: 'B', hasRecentActivity: true },
      ],
      ['u1'],
    );
    expect(Array.from(set)).toEqual(['u1']);
  });

  test('4. initialSelected = empty array → empty set (explicit clear)', () => {
    const set = computeDefaultSelected(
      [{ id: 'u1', name: 'A', hasRecentActivity: true }],
      [],
    );
    expect(set.size).toBe(0);
  });

  test('5. empty users array + null initialSelected → empty set (no crash)', () => {
    const set = computeDefaultSelected([], null);
    expect(set.size).toBe(0);
  });
});

describe('BookableUsersPicker source — UI-SPEC §5 locked copy', () => {
  test('renders the heading: "Who should Voco mirror from Jobber?"', () => {
    expect(SOURCE).toContain('Who should Voco mirror from Jobber?');
  });

  test('renders the subtext: "Voco will block slots for visits assigned to these team members."', () => {
    expect(SOURCE).toContain('Voco will block slots for visits assigned to these team members.');
  });

  test('renders the save button label: "Save team members"', () => {
    expect(SOURCE).toContain('Save team members');
  });

  test('renders the zero-recent footnote verbatim', () => {
    expect(SOURCE).toContain('No recent visits found — all members selected. Deselect office or admin accounts.');
  });

  test('renders the resync footnote', () => {
    expect(SOURCE).toContain('Changing this set triggers a re-sync of your Jobber schedule.');
  });

  test('renders the empty state: "No team members found in Jobber."', () => {
    expect(SOURCE).toContain('No team members found in Jobber.');
  });

  test('renders the "Active" badge label', () => {
    expect(SOURCE).toContain('>\n                Active\n              </span>');
  });

  test('renders the success toast: "Team members updated."', () => {
    expect(SOURCE).toContain('Team members updated.');
  });

  test('renders the error toast: "Couldn\'t save — please try again."', () => {
    expect(SOURCE).toContain("Couldn't save — please try again.");
  });

  test('uses fieldset + legend for accessibility (UI-SPEC §6)', () => {
    expect(SOURCE).toMatch(/<fieldset>/);
    expect(SOURCE).toMatch(/<legend/);
  });

  test('PATCHes /api/integrations/jobber/bookable-users with userIds array', () => {
    expect(SOURCE).toContain("'/api/integrations/jobber/bookable-users'");
    expect(SOURCE).toContain("method: 'PATCH'");
    expect(SOURCE).toContain('userIds: Array.from(selected)');
  });
});

describe('JobberSetupPage source — solo auto-skip (D-02)', () => {
  const SETUP = readFileSync(
    resolve(process.cwd(), 'src/app/dashboard/integrations/jobber/setup/page.js'),
    'utf8',
  );

  test('server-side solo auto-skip branches on users.length === 1', () => {
    expect(SETUP).toMatch(/if\s*\(\s*users\.length\s*===\s*1\s*\)/);
  });

  test('solo branch redirects to /dashboard/more/integrations?jobber=connected', () => {
    expect(SETUP).toContain('/dashboard/more/integrations?jobber=connected');
  });

  test('solo branch writes the single user id and triggers rebuildJobberMirror', () => {
    expect(SETUP).toMatch(/jobber_bookable_user_ids:\s*\[users\[0\]\.id\]/);
    expect(SETUP).toContain('rebuildJobberMirror');
  });

  test('renders BookableUsersPicker for multi-user accounts', () => {
    expect(SETUP).toContain('<BookableUsersPicker');
    expect(SETUP).toContain('initialSelected={cred.jobber_bookable_user_ids}');
  });

  test('redirects unauthenticated to /auth/signin', () => {
    expect(SETUP).toContain("redirect('/auth/signin')");
  });
});
