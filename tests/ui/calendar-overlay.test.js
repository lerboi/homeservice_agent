/**
 * Phase 57 Plan 05 — calendar overlay retrofit verification.
 *
 * Static-grep tests against CalendarView.js (project does not configure RTL —
 * see BusinessIntegrationsClient.static.test.js precedent). The 6-pillar visual
 * audit happens in the human-verify checkpoint (Task 4).
 */

import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CALENDAR_VIEW = readFileSync(
  resolve(process.cwd(), 'src/components/dashboard/CalendarView.js'),
  'utf8',
);
const APPOINTMENTS_ROUTE = readFileSync(
  resolve(process.cwd(), 'src/app/api/appointments/route.js'),
  'utf8',
);
const CONNECTION_STATUS = readFileSync(
  resolve(process.cwd(), 'src/app/api/integrations/jobber/connection-status/route.js'),
  'utf8',
);

describe('ExternalEventBlock — unified muted slate + provider pill', () => {
  test('1. provider label map includes all three providers', () => {
    expect(CALENDAR_VIEW).toMatch(/jobber:\s*['"]From Jobber['"]/);
    expect(CALENDAR_VIEW).toMatch(/google:\s*['"]From Google['"]/);
    expect(CALENDAR_VIEW).toMatch(/outlook:\s*['"]From Outlook['"]/);
  });

  test('2. surface uses bg-slate-50 (muted), NOT bg-violet-50 (old)', () => {
    expect(CALENDAR_VIEW).toContain('bg-slate-50');
    // Verify the old hardcoded violet treatment is gone from ExternalEventBlock body
    const externalBlockSection = CALENDAR_VIEW.split('function ExternalEventBlock')[1].split('function ')[0];
    expect(externalBlockSection).not.toMatch(/bg-violet-50/);
  });

  test('3. Jobber click handler opens secure.getjobber.com/calendar?date=', () => {
    expect(CALENDAR_VIEW).toContain('secure.getjobber.com/calendar?date=');
    expect(CALENDAR_VIEW).toMatch(/window\.open\([^)]*url[^)]*'_blank'/);
  });

  test('4. Jobber click EARLY-RETURNS so onClick (which opens the Voco flyout) does not fire', () => {
    const externalBlockSection = CALENDAR_VIEW.split('function ExternalEventBlock')[1].split('function ')[0];
    // Inside the jobber branch, the handler must return before reaching onClick?.(event)
    expect(externalBlockSection).toMatch(/event\.provider === ['"]jobber['"][\s\S]*?return;[\s\S]*?onClick\?\.\(event\)/);
  });

  test('5. provider pill class map carries Jobber brand emerald (#1B9F4F)', () => {
    expect(CALENDAR_VIEW).toContain('#1B9F4F');
  });

  test('6. AppointmentBlock accepts jobberConnected prop with default false', () => {
    expect(CALENDAR_VIEW).toMatch(/function AppointmentBlock\([^)]*jobberConnected = false/);
  });

  test('7. "Not in Jobber" pill renders only when jobberConnected && !appointment.jobber_visit_id', () => {
    expect(CALENDAR_VIEW).toContain('Not in Jobber');
    expect(CALENDAR_VIEW).toMatch(/jobberConnected && !appointment\.jobber_visit_id/);
  });

  test('8. CalendarView default-export accepts jobberConnected prop and threads it to AppointmentBlock', () => {
    expect(CALENDAR_VIEW).toMatch(/export default function CalendarView\([\s\S]*?jobberConnected = false[\s\S]*?\) \{/);
    expect(CALENDAR_VIEW).toMatch(/<AppointmentBlock[\s\S]*?jobberConnected=\{jobberConnected\}/);
  });
});

describe('appointments API — surfaces jobber_visit_id', () => {
  test('GET select list includes jobber_visit_id', () => {
    expect(APPOINTMENTS_ROUTE).toMatch(/jobber_visit_id/);
  });
});

describe('connection-status route — JSON-shaped GET', () => {
  test('exports GET that returns {connected: boolean}', () => {
    expect(CONNECTION_STATUS).toMatch(/export async function GET\(/);
    expect(CONNECTION_STATUS).toContain("provider', 'jobber'");
    expect(CONNECTION_STATUS).toContain('connected:');
  });

  test('uses getTenantId from project auth helper', () => {
    expect(CONNECTION_STATUS).toContain('@/lib/get-tenant-id');
  });
});
