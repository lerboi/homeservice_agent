/**
 * Phase 57 Plan 05 — CopyToJobberSection + AppointmentFlyout integration.
 *
 * Pure-function tests for buildJobberPasteBlock + static-grep for UI-SPEC §3 copy.
 * Visual rendering covered by Task 4 human-verify checkpoint.
 */

import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildJobberPasteBlock } from '@/components/dashboard/CopyToJobberSection.helpers';

const COPY_SOURCE = readFileSync(
  resolve(process.cwd(), 'src/components/dashboard/CopyToJobberSection.jsx'),
  'utf8',
);
const FLYOUT = readFileSync(
  resolve(process.cwd(), 'src/components/dashboard/AppointmentFlyout.js'),
  'utf8',
);

describe('buildJobberPasteBlock — pasteable text', () => {
  const appt = {
    caller_name: 'Jane Doe',
    caller_phone: '+1 555-867-5309',
    service_address: '123 Main St',
    start_time: '2026-05-01T14:00:00.000Z',
    end_time: '2026-05-01T15:00:00.000Z',
    notes: 'Backflow check',
  };

  test('1. block contains all six labelled lines', () => {
    const text = buildJobberPasteBlock(appt);
    expect(text).toMatch(/^Client: Jane Doe$/m);
    expect(text).toMatch(/^Phone: \+1 555-867-5309$/m);
    expect(text).toMatch(/^Address: 123 Main St$/m);
    expect(text).toMatch(/^Start: /m);
    expect(text).toMatch(/^Duration: 60 min$/m);
    expect(text).toMatch(/^Notes: Backflow check$/m);
  });

  test('2. missing fields fall back to em-dash', () => {
    const text = buildJobberPasteBlock({ start_time: null, end_time: null });
    expect(text).toMatch(/^Client: —$/m);
    expect(text).toMatch(/^Phone: —$/m);
    expect(text).toMatch(/^Notes: —$/m);
  });

  test('3. null appointment returns empty string (no crash)', () => {
    expect(buildJobberPasteBlock(null)).toBe('');
  });

  test('4. duration handles invalid times gracefully', () => {
    const text = buildJobberPasteBlock({ ...appt, end_time: 'garbage' });
    expect(text).toMatch(/^Duration: — min$/m);
  });
});

describe('CopyToJobberSection source — UI-SPEC §3 locked copy', () => {
  test('renders heading "Copy to Jobber"', () => {
    expect(COPY_SOURCE).toContain('Copy to Jobber');
  });
  test('renders subtext "Paste into a new Jobber visit"', () => {
    expect(COPY_SOURCE).toContain('Paste into a new Jobber visit');
  });
  test('renders button label "Copy details"', () => {
    expect(COPY_SOURCE).toContain('Copy details');
  });
  test('renders link label "Open in Jobber"', () => {
    expect(COPY_SOURCE).toContain('Open in Jobber');
  });
  test('renders success toast "Copied to clipboard"', () => {
    expect(COPY_SOURCE).toContain('Copied to clipboard');
  });
  test('renders error toast verbatim', () => {
    expect(COPY_SOURCE).toContain("Couldn't copy — try manually selecting the text");
  });
  test('Open in Jobber link points at secure.getjobber.com/work_orders/new', () => {
    expect(COPY_SOURCE).toContain('https://secure.getjobber.com/work_orders/new');
  });
  test('Copy button has min-h-[44px] tap target', () => {
    expect(COPY_SOURCE).toContain('min-h-[44px]');
  });
  test('returns null when jobberConnected is false', () => {
    expect(COPY_SOURCE).toMatch(/if \(!jobberConnected[^)]*\) return null/);
  });
});

describe('AppointmentFlyout — Phase 57 integration', () => {
  test('imports CopyToJobberSection', () => {
    expect(FLYOUT).toContain('CopyToJobberSection');
  });
  test('accepts jobberConnected prop with default false', () => {
    expect(FLYOUT).toMatch(/jobberConnected = false/);
  });
  test('renders "Not in Jobber yet" pill conditionally', () => {
    expect(FLYOUT).toContain('Not in Jobber yet');
    expect(FLYOUT).toMatch(/jobberConnected && !appointment\.jobber_visit_id/);
  });
  test('renders <CopyToJobberSection ... jobberConnected={jobberConnected} />', () => {
    expect(FLYOUT).toMatch(/<CopyToJobberSection[\s\S]*?jobberConnected=\{jobberConnected\}/);
  });
});
