import { describe, test, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { calculateAvailableSlots } from '@/lib/scheduling/slot-calculator.js';

/**
 * JOBSCHED-02: provider-agnostic slot query MUST occlude slots covered by
 * calendar_events rows regardless of provider value. Phase 57 adds 'jobber' to
 * the allowed provider set; this test verifies the slot calculator already
 * treats jobber externalBlocks identically to google/outlook (no code change
 * needed in slot-calculator.js — the contract is provider-agnostic by design).
 *
 * Also verifies — by file inspection — that
 * src/app/api/appointments/available-slots/route.js does NOT add a
 * .eq('provider', ...) filter on the calendar_events select. If a future change
 * accidentally narrows that select, this test fires.
 */

const TARGET_DATE = '2026-04-13'; // Monday
const CHICAGO_TZ = 'America/Chicago';

const WORKING_HOURS = {
  monday:    { open: '09:00', close: '17:00', enabled: true,  lunchStart: null, lunchEnd: null },
  tuesday:   { open: '09:00', close: '17:00', enabled: true,  lunchStart: null, lunchEnd: null },
  wednesday: { open: '09:00', close: '17:00', enabled: true,  lunchStart: null, lunchEnd: null },
  thursday:  { open: '09:00', close: '17:00', enabled: true,  lunchStart: null, lunchEnd: null },
  friday:    { open: '09:00', close: '17:00', enabled: true,  lunchStart: null, lunchEnd: null },
  saturday:  { open: '09:00', close: '17:00', enabled: false, lunchStart: null, lunchEnd: null },
  sunday:    { open: '09:00', close: '17:00', enabled: false, lunchStart: null, lunchEnd: null },
};

const BASE_PARAMS = {
  workingHours: WORKING_HOURS,
  slotDurationMins: 60,
  existingBookings: [],
  zones: [],
  zonePairBuffers: [],
  targetDate: TARGET_DATE,
  tenantTimezone: CHICAGO_TZ,
  maxSlots: 50,
};

// 10:00 CDT = 15:00 UTC, 11:00 CDT = 16:00 UTC.
const TEN_AM_CDT_UTC = '2026-04-13T15:00:00.000Z';
const ELEVEN_AM_CDT_UTC = '2026-04-13T16:00:00.000Z';

describe('calculateAvailableSlots — provider-agnostic externalBlocks (JOBSCHED-02)', () => {
  test('control: with NO externalBlocks, the 10am slot is offered', () => {
    const slots = calculateAvailableSlots({ ...BASE_PARAMS, externalBlocks: [] });
    const has10am = slots.some((s) => s.start === TEN_AM_CDT_UTC);
    expect(has10am).toBe(true);
  });

  test('a calendar_events row sourced from Jobber occludes the 10am slot', () => {
    // Simulates a row that was inserted by applyJobberVisit with provider='jobber'.
    // The route at src/app/api/appointments/available-slots/route.js does a
    // provider-agnostic select on calendar_events, so jobber rows reach
    // externalBlocks alongside google/outlook rows.
    const jobberBlock = { start_time: TEN_AM_CDT_UTC, end_time: ELEVEN_AM_CDT_UTC };
    const slots = calculateAvailableSlots({ ...BASE_PARAMS, externalBlocks: [jobberBlock] });
    const has10am = slots.some((s) => s.start === TEN_AM_CDT_UTC);
    expect(has10am).toBe(false);
  });

  test('a google-sourced calendar_events row occludes the same slot (no regression)', () => {
    const googleBlock = { start_time: TEN_AM_CDT_UTC, end_time: ELEVEN_AM_CDT_UTC };
    const slots = calculateAvailableSlots({ ...BASE_PARAMS, externalBlocks: [googleBlock] });
    expect(slots.some((s) => s.start === TEN_AM_CDT_UTC)).toBe(false);
  });
});

describe('available-slots route — calendar_events select stays provider-agnostic', () => {
  test('route does NOT narrow the calendar_events select with .eq("provider", ...)', () => {
    const routePath = path.join(
      process.cwd(),
      'src',
      'app',
      'api',
      'appointments',
      'available-slots',
      'route.js',
    );
    const src = fs.readFileSync(routePath, 'utf8');

    // Find the calendar_events block and confirm no provider filter is applied
    // in the same select chain. We approximate by asserting the file contains
    // the from('calendar_events') call and does NOT contain .eq('provider'
    // anywhere in the file (the route currently has zero provider filters).
    expect(src).toContain(".from('calendar_events')");
    expect(src).not.toMatch(/\.eq\(\s*['"]provider['"]/);
  });
});
